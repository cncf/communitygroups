/**
 * trace-logger.js - Narrative logging for AI trace correlation
 *
 * This utility creates structured JSON logs that tell the "story" of execution
 * alongside OpenTelemetry traces. While traces capture metrics and timing,
 * these logs capture business logic decisions, state changes, and searchable
 * context for AI assistants to understand system behavior.
 *
 * Output follows OpenTelemetry conventions for trace correlation.
 */

import { trace } from '@opentelemetry/api';
import { logger } from '../logging.js';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { getConfig } from './config.js';

/**
 * Check if we're in dev mode using centralized config
 * Dev mode controls narrative logging output to Datadog
 */
function isDevMode() {
  const { dev } = getConfig();
  return dev;
}

/**
 * Create narrative log entry with OpenTelemetry trace correlation
 *
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} operation - Operation name (matches span name convention)
 * @param {string} message - Human-readable narrative message
 * @param {Object} context - Additional context data (optional)
 */
function narrativeLog(level, operation, message, context = {}) {
  // Only output in dev mode (when narrative logs should go to Datadog)
  if (!isDevMode()) {
    return;
  }

  // Capture timestamp at start for consistency
  const timestamp = Date.now();
  const span = trace.getActiveSpan();
  const spanContext = span?.spanContext();

  // Create structured log entry for console
  const logEntry = {
    timestamp: new Date(timestamp).toISOString(),
    level: level,
    service: 'commit-story',
    operation: operation,
    message: message,
    traceId: spanContext?.traceId || 'no-trace',
    spanId: spanContext?.spanId || 'no-span',
    ...context
  };

  // Emit to OpenTelemetry Logs SDK (goes to Datadog)
  if (spanContext?.traceId && spanContext?.spanId) {
    const severityMap = {
      'debug': SeverityNumber.DEBUG,
      'info': SeverityNumber.INFO,
      'warn': SeverityNumber.WARN,
      'error': SeverityNumber.ERROR
    };

    logger.emit({
      severityNumber: severityMap[level] || SeverityNumber.INFO,
      severityText: level.toUpperCase(),
      body: message,
      attributes: {
        'operation': operation,
        'service.name': 'commit-story',
        'trace_id': spanContext.traceId,
        'span_id': spanContext.spanId,
        'dd.trace_id': spanContext.traceId,  // Datadog format
        'dd.span_id': spanContext.spanId,    // Datadog format
        ...context
      },
      timestamp: timestamp, // Milliseconds - SDK converts to nanoseconds
    });
  }

  // Narrative logs only emit to OpenTelemetry/Datadog, no console output
}


/**
 * Create narrative logger for a specific operation
 * Returns an object with level-specific logging functions
 *
 * @param {string} operation - Operation name (e.g., 'claude.collect_messages')
 * @returns {Object} Logger with info, warn, error, debug methods
 */
export function createNarrativeLogger(operation) {
  return {
    // Narrative-specific methods for operation tracking
    start: (operationDesc, message, context) => narrativeLog('info', operation, message, { operationDesc, phase: 'start', ...context }),
    progress: (operationDesc, message, context) => narrativeLog('info', operation, message, { operationDesc, phase: 'progress', ...context }),
    complete: (operationDesc, message, context) => narrativeLog('info', operation, message, { operationDesc, phase: 'complete', ...context }),
    decision: (operationDesc, message, context) => narrativeLog('info', operation, message, { operationDesc, phase: 'decision', ...context }),

    // Standard logging methods
    info: (message, context) => narrativeLog('info', operation, message, context),
    warn: (message, context) => narrativeLog('warn', operation, message, context),
    error: (operationDesc, message, error, context) => narrativeLog('error', operation, message, { operationDesc, error: error?.message, stack: error?.stack, ...context }),
    debug: (message, context) => narrativeLog('debug', operation, message, context)
  };
}

/**
 * Convenience functions for common logging patterns
 */
export const narrativeLogger = {
  /**
   * Log the start of an operation
   */
  start: (operation, message, context) => narrativeLog('info', operation, `Starting: ${message}`, context),

  /**
   * Log a state change or intermediate result
   */
  progress: (operation, message, context) => narrativeLog('info', operation, message, context),

  /**
   * Log a business logic decision
   */
  decision: (operation, message, context) => narrativeLog('info', operation, `Decision: ${message}`, context),

  /**
   * Log completion of an operation
   */
  complete: (operation, message, context) => narrativeLog('info', operation, `Completed: ${message}`, context),

  /**
   * Log an error with trace correlation
   */
  error: (operation, message, error, context = {}) => {
    const errorContext = {
      error: error?.message,
      stack: error?.stack,
      ...context
    };
    narrativeLog('error', operation, `Error: ${message}`, errorContext);
  }
};

export default narrativeLogger;