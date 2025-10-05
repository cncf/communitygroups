/**
 * OpenAI Client Configuration
 * Handles API client setup with environment-based configuration
 */

import OpenAI from 'openai';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL, getProviderFromModel } from '../telemetry/standards.js';

// Get tracer instance for manual instrumentation
const tracer = trace.getTracer('commit-story', '1.0.0');

export function createOpenAIClient() {
  return tracer.startActiveSpan(OTEL.span.config.openai(), {
    attributes: {
      ...OTEL.attrs.config.openai({
        apiKeyValid: !!process.env.OPENAI_API_KEY,
        model: DEFAULT_MODEL,
        provider: getProviderFromModel(DEFAULT_MODEL),
        initDuration: 0
      }),
      'code.function': 'createOpenAIClient'
    }
  }, (span) => {
    // Emit initial config metrics for OpenAI client analysis
    const requestAttrs = OTEL.attrs.config.openai({
      apiKeyValid: !!process.env.OPENAI_API_KEY,
      model: DEFAULT_MODEL,
      provider: getProviderFromModel(DEFAULT_MODEL),
      initDuration: 0
    });
    Object.entries(requestAttrs).forEach(([name, value]) => {
      if (typeof value === 'number' || typeof value === 'boolean') {
        OTEL.metrics.gauge(name, typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    });
    const startTime = Date.now();

    try {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Missing API key' });
        throw new Error(
          'OPENAI_API_KEY environment variable is required. ' +
          'Please set it in your .env file or environment.'
        );
      }

      const client = new OpenAI({
        apiKey,
      });

      // Update span with final metrics
      const finalAttrs = {
        [`${OTEL.NAMESPACE}.config.init_duration_ms`]: Date.now() - startTime
      };
      span.setAttributes(finalAttrs);

      // Emit final metrics for config initialization analysis
      Object.entries(finalAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });
      span.setStatus({ code: SpanStatusCode.OK, message: 'OpenAI client initialized successfully' });

      return client;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

export const DEFAULT_MODEL = 'gpt-4o-mini';