/**
 * Claude Code Chat Data Collector
 * Extracts chat messages from Claude Code JSONL files for git commit time windows
 * Based on research findings in /docs/claude-chat-research.md
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../telemetry/standards.js';
import { createNarrativeLogger } from '../utils/trace-logger.js';

// Get tracer instance for Claude collector instrumentation
const tracer = trace.getTracer('commit-story-claude-collector', '1.0.0');

/**
 * Extract chat messages for a specific commit time window, grouped by session
 * @param {Date} commitTime - Current commit timestamp (UTC)
 * @param {Date|null} previousCommitTime - Previous commit timestamp (UTC), or null for first commit
 * @param {string} repoPath - Full path to repository (for cwd filtering)
 * @returns {Array} Array of session objects, each containing sessionId, messages array, startTime, and messageCount
 */
export function extractChatForCommit(commitTime, previousCommitTime, repoPath) {
  return tracer.startActiveSpan(OTEL.span.collectors.claude(), {
    attributes: {
      [`${OTEL.NAMESPACE}.collector.repo_path`]: repoPath,
      [`${OTEL.NAMESPACE}.collector.time_window_start`]: previousCommitTime?.toISOString() || 'session_start',
      [`${OTEL.NAMESPACE}.collector.time_window_end`]: commitTime.toISOString(),
      'code.function': 'extractChatForCommit'
    }
  }, (span) => {
    const logger = createNarrativeLogger('claude.collect_messages');

    try {
      const messages = [];

      // For first commit (no previous commit), collect all messages from session start
      // For subsequent commits, collect messages since previous commit
      const windowStart = previousCommitTime;
      const isFirstCommit = !previousCommitTime;
      const timeWindowMinutes = windowStart ? Math.round((commitTime - windowStart) / (1000 * 60)) : 'all';
      logger.start('chat message collection', `Collecting Claude messages for ${isFirstCommit ? 'entire session (first commit)' : `${timeWindowMinutes}-minute commit window`}`);

      // 1. Find all Claude JSONL files
      const files = findClaudeFiles();
      const filesFoundMetric = files.length;

      span.setAttributes({
        [`${OTEL.NAMESPACE}.collector.files_found`]: filesFoundMetric
      });

      // Emit files_found as queryable metric
      OTEL.metrics.gauge(`${OTEL.NAMESPACE}.collector.files_found`, filesFoundMetric);

      logger.progress('chat message collection', `Found ${files.length} Claude JSONL files in ~/.claude/projects directories`);

      let processedFiles = 0;
      let skippedFiles = 0;
      let totalLines = 0;
      let validMessages = 0;
      let projectFilteredOut = 0;
      let timeFilteredOut = 0;

      if (files.length === 0) {
        logger.progress('chat message collection', 'No Claude JSONL files found in ~/.claude/projects - creating empty result');
      }

      // 2. Process each JSONL file
      for (const filePath of files) {
        try {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.trim().split('\n');
          totalLines += lines.length;
          processedFiles++;

          for (const line of lines) {
            if (!line.trim()) continue; // Skip empty lines

            try {
              const message = JSON.parse(line);

              // 3. Filter by project using cwd field
              if (message.cwd !== repoPath) {
                projectFilteredOut++;
                continue;
              }

              // 4. Filter by time window
              const messageTime = parseTimestamp(message.timestamp);
              if (!messageTime) continue;

              // For first commit (no previous commit), include all messages up to commit time
              // For subsequent commits, only include messages between previous and current commit
              const inTimeWindow = previousCommitTime
                ? (previousCommitTime <= messageTime && messageTime <= commitTime)
                : (messageTime <= commitTime);

              if (inTimeWindow) {
                messages.push(message); // Full message object
                validMessages++;
              } else {
                timeFilteredOut++;
              }
            } catch (parseError) {
              // Skip malformed JSON lines, continue processing
              continue;
            }
          }
        } catch (fileError) {
          // Skip files that can't be read, continue with other files
          skippedFiles++;
          continue;
        }
      }

      // Log processing results
      logger.progress('chat message collection', `Processed ${processedFiles} files (${skippedFiles} skipped), parsed ${totalLines} JSONL lines`);

      if (projectFilteredOut > 0 || timeFilteredOut > 0) {
        logger.progress('chat message collection', `Filtered out ${projectFilteredOut} messages (wrong project) + ${timeFilteredOut} messages (outside time window)`);
      }

      // Add final processing metrics
      const finalMetrics = {
        [`${OTEL.NAMESPACE}.collector.files_processed`]: processedFiles,
        [`${OTEL.NAMESPACE}.collector.files_skipped`]: skippedFiles,
        [`${OTEL.NAMESPACE}.collector.total_lines`]: totalLines,
        [`${OTEL.NAMESPACE}.collector.messages_collected`]: validMessages,
        [`${OTEL.NAMESPACE}.collector.messages_filtered`]: messages.length
      };

      span.setAttributes(finalMetrics);

      // Emit processing metrics as queryable metrics
      Object.entries(finalMetrics).forEach(([name, value]) => {
        OTEL.metrics.gauge(name, value);
      });

      // 5. Group by session ID and sort sessions chronologically
      const groupedMessages = groupMessagesBySession(messages);

      if (validMessages === 0) {
        logger.complete('chat message collection', 'No messages found in time window - empty result');
      } else {
        const sessionCount = groupedMessages.length;
        logger.complete('chat message collection', `Collected ${validMessages} messages across ${sessionCount} sessions, grouped by conversation thread`);
      }

      span.setStatus({ code: SpanStatusCode.OK, message: 'Claude messages collected successfully' });
      return groupedMessages;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      logger.error('chat message collection', 'Collection failed', error);
      return [];
    } finally {
      span.end();
    }
  });
}

