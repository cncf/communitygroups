/**
 * Commit Content Analyzer Utility
 *
 * Analyzes git diffs to categorize changed files as documentation vs functional code.
 * Used by generators to conditionally adjust prompts based on commit content.
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../../telemetry/standards.js';
import { createNarrativeLogger } from '../../utils/trace-logger.js';

const tracer = trace.getTracer('commit-story', '1.0.0');

/**
 * Analyzes a git diff to categorize changed files
 *
 * @param {string} diff - Git diff output
 * @returns {Object} Analysis results
 * @returns {string[]} return.changedFiles - All changed file paths
 * @returns {string[]} return.docFiles - Documentation files (.md, .txt, README, CHANGELOG)
 * @returns {string[]} return.functionalFiles - Non-documentation files (actual code)
 * @returns {boolean} return.hasFunctionalCode - True if any functional files changed
 * @returns {boolean} return.hasOnlyDocs - True if only documentation files changed
 */
export function analyzeCommitContent(diff) {
  return tracer.startActiveSpan(OTEL.span.utils.commitContentAnalyzer(), (span) => {
    const logger = createNarrativeLogger('utils.commit_content_analysis');

    try {
      logger.start('commit content analysis', `Analyzing git diff to categorize ${diff.length} characters of changes`);

      const diffLines = diff.split('\n');
      const changedFiles = diffLines
        .filter(line => line.startsWith('diff --git'))
        .map(line => line.match(/diff --git a\/(.+) b\/.+/)?.[1])
        .filter(Boolean);

      logger.progress('commit content analysis', `Found ${changedFiles.length} changed files in diff`);

      // Documentation files: .md, .txt, README, CHANGELOG
      const docFiles = changedFiles.filter(file =>
        file.endsWith('.md') || file.endsWith('.txt') ||
        file.includes('README') || file.includes('CHANGELOG')
      );

      const functionalFiles = changedFiles.filter(file => !docFiles.includes(file));

      const hasFunctionalCode = functionalFiles.length > 0;
      const hasOnlyDocs = changedFiles.length > 0 && functionalFiles.length === 0;

      // Determine commit type for logging
      let commitType;
      if (hasFunctionalCode && docFiles.length > 0) {
        commitType = 'mixed (code + docs)';
      } else if (hasFunctionalCode) {
        commitType = 'code only';
      } else if (hasOnlyDocs) {
        commitType = 'documentation only';
      } else {
        commitType = 'empty';
      }

      logger.progress('commit content analysis', `Categorized as ${commitType}: ${functionalFiles.length} functional, ${docFiles.length} documentation`);

      const result = {
        changedFiles,
        docFiles,
        functionalFiles,
        hasFunctionalCode,
        hasOnlyDocs
      };

      // Add telemetry attributes using OTEL builder
      const attrs = {
        'code.function': 'analyzeCommitContent',
        ...OTEL.attrs.files({
          total: changedFiles.length,
          documentation: docFiles.length,
          functional: functionalFiles.length,
          hasFunctionalCode,
          onlyDocumentation: hasOnlyDocs
        })
      };

      span.setAttributes(attrs);

      // Emit metrics for file analysis (dual emission pattern)
      Object.entries(attrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        } else if (typeof value === 'boolean') {
          OTEL.metrics.gauge(name, value ? 1 : 0);
        }
      });

      logger.complete('commit content analysis', `Analysis complete: ${commitType} with ${changedFiles.length} total files`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Commit content analyzed successfully' });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Commit content analysis failed: ${error.message}`
      });
      logger.error('commit content analysis', 'Failed to analyze commit content', error, {
        diffLength: diff?.length || 0
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
