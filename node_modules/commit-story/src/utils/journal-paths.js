import { promises as fs } from 'fs';
import fsSync from 'fs';
import { dirname, join } from 'path';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../telemetry/standards.js';
import { createNarrativeLogger } from './trace-logger.js';

// Get tracer instance for manual instrumentation
const tracer = trace.getTracer('commit-story', '1.0.0');

// Debug mode detection from config file
let isDebugMode = false;
try {
  const configPath = './commit-story.config.json';
  if (fsSync.existsSync(configPath)) {
    const configData = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
    isDebugMode = configData.debug === true;
  }
} catch (error) {
  // Silently ignore config file errors - debug mode defaults to false
}

/**
 * Journal Path Utilities
 * Reusable utilities for journal directory and file path management
 * Following OpenTelemetry semantic conventions for file system operations
 */

/**
 * Generate path components from date
 * @param {Date} date - Date object to format
 * @returns {Object} Path components {year, month, day, monthDir, fileName}
 */
export function formatDateComponents(date) {
  return tracer.startActiveSpan(OTEL.span.utils.journal_paths.format_date(), {
    attributes: {
      [`${OTEL.NAMESPACE}.date.input`]: date.toISOString(),
      'code.function': 'formatDateComponents'
    }
  }, (span) => {
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      const monthDir = `${year}-${month}`;
      const fileName = `${year}-${month}-${day}.md`;

      const components = { year, month, day, monthDir, fileName };

      span.setAttributes({
        [`${OTEL.NAMESPACE}.date.year`]: year,
        [`${OTEL.NAMESPACE}.date.month`]: month,
        [`${OTEL.NAMESPACE}.date.day`]: day,
        [`${OTEL.NAMESPACE}.path.month_dir`]: monthDir,
        [`${OTEL.NAMESPACE}.path.file_name`]: fileName
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return components;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Generate journal file path for entries or reflections
 * @param {string} type - Type of journal ('entries' or 'reflections')
 * @param {Date} date - Date for the journal entry
 * @returns {string} Full file path
 */
export function generateJournalPath(type, date) {
  return tracer.startActiveSpan(OTEL.span.utils.journal_paths.generate_path(), {
    attributes: {
      [`${OTEL.NAMESPACE}.journal.type`]: type,
      [`${OTEL.NAMESPACE}.date.input`]: date.toISOString(),
      'code.function': 'generateJournalPath'
    }
  }, (span) => {
    const logger = createNarrativeLogger('journal.path_generation');

    try {
      logger.start('path generation', `Generating ${type} journal path for ${date.toDateString()}`);

      const { monthDir, fileName } = formatDateComponents(date);
      const filePath = join(process.cwd(), 'journal', type, monthDir, fileName);

      span.setAttributes({
        [`${OTEL.NAMESPACE}.path.type`]: type,
        [`${OTEL.NAMESPACE}.path.month_dir`]: monthDir,
        [`${OTEL.NAMESPACE}.path.file_name`]: fileName,
        [`${OTEL.NAMESPACE}.path.full_path`]: filePath,
        'file.path': filePath // OpenTelemetry semantic convention
      });

      // Emit path generation metric
      OTEL.metrics.counter('commit_story.utils.path_generated', 1, {
        journal_type: type,
        operation: 'generate_path'
      });

      logger.complete('path generation', `Generated path: journal/${type}/${monthDir}/${fileName}`);
      span.setStatus({ code: SpanStatusCode.OK });

      return filePath;
    } catch (error) {
      logger.error('path generation', 'Failed to generate journal path', error, {
        type,
        date: date.toISOString()
      });

      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Ensure journal directory exists, create if needed
 * @param {string} filePath - Full file path (directory will be extracted)
 * @returns {Promise<boolean>} True if directory was created, false if already existed
 */
export async function ensureJournalDirectory(filePath) {
  return await tracer.startActiveSpan(OTEL.span.utils.journal_paths.create_directory(), {
    attributes: {
      [`${OTEL.NAMESPACE}.path.target`]: filePath,
      'code.function': 'ensureJournalDirectory',
      'code.filepath': filePath // OpenTelemetry semantic convention
    }
  }, async (span) => {
    const logger = createNarrativeLogger('journal.directory_creation');
    const startTime = Date.now();

    try {
      const dirPath = dirname(filePath);
      const pathParts = dirPath.split('/');
      const monthDir = pathParts[pathParts.length - 1];
      const journalType = pathParts[pathParts.length - 2];

      logger.start('directory creation', `Ensuring ${journalType} directory exists: ${monthDir}`);

      span.setAttributes({
        [`${OTEL.NAMESPACE}.directory.path`]: dirPath,
        [`${OTEL.NAMESPACE}.directory.month`]: monthDir,
        [`${OTEL.NAMESPACE}.directory.type`]: journalType,
        'file.directory': dirPath // OpenTelemetry semantic convention
      });

      let dirCreated = false;
      try {
        await fs.mkdir(dirPath, { recursive: true });
        dirCreated = true;
        logger.progress('directory creation', `Created directory structure: ${monthDir}`);
      } catch (dirError) {
        if (dirError.code === 'EEXIST') {
          // Directory exists - this is fine
          dirCreated = false;
          logger.progress('directory creation', 'Directory already exists');
        } else {
          // Real error - permission or other issue
          if (isDebugMode) {
            console.error(`❌ Failed to create journal directory: ${dirError.message}`);
            console.error(`   Path: ${dirPath}`);
          }
          logger.error('directory creation', 'Failed to create directory', dirError, {
            targetPath: dirPath,
            errorCode: dirError.code
          });
          throw dirError; // Don't continue if we can't create the directory
        }
      }

      const operationDuration = Date.now() - startTime;

      span.setAttributes({
        [`${OTEL.NAMESPACE}.directory.created`]: dirCreated,
        [`${OTEL.NAMESPACE}.directory.operation_duration_ms`]: operationDuration
      });

      // Emit directory operation metrics
      OTEL.metrics.counter('commit_story.utils.directory_operations', 1, {
        journal_type: journalType,
        operation: 'ensure_directory',
        created: dirCreated.toString()
      });

      OTEL.metrics.histogram('commit_story.utils.directory_operation_duration_ms', operationDuration, {
        journal_type: journalType,
        operation: 'ensure_directory'
      });

      if (dirCreated) {
        OTEL.metrics.counter('commit_story.utils.directories_created', 1, {
          journal_type: journalType
        });
      }

      logger.complete('directory creation', `Directory operation complete (created: ${dirCreated})`);
      span.setStatus({ code: SpanStatusCode.OK });

      return dirCreated;
    } catch (error) {
      const operationDuration = Date.now() - startTime;

      logger.error('directory creation', 'Failed to ensure directory exists', error, {
        targetPath: filePath,
        duration: operationDuration
      });

      span.setAttributes({
        [`${OTEL.NAMESPACE}.directory.operation_duration_ms`]: operationDuration,
        [`${OTEL.NAMESPACE}.directory.created`]: false
      });

      // Emit error metrics
      OTEL.metrics.counter('commit_story.utils.directory_errors', 1, {
        operation: 'ensure_directory',
        error_type: error.name
      });

      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Get timezone-aware timestamp string for journal entries
 * @param {Date} date - Date object to format
 * @returns {string} Formatted time string with timezone
 */
export function getTimezonedTimestamp(date) {
  return tracer.startActiveSpan(OTEL.span.utils.journal_paths.format_timestamp(), {
    attributes: {
      [`${OTEL.NAMESPACE}.date.input`]: date.toISOString(),
      'code.function': 'getTimezonedTimestamp'
    }
  }, (span) => {
    try {
      const timeString = date.toLocaleTimeString('en-US', {
        hour12: true,
        timeZoneName: 'short'
      });

      span.setAttributes({
        [`${OTEL.NAMESPACE}.timestamp.formatted`]: timeString,
        [`${OTEL.NAMESPACE}.timestamp.timezone`]: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return timeString;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Legacy compatibility function for existing journal entries
 * @param {Date} date - Date for journal entry
 * @returns {string} File path for journal entries
 */
export function getJournalFilePath(date) {
  return generateJournalPath('entries', date);
}