/**
 * Find Claude Code session files modified around the commit time window
 * Uses file modification time to avoid processing all session files
 * @param {string} repoPath - Repository path for directory encoding
 * @param {Date} commitTime - Current commit timestamp
 * @param {Date} previousCommitTime - Previous commit timestamp
 * @returns {Array<string>} Array of file paths to process
 */
function findClaudeFiles() {
  return tracer.startActiveSpan(OTEL.span.claude.find_files(), {
    attributes: {
      'code.function': 'findClaudeFiles'
    }
  }, (span) => {
    const logger = createNarrativeLogger('claude.find_files');
    const startTime = Date.now();

    try {
      // Find all Claude Code JSONL files across all project directories
      const claudeProjectsDir = join(homedir(), '.claude', 'projects');

      logger.start('file discovery', `Scanning Claude projects directory: ${claudeProjectsDir}`);

      if (!existsSync(claudeProjectsDir)) {
        logger.decision('file discovery', 'Claude projects directory not found - returning empty result');

        const scanDuration = Date.now() - startTime;
        const discoveryAttrs = OTEL.attrs.claude.findFiles({
          directoriesScanned: 0,
          filesFound: 0,
          scanDuration,
          scanErrors: 0
        });
        span.setAttributes(discoveryAttrs);

        // Emit metrics
        Object.entries(discoveryAttrs).forEach(([name, value]) => {
          if (typeof value === 'number') {
            OTEL.metrics.gauge(name, value);
          }
        });

        logger.complete('file discovery', 'No Claude projects directory found - empty result');
        span.setStatus({ code: SpanStatusCode.OK, message: 'No Claude projects directory found' });
        return [];
      }

      const allFiles = [];
      let directoriesScanned = 0;
      let scanErrors = 0;

      try {
        const projectDirs = readdirSync(claudeProjectsDir);
        logger.progress('file discovery', `Found ${projectDirs.length} project directories to scan`);

        for (const projectDir of projectDirs) {
          const projectPath = join(claudeProjectsDir, projectDir);
          directoriesScanned++;

          try {
            if (existsSync(projectPath)) {
              const files = readdirSync(projectPath)
                .filter(file => file.endsWith('.jsonl'))
                .map(file => join(projectPath, file));

              allFiles.push(...files);
            }
          } catch (error) {
            scanErrors++;
            // Skip directories that can't be read
            continue;
          }
        }
      } catch (error) {
        scanErrors++;
        logger.progress('file discovery', `Error reading project directories: ${error.message}`);
      }

      const scanDuration = Date.now() - startTime;

      // Add comprehensive attributes to span
      const discoveryAttrs = OTEL.attrs.claude.findFiles({
        directoriesScanned,
        filesFound: allFiles.length,
        scanDuration,
        scanErrors
      });
      span.setAttributes(discoveryAttrs);

      // Emit correlated metrics for dashboard analysis
      Object.entries(discoveryAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });

      // Additional key business metrics
      OTEL.metrics.gauge('commit_story.claude.scan_duration_ms', scanDuration);
      OTEL.metrics.gauge('commit_story.claude.files_per_directory',
        directoriesScanned > 0 ? allFiles.length / directoriesScanned : 0);

      logger.complete('file discovery', `Discovered ${allFiles.length} JSONL files across ${directoriesScanned} directories`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Claude files discovered successfully' });
      return allFiles;

    } catch (error) {
      const scanDuration = Date.now() - startTime;
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      logger.error('file discovery', 'Claude file discovery failed', error);

      // Emit error metrics
      OTEL.metrics.gauge('commit_story.claude.scan_duration_ms', scanDuration);
      OTEL.metrics.counter('commit_story.claude.discovery_errors_total', 1);

      return [];
    } finally {
      span.end();
    }
  });
}

