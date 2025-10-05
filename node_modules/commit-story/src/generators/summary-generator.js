/**
 * Summary Generator
 * 
 * Generates summary narratives using OpenAI with the refined prompt architecture.
 * Combines guidelines with section-specific prompts and dynamic context documentation.
 */

import OpenAI from 'openai';
import { getAllGuidelines } from './prompts/guidelines/index.js';
import { summaryPrompt } from './prompts/sections/summary-prompt.js';
import { selectContext } from './utils/context-selector.js';
import { formatSessionsForAI } from '../utils/session-formatter.js';
import { analyzeCommitContent } from './utils/commit-content-analyzer.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { DEFAULT_MODEL } from '../config/openai.js';
import { OTEL, getProviderFromModel } from '../telemetry/standards.js';
import { createNarrativeLogger } from '../utils/trace-logger.js';

// Get tracer instance for summary generation instrumentation
const tracer = trace.getTracer('commit-story-summary', '1.0.0');


/**
 * Generates a summary narrative for a development session
 * 
 * @param {Object} context - The context object from context integrator
 * @param {Object} context.commit - Git commit data
 * @param {Array} context.chatMessages - Chat messages from development session
 * @param {Object|null} context.previousCommit - Previous commit data or null
 * @returns {Promise<string>} Generated summary paragraph
 */
export async function generateSummary(context) {
  return await tracer.startActiveSpan(OTEL.span.ai.summary(), {
    attributes: {
      ...OTEL.attrs.commit(context.commit.data),
      ...OTEL.attrs.genAI.request(DEFAULT_MODEL, 0.7, context.chatSessions.data.length),
      ...OTEL.attrs.chat({
        count: context.chatSessions.data.reduce((sum, session) => sum + session.messageCount, 0),
        sessions: context.chatSessions.data.length
      }),
      'code.function': 'generateSummary'
    }
  }, async (span) => {
    const logger = createNarrativeLogger('ai.generate_summary');

    try {
      // Select commit and chat sessions for summary generation
      const selected = selectContext(context, ['commit', 'chatSessions', 'chatMetadata']);

      logger.start('summary generation', `Generating summary for commit: ${selected.data.commit.hash.slice(0, 8)}`);

      const sessionsCount = selected.data.chatSessions.length;
      const totalMessages = selected.data.chatSessions.reduce((sum, session) => sum + session.messageCount, 0);
      logger.progress('summary generation', `Using ${totalMessages} chat messages across ${sessionsCount} sessions and git diff for context`);

      // Analyze commit content to determine what changed
      const { functionalFiles, docFiles, hasFunctionalCode } = analyzeCommitContent(selected.data.commit.diff);
      const hasSubstantialChat = context.chatMetadata.data.userMessages.overTwentyCharacters >= 3;

      logger.progress('summary generation', `Content analysis: ${functionalFiles.length} functional files, ${docFiles.length} doc files, ${context.chatMetadata.data.userMessages.overTwentyCharacters} substantial user messages`);

      // Create fresh OpenAI instance (DD-016: prevent context bleeding)
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Build the complete prompt (DD-018: compose guidelines + section prompt)
      const guidelines = getAllGuidelines();

  const systemPrompt = `
${selected.description}

${summaryPrompt(hasFunctionalCode, hasSubstantialChat)}

${guidelines}
  `.trim();

  // Prepare the filtered context for the AI with session grouping
  const contextForAI = {
    git: {
      hash: selected.data.commit.hash,
      ...(selected.data.commit.message !== null && { message: selected.data.commit.message }),
      author: selected.data.commit.author,
      timestamp: selected.data.commit.timestamp,
      diff: selected.data.commit.diff,
    },
    chat_sessions: formatSessionsForAI(selected.data.chatSessions)
  };


  const requestPayload = {
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user', 
        content: `Generate a summary for this development session:\n\n${JSON.stringify(contextForAI, null, 2)}`
      }
    ],
    temperature: 0.7,
  };


      const promptTokens = JSON.stringify(contextForAI).length / 4; // Rough estimate
      logger.progress('summary generation', `Constructed prompt: ~${Math.round(promptTokens)} tokens using ${DEFAULT_MODEL}`);

      // Add request payload attributes to span
      const requestAttrs = OTEL.attrs.genAI.request(
        requestPayload.model,
        requestPayload.temperature,
        requestPayload.messages.length
      );
      span.setAttributes(requestAttrs);

      // Emit request metrics for AI performance analysis
      Object.entries(requestAttrs).forEach(([name, value]) => {
        if (typeof value === 'number' || typeof value === 'string') {
          OTEL.metrics.gauge(name, typeof value === 'string' ? 1 : value);
        }
      });

      logger.progress('summary generation', 'Calling OpenAI API for summary generation');

      // Add timeout wrapper (60 seconds for large sessions)
      const completion = await Promise.race([
        openai.chat.completions.create(requestPayload),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout after 60 seconds')), 60000)
        )
      ]);

      const result = completion.choices[0].message.content.trim();
      const responseTokens = completion.usage?.completion_tokens || 0;

      logger.progress('summary generation', `Received response: ${responseTokens} tokens, ${result.length} characters`);
      
      // Add response attributes to span
      const usageAttrs = OTEL.attrs.genAI.usage({
        model: completion.model,
        content: result,
        usage: completion.usage
      });
      span.setAttributes(usageAttrs);

      // Emit usage metrics for cost analysis and performance monitoring
      Object.entries(usageAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });
      
      logger.complete('summary generation', `Summary generated successfully: ${result.split(' ').length} words`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Summary generated successfully' });
      return result;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      logger.error('summary generation', 'OpenAI API call failed', error, {
        model: DEFAULT_MODEL,
        hasApiKey: !!process.env.OPENAI_API_KEY
      });
      return `[Summary generation failed: ${error.message}]`;
    } finally {
      span.end();
    }
  });
}