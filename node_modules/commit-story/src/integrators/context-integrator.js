/**
 * Context Integrator - Time-based Chat Context Matching
 * 
 * Orchestrates the collection of git commit data and chat messages,
 * correlating them by time windows to create unified context for AI processing.
 */

import { getLatestCommitData } from '../collectors/git-collector.js';
import { extractChatForCommit } from '../collectors/claude-collector.js';
import { execSync } from 'child_process';
import { filterContext } from '../generators/filters/context-filter.js';
import { redactSensitiveData } from '../generators/filters/sensitive-data-filter.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../telemetry/standards.js';
import { createNarrativeLogger } from '../utils/trace-logger.js';

/**
 * Extracts clean text content from grouped Claude messages, handling mixed content formats
 *
 * @param {Array} sessionGroups - Array of session objects containing messages
 * @returns {Array} Session objects with cleaned messages
 */
export function extractTextFromMessages(sessionGroups) {
  // Count total messages across all sessions
  const totalMessages = sessionGroups.reduce((sum, session) => sum + (session.messages?.length || 0), 0);

  return tracer.startActiveSpan(OTEL.span.context.extract_text(), {
    attributes: {
      'code.function': 'extractTextFromMessages',
      [`${OTEL.NAMESPACE}.text.input_messages`]: totalMessages,
      [`${OTEL.NAMESPACE}.text.input_sessions`]: sessionGroups.length
    }
  }, (span) => {
    const logger = createNarrativeLogger('context.extract_text_from_messages');
    const startTime = Date.now();

    try {
      logger.start('Text extraction from messages', `Starting extraction from ${totalMessages} Claude messages across ${sessionGroups.length} sessions`, {
        inputCount: totalMessages,
        sessionCount: sessionGroups.length
      });

      // Track content type statistics
      let stringContentMessages = 0;
      let arrayContentMessages = 0;
      let unknownContentMessages = 0;
      let emptyContentMessages = 0;
      let totalContentLength = 0;

      const result = sessionGroups.map(session => {
        const cleanedMessages = session.messages.map(msg => {
          const content = msg.message?.content;
          let cleanContent = '';

          if (!content) {
            cleanContent = '';
            emptyContentMessages++;
            logger.progress('Empty content found', 'Encountered message with no content', { msgType: msg.type });
          } else if (typeof content === 'string') {
            cleanContent = content;
            stringContentMessages++;
          } else if (Array.isArray(content)) {
            // Extract text from array format: [{type: "text", text: "actual content"}]
            cleanContent = content
              .filter(item => item.type === 'text' && item.text)
              .map(item => item.text)
              .join(' ');
            arrayContentMessages++;
          } else {
            // Fallback for unknown content types
            cleanContent = JSON.stringify(content);
            unknownContentMessages++;
            logger.decision('Unknown content type', 'Using JSON stringify fallback for unknown content format', {
              contentType: typeof content,
              msgType: msg.type
            });
          }

          // Filter sensitive data before AI processing
          const beforeRedaction = cleanContent.length;
          cleanContent = redactSensitiveData(cleanContent);
          const afterRedaction = cleanContent.length;

          if (beforeRedaction !== afterRedaction) {
            logger.progress('Sensitive data redacted', `Content length changed from ${beforeRedaction} to ${afterRedaction} characters`, {
              reductionAmount: beforeRedaction - afterRedaction,
              msgType: msg.type
            });
          }

          totalContentLength += cleanContent.length;

          // Return minimal message object for AI processing (eliminates Claude Code metadata bloat)
          return {
            type: msg.type || 'assistant', // user or assistant
            message: {
              content: cleanContent
            },
            timestamp: msg.timestamp
          };
        });

        return {
          sessionId: session.sessionId,
          messages: cleanedMessages,
          startTime: session.startTime,
          messageCount: cleanedMessages.length
        };
      });

      const processingDuration = Date.now() - startTime;
      const averageContentLength = totalMessages > 0 ? Math.round(totalContentLength / totalMessages) : 0;

      // Add comprehensive attributes to span
      const textAttrs = OTEL.attrs.textExtraction({
        inputMessages: totalMessages,
        inputSessions: sessionGroups.length,
        processedMessages: totalMessages,
        processedSessions: result.length,
        stringContentMessages,
        arrayContentMessages,
        unknownContentMessages,
        emptyContentMessages,
        totalContentLength,
        averageContentLength,
        processingDuration
      });
      span.setAttributes(textAttrs);

      // Emit correlated metrics for dashboard analysis
      Object.entries(textAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });

      // Additional key business metrics
      OTEL.metrics.gauge('commit_story.text.extraction_duration_ms', processingDuration);
      OTEL.metrics.gauge('commit_story.text.sessions_count', result.length);

      // Content type ratio metrics for detecting Claude Code format changes
      OTEL.metrics.gauge('commit_story.text.string_content_ratio',
        totalMessages > 0 ? stringContentMessages / totalMessages : 0);
      OTEL.metrics.gauge('commit_story.text.complex_content_ratio',
        totalMessages > 0 ? (arrayContentMessages + unknownContentMessages) / totalMessages : 0);

      logger.complete('Text extraction completed', `Successfully processed ${totalMessages} messages across ${result.length} sessions with ${averageContentLength} avg chars`, {
        processedCount: totalMessages,
        sessionCount: result.length,
        averageLength: averageContentLength,
        processingTime: processingDuration,
        contentTypes: {
          string: stringContentMessages,
          array: arrayContentMessages,
          unknown: unknownContentMessages,
          empty: emptyContentMessages
        }
      });

      span.setStatus({ code: SpanStatusCode.OK, message: 'Text extraction completed successfully' });
      return result;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      logger.error('Text extraction failed', 'Error during message content extraction', error, {
        inputMessageCount: totalMessages,
        inputSessionCount: sessionGroups.length
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Calculates metadata about chat messages for context enrichment
 *
 * @param {Array} messages - Array of clean messages from extractTextFromMessages()
 * @returns {Object} Metadata object with message statistics
 */
function calculateChatMetadata(messages) {
  return tracer.startActiveSpan(OTEL.span.context.calculate_metadata(), {
    attributes: {
      'code.function': 'calculateChatMetadata',
      [`${OTEL.NAMESPACE}.metadata.input_messages`]: messages.length
    }
  }, (span) => {
    const logger = createNarrativeLogger('context.calculate_chat_metadata');
    const startTime = Date.now();

    try {
      logger.start('Chat metadata calculation', `Starting calculation for ${messages.length} messages`, {
        inputCount: messages.length
      });

      const userMessages = messages.filter(msg => msg.type === 'user');
      const assistantMessages = messages.filter(msg => msg.type === 'assistant');

      logger.progress('Message type filtering', `Found ${userMessages.length} user and ${assistantMessages.length} assistant messages`, {
        userCount: userMessages.length,
        assistantCount: assistantMessages.length,
        totalCount: messages.length
      });

      const overTwentyCharMessages = userMessages.filter(msg => {
        const content = msg.message?.content || '';
        return content.length >= 20;
      });

      const userLengths = userMessages.map(msg => (msg.message?.content || '').length);
      const assistantLengths = assistantMessages.map(msg => (msg.message?.content || '').length);

      const userAvgLength = userLengths.length > 0 ? Math.round(userLengths.reduce((a, b) => a + b, 0) / userLengths.length) : 0;
      const userMaxLength = userLengths.length > 0 ? Math.max(...userLengths) : 0;
      const assistantAvgLength = assistantLengths.length > 0 ? Math.round(assistantLengths.reduce((a, b) => a + b, 0) / assistantLengths.length) : 0;
      const assistantMaxLength = assistantLengths.length > 0 ? Math.max(...assistantLengths) : 0;

      logger.progress('Length analysis completed', `User msgs: avg=${userAvgLength}, max=${userMaxLength}; Assistant msgs: avg=${assistantAvgLength}, max=${assistantMaxLength}`, {
        userAvgLength,
        userMaxLength,
        assistantAvgLength,
        assistantMaxLength,
        overTwentyCharCount: overTwentyCharMessages.length
      });

      const calculationDuration = Date.now() - startTime;

      const result = {
        totalMessages: userMessages.length + assistantMessages.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length,
        userMessages: {
          total: userMessages.length,
          overTwentyCharacters: overTwentyCharMessages.length,
          averageLength: userAvgLength,
          maxLength: userMaxLength
        },
        assistantMessages: {
          total: assistantMessages.length,
          averageLength: assistantAvgLength,
          maxLength: assistantMaxLength
        }
      };

      // Add comprehensive attributes to span
      const metadataAttrs = OTEL.attrs.chatMetadata({
        inputMessages: messages.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        overTwentyCharMessages: overTwentyCharMessages.length,
        userAvgLength,
        userMaxLength,
        assistantAvgLength,
        assistantMaxLength,
        calculationDuration
      });
      span.setAttributes(metadataAttrs);

      // Emit correlated metrics for dashboard analysis
      Object.entries(metadataAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });

      // Additional key business metrics
      OTEL.metrics.gauge('commit_story.metadata.calculation_duration_ms', calculationDuration);
      OTEL.metrics.gauge('commit_story.metadata.user_message_ratio',
        messages.length > 0 ? userMessages.length / messages.length : 0);
      OTEL.metrics.gauge('commit_story.metadata.quality_message_ratio',
        userMessages.length > 0 ? overTwentyCharMessages.length / userMessages.length : 0);

      logger.complete('Metadata calculation completed', `Generated statistics for ${result.totalMessages} messages with ${overTwentyCharMessages.length} quality user messages`, {
        totalMessages: result.totalMessages,
        qualityMessages: overTwentyCharMessages.length,
        processingTime: calculationDuration,
        statistics: {
          userRatio: messages.length > 0 ? userMessages.length / messages.length : 0,
          qualityRatio: userMessages.length > 0 ? overTwentyCharMessages.length / userMessages.length : 0
        }
      });

      span.setStatus({ code: SpanStatusCode.OK, message: 'Chat metadata calculation completed successfully' });
      return result;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      logger.error('Metadata calculation failed', 'Error during chat metadata calculation', error, {
        inputMessageCount: messages.length
      });
      throw error;
    } finally {
      span.end();
    }
  });
}


// Get tracer instance for context integration instrumentation
const tracer = trace.getTracer('commit-story-context', '1.0.0');

/**
 * Gathers all context for a commit: git data and time-correlated chat messages
 * 
 * @param {string} commitRef - Git commit reference (HEAD, HEAD~1, hash, etc.)
 * @returns {Promise<Object>} Combined context object with commit data and chat messages
 * @returns {Object} context.commit - Current commit data from git-collector
 * @returns {Array} context.chatMessages - Chat messages from claude-collector  
 * @returns {Object|null} context.previousCommit - Previous commit basic data or null
 */
export async function gatherContextForCommit(commitRef = 'HEAD') {
  return await tracer.startActiveSpan(OTEL.span.context.gather(), {
    attributes: {
      ...OTEL.attrs.repository({ path: process.cwd() }),
      [`${OTEL.NAMESPACE}.commit.ref`]: commitRef,
      'code.function': 'gatherContextForCommit'
    }
  }, async (span) => {
    try {
      // Get current commit data (returns Date object for timestamp)
      const currentCommit = await getLatestCommitData(commitRef);
      if (!currentCommit) {
        throw new Error('❌ Failed to get current commit data');
      }
      
      // Add commit data to span
      const commitAttrs = OTEL.attrs.commit(currentCommit);
      span.setAttributes(commitAttrs);

      // Emit commit metrics for context integration analysis
      Object.entries(commitAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });

      // Get previous commit data for time window
      const previousCommit = await getPreviousCommitData(commitRef);

      if (previousCommit) {
        const prevCommitAttrs = {
          [`${OTEL.NAMESPACE}.previous_commit.hash`]: previousCommit.hash,
          [`${OTEL.NAMESPACE}.previous_commit.timestamp`]: previousCommit.timestamp.toISOString()
        };
        span.setAttributes(prevCommitAttrs);

        // Emit previous commit metrics for context window analysis
        Object.entries(prevCommitAttrs).forEach(([name, value]) => {
          if (typeof value === 'string' && name.includes('timestamp')) {
            // Convert timestamp to numeric metric (epoch milliseconds)
            const timestampMs = new Date(value).getTime();
            OTEL.metrics.gauge(name.replace('timestamp', 'timestamp_ms'), timestampMs);
          }
        });
      }
      
      // Extract chat messages using existing claude-collector API
      // Signature: extractChatForCommit(commitTime, previousCommitTime, repoPath)
      const rawChatMessages = await extractChatForCommit(
        currentCommit.timestamp,           // Date object - current commit time
        previousCommit?.timestamp || null, // Date object or null - previous commit time  
        process.cwd()                      // string - repo path for cwd filtering
      );
    
      // Extract clean text content from messages (now returns session groups)
      const cleanChatSessions = extractTextFromMessages(rawChatMessages || []);

      // Flatten session groups to get all messages for metadata calculation and filtering
      const flattenedMessages = cleanChatSessions.flatMap(session => session.messages);

      // Add raw message data to span
      const rawSessionCount = rawChatMessages?.length || 0;
      const totalMessageCount = flattenedMessages.length;
      const rawChatData = {
        raw_sessions: rawSessionCount,
        sessions: cleanChatSessions.length,
        raw_messages: rawChatMessages?.reduce((sum, session) => sum + (session.messages?.length || 0), 0) || 0,
        count: totalMessageCount
      };
      span.setAttributes(OTEL.attrs.chat(rawChatData));

      // Dual emission: emit metrics alongside span attributes
      OTEL.metrics.gauge('commit_story.chat.raw_sessions_count', rawChatData.raw_sessions);
      OTEL.metrics.gauge('commit_story.chat.sessions_count', rawChatData.sessions);
      OTEL.metrics.gauge('commit_story.chat.raw_messages_count', rawChatData.raw_messages);
      OTEL.metrics.gauge('commit_story.chat.messages_count', rawChatData.count);

      // Apply complete context preparation (consolidate all filtering and token management)
      // Use flattened messages for filtering to maintain existing filter logic
      const rawContext = {
        commit: currentCommit,
        chatMessages: flattenedMessages
      };
      const filteredContext = filterContext(rawContext);

      // Apply the same filtering to session groups to maintain consistency
      // Filter messages within each session and remove empty sessions
      const filteredChatSessions = cleanChatSessions
        .map(session => {
          const filteredMessages = session.messages.filter(msg =>
            filteredContext.chatMessages.some(filtered =>
              filtered.timestamp === msg.timestamp && filtered.content === msg.content
            )
          );
          return {
            ...session,
            messages: filteredMessages,
            messageCount: filteredMessages.length
          };
        })
        .filter(session => session.messages.length > 0);

      // Calculate metadata from cleaned messages (before filtering for richer data)
      const metadata = calculateChatMetadata(flattenedMessages);

      // Add final metadata to span
      const finalChatData = {
        total: metadata.totalMessages,
        userMessages: metadata.userMessageCount,
        assistantMessages: metadata.assistantMessageCount,
        userMessagesOverTwenty: metadata.userMessages.overTwentyCharacters,
        filtered: filteredContext.chatMessages.length
      };
      span.setAttributes(OTEL.attrs.chat(finalChatData));

      // Dual emission: emit key business metrics
      OTEL.metrics.gauge('commit_story.chat.total_messages', finalChatData.total);
      OTEL.metrics.gauge('commit_story.chat.user_messages', finalChatData.userMessages);
      OTEL.metrics.gauge('commit_story.chat.assistant_messages', finalChatData.assistantMessages);
      OTEL.metrics.gauge('commit_story.chat.user_messages_over_twenty', finalChatData.userMessagesOverTwenty);

      // Return self-documenting context object for journal generation
      const result = {
        commit: {
          data: filteredContext.commit,     // Filtered git data (hash, message, author, timestamp, diff)
          description: `Git commit with fields:
  - hash: Commit hash string
  - message: Commit message (may be null)
  - author: Object with {name, email}
  - timestamp: ISO 8601 timestamp
  - diff: Full unified diff showing file changes
    - File paths in headers: diff --git a/path/to/file b/path/to/file
    - Lines added (+) and removed (-)`
        },
        previousCommit: {
          data: previousCommit,             // Previous commit data for time window calculation
          description: "Previous commit data used for calculating development time window"
        },
        chatMessages: {
          data: filteredContext.chatMessages, // Filtered chat messages with token optimization (flattened)
          description: "Chat messages where type:'user' = HUMAN DEVELOPER input, type:'assistant' = AI ASSISTANT responses"
        },
        chatSessions: {
          data: filteredChatSessions, // Session-grouped chat messages (filtered to match chatMessages)
          description: `Chat sessions - array of session objects, each containing:
  - session_id: "Session 1", "Session 2", etc.
  - session_start: ISO 8601 timestamp when session began
  - message_count: Total messages in this session
  - messages: Array of message objects, each with:
    - type: "user" (human developer) or "assistant" (AI)
    - content: The message text
    - timestamp: ISO 8601 timestamp when message was sent`
        },
        chatMetadata: {
          data: metadata,
          description: "Chat statistics: Message counts, lengths, and quality metrics for decision-making"
        }
      };
      
      span.setStatus({ code: SpanStatusCode.OK, message: 'Context gathered successfully' });
      return result;
      
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      console.error('Error gathering context for commit:', error.message);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Gets the previous commit data for time window calculation
 *
 * @param {string} commitRef - Git commit reference to calculate previous from
 * @returns {Promise<Object|null>} Previous commit data or null if no previous commit
 */
async function getPreviousCommitData(commitRef = 'HEAD') {
  return await tracer.startActiveSpan(OTEL.span.collectors.git(), {
    attributes: {
      'code.function': 'getPreviousCommitData',
      [`${OTEL.NAMESPACE}.git.commit_ref`]: commitRef,
      [`${OTEL.NAMESPACE}.git.command`]: `git log -1 --format="%H|%ct" ${commitRef}~1`
    }
  }, async (span) => {
    const logger = createNarrativeLogger('git.collect_previous_commit_data');
    const startTime = Date.now();

    try {
      logger.start('Previous commit data retrieval', `Retrieving previous commit data for reference: ${commitRef}`, {
        commitRef,
        command: `git log -1 --format="%H|%ct" ${commitRef}~1`
      });

      // Get previous commit hash and timestamp (one commit before the specified commit)
      let previousCommitInfo;
      try {
        previousCommitInfo = execSync(
          `git log -1 --format="%H|%ct" ${commitRef}~1`,
          { encoding: 'utf8', cwd: process.cwd() }
        ).trim();
      } catch (gitError) {
        // No parent commit exists (first commit in repository)
        const executionDuration = Date.now() - startTime;

        logger.decision('No previous commit found', 'Git command failed - this is the first commit in repository', {
          commitRef,
          executionTime: executionDuration,
          result: 'no_previous_commit',
          error: gitError.message
        });

        // Add attributes for null result case
        const gitAttrs = OTEL.attrs.gitCollection({
          commitRef,
          command: `git log -1 --format="%H|%ct" ${commitRef}~1`,
          previousCommitFound: false,
          previousCommitHash: null,
          previousCommitTimestamp: null,
          executionDuration
        });
        span.setAttributes(gitAttrs);

        // Emit metrics for null result
        OTEL.metrics.gauge('commit_story.git.execution_duration_ms', executionDuration);
        OTEL.metrics.gauge('commit_story.git.previous_commit_found', 0); // 0 for false
        OTEL.metrics.counter('commit_story.git.no_previous_commit_total', 1);

        logger.complete('Previous commit data retrieval completed', 'No previous commit found - returning null for first commit', {
          result: null,
          executionTime: executionDuration,
          reason: 'first_commit_in_repo'
        });

        span.setStatus({ code: SpanStatusCode.OK, message: 'No previous commit found (first commit)' });
        return null; // No previous commit (first commit in repo)
      }

      const executionDuration = Date.now() - startTime;

      if (!previousCommitInfo) {
        logger.decision('No previous commit found', 'Git command returned empty result - likely first commit in repository', {
          commitRef,
          executionTime: executionDuration,
          result: 'no_previous_commit'
        });

        // Add attributes for null result case
        const gitAttrs = OTEL.attrs.gitCollection({
          commitRef,
          command: `git log -1 --format="%H|%ct" ${commitRef}~1`,
          previousCommitFound: false,
          previousCommitHash: null,
          previousCommitTimestamp: null,
          executionDuration
        });
        span.setAttributes(gitAttrs);

        // Emit metrics for null result
        OTEL.metrics.gauge('commit_story.git.execution_duration_ms', executionDuration);
        OTEL.metrics.gauge('commit_story.git.previous_commit_found', 0); // 0 for false
        OTEL.metrics.counter('commit_story.git.no_previous_commit_total', 1);

        logger.complete('Previous commit data retrieval completed', 'No previous commit found - returning null for first commit', {
          result: null,
          executionTime: executionDuration,
          reason: 'first_commit_in_repo'
        });

        span.setStatus({ code: SpanStatusCode.OK, message: 'No previous commit found (first commit)' });
        return null; // No previous commit (first commit in repo)
      }

      const [hash, timestamp] = previousCommitInfo.split('|');
      const previousCommitTimestamp = new Date(parseInt(timestamp) * 1000); // Convert to Date object like git-collector

      logger.progress('Previous commit data parsed', `Found previous commit: ${hash} at ${previousCommitTimestamp.toISOString()}`, {
        hash,
        timestamp: previousCommitTimestamp.toISOString(),
        rawTimestamp: timestamp
      });

      const result = {
        hash: hash,
        timestamp: previousCommitTimestamp
      };

      // Add comprehensive attributes to span
      const gitAttrs = OTEL.attrs.gitCollection({
        commitRef,
        command: `git log -1 --format="%H|%ct" ${commitRef}~1`,
        previousCommitFound: true,
        previousCommitHash: hash,
        previousCommitTimestamp: previousCommitTimestamp.toISOString(),
        executionDuration
      });
      span.setAttributes(gitAttrs);

      // Emit correlated metrics for dashboard analysis
      Object.entries(gitAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        } else if (typeof value === 'boolean') {
          OTEL.metrics.gauge(name, value ? 1 : 0);
        }
      });

      // Additional key business metrics
      OTEL.metrics.gauge('commit_story.git.execution_duration_ms', executionDuration);
      OTEL.metrics.gauge('commit_story.git.previous_commit_found', 1); // 1 for true
      OTEL.metrics.counter('commit_story.git.previous_commit_success_total', 1);

      logger.complete('Previous commit data retrieval completed', `Successfully retrieved previous commit ${hash} from ${previousCommitTimestamp.toISOString()}`, {
        result: result,
        executionTime: executionDuration,
        hash: hash,
        timestamp: previousCommitTimestamp.toISOString()
      });

      span.setStatus({ code: SpanStatusCode.OK, message: 'Previous commit data retrieved successfully' });
      return result;

    } catch (error) {
      const executionDuration = Date.now() - startTime;

      logger.decision('Git command failed', 'Git log command failed - treating as no previous commit available', {
        error: error.message,
        commitRef,
        executionTime: executionDuration,
        errorType: 'git_command_error'
      });

      // Add attributes for error case (treat as no previous commit)
      const gitAttrs = OTEL.attrs.gitCollection({
        commitRef,
        command: `git log -1 --format="%H|%ct" ${commitRef}~1`,
        previousCommitFound: false,
        previousCommitHash: null,
        previousCommitTimestamp: null,
        executionDuration
      });
      span.setAttributes(gitAttrs);

      // Emit metrics for error case (treated as no previous commit)
      OTEL.metrics.gauge('commit_story.git.execution_duration_ms', executionDuration);
      OTEL.metrics.gauge('commit_story.git.previous_commit_found', 0); // 0 for false
      OTEL.metrics.counter('commit_story.git.command_error_total', 1);

      logger.complete('Previous commit data retrieval completed', 'Git command error treated as no previous commit - returning null', {
        result: null,
        executionTime: executionDuration,
        reason: 'git_command_error'
      });

      // Don't throw error - return null as this is expected behavior for first commit
      span.setStatus({ code: SpanStatusCode.OK, message: 'No previous commit exists (git error handled)' });
      return null; // No previous commit exists (first commit in repo)
    } finally {
      span.end();
    }
  });
}