/**
 * Parse Claude Code timestamp to UTC Date object
 * Claude timestamps: "2025-08-20T20:54:46.152Z" (UTC ISO format)
 * @param {string} timestamp - Timestamp string from Claude message
 * @returns {Date|null} Parsed Date in UTC, or null if invalid
 */
function parseTimestamp(timestamp) {
  if (!timestamp) return null;

  // Claude timestamps: "2025-08-20T20:54:46.152Z" -> UTC Date
  return new Date(timestamp.replace('Z', '+00:00'));
}

/**
 * Groups messages by session ID and sorts sessions chronologically
 * @param {Array} messages - Array of message objects with sessionId
 * @returns {Array} Array of session objects, each containing sessionId and messages array
 */
function groupMessagesBySession(messages) {
  return tracer.startActiveSpan(OTEL.span.claude.group_by_session(), {
    attributes: {
      'code.function': 'groupMessagesBySession',
      [`${OTEL.NAMESPACE}.claude.input_messages`]: messages.length
    }
  }, (span) => {
    const logger = createNarrativeLogger('claude.group_by_session');
    const startTime = Date.now();

    try {
      logger.start('message grouping', `Grouping ${messages.length} messages by session ID for chronological organization`);

      // Group messages by sessionId
      const sessionMap = new Map();

      for (const message of messages) {
        const sessionId = message.sessionId;
        if (!sessionId) continue; // Skip messages without session ID

        if (!sessionMap.has(sessionId)) {
          sessionMap.set(sessionId, []);
        }
        sessionMap.get(sessionId).push(message);
      }

      const uniqueSessions = sessionMap.size;
      logger.progress('message grouping', `Found ${uniqueSessions} unique session IDs in message set`);

      // Convert to array of session objects
      const sessions = Array.from(sessionMap.entries()).map(([sessionId, sessionMessages]) => {
        // Sort messages within each session chronologically
        const sortedMessages = sessionMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        return {
          sessionId: sessionId,
          messages: sortedMessages,
          startTime: sortedMessages[0]?.timestamp,
          messageCount: sortedMessages.length
        };
      });

      // Sort sessions by their earliest message timestamp
      const result = sessions.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

      const groupingDuration = Date.now() - startTime;

      // Add comprehensive attributes to span
      const groupAttrs = OTEL.attrs.claude.groupBySession({
        inputMessages: messages.length,
        uniqueSessions,
        groupedSessions: result.length,
        groupingDuration
      });
      span.setAttributes(groupAttrs);

      // Emit correlated metrics for dashboard analysis
      Object.entries(groupAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });

      // Additional key business metrics
      OTEL.metrics.gauge('commit_story.claude.grouping_duration_ms', groupingDuration);
      OTEL.metrics.gauge('commit_story.claude.avg_messages_per_session',
        result.length > 0 ? messages.length / result.length : 0);

      logger.complete('message grouping', `Successfully grouped messages into ${result.length} chronologically sorted sessions`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Message grouping completed successfully' });
      return result;

    } catch (error) {
      const groupingDuration = Date.now() - startTime;
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      logger.error('message grouping', 'Session grouping failed', error);

      // Emit error metrics
      OTEL.metrics.gauge('commit_story.claude.grouping_duration_ms', groupingDuration);
      OTEL.metrics.counter('commit_story.claude.grouping_errors_total', 1);

      throw error;
    } finally {
      span.end();
    }
  });
}