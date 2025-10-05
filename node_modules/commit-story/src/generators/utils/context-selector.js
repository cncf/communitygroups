/**
 * Context Selection Utility
 *
 * Enables generators to opt-in to specific context data and automatically
 * generates accurate descriptions for AI prompts.
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../../telemetry/standards.js';
import { createNarrativeLogger } from '../../utils/trace-logger.js';

// Get tracer instance for context selection instrumentation
const tracer = trace.getTracer('commit-story-utils', '1.0.0');

/**
 * Selects specific context pieces and generates accurate descriptions
 *
 * @param {Object} context - Self-documenting context object from context-integrator
 * @param {string[]} selections - Array of context keys to select (e.g., ['commit', 'chatMessages'])
 * @returns {Object} Selected data with auto-generated description
 * @returns {Object} return.data - The selected context data
 * @returns {string} return.description - Accurate description of available data
 */
export function selectContext(context, selections) {
  return tracer.startActiveSpan(OTEL.span.utils.contextSelect(), {
    attributes: {
      ...OTEL.attrs.utils.contextSelect({
        selectionsRequested: selections.length
      })
    }
  }, (span) => {
    // Emit initial request metrics for context selection analysis
    const requestAttrs = OTEL.attrs.utils.contextSelect({
      selectionsRequested: selections.length
    });
    Object.entries(requestAttrs).forEach(([name, value]) => {
      if (typeof value === 'number') {
        OTEL.metrics.gauge(name, value);
      }
    });
    const logger = createNarrativeLogger('utils.select_context');

    try {
      const startTime = Date.now();

      logger.start('context selection', `Selecting context pieces: [${selections.join(', ')}]`);

      // Build selected data object
      const selectedData = {};
      const descriptions = [];
      const foundKeys = [];
      const missingKeys = [];

      selections.forEach(key => {
        if (context[key]) {
          selectedData[key] = context[key].data;
          descriptions.push(context[key].description);
          foundKeys.push(key);
        } else {
          missingKeys.push(key);
        }
      });

      if (missingKeys.length > 0) {
        logger.progress('context selection', `Missing context keys: [${missingKeys.join(', ')}] - skipping`);
      }

      logger.progress('context selection', `Found ${foundKeys.length} of ${selections.length} requested context pieces`);

      // Generate description of what's actually available
      const description = descriptions.length > 0
        ? `AVAILABLE DATA:\n- ${descriptions.join('\n- ')}`
        : 'AVAILABLE DATA: (none selected)';

      logger.progress('context selection', `Generated description: ${Math.round(description.length / 10) * 10} characters`);

      const result = {
        data: selectedData,
        description: description
      };

      if (descriptions.length === 0) {
        logger.complete('context selection', 'No context data selected - empty result');
      } else {
        logger.complete('context selection', `Selected data ready: [${foundKeys.join(', ')}]`);
      }

      // Track completion metrics
      const completionAttrs = OTEL.attrs.utils.contextSelect({
        selectionsFound: descriptions.length,
        descriptionLength: description.length,
        dataKeys: Object.keys(selectedData).join(','),
        processingDuration: Date.now() - startTime
      });
      span.setAttributes(completionAttrs);

      // Emit completion metrics for utility performance analysis
      Object.entries(completionAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      logger.error('context selection', 'Context selection failed', error, {
        requestedKeys: selections.join(',')
      });
      throw error;
    } finally {
      span.end();
    }
  });
}