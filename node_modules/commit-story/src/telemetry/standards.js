/**
 * OpenTelemetry Standards Module
 *
 * Centralizes OpenTelemetry semantic conventions and provides builders to enforce
 * correct attribute naming, span patterns, and metric emission. Prevents instrumentation
 * errors and ensures consistency across the entire codebase.
 *
 * Semantic Namespace Guidelines:
 * - gen_ai.*: Direct AI operation characteristics (model params, tokens, response metrics)
 * - commit_story.*: Application-specific attributes (business logic, infrastructure)
 *
 * Metric Conventions:
 * - Use hierarchical naming: commit_story.category.metric_name
 * - Follow OpenTelemetry units: milliseconds for duration, dimensionless "1" for counts
 * - Gauge: Point-in-time values (message counts, current state)
 * - Counter: Incrementing values (total operations, cumulative errors)
 * - Histogram: Distribution data (durations, payload sizes)
 */

import { metrics } from '@opentelemetry/api';
import {
  SEMATTRS_CODE_FUNCTION,
  SEMATTRS_CODE_FILEPATH,
  SEMATTRS_CODE_LINENO,
  SEMATTRS_RPC_SYSTEM,
  SEMATTRS_RPC_SERVICE,
  SEMATTRS_RPC_METHOD
} from '@opentelemetry/semantic-conventions';

/**
 * Detects AI provider from model name for telemetry
 * @param {string} modelName - The model name (e.g., 'gpt-4o-mini', 'claude-3')
 * @returns {string} Provider name ('openai', 'anthropic', 'google', 'meta', 'unknown')
 */
export function getProviderFromModel(modelName) {
  if (!modelName) return 'unknown';
  const model = modelName.toLowerCase();
  if (model.startsWith('gpt')) return 'openai';
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gemini')) return 'google';
  if (model.includes('llama')) return 'meta';
  return 'unknown';
}

/**
 * Get OpenTelemetry Meter instance for commit-story metrics
 * Follows OpenTelemetry best practices for meter naming and versioning
 */
function getMeter() {
  return metrics.getMeter('commit-story', '1.0.0');
}

/**
 * OpenTelemetry standards constant - centralized patterns and conventions
 */
