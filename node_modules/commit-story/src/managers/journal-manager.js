import { promises as fs } from 'fs';
import fsSync from 'fs';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../telemetry/standards.js';
import { createNarrativeLogger } from '../utils/trace-logger.js';
import { generateJournalPath, ensureJournalDirectory, getTimezonedTimestamp } from '../utils/journal-paths.js';

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
 * Journal File Management System
 * Handles saving journal entries to daily markdown files with monthly directory organization
 */

/**
 * Saves a journal entry to the appropriate daily file
 * @param {string} commitHash - Git commit hash
 * @param {string} timestamp - ISO timestamp string
 * @param {string} commitMessage - First line of commit message
 * @param {Object} sections - Object containing all journal sections
 * @param {string} sections.summary - Generated summary content
 * @param {string} sections.dialogue - Generated dialogue content
 * @param {string} sections.technicalDecisions - Generated technical decisions content
 * @param {string} sections.commitDetails - Generated commit details content
 * @param {Date|null} previousCommitTime - Previous commit timestamp for reflection window calculation
 * @returns {Promise<string>} - Path to the file where entry was saved
 */
export async function saveJournalEntry(commitHash, timestamp, commitMessage, sections, previousCommitTime = null) {
  return await tracer.startActiveSpan(OTEL.span.journal.save(), {
    attributes: {
      [`${OTEL.NAMESPACE}.commit.hash`]: commitHash,
      [`${OTEL.NAMESPACE}.commit.message`]: commitMessage?.split('\n')[0],
      'code.function': 'saveJournalEntry'
    }
  }, async (span) => {
    const logger = createNarrativeLogger('journal.save_entry');
    const startTime = Date.now();

    try {
      logger.start('journal entry save', `Saving journal entry for commit: ${commitHash.slice(0, 8)}`);

      const date = new Date(timestamp);

      // Use extracted utilities for path generation and directory creation
      const filePath = generateJournalPath('entries', date);
      const pathParts = filePath.split('/');
      const monthDir = pathParts[pathParts.length - 2];
      const fileName = pathParts[pathParts.length - 1];

      logger.progress('journal entry save', `Target file: ${monthDir}/${fileName}`);

      // Discover reflections within commit development window
      const reflections = await discoverReflections(date, previousCommitTime);
      logger.progress('journal entry save', `Found ${reflections.length} reflections for commit window`);

      // Format entry for file or stdout
      const formattedEntry = formatJournalEntry(timestamp, commitHash, commitMessage, sections, reflections);

      // Create directory structure if it doesn't exist using extracted utility
      const dirCreated = await ensureJournalDirectory(filePath);

      const entrySizeKB = Math.round(formattedEntry.length / 1024);
      logger.progress('journal entry save', `Writing ${entrySizeKB}KB journal entry to daily file`);

      // Append to daily file
      await fs.appendFile(filePath, formattedEntry, 'utf8');

      // Record successful save metrics
      const saveData = {
        filePath: filePath,
        entrySize: formattedEntry.length,
        dirCreated: dirCreated,
        writeDuration: Date.now() - startTime
      };
      span.setAttributes(OTEL.attrs.journal.save(saveData));

      // Dual emission: emit key journal metrics
      OTEL.metrics.gauge('commit_story.journal.entry_size', saveData.entrySize);
      OTEL.metrics.histogram('commit_story.journal.write_duration_ms', saveData.writeDuration);
      OTEL.metrics.counter('commit_story.journal.entries_saved', 1);

      logger.complete('journal entry save', `Journal entry saved successfully to ${fileName}`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Journal entry saved successfully' });
      return filePath;

    } catch (error) {
      // Record error metrics
      const errorAttrs = OTEL.attrs.journal.save({
        filePath: 'stdout (file write failed)',
        entrySize: 0,
        dirCreated: false,
        writeDuration: Date.now() - startTime
      });
      span.setAttributes(errorAttrs);

      // Emit error metrics for journal failure analysis
      Object.entries(errorAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        } else if (typeof value === 'boolean') {
          OTEL.metrics.gauge(name, value ? 1 : 0);
        }
      });

      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      if (isDebugMode) {
        console.error(`❌ Failed to write journal file: ${error.message}`);
        console.error(`   Target path: ${filePath}`);
      }
      logger.error('journal entry save', 'Failed to write journal file', error, {
        targetPath: filePath
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Formats the complete journal entry
 * Uses time-only headers since date is provided by filename context
 *
 * @param {string} timestamp - ISO timestamp string
 * @param {string} commitHash - Git commit hash
 * @param {string} commitMessage - First line of commit message
 * @param {Object} sections - All journal sections
 * @param {Array} reflections - Array of reflection objects
 * @returns {string} Complete formatted journal entry
 */
function formatJournalEntry(timestamp, commitHash, commitMessage, sections, reflections = []) {
  return tracer.startActiveSpan(OTEL.span.journal.format(), {
    attributes: {
      [`${OTEL.NAMESPACE}.commit.hash`]: commitHash.substring(0, 8),
      [`${OTEL.NAMESPACE}.commit.message`]: commitMessage?.split('\n')[0],
      'code.function': 'formatJournalEntry'
    }
  }, (span) => {
    const logger = createNarrativeLogger('journal.format_entry');
    const startTime = Date.now();

    try {
      logger.start('journal entry formatting', `Formatting journal entry for commit: ${commitHash.slice(0, 8)}`);

      const date = new Date(timestamp);

      // Format time with user's local timezone using extracted utility
      const timeString = getTimezonedTimestamp(date);

      const shortHash = commitHash.substring(0, 8);

      logger.progress('journal entry formatting', `Building entry structure with ${reflections.length} reflections`);

      // Build journal entry with visual separation and four-section structure
      let entry = '\n\n';  // Newlines for visual separation between entries

      // Time-only header with commit label and message
      entry += `## ${timeString} - Commit: ${shortHash} - ${commitMessage}\n\n`;

      // Summary section
      entry += `### Summary - ${shortHash}\n\n`;
      entry += sections.summary + '\n\n';

      // Development Dialogue section
      entry += `### Development Dialogue - ${shortHash}\n\n`;
      entry += sections.dialogue + '\n\n';

      // Technical Decisions section
      entry += `### Technical Decisions - ${shortHash}\n\n`;
      entry += sections.technicalDecisions + '\n\n';

      // Developer Reflections section (only if reflections exist)
      if (reflections.length > 0) {
        entry += `### Developer Reflections - ${shortHash}\n\n`;

        for (const reflection of reflections) {
          entry += `**${reflection.timeString}**\n\n`;
          entry += reflection.content.join('\n') + '\n\n';
        }
        logger.progress('journal entry formatting', `Added ${reflections.length} reflections to entry`);
      }

      // Commit Details section
      entry += `### Commit Details - ${shortHash}\n\n`;
      entry += sections.commitDetails + '\n\n';

      // Separator for multiple entries in same day
      entry += '═══════════════════════════════════════\n\n';

      // Record successful format metrics
      const formatData = {
        entrySize: entry.length,
        reflectionCount: reflections.length,
        sectionCount: 4, // Summary, Dialogue, Technical, Details (reflections are conditional)
        formatDuration: Date.now() - startTime
      };
      span.setAttributes(OTEL.attrs.journal.format(formatData));

      // Dual emission: emit key formatting metrics
      OTEL.metrics.gauge('commit_story.journal.formatted_entry_size', formatData.entrySize);
      OTEL.metrics.gauge('commit_story.journal.reflection_count', formatData.reflectionCount);
      OTEL.metrics.histogram('commit_story.journal.format_duration_ms', formatData.formatDuration);

      logger.complete('journal entry formatting', `Formatted ${Math.round(entry.length / 1024)}KB entry with ${reflections.length} reflections`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Journal entry formatted successfully' });
      return entry;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      logger.error('journal entry formatting', 'Failed to format journal entry', error, {
        commitHash: commitHash?.slice(0, 8)
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Discover reflections within a commit development window
 * @param {Date} commitTime - End time of the commit window
 * @param {Date|null} previousCommitTime - Start time of the commit window (or null for first commit)
 * @returns {Promise<Array>} Array of reflection objects with timestamp and content
 */
export async function discoverReflections(commitTime, previousCommitTime) {
  return await tracer.startActiveSpan(OTEL.span.journal.discover_reflections(), {
    attributes: {
      [`${OTEL.NAMESPACE}.commit.time`]: commitTime.toISOString(),
      [`${OTEL.NAMESPACE}.commit.previous_time`]: previousCommitTime?.toISOString() || null,
      'code.function': 'discoverReflections'
    }
  }, async (span) => {
    const logger = createNarrativeLogger('journal.discover_reflections');
    const startTime = Date.now();

    try {
      const reflections = [];
      // Use previous commit time as start, or default to 24 hours before if no previous commit
      const searchStartTime = previousCommitTime || new Date(commitTime.getTime() - (24 * 60 * 60 * 1000));

      // Calculate time window for discovery
      const timeWindowMs = commitTime.getTime() - searchStartTime.getTime();
      const timeWindowHours = Math.round(timeWindowMs / (60 * 60 * 1000) * 10) / 10;

      logger.start('reflection discovery', `Discovering reflections in ${timeWindowHours}h window ending at ${commitTime.toISOString()}`);

      // Generate date range to check for reflection files
      const daysToCheck = Math.ceil(timeWindowMs / (24 * 60 * 60 * 1000)) + 1;

      logger.progress('reflection discovery', `Checking ${daysToCheck} days for reflection files`);

      let filesChecked = 0;
      let filesFound = 0;

      for (let i = 0; i < daysToCheck; i++) {
        const checkDate = new Date(searchStartTime.getTime() + (i * 24 * 60 * 60 * 1000));
        const reflectionPath = generateJournalPath('reflections', checkDate);

        filesChecked++;

        try {
          if (fsSync.existsSync(reflectionPath)) {
            filesFound++;
            const content = await fs.readFile(reflectionPath, 'utf8');
            const reflectionEntries = parseReflectionFile(content, checkDate, searchStartTime, commitTime);
            reflections.push(...reflectionEntries);

            if (reflectionEntries.length > 0) {
              logger.progress('reflection discovery', `Found ${reflectionEntries.length} reflections in ${reflectionPath.split('/').pop()}`);
            }
          }
        } catch (error) {
          // Silently ignore file read errors but log for debugging
          if (isDebugMode) {
            console.warn(`Could not read reflection file ${reflectionPath}: ${error.message}`);
          }
        }
      }

      const sortedReflections = reflections.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Record successful discovery metrics
      const discoveryData = {
        filesChecked: filesChecked,
        reflectionsFound: sortedReflections.length,
        timeWindowHours: timeWindowHours,
        discoveryDuration: Date.now() - startTime
      };
      span.setAttributes(OTEL.attrs.journal.discovery(discoveryData));

      // Dual emission: emit key discovery metrics
      OTEL.metrics.gauge('commit_story.journal.reflection_files_checked', discoveryData.filesChecked);
      OTEL.metrics.gauge('commit_story.journal.reflections_discovered', discoveryData.reflectionsFound);
      OTEL.metrics.gauge('commit_story.journal.discovery_time_window_hours', discoveryData.timeWindowHours);
      OTEL.metrics.histogram('commit_story.journal.discovery_duration_ms', discoveryData.discoveryDuration);

      logger.complete('reflection discovery', `Discovered ${sortedReflections.length} reflections from ${filesFound}/${filesChecked} files in ${timeWindowHours}h window`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Reflection discovery completed successfully' });
      return sortedReflections;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      logger.error('reflection discovery', 'Failed to discover reflections', error, {
        timeWindow: `${commitTime.toISOString()} - ${previousCommitTime?.toISOString() || 'default'}`
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Parse reflection file content and extract entries within time window
 * @param {string} content - File content
 * @param {Date} fileDate - Date of the reflection file
 * @param {Date} startTime - Start of search window
 * @param {Date} endTime - End of search window
 * @returns {Array} Array of reflection objects
 */
function parseReflectionFile(content, fileDate, startTime, endTime) {
  return tracer.startActiveSpan(OTEL.span.journal.parse_reflection_file(), {
    attributes: {
      [`${OTEL.NAMESPACE}.reflection.file_date`]: fileDate.toISOString(),
      [`${OTEL.NAMESPACE}.reflection.window_start`]: startTime.toISOString(),
      [`${OTEL.NAMESPACE}.reflection.window_end`]: endTime.toISOString(),
      'code.function': 'parseReflectionFile'
    }
  }, (span) => {
    const logger = createNarrativeLogger('journal.parse_reflection_file');
    const parseStartTime = Date.now();

    try {
      logger.start('reflection file parsing', `Parsing ${Math.round(content.length / 1024)}KB reflection file for ${fileDate.toDateString()}`);

      const reflections = [];
      const lines = content.split('\n');
      let currentReflection = null;
      let timestampHeadersFound = 0;
      let contentLinesProcessed = 0;

      logger.progress('reflection file parsing', `Processing ${lines.length} lines for time window ${startTime.toISOString()} to ${endTime.toISOString()}`);

      for (const line of lines) {
        contentLinesProcessed++;

        // Look for timestamp headers (## HH:MM:SS [TIMEZONE])
        const timestampMatch = line.match(/^## (\d{1,2}:\d{2}:\d{2} (?:AM|PM) [A-Z]{3,4})$/);

        if (timestampMatch) {
          timestampHeadersFound++;

          // Save previous reflection if it exists
          if (currentReflection) {
            reflections.push(currentReflection);
          }

          // Parse timestamp and create full datetime
          const timeString = timestampMatch[1];
          const reflectionTime = parseReflectionTimestamp(fileDate, timeString);

          // Check if reflection falls within time window
          if (reflectionTime >= startTime && reflectionTime <= endTime) {
            currentReflection = {
              timestamp: reflectionTime,
              timeString: timeString,
              content: []
            };
          } else {
            currentReflection = null;
          }
        } else if (currentReflection && line.trim() && !line.match(/^═+$/)) {
          // Add content lines (skip empty lines and separators)
          currentReflection.content.push(line);
        }
      }

      // Don't forget the last reflection
      if (currentReflection) {
        reflections.push(currentReflection);
      }

      // Record successful parsing metrics
      const parseData = {
        fileSize: content.length,
        linesParsed: lines.length,
        entriesExtracted: reflections.length,
        parseDuration: Date.now() - parseStartTime,
        filePath: generateJournalPath('reflections', fileDate)
      };
      span.setAttributes(OTEL.attrs.journal.parse(parseData));

      // Dual emission: emit key parsing metrics
      OTEL.metrics.gauge('commit_story.journal.reflection_file_size_bytes', parseData.fileSize);
      OTEL.metrics.gauge('commit_story.journal.reflection_lines_parsed', parseData.linesParsed);
      OTEL.metrics.gauge('commit_story.journal.reflection_entries_extracted', parseData.entriesExtracted);
      OTEL.metrics.histogram('commit_story.journal.reflection_parse_duration_ms', parseData.parseDuration);

      logger.complete('reflection file parsing', `Extracted ${reflections.length} reflections from ${timestampHeadersFound} headers in ${lines.length} lines`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Reflection file parsed successfully' });
      return reflections;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      logger.error('reflection file parsing', 'Failed to parse reflection file', error, {
        fileDate: fileDate.toDateString(),
        contentSize: content.length
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Stable abbreviation to IANA timezone mapping
 */
const TIMEZONE_MAP = {
  // North America
  'EDT': 'America/New_York', 'EST': 'America/New_York',
  'PDT': 'America/Los_Angeles', 'PST': 'America/Los_Angeles',
  'CDT': 'America/Chicago', 'CST': 'America/Chicago',
  'MDT': 'America/Denver', 'MST': 'America/Denver',
  'AKDT': 'America/Anchorage', 'AKST': 'America/Anchorage',
  'HST': 'Pacific/Honolulu',

  // Europe
  'GMT': 'Etc/GMT', 'UTC': 'Etc/UTC',
  'BST': 'Europe/London',
  'CET': 'Europe/Berlin', 'CEST': 'Europe/Berlin',

  // Asia
  'JST': 'Asia/Tokyo',
  'CCT': 'Asia/Shanghai', // China Standard Time

  // Australia
  'AEST': 'Australia/Sydney', 'AEDT': 'Australia/Sydney',
  'AWST': 'Australia/Perth', 'AWDT': 'Australia/Perth',
  'ACST': 'Australia/Adelaide', 'ACDT': 'Australia/Adelaide'
};

/**
 * Get timezone offset in milliseconds for a specific date/time
 * @param {number} utcMillis - UTC milliseconds
 * @param {string} timeZone - IANA timezone identifier
 * @returns {number} Offset in milliseconds
 */
function getTimezoneOffset(utcMillis, timeZone) {
  return tracer.startActiveSpan(OTEL.span.journal.timezone_offset(), {
    attributes: {
      [`${OTEL.NAMESPACE}.timezone.input_utc_millis`]: utcMillis,
      [`${OTEL.NAMESPACE}.timezone.iana_zone`]: timeZone,
      'code.function': 'getTimezoneOffset'
    }
  }, (span) => {
    const logger = createNarrativeLogger('journal.timezone_offset');
    const startTime = Date.now();

    try {
      logger.start('timezone offset calculation', `Calculating offset for ${timeZone} at ${new Date(utcMillis).toISOString()}`);

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      });

      logger.progress('timezone offset calculation', `Created DateTimeFormat for ${timeZone}, parsing UTC timestamp`);

      const parts = formatter.formatToParts(new Date(utcMillis));
      const dateMap = Object.fromEntries(parts.map(p => [p.type, p.value]));

      logger.progress('timezone offset calculation', `Parsed ${parts.length} date/time components from formatter`);

      const localMillis = Date.UTC(
        Number(dateMap.year),
        Number(dateMap.month) - 1,
        Number(dateMap.day),
        Number(dateMap.hour),
        Number(dateMap.minute),
        Number(dateMap.second)
      );

      const offsetMillis = localMillis - utcMillis;
      const offsetMinutes = offsetMillis / (1000 * 60);
      const calculationDuration = Date.now() - startTime;

      // Record successful operation attributes with dual emission
      const timezoneData = {
        inputUtcMillis: utcMillis,
        ianaZone: timeZone,
        offsetMinutes: offsetMinutes,
        calculationDuration: calculationDuration
      };
      const attrs = OTEL.attrs.journal.timezoneOffset(timezoneData);
      span.setAttributes(attrs);

      // Dual emission: emit key metrics for dashboards and alerting
      OTEL.metrics.histogram('commit_story.timezone.calculation_duration_ms', calculationDuration);
      OTEL.metrics.gauge('commit_story.timezone.offset_minutes', offsetMinutes);

      logger.complete('timezone offset calculation', `Calculated ${offsetMinutes}min offset (${offsetMillis}ms) for ${timeZone} in ${calculationDuration}ms`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Timezone offset calculated successfully' });
      return offsetMillis;

    } catch (error) {
      const calculationDuration = Date.now() - startTime;
      const timezoneData = {
        inputUtcMillis: utcMillis,
        ianaZone: timeZone,
        offsetMinutes: 0,
        calculationDuration: calculationDuration
      };
      span.setAttributes(OTEL.attrs.journal.timezoneOffset(timezoneData));

      // Error metrics for timezone calculation failures
      OTEL.metrics.counter('commit_story.timezone.calculation_errors', 1);
      OTEL.metrics.histogram('commit_story.timezone.calculation_duration_ms', calculationDuration);

      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      logger.error('timezone offset calculation', 'Failed to calculate timezone offset', error, {
        timeZone: timeZone,
        utcMillis: utcMillis
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Parse reflection timestamp string into Date object
 * @param {Date} fileDate - Date of the file containing the reflection
 * @param {string} timeString - Time string like "9:36:37 PM EDT"
 * @returns {Date} Full datetime object in UTC
 */
function parseReflectionTimestamp(fileDate, timeString) {
  return tracer.startActiveSpan(OTEL.span.journal.parse_timestamp(), {
    attributes: {
      [`${OTEL.NAMESPACE}.reflection.file_date`]: fileDate.toISOString(),
      [`${OTEL.NAMESPACE}.reflection.time_string`]: timeString,
      'code.function': 'parseReflectionTimestamp'
    }
  }, (span) => {
    const logger = createNarrativeLogger('journal.parse_timestamp');

    try {
      logger.start('timestamp parsing', `Parsing timestamp "${timeString}" for ${fileDate.toDateString()}`);

      // Parse timezone-aware timestamp with UTC conversion for consistent time window calculations
      const [time, period, timezone] = timeString.split(' ');
      const [hours, minutes, seconds] = time.split(':').map(Number);

      let parseSuccess = true;
      let detectedTimezone = timezone || 'unknown';

      // Convert to 24-hour format
      let hour24 = hours;
      if (period === 'PM' && hours !== 12) {
        hour24 += 12;
      } else if (period === 'AM' && hours === 12) {
        hour24 = 0;
      }

      // Look up IANA timezone from abbreviation
      const ianaTimezone = TIMEZONE_MAP[detectedTimezone.toUpperCase()];
      let utcDate;

      if (!ianaTimezone) {
        // Fallback for unknown timezones: use native parsing
        logger.progress('timestamp parsing', `Unknown timezone "${detectedTimezone}", attempting native parsing`);
        const nativeAttempt = new Date(`${fileDate.toDateString()} ${timeString}`);
        if (!isNaN(nativeAttempt.getTime())) {
          utcDate = nativeAttempt;
        } else {
          // Final fallback: assume local timezone
          const localDate = new Date(fileDate);
          localDate.setHours(hour24, minutes, seconds || 0, 0);
          utcDate = localDate;
        }
      } else {
        // Create naive UTC date for the specified date/time
        const naiveUTC = Date.UTC(
          fileDate.getFullYear(),
          fileDate.getMonth(),
          fileDate.getDate(),
          hour24,
          minutes,
          seconds || 0
        );

        // Calculate actual timezone offset using Intl
        const offsetMs = getTimezoneOffset(naiveUTC, ianaTimezone);

        // Convert to true UTC by subtracting the offset
        utcDate = new Date(naiveUTC - offsetMs);

        logger.progress('timestamp parsing', `Converted ${timeString} to UTC using ${ianaTimezone} (offset: ${offsetMs/1000/60}min)`);
      }

      // Validate the parsed date makes sense
      if (isNaN(utcDate.getTime()) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
        parseSuccess = false;
        throw new Error(`Invalid timestamp components: ${timeString}`);
      }

      // Record successful parsing attributes
      const timestampData = {
        format: `${period} ${timezone}`,
        timezone: detectedTimezone,
        parseSuccess: parseSuccess
      };
      span.setAttributes(OTEL.attrs.journal.timestamp(timestampData));

      // Lightweight metrics for timestamp parsing success
      OTEL.metrics.counter('commit_story.journal.timestamp_parse_success', 1);
      OTEL.metrics.gauge('commit_story.journal.timezone_detected', detectedTimezone === 'unknown' ? 0 : 1);

      logger.complete('timestamp parsing', `Parsed ${timeString} to ${utcDate.toISOString()}`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Timestamp parsed successfully' });
      return utcDate;

    } catch (error) {
      const timestampData = {
        format: 'parse_failed',
        timezone: 'unknown',
        parseSuccess: false
      };
      span.setAttributes(OTEL.attrs.journal.timestamp(timestampData));

      // Error metrics for timestamp parsing failures
      OTEL.metrics.counter('commit_story.journal.timestamp_parse_errors', 1);

      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      logger.error('timestamp parsing', 'Failed to parse reflection timestamp', error, {
        timeString: timeString,
        fileDate: fileDate.toDateString()
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Utility function to get the file path for a given date
 * Useful for testing or checking if entries exist for a date
 * @param {Date} date - Date to get file path for
 * @returns {string} - File path for that date's journal
 */
export function getJournalFilePath(date) {
  return tracer.startActiveSpan(OTEL.span.journal.get_file_path(), {
    attributes: {
      [`${OTEL.NAMESPACE}.journal.requested_date`]: date.toISOString(),
      'code.function': 'getJournalFilePath'
    }
  }, (span) => {
    const logger = createNarrativeLogger('journal.get_file_path');

    try {
      logger.start('path generation', `Generating journal file path for ${date.toDateString()}`);

      // Use extracted utility for path generation
      const generatedPath = generateJournalPath('entries', date);

      // Record successful path generation attributes
      const pathData = {
        requestedDate: date.toISOString(),
        generatedPath: generatedPath
      };
      span.setAttributes(OTEL.attrs.journal.path(pathData));

      // Lightweight metrics for path generation
      OTEL.metrics.counter('commit_story.journal.path_generation_requests', 1);

      logger.complete('path generation', `Generated path: ${generatedPath.split('/').slice(-2).join('/')}`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Journal file path generated successfully' });
      return generatedPath;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      logger.error('path generation', 'Failed to generate journal file path', error, {
        requestedDate: date.toDateString()
      });

      throw error;
    } finally {
      span.end();
    }
  });
}