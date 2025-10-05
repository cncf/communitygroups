#!/usr/bin/env node

// Initialize OpenTelemetry BEFORE any other imports
import sdk from '../tracing.js';

/**
 * Commit Story MCP Server
 *
 * Model Context Protocol server providing journal reflection tools to AI assistants.
 * Integrates with commit-story telemetry infrastructure for full observability.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { trace, SpanStatusCode, propagation, context, metrics } from '@opentelemetry/api';
import { OTEL } from '../telemetry/standards.js';
import { createNarrativeLogger } from '../utils/trace-logger.js';
import { createReflectionTool } from './tools/reflection-tool.js';

// Initialize telemetry
const tracer = trace.getTracer('commit-story', '1.0.0');
const logger = createNarrativeLogger('mcp.server');

/**
 * Main MCP Server Class
 */
class CommitStoryMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'commit-story',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupLifecycleHandlers();
  }

  /**
   * Extract trace context from MCP request headers/metadata
   * @param {Object} request - MCP request object
   * @returns {Object} Extracted context or active context if none found
   */
  extractTraceContext(request) {
    try {
      // Check for trace context in request metadata or params
      // MCP protocol may pass headers through different fields
      const headers = request.meta?.headers ||
                     request.params?.meta?.headers ||
                     request.headers ||
                     {};

      // Extract context using OpenTelemetry W3C propagator
      const extractedContext = propagation.extract(context.active(), headers);

      logger.progress('mcp.context_propagation', 'Extracted trace context from MCP request', {
        has_traceparent: !!headers.traceparent,
        has_tracestate: !!headers.tracestate,
        context_extracted: extractedContext !== context.active()
      });

      return extractedContext;
    } catch (error) {
      // If context extraction fails, use active context
      logger.progress('mcp.context_propagation', 'Failed to extract trace context, using active', {
        error: error.message
      });
      return context.active();
    }
  }

  /**
   * Setup MCP tool request handlers with telemetry
   */
  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      // Extract trace context from incoming request
      const extractedContext = this.extractTraceContext(request);

      return context.with(extractedContext, () => {
        return tracer.startActiveSpan(OTEL.span.mcp.tool_invocation(), {
          attributes: {
            ...OTEL.attrs.mcp.server({
              transport: 'stdio',
              version: '1.0.0',
              method: 'tools/list'
            }),
            'code.function': 'listTools'
          }
        }, async (span) => {
        try {
          logger.start('mcp.tool_invocation', 'Listing available MCP tools', {
            method: 'tools/list'
          });

          const tools = [
            {
              name: 'journal_add_reflection',
              description: 'Add a timestamped reflection to your development journal. IMPORTANT: Pass the reflection text exactly as provided by the user, verbatim, without any AI interpretation, elaboration, or additions.',
              inputSchema: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'The reflection content to add to the journal (must be passed verbatim from user input)'
                  },
                  timestamp: {
                    type: 'string',
                    description: 'Optional timestamp override (ISO 8601 format)'
                  }
                },
                required: ['text']
              }
            }
          ];

          // Emit metrics
          OTEL.metrics.counter('commit_story.mcp.tool_invocations', 1, {
            'mcp.method': 'tools/list',
            'mcp.tool_count': tools.length
          });

          span.setAttributes({
            [`${OTEL.NAMESPACE}.mcp.tools_listed`]: tools.length,
            'rpc.method': 'tools/list'
          });

          logger.complete('mcp.tool_invocation', `Listed ${tools.length} available tools`, {
            tool_count: tools.length
          });

          span.setStatus({ code: SpanStatusCode.OK });
          return { tools };
        } catch (error) {
          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

          logger.error('mcp.tool_invocation', 'Failed to list tools', error, {
            method: 'tools/list'
          });

          OTEL.metrics.counter('commit_story.mcp.server_errors', 1, {
            'mcp.method': 'tools/list',
            'error.type': error.name
          });

          throw error;
        }
        });
      });
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Extract trace context from incoming request
      const extractedContext = this.extractTraceContext(request);

      return context.with(extractedContext, () => {
        return tracer.startActiveSpan(OTEL.span.mcp.tool_invocation(), {
          attributes: {
            ...OTEL.attrs.mcp.tool({
              name: name,
              paramCount: Object.keys(args || {}).length,
              executionDuration: 0 // Will be set later
            }),
            ...OTEL.attrs.mcp.server({
              transport: 'stdio',
              version: '1.0.0',
              method: name // Use tool name as RPC method for better AI assistant querying
            }),
            'code.function': 'callTool'
          }
        }, async (span) => {
        const startTime = Date.now();

        try {
          logger.start('mcp.tool_invocation', `Invoking MCP tool: ${name}`, {
            tool_name: name,
            parameter_count: Object.keys(args || {}).length
          });

          // Tool registry for better maintainability and telemetry
          const toolHandlers = {
            'journal_add_reflection': createReflectionTool
          };

          const toolHandler = toolHandlers[name];
          if (!toolHandler) {
            throw new Error(`Unknown tool: ${name}`);
          }

          const result = await toolHandler(args, span);

          const executionDuration = Date.now() - startTime;

          // Update span with execution duration
          span.setAttributes({
            [`${OTEL.NAMESPACE}.mcp.tool_execution_duration_ms`]: executionDuration
          });

          // Emit metrics
          OTEL.metrics.counter('commit_story.mcp.tool_invocations', 1, {
            'mcp.tool_name': name,
            'mcp.success': 'true'
          });

          OTEL.metrics.histogram('commit_story.mcp.tool_execution_duration_ms', executionDuration, {
            'mcp.tool_name': name
          });

          logger.complete('mcp.tool_invocation', `Successfully executed tool: ${name}`, {
            tool_name: name,
            execution_duration_ms: executionDuration,
            success: true
          });

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();

          // Force telemetry export after tool execution (match journal pattern)
          try {
            logger.progress('mcp.telemetry_flush', 'Starting telemetry flush after tool execution');

            // Use same pattern as journal: gracefulShutdown flushes logs + SDK
            const { gracefulShutdown } = await import('../logging.js');
            await gracefulShutdown();

            logger.progress('mcp.telemetry_flush', 'Telemetry flush completed successfully');
          } catch (error) {
            // Don't fail the tool call if telemetry flush fails
            logger.error('mcp.telemetry_flush', 'Telemetry flush failed (non-critical)', error, {
              error_message: error.message,
              error_stack: error.stack
            });
          }

          return result;

        } catch (error) {
          const executionDuration = Date.now() - startTime;

          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

          // Update span with execution duration even on error
          span.setAttributes({
            [`${OTEL.NAMESPACE}.mcp.tool_execution_duration_ms`]: executionDuration
          });

          logger.error('mcp.tool_invocation', `Failed to execute tool: ${name}`, error, {
            tool_name: name,
            execution_duration_ms: executionDuration
          });

          OTEL.metrics.counter('commit_story.mcp.tool_invocations', 1, {
            'mcp.tool_name': name,
            'mcp.success': 'false'
          });

          OTEL.metrics.counter('commit_story.mcp.server_errors', 1, {
            'mcp.tool_name': name,
            'error.type': error.name
          });

          return {
            content: [{
              type: 'text',
              text: `Error executing tool ${name}: ${error.message}`
            }],
            isError: true
          };
        }
        });
      });
    });
  }

  /**
   * Setup server lifecycle event handlers with telemetry
   */
  setupLifecycleHandlers() {
    // Server startup
    this.server.onerror = (error) => {
      return tracer.startActiveSpan(OTEL.span.mcp.server_startup(), {
        attributes: {
          ...OTEL.attrs.mcp.server({
            transport: 'stdio',
            version: '1.0.0',
            method: 'error'
          }),
          'code.function': 'onError'
        }
      }, (span) => {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

        logger.error('mcp.server_startup', 'MCP server error occurred', error, {
          error_type: error.name
        });

        OTEL.metrics.counter('commit_story.mcp.server_errors', 1, {
          'error.type': error.name,
          'mcp.phase': 'runtime'
        });

        console.error('MCP Server error:', error);
      });
    };

    // Handle process signals for graceful shutdown
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      tracer.startActiveSpan(OTEL.span.mcp.server_shutdown(), {
        attributes: {
          'code.function': 'onUncaughtException'
        }
      }, (span) => {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Uncaught exception' });

        logger.error('mcp.server_startup', 'Uncaught exception in MCP server', error);

        OTEL.metrics.counter('commit_story.mcp.server_errors', 1, {
          'error.type': 'uncaughtException'
        });
      });

      console.error('Uncaught exception:', error);
      process.exit(1);
    });
  }

  /**
   * Start the MCP server with telemetry
   */
  async start() {
    return tracer.startActiveSpan(OTEL.span.mcp.server_startup(), {
      attributes: {
        ...OTEL.attrs.mcp.server({
          transport: 'stdio',
          version: '1.0.0',
          method: 'startup'
        }),
        'code.function': 'start'
      }
    }, async (span) => {
      const startTime = Date.now();

      try {
        logger.start('mcp.server_startup', 'Starting commit-story MCP server', {
          transport: 'stdio',
          version: '1.0.0'
        });

        const transport = new StdioServerTransport();
        await this.server.connect(transport);

        const startupDuration = Date.now() - startTime;

        span.setAttributes({
          [`${OTEL.NAMESPACE}.mcp.startup_duration_ms`]: startupDuration,
          [`${OTEL.NAMESPACE}.mcp.transport_connected`]: true
        });

        // Emit metrics
        OTEL.metrics.counter('commit_story.mcp.connection_attempts', 1, {
          'mcp.transport': 'stdio',
          'mcp.success': 'true'
        });

        OTEL.metrics.histogram('commit_story.mcp.server_startup_duration_ms', startupDuration);

        logger.complete('mcp.server_startup', 'MCP server started successfully', {
          transport: 'stdio',
          startup_duration_ms: startupDuration
        });

        span.setStatus({ code: SpanStatusCode.OK });

      } catch (error) {
        const startupDuration = Date.now() - startTime;

        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

        span.setAttributes({
          [`${OTEL.NAMESPACE}.mcp.startup_duration_ms`]: startupDuration
        });

        logger.error('mcp.server_startup', 'Failed to start MCP server', error, {
          transport: 'stdio',
          startup_duration_ms: startupDuration
        });

        OTEL.metrics.counter('commit_story.mcp.connection_attempts', 1, {
          'mcp.transport': 'stdio',
          'mcp.success': 'false'
        });

        OTEL.metrics.counter('commit_story.mcp.server_errors', 1, {
          'error.type': error.name,
          'mcp.phase': 'startup'
        });

        throw error;
      }
    });
  }

  /**
   * Graceful shutdown with telemetry
   */
  async shutdown(signal) {
    return tracer.startActiveSpan(OTEL.span.mcp.server_shutdown(), {
      attributes: {
        ...OTEL.attrs.mcp.server({
          transport: 'stdio',
          version: '1.0.0',
          method: 'shutdown'
        }),
        [`${OTEL.NAMESPACE}.mcp.shutdown_signal`]: signal,
        'code.function': 'shutdown'
      }
    }, async (span) => {
      try {
        logger.start('mcp.server_shutdown', `Shutting down MCP server (${signal})`, {
          signal: signal
        });

        await this.server.close();

        logger.complete('mcp.server_shutdown', 'MCP server shut down successfully', {
          signal: signal
        });

        span.setStatus({ code: SpanStatusCode.OK });

        // Flush telemetry before process exit (match journal pattern)
        try {
          const { gracefulShutdown } = await import('../logging.js');
          await gracefulShutdown();
          logger.complete('mcp.telemetry_flush', 'Telemetry flushed successfully');
        } catch (error) {
          logger.error('mcp.telemetry_flush', 'Failed to flush telemetry', error);
        }

        process.exit(0);

      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

        logger.error('mcp.server_shutdown', 'Error during MCP server shutdown', error, {
          signal: signal
        });

        OTEL.metrics.counter('commit_story.mcp.server_errors', 1, {
          'error.type': error.name,
          'mcp.phase': 'shutdown'
        });

        process.exit(1);
      }
    });
  }

}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CommitStoryMCPServer();
  server.start().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

export { CommitStoryMCPServer };