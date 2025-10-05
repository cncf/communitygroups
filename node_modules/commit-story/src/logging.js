import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import resourcePkg from '@opentelemetry/resources';
const { resourceFromAttributes, defaultResource } = resourcePkg;
import pkg from '@opentelemetry/semantic-conventions';
const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = pkg;
import fs from 'fs';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from './telemetry/standards.js';
import { createNarrativeLogger } from './utils/trace-logger.js';
import { shutdownWithTimeout } from './utils/shutdown-helper.js';

// Get tracer instance for instrumentation
const tracer = trace.getTracer('commit-story', '1.0.0');

// Get configuration synchronously during bootstrap
const { dev: isDevMode } = (() => {
  try {
    const configPath = './commit-story.config.json';
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        debug: configData.debug === true,
        dev: configData.dev === true
      };
    }
  } catch (error) {
    // Silently ignore config file errors - both modes default to false
  }
  return { debug: false, dev: false };
})();

// Only initialize logging when dev mode is enabled
let logger = null;
let batchProcessor = null;

// Instrument conditional logging initialization
function initializeLoggingConditionally() {
  return tracer.startActiveSpan(OTEL.span.initialization.logging(), {
    attributes: {
      'code.function': 'initializeLoggingConditionally'
    }
  }, (span) => {
    const narrativeLogger = createNarrativeLogger('initialization.logging_setup');
    const startTime = Date.now();

    try {
      narrativeLogger.decision('Condition check', `Logging initialization condition: dev mode = ${isDevMode}`, {
        dev_mode_enabled: isDevMode,
        condition_met: isDevMode
      });

      if (!isDevMode) {
        narrativeLogger.decision('Skip initialization', 'Logging initialization skipped - dev mode is false', {
          skip_reason: 'dev_mode_disabled',
          logger_type: 'noop'
        });

        const skipDuration = Date.now() - startTime;
        const attrs = OTEL.attrs.initialization.logging({
          providerInitialized: false,
          batchProcessor: false,
          otlpEndpoint: null,
          maxBatchSize: 0,
          scheduledDelayMs: 0,
          initializationDuration: skipDuration
        });

        span.setAttributes(attrs);
        span.setStatus({ code: SpanStatusCode.OK, message: 'Logging skipped - dev mode disabled' });
        return { logger: { emit: () => {} }, batchProcessor: null };
      }

      narrativeLogger.progress('Starting initialization', 'Dev mode enabled, initializing logging system', {
        service_name: 'commit-story-dev',
        service_version: '1.0.0'
      });

      return initializeLoggingProvider(narrativeLogger, startTime, span);

    } catch (error) {
      const initializationDuration = Date.now() - startTime;
      narrativeLogger.error('Logging initialization', 'Failed to initialize logging', error, {
        initialization_duration_ms: initializationDuration
      });

      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

function initializeLoggingProvider(narrativeLogger, startTime, span) {
  narrativeLogger.progress('OTLP configuration', 'Configuring OTLP log exporter for Datadog Agent', {
    endpoint: 'http://localhost:4318/v1/logs'
  });

  const initResult = initializeLoggingSystem();

  const initializationDuration = Date.now() - startTime;
  const attrs = OTEL.attrs.initialization.logging({
    providerInitialized: true,
    batchProcessor: true,
    otlpEndpoint: 'http://localhost:4318/v1/logs',
    maxBatchSize: 100,
    scheduledDelayMs: 1000,
    initializationDuration
  });

  span.setAttributes(attrs);
  span.setStatus({ code: SpanStatusCode.OK, message: 'Logging initialized successfully' });

  narrativeLogger.complete('Logging initialization', 'Logging system initialized successfully', {
    provider_initialized: true,
    batch_processor: true,
    otlp_endpoint: 'http://localhost:4318/v1/logs',
    initialization_duration_ms: initializationDuration
  });

  return initResult;
}

function initializeLoggingSystem() {
  const isDevModeActive = isDevMode;
  // Create OTLP log exporter for local Datadog Agent (same as traces)
  const logExporter = new OTLPLogExporter({
    url: 'http://localhost:4318/v1/logs',
    concurrencyLimit: 8, // Allow multiple concurrent exports during shutdown
  });

  // Add error handler to catch silent export failures
  // Limit error logging to prevent feedback loop during shutdown
  let failureCount = 0;
  const MAX_LOGGED_FAILURES = 3;

  const originalExport = logExporter.export.bind(logExporter);
  logExporter.export = function(logs, resultCallback) {
    return originalExport(logs, (result) => {
      if (result.code !== 0 && failureCount < MAX_LOGGED_FAILURES) {
        console.error('❌ OTLP Log Export: FAILED', result);
        failureCount++;
        if (failureCount === MAX_LOGGED_FAILURES) {
          console.error('❌ Further log export failures will be suppressed to prevent feedback loop');
        }
      }
      resultCallback(result);
    });
  };

  // Configure resource attributes to match tracing setup
  const resourceAttributes = {
    [SEMRESATTRS_SERVICE_NAME]: 'commit-story-dev',
    [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
    environment: 'development',
  };

  const resource = defaultResource().merge(resourceFromAttributes(resourceAttributes));

  // Create batch processor for efficient log export
  batchProcessor = new BatchLogRecordProcessor(logExporter, {
    maxExportBatchSize: 100, // Batch logs to reduce HTTP requests
    scheduledDelayMillis: 1000, // Export batches every second
  });

  // Create LoggerProvider with processor and resource
  const loggerProvider = new LoggerProvider({
    resource: resource,
    processors: [batchProcessor],
  });

  // Export logger instance for narrative logging
  const loggerInstance = loggerProvider.getLogger('commit-story-narrative', '1.0.0');

  return { logger: loggerInstance, batchProcessor };
}

// Execute conditional initialization
const loggingResult = initializeLoggingConditionally();
logger = loggingResult.logger;
batchProcessor = loggingResult.batchProcessor;

export { logger };

/**
 * Shutdown logging system with timeout
 * @param {Object} options - Shutdown options
 * @param {number} options.timeoutMs - Maximum time to wait for shutdown (default: 2000ms)
 * @returns {Promise<{success: boolean, error?: Error}>} Export status
 */
export async function shutdownLogging({ timeoutMs = 2000 } = {}) {
  if (!isDevMode || !batchProcessor) {
    // Logging not initialized, nothing to shutdown
    return { success: true };
  }

  try {
    await shutdownWithTimeout(() => batchProcessor.forceFlush(), timeoutMs, 'Logging');
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

// Add graceful shutdown handler to flush logs and metrics (only when dev mode enabled)
export async function gracefulShutdown() {
  if (!isDevMode) {
    // No telemetry to shutdown, resolve immediately
    return Promise.resolve();
  }

  return tracer.startActiveSpan(OTEL.span.shutdown.graceful(), {
    attributes: {
      'code.function': 'gracefulShutdown'
    }
  }, async (span) => {
    const logger = createNarrativeLogger('shutdown.graceful_shutdown');
    const startTime = Date.now();

    try {
      logger.start('Graceful shutdown', 'Beginning graceful shutdown of telemetry systems', {
        operation: 'graceful_shutdown',
        dev_mode: isDevMode
      });

      console.log('🔄 Shutting down logger, flushing logs...');

      return new Promise((resolve) => {
        // Force flush any remaining logs
        logger.progress('Flushing logs', 'Flushing batch processor logs to OTLP endpoint', {
          flush_target: 'batch_processor'
        });

        batchProcessor.forceFlush().then(() => {
          logger.progress('Logs flushed', 'Batch processor logs successfully flushed', {
            flush_status: 'success'
          });
          console.log('✅ Logs flushed successfully');

          // Import and shutdown OpenTelemetry SDK to flush metrics
          logger.progress('SDK shutdown', 'Importing tracing module and shutting down OpenTelemetry SDK', {
            shutdown_target: 'opentelemetry_sdk'
          });

          import('./tracing.js').then(({ default: sdk }) => {
            if (sdk) {
              return sdk.shutdown();
            } else {
              logger.decision('No SDK', 'No SDK found to shutdown, resolving immediately', {
                sdk_present: false,
                action: 'skip_shutdown'
              });
              return Promise.resolve();
            }
          }).then(() => {
            const shutdownDuration = Date.now() - startTime;
            const attrs = OTEL.attrs.shutdown.graceful({
              logsFlushed: true,
              sdkShutdown: true,
              shutdownDuration
            });

            span.setAttributes(attrs);

            // Emit metrics for shutdown analysis
            Object.entries(attrs).forEach(([name, value]) => {
              if (typeof value === 'number') {
                OTEL.metrics.histogram(name, value);
              } else if (typeof value === 'boolean') {
                OTEL.metrics.gauge(name, value ? 1 : 0);
              }
            });

            logger.complete('Shutdown complete', `Graceful shutdown completed successfully in ${shutdownDuration}ms`, {
              logs_flushed: true,
              sdk_shutdown: true,
              total_duration_ms: shutdownDuration
            });

            console.log('✅ OpenTelemetry SDK shutdown, metrics flushed');
            span.setStatus({ code: SpanStatusCode.OK, message: 'Graceful shutdown completed successfully' });
            resolve();
          }).catch((err) => {
            const shutdownDuration = Date.now() - startTime;

            logger.error('SDK shutdown', 'Error shutting down OpenTelemetry SDK', err, {
              error_type: 'sdk_shutdown_error',
              duration_ms: shutdownDuration
            });

            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            console.error('❌ Error shutting down SDK:', err);
            resolve();
          });
        }).catch((err) => {
          const shutdownDuration = Date.now() - startTime;

          logger.error('Log flush', 'Error flushing logs during shutdown', err, {
            error_type: 'log_flush_error',
            duration_ms: shutdownDuration
          });

          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          console.error('❌ Error flushing logs:', err);
          resolve();
        });
      });

    } catch (error) {
      const shutdownDuration = Date.now() - startTime;

      logger.error('Graceful shutdown', 'Unexpected error during graceful shutdown', error, {
        error_type: 'unexpected_shutdown_error',
        duration_ms: shutdownDuration
      });

      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Prevent multiple shutdown executions
let isShuttingDown = false;

// Only register shutdown handlers when dev mode is enabled
if (isDevMode) {
  const handleShutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    gracefulShutdown();
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

