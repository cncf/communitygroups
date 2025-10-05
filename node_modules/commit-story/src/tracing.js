import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader, AggregationTemporality } from '@opentelemetry/sdk-metrics';
import fs from 'fs';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from './telemetry/standards.js';
import { createNarrativeLogger } from './utils/trace-logger.js';
import { shutdownWithTimeout } from './utils/shutdown-helper.js';

// Check if running from test script - only show console traces during testing
const isTestScript = process.argv[1]?.includes('test-otel');

// Get configuration synchronously during bootstrap
const { debug: isDebugMode, dev: isDevMode } = (() => {
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

// Only initialize telemetry when dev mode is enabled
let sdk = null;

// Instrument conditional telemetry initialization
function initializeTelemetryConditionally() {
  // We need to use a simple tracer since the SDK might not be initialized yet
  const simpleTracer = {
    startActiveSpan: (name, options, fn) => {
      const startTime = Date.now();
      const logger = createNarrativeLogger('initialization.telemetry_setup');

      try {
        logger.start('Telemetry initialization', `Checking telemetry initialization conditions`, {
          dev_mode: isDevMode,
          test_script: isTestScript
        });

        const result = fn({
          setAttributes: () => {},
          setStatus: () => {},
          recordException: () => {},
          end: () => {}
        });

        const duration = Date.now() - startTime;
        logger.complete('Telemetry setup', `Telemetry initialization completed in ${duration}ms`, {
          sdk_initialized: result !== null,
          initialization_duration_ms: duration
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Telemetry setup', 'Error during telemetry initialization', error, {
          initialization_duration_ms: duration
        });
        throw error;
      }
    }
  };

  return simpleTracer.startActiveSpan(OTEL.span.initialization.telemetry(), {
    attributes: {
      'code.function': 'initializeTelemetryConditionally'
    }
  }, (span) => {
    const logger = createNarrativeLogger('initialization.telemetry_setup');
    const startTime = Date.now();

    try {
      logger.decision('Condition check', `Telemetry initialization condition: dev mode = ${isDevMode}`, {
        dev_mode_enabled: isDevMode,
        condition_met: isDevMode
      });

      if (!isDevMode) {
        logger.decision('Skip initialization', 'Telemetry disabled - dev mode is false', {
          skip_reason: 'dev_mode_disabled',
          sdk_initialized: false
        });
        return null;
      }

      logger.progress('Starting initialization', 'Dev mode enabled, initializing telemetry stack', {
        service_name: 'commit-story-dev',
        service_version: '1.0.0'
      });

      return initializeSDK(logger, startTime, span);

    } catch (error) {
      const initializationDuration = Date.now() - startTime;
      logger.error('Telemetry initialization', 'Failed to initialize telemetry', error, {
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

function initializeSDK(logger, startTime, span) {
  logger.progress('OTLP configuration', 'Configuring OTLP exporters for Datadog Agent', {
    trace_endpoint: 'http://localhost:4318/v1/traces',
    metrics_endpoint: 'http://localhost:4318/v1/metrics'
  });
  // Create OTLP exporter for Datadog Agent (localhost:4318)
  const otlpTraceExporter = new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
    headers: {
      // Add any required headers for Datadog OTLP ingestion
    },
  });

  // Create OTLP metric exporter for Datadog Agent (localhost:4318)
  const otlpMetricExporter = new OTLPMetricExporter({
    url: 'http://localhost:4318/v1/metrics',
    temporalityPreference: AggregationTemporality.DELTA, // Required for Datadog OTLP ingest
    headers: {
      // Add any required headers for Datadog OTLP ingestion
    },
  });

  // Build span processors array - conditionally include console exporter
  const spanProcessors = [
    // OTLP exporter for Datadog with batching
    new BatchSpanProcessor(otlpTraceExporter, {
      maxExportBatchSize: 10, // Batch for efficiency
      scheduledDelayMillis: 1000, // 1 second delay for network calls
    }),
  ];

  // Only add console exporter when running test script
  if (isTestScript) {
    const consoleExporter = new ConsoleSpanExporter();
    spanProcessors.unshift(
      new BatchSpanProcessor(consoleExporter, {
        maxExportBatchSize: 1, // Export immediately for development
        scheduledDelayMillis: 100, // Minimal delay
      })
    );
  }

  // Initialize Node SDK with dual span processors and metrics
  sdk = new NodeSDK({
    serviceName: 'commit-story-dev',
    serviceVersion: '1.0.0',
    spanProcessors,
    // Configure dual metric readers
    metricReader: new PeriodicExportingMetricReader({
      exporter: otlpMetricExporter,
      exportIntervalMillis: 5000, // Export every 5 seconds for development (ensures short commits work)
    }),
    instrumentations: [
      // Auto-instrument common libraries
      getNodeAutoInstrumentations({
        // Disable instrumentations we don't need yet
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });

  // Initialize tracing
  sdk.start();

  const initializationDuration = Date.now() - startTime;
  const attrs = OTEL.attrs.initialization.telemetry({
    sdkInitialized: true,
    serviceName: 'commit-story-dev',
    serviceVersion: '1.0.0',
    otlpEndpoint: 'http://localhost:4318',
    consoleOutput: isTestScript,
    initializationDuration
  });

  span.setAttributes(attrs);
  span.setStatus({ code: SpanStatusCode.OK, message: 'Telemetry initialized successfully' });

  logger.complete('SDK initialization', 'OpenTelemetry SDK initialized successfully', {
    service_name: 'commit-story-dev',
    traces_enabled: true,
    metrics_enabled: true,
    console_output: isTestScript,
    initialization_duration_ms: initializationDuration
  });

  // Only show initialization messages in test script or debug mode
  if (isTestScript) {
    console.log('🔭 OpenTelemetry observability stack initialized:');
    console.log('  ✅ Traces: Console + OTLP to Datadog Agent (localhost:4318)');
    console.log('  ✅ Metrics: OTLP to Datadog Agent (localhost:4318)');
    console.log('  📊 Service: commit-story-dev');
  } else if (isDebugMode) {
    console.log('OpenTelemetry initialized');
  }

  return sdk;
}

// Execute conditional initialization
sdk = initializeTelemetryConditionally();

/**
 * Gracefully shutdown telemetry with timeout
 * @param {Object} options - Shutdown options
 * @param {number} options.timeoutMs - Maximum time to wait for shutdown (default: 2000ms)
 * @returns {Promise<{success: boolean, error?: Error}>} Export status
 */
export async function shutdownTelemetry({ timeoutMs = 2000 } = {}) {
  if (!sdk) {
    // Telemetry not initialized (dev mode disabled), nothing to shutdown
    return { success: true };
  }

  try {
    await shutdownWithTimeout(() => sdk.shutdown(), timeoutMs, 'Telemetry');
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export default sdk;