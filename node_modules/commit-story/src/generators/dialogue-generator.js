/**
 * Development Dialogue Generator
 *
 * Extracts supporting human quotes based on summary content
 * using the summary-guided extraction approach.
 */

import OpenAI from 'openai';
import { getAllGuidelines } from './prompts/guidelines/index.js';
import { dialoguePrompt } from './prompts/sections/dialogue-prompt.js';
import { extractTextFromMessages } from '../integrators/context-integrator.js';
import { selectContext } from './utils/context-selector.js';
import { formatSessionsForAI } from '../utils/session-formatter.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { DEFAULT_MODEL } from '../config/openai.js';
import { OTEL, getProviderFromModel } from '../telemetry/standards.js';
import { createNarrativeLogger } from '../utils/trace-logger.js';

// Get tracer instance for dialogue generation instrumentation
const tracer = trace.getTracer('commit-story-dialogue', '1.0.0');


/**
 * Generates development dialogue for a development session using summary-guided extraction
 *
 * @param {Object} context - Self-documenting context object from context integrator
 * @param {string} summary - Generated summary of the development session
 * @returns {Promise<string>} Generated dialogue section
 */
export async function generateDevelopmentDialogue(context, summary) {
  return await tracer.startActiveSpan(OTEL.span.ai.dialogue(), {
    attributes: {
      ...OTEL.attrs.commit(context.commit.data),
      ...OTEL.attrs.genAI.request(DEFAULT_MODEL, 0.7, context.chatSessions.data.length),
      ...OTEL.attrs.chat({
        count: context.chatSessions.data.reduce((sum, session) => sum + session.messageCount, 0),
        sessions: context.chatSessions.data.length
      }),
      'code.function': 'generateDevelopmentDialogue'
    }
  }, async (span) => {
    const logger = createNarrativeLogger('ai.generate_dialogue');

    try {
      logger.start('dialogue generation', 'Starting dialogue extraction from chat messages');

      // Select chat sessions and metadata for dialogue extraction (ignore git data)
      const selected = selectContext(context, ['chatSessions', 'chatMetadata']);
      const chatSessions = selected.data.chatSessions;

      // Check if any user messages are substantial enough for dialogue extraction (DD-054)
      if (context.chatMetadata.data.userMessages.overTwentyCharacters === 0) {
        logger.decision('dialogue generation', 'No substantial user messages found - skipping dialogue generation');
        return "No significant dialogue found for this development session";
      }

      logger.progress('dialogue generation', `Found ${context.chatMetadata.data.userMessages.overTwentyCharacters} substantial user messages`);

      // Create fresh OpenAI instance (DD-016: prevent context bleeding)
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Build the complete prompt (DD-018: compose guidelines + section prompt)
      const guidelines = getAllGuidelines();

      const systemPrompt = `
${selected.description}

${dialoguePrompt}

${guidelines}
  `.trim();

      // Prepare the context for AI processing with session grouping
      // Calculate maximum quotes dynamically: 8% of substantial user messages + 1
      // This scales with session size while encouraging quality over quantity
      const maxQuotes = Math.ceil(context.chatMetadata.data.userMessages.overTwentyCharacters * 0.08) + 1;
      const contextForAI = {
        summary: summary,
        chat_sessions: formatSessionsForAI(chatSessions),
        maxQuotes: maxQuotes
      };

      const userContentString = `Extract supporting dialogue for this development session:\n\n${JSON.stringify(contextForAI, null, 2)}`;

      const requestPayload = {
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userContentString
          }
        ],
        temperature: 0.7,
      };

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

      // Add timeout wrapper (60 seconds for large sessions)
      const completion = await Promise.race([
        openai.chat.completions.create(requestPayload),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout after 60 seconds')), 60000)
        )
      ]);

      const dialogue = completion.choices[0].message.content.trim();

      // Add response attributes to span
      const usageAttrs = OTEL.attrs.genAI.usage({
        model: completion.model,
        content: dialogue,
        usage: completion.usage
      });
      span.setAttributes(usageAttrs);

      // Emit usage metrics for cost analysis and performance monitoring
      Object.entries(usageAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });

      // Clean up formatting in assistant quotes for readability
      const cleanedDialogue = dialogue
        .replace(/\\"/g, '"')        // Remove escape characters from quotes
        .replace(/\\n/g, '\n');      // Convert literal \n to actual newlines

      span.setStatus({ code: SpanStatusCode.OK, message: 'Dialogue generated successfully' });
      return cleanedDialogue;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      console.error(`⚠️ Development Dialogue generation failed: ${error.message}`);
      return `[Development Dialogue generation failed: ${error.message}]`;
    } finally {
      span.end();
    }
  });
}