export const OTEL = {
  // Application namespace for custom attributes
  NAMESPACE: 'commit_story',

  // Span name builders (enforce correct naming patterns)
  span: {
    main: () => 'commit_story.main',

    // Application infrastructure operations
    connectivity: () => 'commit_story.connectivity_test',

    // Context and data operations
    context: {
      gather: () => 'context.gather_for_commit',
      filter: () => 'context.filter_messages',
      extract_text: () => 'context.extract_text_from_messages',
      calculate_metadata: () => 'context.calculate_chat_metadata'
    },

    // Journal generation operations
    journal: {
      generate: () => 'journal.generate_entry',
      save: () => 'journal.save_entry',
      format: () => 'journal.format_entry',
      discover_reflections: () => 'journal.discover_reflections',
      parse_reflection_file: () => 'journal.parse_reflection_file',
      parse_timestamp: () => 'journal.parse_timestamp',
      timezone_offset: () => 'journal.timezone_offset',
      get_file_path: () => 'journal.get_file_path'
    },

    // AI generation operations
    ai: {
      summary: () => 'summary.generate',
      dialogue: () => 'dialogue.generate',
      technical: () => 'technical_decisions.generate'
    },

    // Prompt construction operations
    prompts: {
      summary: () => 'prompts.summary_construction',
      dialogue: () => 'prompts.dialogue_construction',
      technical: () => 'prompts.technical_construction'
    },

    // Data collection operations
    collectors: {
      claude: () => 'claude.collect_messages',
      git: () => 'git.collect_data'
    },


    // CLI argument parsing operations
    cli: {
      parse_arguments: () => 'cli.parse_arguments',
      process_flags: () => 'cli.process_flags'
    },

    // Application initialization operations
    initialization: {
      conditional: () => 'initialization.conditional_setup',
      telemetry: () => 'initialization.telemetry_setup',
      logging: () => 'initialization.logging_setup'
    },

    // Application shutdown operations
    shutdown: {
      graceful: () => 'shutdown.graceful_shutdown',
      flush_logs: () => 'shutdown.flush_logs',
      flush_metrics: () => 'shutdown.flush_metrics'
    },

    // Data filtering operations
    filters: {
      sensitiveData: () => 'filters.redact_sensitive_data'
    },

    // Utility operations
    utils: {
      contextSelect: () => 'utils.select_context',
      sessionFormat: () => 'utils.session_format',
      commitContentAnalyzer: () => 'utils.commit_content_analyzer.analyze',
      journal_paths: {
        generate_path: () => 'utils.journal_paths.generate_path',
        create_directory: () => 'utils.journal_paths.create_directory',
        format_date: () => 'utils.journal_paths.format_date',
        format_timestamp: () => 'utils.journal_paths.format_timestamp',
        write_file: () => 'utils.journal_paths.write_file'
      }
    },

    // Claude collector utility operations
    claude: {
      find_files: () => 'claude.find_files',
      group_by_session: () => 'claude.group_by_session'
    },

    // MCP (Model Context Protocol) operations
    mcp: {
      server_startup: () => 'mcp.server_startup',
      server_shutdown: () => 'mcp.server_shutdown',
      tool_invocation: () => 'mcp.tool_invocation',
      tool: {
        journal_add_reflection: () => 'mcp.tool.journal_add_reflection'
      }
    }
  },

  // Attribute builders (enforce correct conventions)
  attrs: {

    /**
     * Official OpenTelemetry GenAI attributes
     * Based on: https://opentelemetry.io/docs/specs/semconv/gen-ai/
     */
    genAI: {
      /**
       * Request attributes for AI operations
       * @param {string} model - Model name
       * @param {number} temperature - Generation temperature
       * @param {number} msgCount - Number of messages sent to AI
       * @returns {Object} Official GenAI request attributes
       */
      request: (model, temperature, msgCount) => ({
        'gen_ai.request.model': model,
        'gen_ai.request.temperature': temperature,
        'gen_ai.request.messages_count': msgCount, // Extension: AI-specific metric
        'gen_ai.operation.name': 'chat',
        'gen_ai.provider.name': getProviderFromModel(model)
      }),

      /**
       * Usage/response attributes for AI operations
       * @param {Object} response - AI response object
       * @returns {Object} Official GenAI usage attributes
       */
      usage: (response) => ({
        'gen_ai.response.model': response.model,
        'gen_ai.response.message_length': response.content?.length || 0, // Extension: AI response characteristic
        'gen_ai.usage.prompt_tokens': response.usage?.prompt_tokens || 0,
        'gen_ai.usage.completion_tokens': response.usage?.completion_tokens || 0
      }),

      /**
       * Conversation tracking attributes
       * @param {string} conversationId - Unique conversation ID
       * @returns {Object} Conversation attributes
       */
      conversation: (conversationId) => ({
        'gen_ai.conversation.id': conversationId
      })
    },

    /**
     * Application-specific commit attributes
     * @param {Object} commitData - Commit information
     * @returns {Object} Commit attributes with commit_story namespace
     */
    commit: (commitData) => ({
      [`${OTEL.NAMESPACE}.commit.hash`]: commitData.hash,
      [`${OTEL.NAMESPACE}.commit.message`]: commitData.message?.split('\n')[0], // First line only
      [`${OTEL.NAMESPACE}.commit.timestamp`]: commitData.timestamp?.toISOString(),
      [`${OTEL.NAMESPACE}.commit.author`]: commitData.author,
      [`${OTEL.NAMESPACE}.commit.ref`]: commitData.ref
    }),

    /**
     * Application chat context attributes
     * @param {Object} chatData - Chat statistics
     * @returns {Object} Chat attributes with commit_story namespace
     */
    chat: (chatData) => ({
      [`${OTEL.NAMESPACE}.chat.messages_count`]: chatData.filtered || chatData.count,
      [`${OTEL.NAMESPACE}.chat.raw_messages_count`]: chatData.raw,
      [`${OTEL.NAMESPACE}.chat.total_messages`]: chatData.total,
      [`${OTEL.NAMESPACE}.chat.user_messages`]: chatData.userMessages,
      [`${OTEL.NAMESPACE}.chat.assistant_messages`]: chatData.assistantMessages,
      [`${OTEL.NAMESPACE}.chat.user_messages_over_twenty`]: chatData.userMessagesOverTwenty
    }),

    /**
     * Prompt construction attributes
     * @param {Object} promptData - Prompt construction parameters
     * @returns {Object} Prompt attributes with commit_story namespace
     */
    prompts: {
      /**
       * Summary prompt construction attributes
       * @param {Object} params - Summary prompt parameters
       * @returns {Object} Summary prompt attributes
       */
      summary: (params) => ({
        [`${OTEL.NAMESPACE}.prompt.has_functional_code`]: params.hasFunctionalCode,
        [`${OTEL.NAMESPACE}.prompt.has_substantial_chat`]: params.hasSubstantialChat,
        [`${OTEL.NAMESPACE}.prompt.scenario`]: params.scenario,
        [`${OTEL.NAMESPACE}.prompt.length`]: params.length
      })
    },

    /**
     * File analysis attributes
     * @param {Object} fileData - File analysis results
     * @returns {Object} File attributes with commit_story namespace
     */
    files: (fileData) => ({
      [`${OTEL.NAMESPACE}.files.total`]: fileData.total,
      [`${OTEL.NAMESPACE}.files.documentation`]: fileData.documentation,
      [`${OTEL.NAMESPACE}.files.functional`]: fileData.functional,
      [`${OTEL.NAMESPACE}.files.has_functional_code`]: fileData.hasFunctionalCode,
      [`${OTEL.NAMESPACE}.files.only_documentation`]: fileData.onlyDocumentation
    }),

    /**
     * Context processing attributes
     * @param {Object} contextData - Context processing metrics
     * @returns {Object} Context attributes
     */
    context: (contextData) => ({
      [`${OTEL.NAMESPACE}.context.original_messages`]: contextData.originalCount,
      [`${OTEL.NAMESPACE}.context.filtered_messages`]: contextData.filteredCount,
      [`${OTEL.NAMESPACE}.context.removed_messages`]: contextData.removedCount,
      [`${OTEL.NAMESPACE}.context.token_reduction`]: contextData.tokensSaved,
      [`${OTEL.NAMESPACE}.context.token_reduction_percent`]: contextData.reductionPercent,
      [`${OTEL.NAMESPACE}.context.original_chat_tokens`]: contextData.originalChatTokens,
      [`${OTEL.NAMESPACE}.context.filtered_chat_tokens`]: contextData.filteredChatTokens,
      [`${OTEL.NAMESPACE}.context.diff_tokens`]: contextData.diffTokens,
      [`${OTEL.NAMESPACE}.context.total_estimated_tokens`]: contextData.totalTokens,
      [`${OTEL.NAMESPACE}.context.final_messages`]: contextData.finalMessages,
      [`${OTEL.NAMESPACE}.context.final_chat_tokens`]: contextData.finalChatTokens,
      [`${OTEL.NAMESPACE}.context.aggressive_filtering`]: contextData.aggressiveFiltering
    }),

    /**
     * Text extraction operation attributes
     * @param {Object} textData - Text extraction metrics
     * @returns {Object} Text extraction attributes
     */
    textExtraction: (textData) => ({
      [`${OTEL.NAMESPACE}.text.input_messages`]: textData.inputMessages,
      [`${OTEL.NAMESPACE}.text.processed_messages`]: textData.processedMessages,
      [`${OTEL.NAMESPACE}.text.string_content_messages`]: textData.stringContentMessages,
      [`${OTEL.NAMESPACE}.text.array_content_messages`]: textData.arrayContentMessages,
      [`${OTEL.NAMESPACE}.text.unknown_content_messages`]: textData.unknownContentMessages,
      [`${OTEL.NAMESPACE}.text.empty_content_messages`]: textData.emptyContentMessages,
      [`${OTEL.NAMESPACE}.text.total_content_length`]: textData.totalContentLength,
      [`${OTEL.NAMESPACE}.text.average_content_length`]: textData.averageContentLength,
      [`${OTEL.NAMESPACE}.text.processing_duration_ms`]: textData.processingDuration
    }),

    /**
     * Chat metadata calculation attributes
     * @param {Object} metadataData - Metadata calculation metrics
     * @returns {Object} Metadata calculation attributes
     */
    chatMetadata: (metadataData) => ({
      [`${OTEL.NAMESPACE}.metadata.input_messages`]: metadataData.inputMessages,
      [`${OTEL.NAMESPACE}.metadata.user_messages`]: metadataData.userMessages,
      [`${OTEL.NAMESPACE}.metadata.assistant_messages`]: metadataData.assistantMessages,
      [`${OTEL.NAMESPACE}.metadata.over_twenty_char_messages`]: metadataData.overTwentyCharMessages,
      [`${OTEL.NAMESPACE}.metadata.user_avg_length`]: metadataData.userAvgLength,
      [`${OTEL.NAMESPACE}.metadata.user_max_length`]: metadataData.userMaxLength,
      [`${OTEL.NAMESPACE}.metadata.assistant_avg_length`]: metadataData.assistantAvgLength,
      [`${OTEL.NAMESPACE}.metadata.assistant_max_length`]: metadataData.assistantMaxLength,
      [`${OTEL.NAMESPACE}.metadata.calculation_duration_ms`]: metadataData.calculationDuration
    }),

    /**
     * Git data collection attributes
     * @param {Object} gitData - Git data collection metrics
     * @returns {Object} Git attributes
     */
    gitCollection: (gitData) => ({
      [`${OTEL.NAMESPACE}.git.commit_ref`]: gitData.commitRef,
      [`${OTEL.NAMESPACE}.git.command`]: gitData.command,
      [`${OTEL.NAMESPACE}.git.previous_commit_found`]: gitData.previousCommitFound,
      [`${OTEL.NAMESPACE}.git.previous_commit_hash`]: gitData.previousCommitHash,
      [`${OTEL.NAMESPACE}.git.previous_commit_timestamp`]: gitData.previousCommitTimestamp,
      [`${OTEL.NAMESPACE}.git.execution_duration_ms`]: gitData.executionDuration
    }),

    /**
     * Journal section length attributes
     * @param {Object} sectionLengths - Length of each journal section
     * @returns {Object} Section attributes
     */
    sections: (sectionLengths) => ({
      [`${OTEL.NAMESPACE}.sections.summary_length`]: sectionLengths.summary,
      [`${OTEL.NAMESPACE}.sections.dialogue_length`]: sectionLengths.dialogue,
      [`${OTEL.NAMESPACE}.sections.technical_decisions_length`]: sectionLengths.technical,
      [`${OTEL.NAMESPACE}.sections.commit_details_length`]: sectionLengths.details
    }),

    /**
     * Repository and environment attributes
     * @param {Object} repoData - Repository information
     * @returns {Object} Repository attributes
     */
    repository: (repoData) => ({
      [`${OTEL.NAMESPACE}.repository.path`]: repoData.path,
      [`${OTEL.NAMESPACE}.repository.name`]: repoData.name
    }),

    /**
     * Journal operation attributes
     */
    journal: {
      /**
       * Journal completion attributes (from main execution)
       * @param {Object} journalData - Journal completion information
       * @returns {Object} Journal attributes
       */
      completion: (journalData) => ({
        [`${OTEL.NAMESPACE}.journal.file_path`]: journalData.filePath,
        [`${OTEL.NAMESPACE}.journal.completed`]: journalData.completed
      }),

      /**
       * Journal save operation attributes
       * @param {Object} saveData - Journal save operation data
       * @returns {Object} Journal save attributes
       */
      save: (saveData) => ({
        [`${OTEL.NAMESPACE}.journal.file_path`]: saveData.filePath,
        [`${OTEL.NAMESPACE}.journal.entry_size`]: saveData.entrySize,
        [`${OTEL.NAMESPACE}.journal.directory_created`]: saveData.dirCreated,
        [`${OTEL.NAMESPACE}.journal.write_duration_ms`]: saveData.writeDuration
      }),

      /**
       * Journal format operation attributes
       * @param {Object} formatData - Journal format operation data
       * @returns {Object} Journal format attributes
       */
      format: (formatData) => ({
        [`${OTEL.NAMESPACE}.journal.entry_size`]: formatData.entrySize,
        [`${OTEL.NAMESPACE}.journal.reflection_count`]: formatData.reflectionCount,
        [`${OTEL.NAMESPACE}.journal.section_count`]: formatData.sectionCount,
        [`${OTEL.NAMESPACE}.journal.format_duration_ms`]: formatData.formatDuration
      }),

      /**
       * Journal reflection discovery attributes
       * @param {Object} discoveryData - Reflection discovery operation data
       * @returns {Object} Discovery attributes
       */
      discovery: (discoveryData) => ({
        [`${OTEL.NAMESPACE}.journal.files_checked`]: discoveryData.filesChecked,
        [`${OTEL.NAMESPACE}.journal.reflections_found`]: discoveryData.reflectionsFound,
        [`${OTEL.NAMESPACE}.journal.time_window_hours`]: discoveryData.timeWindowHours,
        [`${OTEL.NAMESPACE}.journal.discovery_duration_ms`]: discoveryData.discoveryDuration
      }),

      /**
       * Journal reflection file parsing attributes
       * @param {Object} parseData - File parsing operation data
       * @returns {Object} Parse attributes
       */
      parse: (parseData) => ({
        [`${OTEL.NAMESPACE}.journal.file_size`]: parseData.fileSize,
        [`${OTEL.NAMESPACE}.journal.lines_parsed`]: parseData.linesParsed,
        [`${OTEL.NAMESPACE}.journal.entries_extracted`]: parseData.entriesExtracted,
        [`${OTEL.NAMESPACE}.journal.parse_duration_ms`]: parseData.parseDuration,
        [SEMATTRS_CODE_FILEPATH]: parseData.filePath
      }),

      /**
       * Journal timestamp parsing attributes
       * @param {Object} timestampData - Timestamp parsing data
       * @returns {Object} Timestamp attributes
       */
      timestamp: (timestampData) => ({
        [`${OTEL.NAMESPACE}.journal.timestamp_format`]: timestampData.format,
        [`${OTEL.NAMESPACE}.journal.timezone_detected`]: timestampData.timezone,
        [`${OTEL.NAMESPACE}.journal.parse_success`]: timestampData.parseSuccess
      }),

      /**
       * Journal file path generation attributes
       * @param {Object} pathData - Path generation data
       * @returns {Object} Path attributes
       */
      path: (pathData) => ({
        [`${OTEL.NAMESPACE}.journal.requested_date`]: pathData.requestedDate,
        [`${OTEL.NAMESPACE}.journal.generated_path`]: pathData.generatedPath,
        [SEMATTRS_CODE_FILEPATH]: pathData.generatedPath
      }),

      /**
       * Timezone offset calculation attributes
       * @param {Object} timezoneData - Timezone offset calculation data
       * @returns {Object} Timezone offset attributes
       */
      timezoneOffset: (timezoneData) => ({
        [`${OTEL.NAMESPACE}.timezone.input_utc_millis`]: timezoneData.inputUtcMillis,
        [`${OTEL.NAMESPACE}.timezone.iana_zone`]: timezoneData.ianaZone,
        [`${OTEL.NAMESPACE}.timezone.offset_minutes`]: timezoneData.offsetMinutes,
        [`${OTEL.NAMESPACE}.timezone.calculation_duration_ms`]: timezoneData.calculationDuration
      })
    },


    /**
     * CLI argument parsing operation attributes
     */
    cli: {
      /**
       * CLI argument parsing attributes
       * @param {Object} parseData - CLI parsing operation data
       * @returns {Object} CLI parsing attributes
       */
      parseArguments: (parseData) => ({
        [`${OTEL.NAMESPACE}.cli.total_arguments`]: parseData.totalArguments,
        [`${OTEL.NAMESPACE}.cli.processed_arguments`]: parseData.processedArguments,
        [`${OTEL.NAMESPACE}.cli.dry_run_flag`]: parseData.dryRunFlag,
        [`${OTEL.NAMESPACE}.cli.commit_ref_provided`]: parseData.commitRefProvided,
        [`${OTEL.NAMESPACE}.cli.commit_ref`]: parseData.commitRef,
        [`${OTEL.NAMESPACE}.cli.unknown_flags`]: parseData.unknownFlags,
        [`${OTEL.NAMESPACE}.cli.parsing_duration_ms`]: parseData.parsingDuration
      }),

      /**
       * CLI flag processing attributes
       * @param {Object} flagData - CLI flag processing data
       * @returns {Object} CLI flag attributes
       */
      processFlags: (flagData) => ({
        [`${OTEL.NAMESPACE}.cli.flags_found`]: flagData.flagsFound,
        [`${OTEL.NAMESPACE}.cli.flags_processed`]: flagData.flagsProcessed,
        [`${OTEL.NAMESPACE}.cli.test_flag_alias`]: flagData.testFlagAlias,
        [`${OTEL.NAMESPACE}.cli.processing_duration_ms`]: flagData.processingDuration
      })
    },

    /**
     * Application initialization operation attributes
     */
    initialization: {
      /**
       * Conditional initialization attributes
       * @param {Object} initData - Initialization operation data
       * @returns {Object} Initialization attributes
       */
      conditional: (initData) => ({
        [`${OTEL.NAMESPACE}.init.condition_met`]: initData.conditionMet,
        [`${OTEL.NAMESPACE}.init.condition_type`]: initData.conditionType,
        [`${OTEL.NAMESPACE}.init.initialization_duration_ms`]: initData.initializationDuration,
        [`${OTEL.NAMESPACE}.init.skip_reason`]: initData.skipReason
      }),

      /**
       * Telemetry initialization attributes
       * @param {Object} telemetryData - Telemetry initialization data
       * @returns {Object} Telemetry initialization attributes
       */
      telemetry: (telemetryData) => ({
        [`${OTEL.NAMESPACE}.telemetry.sdk_initialized`]: telemetryData.sdkInitialized,
        [`${OTEL.NAMESPACE}.telemetry.service_name`]: telemetryData.serviceName,
        [`${OTEL.NAMESPACE}.telemetry.service_version`]: telemetryData.serviceVersion,
        [`${OTEL.NAMESPACE}.telemetry.otlp_endpoint`]: telemetryData.otlpEndpoint,
        [`${OTEL.NAMESPACE}.telemetry.console_output`]: telemetryData.consoleOutput,
        [`${OTEL.NAMESPACE}.telemetry.initialization_duration_ms`]: telemetryData.initializationDuration
      }),

      /**
       * Logging initialization attributes
       * @param {Object} loggingData - Logging initialization data
       * @returns {Object} Logging initialization attributes
       */
      logging: (loggingData) => ({
        [`${OTEL.NAMESPACE}.logging.provider_initialized`]: loggingData.providerInitialized,
        [`${OTEL.NAMESPACE}.logging.batch_processor`]: loggingData.batchProcessor,
        [`${OTEL.NAMESPACE}.logging.otlp_endpoint`]: loggingData.otlpEndpoint,
        [`${OTEL.NAMESPACE}.logging.max_batch_size`]: loggingData.maxBatchSize,
        [`${OTEL.NAMESPACE}.logging.scheduled_delay_ms`]: loggingData.scheduledDelayMs,
        [`${OTEL.NAMESPACE}.logging.initialization_duration_ms`]: loggingData.initializationDuration
      })
    },

    /**
     * Application shutdown operation attributes
     */
    shutdown: {
      /**
       * Graceful shutdown attributes
       * @param {Object} shutdownData - Shutdown operation data
       * @returns {Object} Shutdown attributes
       */
      graceful: (shutdownData) => ({
        [`${OTEL.NAMESPACE}.shutdown.triggered_by`]: shutdownData.triggeredBy,
        [`${OTEL.NAMESPACE}.shutdown.logs_flushed`]: shutdownData.logsFlushed,
        [`${OTEL.NAMESPACE}.shutdown.metrics_flushed`]: shutdownData.metricsFlushed,
        [`${OTEL.NAMESPACE}.shutdown.sdk_shutdown`]: shutdownData.sdkShutdown,
        [`${OTEL.NAMESPACE}.shutdown.total_duration_ms`]: shutdownData.totalDuration,
        [`${OTEL.NAMESPACE}.shutdown.errors_encountered`]: shutdownData.errorsEncountered
      }),

      /**
       * Log flushing attributes
       * @param {Object} flushData - Log flush operation data
       * @returns {Object} Log flush attributes
       */
      flushLogs: (flushData) => ({
        [`${OTEL.NAMESPACE}.shutdown.logs_pending`]: flushData.logsPending,
        [`${OTEL.NAMESPACE}.shutdown.logs_flushed_count`]: flushData.logsFlushedCount,
        [`${OTEL.NAMESPACE}.shutdown.flush_logs_duration_ms`]: flushData.flushLogsDuration,
        [`${OTEL.NAMESPACE}.shutdown.flush_logs_success`]: flushData.flushLogsSuccess
      }),

      /**
       * Metrics flushing attributes
       * @param {Object} flushData - Metrics flush operation data
       * @returns {Object} Metrics flush attributes
       */
      flushMetrics: (flushData) => ({
        [`${OTEL.NAMESPACE}.shutdown.metrics_pending`]: flushData.metricsPending,
        [`${OTEL.NAMESPACE}.shutdown.metrics_flushed_count`]: flushData.metricsFlushedCount,
        [`${OTEL.NAMESPACE}.shutdown.flush_metrics_duration_ms`]: flushData.flushMetricsDuration,
        [`${OTEL.NAMESPACE}.shutdown.flush_metrics_success`]: flushData.flushMetricsSuccess
      })
    },

    /**
     * Data filtering operation attributes
     */
    filters: {
      /**
       * Sensitive data redaction attributes (NO sensitive data captured, only counts)
       * @param {Object} filterData - Filter operation metrics
       * @returns {Object} Filter attributes (counts and performance only)
       */
      sensitiveData: (filterData) => ({
        [`${OTEL.NAMESPACE}.filter.input_length`]: filterData.inputLength,
        [`${OTEL.NAMESPACE}.filter.output_length`]: filterData.outputLength,
        [`${OTEL.NAMESPACE}.filter.keys_redacted`]: filterData.keysRedacted,
        [`${OTEL.NAMESPACE}.filter.jwts_redacted`]: filterData.jwtsRedacted,
        [`${OTEL.NAMESPACE}.filter.tokens_redacted`]: filterData.tokensRedacted,
        [`${OTEL.NAMESPACE}.filter.emails_redacted`]: filterData.emailsRedacted,
        [`${OTEL.NAMESPACE}.filter.total_redactions`]: filterData.totalRedactions,
        [`${OTEL.NAMESPACE}.filter.processing_duration_ms`]: filterData.processingDuration
      })
    },

    /**
     * Utility function operation attributes
     */
    utils: {
      /**
       * Context selection operation attributes
       * @param {Object} selectionData - Context selection metrics
       * @returns {Object} Context selection attributes
       */
      contextSelect: (selectionData) => ({
        [`${OTEL.NAMESPACE}.utils.selections_requested`]: selectionData.selectionsRequested,
        [`${OTEL.NAMESPACE}.utils.selections_found`]: selectionData.selectionsFound,
        [`${OTEL.NAMESPACE}.utils.description_length`]: selectionData.descriptionLength,
        [`${OTEL.NAMESPACE}.utils.data_keys`]: selectionData.dataKeys,
        [`${OTEL.NAMESPACE}.utils.processing_duration_ms`]: selectionData.processingDuration
      }),

      /**
       * Session formatting operation attributes
       * @param {Object} formatData - Session format metrics
       * @returns {Object} Session format attributes
       */
      sessionFormat: (formatData) => ({
        [`${OTEL.NAMESPACE}.session.input_sessions`]: formatData.inputSessions,
        [`${OTEL.NAMESPACE}.session.formatted_sessions`]: formatData.formattedSessions,
        [`${OTEL.NAMESPACE}.session.total_messages`]: formatData.totalMessages,
        [`${OTEL.NAMESPACE}.session.processing_duration_ms`]: formatData.processingDuration
      }),

      /**
       * Journal paths operation attributes
       * @param {Object} pathData - Path operation data
       * @returns {Object} Journal paths attributes
       */
      journalPaths: {
        generatePath: (pathData) => ({
          [`${OTEL.NAMESPACE}.journal.type`]: pathData.type,
          [`${OTEL.NAMESPACE}.path.month_dir`]: pathData.monthDir,
          [`${OTEL.NAMESPACE}.path.file_name`]: pathData.fileName,
          [`${OTEL.NAMESPACE}.path.full_path`]: pathData.fullPath,
          [SEMATTRS_CODE_FILEPATH]: pathData.fullPath // OpenTelemetry semantic convention
        }),

        createDirectory: (directoryData) => ({
          [`${OTEL.NAMESPACE}.directory.path`]: directoryData.path,
          [`${OTEL.NAMESPACE}.directory.type`]: directoryData.type,
          [`${OTEL.NAMESPACE}.directory.created`]: directoryData.created,
          [`${OTEL.NAMESPACE}.directory.operation_duration_ms`]: directoryData.operationDuration,
          [SEMATTRS_CODE_FILEPATH]: directoryData.path // OpenTelemetry semantic convention (directory)
        }),

        formatDate: (dateData) => ({
          [`${OTEL.NAMESPACE}.date.year`]: dateData.year,
          [`${OTEL.NAMESPACE}.date.month`]: dateData.month,
          [`${OTEL.NAMESPACE}.date.day`]: dateData.day,
          [`${OTEL.NAMESPACE}.path.month_dir`]: dateData.monthDir,
          [`${OTEL.NAMESPACE}.path.file_name`]: dateData.fileName
        }),

        formatTimestamp: (timestampData) => ({
          [`${OTEL.NAMESPACE}.timestamp.formatted`]: timestampData.formatted,
          [`${OTEL.NAMESPACE}.timestamp.timezone`]: timestampData.timezone
        })
      }
    },

    /**
     * Claude collector utility operation attributes
     */
    claude: {
      /**
       * File discovery operation attributes
       * @param {Object} discoveryData - File discovery metrics
       * @returns {Object} File discovery attributes
       */
      findFiles: (discoveryData) => ({
        [`${OTEL.NAMESPACE}.claude.directories_scanned`]: discoveryData.directoriesScanned,
        [`${OTEL.NAMESPACE}.claude.files_found`]: discoveryData.filesFound,
        [`${OTEL.NAMESPACE}.claude.scan_duration_ms`]: discoveryData.scanDuration,
        [`${OTEL.NAMESPACE}.claude.scan_errors`]: discoveryData.scanErrors
      }),

      /**
       * Message grouping operation attributes
       * @param {Object} groupData - Grouping operation metrics
       * @returns {Object} Message grouping attributes
       */
      groupBySession: (groupData) => ({
        [`${OTEL.NAMESPACE}.claude.input_messages`]: groupData.inputMessages,
        [`${OTEL.NAMESPACE}.claude.unique_sessions`]: groupData.uniqueSessions,
        [`${OTEL.NAMESPACE}.claude.grouped_sessions`]: groupData.groupedSessions,
        [`${OTEL.NAMESPACE}.claude.grouping_duration_ms`]: groupData.groupingDuration
      })
    },

    /**
     * MCP (Model Context Protocol) operation attributes
     */
    mcp: {
      /**
       * MCP server attributes following RPC semantic conventions
       * @param {Object} serverData - Server operation data
       * @param {Object} serverData.transport - Transport type (e.g., 'stdio')
       * @param {Object} serverData.version - MCP version
       * @param {Object} serverData.method - RPC method name (for JSON-RPC semantic conventions)
       * @returns {Object} MCP server attributes with proper semantic conventions
       */
      server: (serverData) => ({
        [`${OTEL.NAMESPACE}.mcp.transport`]: serverData.transport,
        [`${OTEL.NAMESPACE}.mcp.version`]: serverData.version,
        [SEMATTRS_RPC_SYSTEM]: 'jsonrpc', // OpenTelemetry RPC semantic convention
        [SEMATTRS_RPC_SERVICE]: 'mcp_server',
        [SEMATTRS_RPC_METHOD]: serverData.method // Tool-specific method name for better AI assistant querying
      }),

      /**
       * MCP tool invocation attributes
       * @param {Object} toolData - Tool operation data
       * @returns {Object} Tool attributes with function semantic conventions
       */
      tool: (toolData) => ({
        [`${OTEL.NAMESPACE}.mcp.tool_name`]: toolData.name,
        [`${OTEL.NAMESPACE}.mcp.tool_parameters_count`]: toolData.paramCount,
        [`${OTEL.NAMESPACE}.mcp.tool_execution_duration_ms`]: toolData.executionDuration,
        [SEMATTRS_CODE_FUNCTION]: toolData.name // OpenTelemetry code semantic convention
      }),

      /**
       * Reflection-specific attributes
       * @param {Object} reflectionData - Reflection operation data
       * @returns {Object} Reflection attributes with file semantic conventions
       */
      reflection: (reflectionData) => ({
        [`${OTEL.NAMESPACE}.reflection.text_length`]: reflectionData.textLength,
        [`${OTEL.NAMESPACE}.reflection.timestamp`]: reflectionData.timestamp,
        [`${OTEL.NAMESPACE}.reflection.file_created`]: reflectionData.fileCreated,
        [SEMATTRS_CODE_FILEPATH]: reflectionData.filePath, // OpenTelemetry file semantic convention
        [`${OTEL.NAMESPACE}.reflection.directory`]: reflectionData.directory
      })
    }
  },

  // Event builders for structured events
  events: {
    /**
     * GenAI prompt event
     * @param {Array} messages - Messages sent to AI
     * @param {string} model - Model used
     * @returns {Object} Event attributes
     */
    genAI: {
      prompt: (messages, model) => ({
        'gen_ai.content.prompt': JSON.stringify(messages),
        'gen_ai.request.model': model,
        'gen_ai.provider.name': getProviderFromModel(model)
      }),

      /**
       * GenAI completion event
       * @param {Object} response - AI response
       * @returns {Object} Event attributes
       */
      completion: (response) => ({
        'gen_ai.content.completion': response.content,
        'gen_ai.response.model': response.model,
        'gen_ai.usage.prompt_tokens': response.usage?.prompt_tokens || 0,
        'gen_ai.usage.completion_tokens': response.usage?.completion_tokens || 0
      })
    }
  },

  // Metrics builders for dual emission (span attributes + queryable metrics)
  metrics: {
    /**
     * Emit a gauge metric (point-in-time value)
     * @param {string} name - Metric name (should match span attribute name)
     * @param {number} value - Metric value
     * @param {Object} attributes - Metric attributes (tags)
     */
    gauge: (name, value, attributes = {}) => {
      try {
        const meter = getMeter();
        const gauge = meter.createGauge(name, {
          description: `Gauge metric: ${name}`,
          unit: name.includes('_ms') || name.includes('duration') ? 'ms' : '1'
        });

        const defaultAttributes = {
          'service.name': 'commit-story-dev',
          'environment': 'development'
        };

        gauge.record(value, { ...defaultAttributes, ...attributes });
      } catch (error) {
        console.warn(`Failed to emit gauge metric ${name}:`, error.message);
      }
    },

    /**
     * Emit a counter metric (incrementing value)
     * @param {string} name - Metric name
     * @param {number} value - Increment value (default 1)
     * @param {Object} attributes - Metric attributes (tags)
     */
    counter: (name, value = 1, attributes = {}) => {
      try {
        const meter = getMeter();
        const counter = meter.createCounter(name, {
          description: `Counter metric: ${name}`,
          unit: '1'
        });

        const defaultAttributes = {
          'service.name': 'commit-story-dev',
          'environment': 'development'
        };

        counter.add(value, { ...defaultAttributes, ...attributes });
      } catch (error) {
        console.warn(`Failed to emit counter metric ${name}:`, error.message);
      }
    },

    /**
     * Emit a histogram metric (distribution data)
     * @param {string} name - Metric name
     * @param {number} value - Measurement value
     * @param {Object} attributes - Metric attributes (tags)
     */
    histogram: (name, value, attributes = {}) => {
      try {
        const meter = getMeter();
        const histogram = meter.createHistogram(name, {
          description: `Histogram metric: ${name}`,
          unit: name.includes('_ms') || name.includes('duration') ? 'ms' : '1'
        });

        const defaultAttributes = {
          'service.name': 'commit-story-dev',
          'environment': 'development'
        };

        histogram.record(value, { ...defaultAttributes, ...attributes });
      } catch (error) {
        console.warn(`Failed to emit histogram metric ${name}:`, error.message);
      }
    }
  }
};

/**
 * Utility for structured logging with trace context
 * @param {import('@opentelemetry/api').Span} span - Active span
 * @returns {Object} Trace context for logging
 */
export function getTraceContext(span) {
  if (!span) return {};

  const spanContext = span.spanContext();
  if (!spanContext) return {};

  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    service: OTEL.NAMESPACE
  };
}