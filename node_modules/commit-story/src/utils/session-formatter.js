/**
 * Session Formatter Utility
 *
 * Transforms session-grouped chat messages into a consistent format for AI processing
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../telemetry/standards.js';
import { createNarrativeLogger } from './trace-logger.js';

// Get tracer instance for session formatting instrumentation
const tracer = trace.getTracer('commit-story-session-formatter', '1.0.0');

/**
 * Formats session groups for AI consumption with consistent structure
 * @param {Array} sessions - Array of session objects with messages
 * @returns {Array} Formatted sessions with session_id, session_start, message_count, and messages
 */
export function formatSessionsForAI(sessions) {
  return tracer.startActiveSpan(OTEL.span.utils.sessionFormat(), {
    attributes: {
      'code.function': 'formatSessionsForAI',
      [`${OTEL.NAMESPACE}.session.input_sessions`]: sessions.length
    }
  }, (span) => {
    const logger = createNarrativeLogger('utils.session_format');
    const startTime = Date.now();

    try {
      const totalMessages = sessions.reduce((sum, session) => sum + (session.messages?.length || 0), 0);

      logger.start('session formatting', `Formatting ${sessions.length} chat sessions with ${totalMessages} total messages for AI processing`);

      const result = sessions.map((session, index) => ({
        session_id: `Session ${index + 1}`,
        session_start: session.startTime,
        message_count: session.messageCount,
        messages: session.messages.map(msg => ({
          type: msg.type,
          content: msg.message?.content,
          timestamp: msg.timestamp,
        }))
      }));

      const processingDuration = Date.now() - startTime;

      // Add comprehensive attributes to span
      const formatAttrs = OTEL.attrs.utils.sessionFormat({
        inputSessions: sessions.length,
        formattedSessions: result.length,
        totalMessages,
        processingDuration
      });
      span.setAttributes(formatAttrs);

      // Emit correlated metrics for dashboard analysis
      Object.entries(formatAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });

      // Additional key business metrics
      OTEL.metrics.gauge('commit_story.session.formatting_duration_ms', processingDuration);
      OTEL.metrics.gauge('commit_story.session.avg_messages_per_session',
        sessions.length > 0 ? totalMessages / sessions.length : 0);

      logger.complete('session formatting', `Successfully formatted ${result.length} sessions with consistent structure for AI consumption`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Session formatting completed successfully' });
      return result;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      logger.error('session formatting', 'Session formatting failed', error);
      throw error;
    } finally {
      span.end();
    }
  });
}