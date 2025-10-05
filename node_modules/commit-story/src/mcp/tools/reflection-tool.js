/**
 * Journal Reflection Tool
 *
 * MCP tool for adding timestamped reflections to development journal.
 * Integrates with existing journal infrastructure and telemetry.
 */

import { promises as fs } from 'fs';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../../telemetry/standards.js';
import { createNarrativeLogger } from '../../utils/trace-logger.js';
import { generateJournalPath, ensureJournalDirectory, getTimezonedTimestamp } from '../../utils/journal-paths.js';

// Initialize telemetry
const tracer = trace.getTracer('commit-story', '1.0.0');
const logger = createNarrativeLogger('reflection.creation');

/**
 * Create a journal reflection with full telemetry
 * @param {Object} args - Tool arguments {text, timestamp?}
 * @param {import('@opentelemetry/api').Span} parentSpan - Parent MCP span
 * @returns {Promise<Object>} MCP tool response
 */
export async function createReflectionTool(args, parentSpan) {
  return tracer.startActiveSpan(OTEL.span.mcp.tool.journal_add_reflection(), {
    attributes: {
      'code.function': 'createReflectionTool'
    },
    parent: parentSpan
  }, async (span) => {
    const startTime = Date.now();

    try {
      // Validate input
      if (!args || typeof args !== 'object') {
        throw new Error('Invalid arguments: expected object with text property');
      }

      if (!args.text || typeof args.text !== 'string') {
        throw new Error('Missing or invalid text: reflection text is required');
      }

      if (args.text.trim().length === 0) {
        throw new Error('Empty reflection: text cannot be empty or whitespace only');
      }

      if (args.text.length > 10000) {
        throw new Error('Reflection too long: maximum 10,000 characters allowed');
      }

      // Parse timestamp (use provided or current time)
      const timestamp = args.timestamp ? new Date(args.timestamp) : new Date();

      if (isNaN(timestamp.getTime())) {
        throw new Error('Invalid timestamp format: use ISO 8601 format (e.g., "2025-09-22T10:30:00Z")');
      }

      const reflectionText = args.text.trim();

      logger.start('reflection.creation', 'Creating journal reflection', {
        text_length: reflectionText.length,
        timestamp: timestamp.toISOString(),
        has_custom_timestamp: !!args.timestamp
      });

      // Generate reflection file path (use 'reflections' type)
      const filePath = generateJournalPath('reflections', timestamp);

      // Ensure directory exists
      await ensureJournalDirectory(filePath);

      // Format reflection entry
      const formattedTimestamp = getTimezonedTimestamp(timestamp);
      const reflectionEntry = `## ${formattedTimestamp}

${reflectionText}

═══════════════════════════════════════

`;

      // Check if file exists and append or create
      let fileCreated = false;
      try {
        await fs.access(filePath);
        logger.progress('reflection.creation', 'Appending to existing reflection file', {
          file_path: filePath
        });
      } catch (error) {
        fileCreated = true;
        logger.progress('reflection.creation', 'Creating new reflection file', {
          file_path: filePath
        });
      }

      // Write reflection to file with telemetry
      await tracer.startActiveSpan(OTEL.span.utils.journal_paths.write_file(), {
        attributes: {
          'code.function': 'writeReflectionFile',
          'code.filepath': filePath,
          'file.operation': 'append',
          [`${OTEL.NAMESPACE}.reflection.file_created`]: fileCreated,
          [`${OTEL.NAMESPACE}.reflection.content_size`]: reflectionEntry.length
        }
      }, async (writeSpan) => {
        try {
          await fs.appendFile(filePath, reflectionEntry, 'utf8');
          writeSpan.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          writeSpan.recordException(error);
          writeSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          throw error;
        } finally {
          writeSpan.end();
        }
      });

      const processingDuration = Date.now() - startTime;

      // Set comprehensive telemetry attributes
      const directory = filePath.substring(0, filePath.lastIndexOf('/'));
      const telemetryData = {
        textLength: reflectionText.length,
        timestamp: timestamp.toISOString(),
        fileCreated: fileCreated,
        filePath: filePath,
        directory: directory
      };

      span.setAttributes({
        ...OTEL.attrs.mcp.reflection(telemetryData),
        [`${OTEL.NAMESPACE}.reflection.processing_duration_ms`]: processingDuration,
        [`${OTEL.NAMESPACE}.reflection.has_custom_timestamp`]: !!args.timestamp
      });

      // Emit metrics for dual visibility
      OTEL.metrics.counter('commit_story.reflections.added', 1, {
        'reflection.file_created': fileCreated.toString(),
        'reflection.has_custom_timestamp': (!!args.timestamp).toString()
      });

      OTEL.metrics.gauge('commit_story.reflections.size', reflectionText.length, {
        'reflection.timestamp': timestamp.toISOString().split('T')[0] // Date only
      });

      OTEL.metrics.histogram('commit_story.reflection.processing_duration_ms', processingDuration, {
        'reflection.operation': fileCreated ? 'create' : 'append'
      });

      // Count daily reflections (for dashboard visibility)
      const dateString = timestamp.toISOString().split('T')[0];
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const entryCount = (fileContent.match(/## \d{2}:\d{2}:\d{2}/g) || []).length;

        OTEL.metrics.gauge('commit_story.reflections.daily_count', entryCount, {
          'reflection.date': dateString
        });
      } catch (error) {
        // Don't fail the whole operation if count fails
        span.recordException(error);
      }

      logger.complete('reflection.creation', 'Journal reflection created successfully', {
        file_path: filePath,
        text_length: reflectionText.length,
        file_created: fileCreated,
        processing_duration_ms: processingDuration
      });

      span.setStatus({ code: SpanStatusCode.OK });

      return {
        content: [{
          type: 'text',
          text: '✅ Reflection added successfully!'
        }],
        isError: false
      };

    } catch (error) {
      const processingDuration = Date.now() - startTime;

      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      span.setAttributes({
        [`${OTEL.NAMESPACE}.reflection.processing_duration_ms`]: processingDuration,
        [`${OTEL.NAMESPACE}.reflection.error_type`]: error.name
      });

      logger.error('reflection.creation', 'Failed to create journal reflection', error, {
        text_length: args?.text?.length || 0,
        has_text: !!args?.text,
        processing_duration_ms: processingDuration
      });

      OTEL.metrics.counter('commit_story.reflections.errors', 1, {
        'error.type': error.name,
        'error.validation': error.message.includes('Invalid') || error.message.includes('Missing') ? 'true' : 'false'
      });

      // Return MCP error response
      const errorMessage = `❌ **Failed to add reflection**\n\n🔍 **Error**: ${error.message}\n\n💡 **Help**: Make sure your reflection text is not empty and any custom timestamp follows ISO 8601 format.`;

      return {
        content: [{
          type: 'text',
          text: errorMessage
        }],
        isError: true
      };
    }
  });
}