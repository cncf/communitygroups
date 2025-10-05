/**
 * Git Commit Data Collector
 * Extracts data from the latest commit for git hook processing
 */

import { execSync } from 'child_process';
import { redactSensitiveData } from '../generators/filters/sensitive-data-filter.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../telemetry/standards.js';
import { createNarrativeLogger } from '../utils/trace-logger.js';

// Get tracer instance for Git collector instrumentation
const tracer = trace.getTracer('commit-story-git-collector', '1.0.0');

/**
 * Get data for the specified commit (defaults to HEAD)
 * This is called by the git post-commit hook or test harness
 * @param {string} commitRef - Git commit reference (HEAD, HEAD~1, hash, etc.)
 * @returns {Object|null} Commit data or null if error
 */
export function getLatestCommitData(commitRef = 'HEAD') {
  return tracer.startActiveSpan(OTEL.span.collectors.git(), {
    attributes: {
      [`${OTEL.NAMESPACE}.collector.commit_ref`]: commitRef,
      'code.function': 'getLatestCommitData'
    }
  }, (span) => {
    const logger = createNarrativeLogger('git.collect_data');

    try {
      logger.start('git data collection', `Collecting git data for commit: ${commitRef}`);

      // Get commit metadata: hash|author_name|author_email|timestamp|subject
      const metadataOutput = execSync(`git show --format=format:"%H|%an|%ae|%at|%s" --no-patch ${commitRef}`, { encoding: 'utf8' }).trim();

      // Parse metadata - handle potential issues with pipe characters in commit message
      const parts = metadataOutput.split('|');
      const hash = parts[0];
      const authorName = parts[1];
      const authorEmail = parts[2];
      const timestamp = parts[3];
      const rawMessage = parts.slice(4).join('|'); // Rejoin in case message contains pipes

      logger.progress('git data collection', `Parsed commit metadata: ${hash.slice(0, 8)} by ${authorName}`);

      const message = redactSensitiveData(rawMessage);
      const messageWasRedacted = message.includes('[REDACTED]');

      if (messageWasRedacted) {
        logger.progress('git data collection', 'Redacted sensitive data from commit message');
      }

      // Get full diff content for the specified commit
      logger.progress('git data collection', `Retrieving diff with git diff-tree for ${commitRef}`);
      const diff = execSync(`git diff-tree -p ${commitRef}`, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer

      const diffLines = diff.split('\n').length;
      const diffSizeKB = Math.round(diff.length / 1024);

      logger.progress('git data collection', `Retrieved diff: ${diffLines} lines, ${diffSizeKB}KB`);

      const commitData = {
        hash,
        message,
        author: {
          name: '[REDACTED_NAME]',
          email: '[REDACTED_EMAIL]'
        },
        timestamp: new Date(parseInt(timestamp) * 1000),
        diff
      };

      // Add commit attributes using OTEL builder
      const commitAttrs = OTEL.attrs.commit(commitData);
      span.setAttributes(commitAttrs);

      // Also emit commit attributes as metrics for statistical analysis
      Object.entries(commitAttrs).forEach(([name, value]) => {
        if (typeof value === 'number' || typeof value === 'boolean') {
          OTEL.metrics.gauge(name, typeof value === 'boolean' ? (value ? 1 : 0) : value);
        }
      });

      // Add git-specific collection metrics
      const collectorMetrics = {
        [`${OTEL.NAMESPACE}.collector.diff_size_chars`]: diff.length,
        [`${OTEL.NAMESPACE}.collector.diff_size_lines`]: diff.split('\n').length,
        [`${OTEL.NAMESPACE}.collector.message_redacted`]: message.includes('[REDACTED]') ? 1 : 0
      };

      span.setAttributes(collectorMetrics);

      // Emit collector metrics as queryable metrics
      Object.entries(collectorMetrics).forEach(([name, value]) => {
        OTEL.metrics.gauge(name, value);
      });

      logger.complete('git data collection', `Git data collected successfully: ${hash.slice(0, 8)}`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Git commit data collected successfully' });
      return commitData;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      logger.error('git data collection', 'Git command failed', error, {
        commitRef,
        command: error.cmd || 'unknown'
      });
      return null;
    } finally {
      span.end();
    }
  });
}