/**
 * Technical Decisions Generator
 *
 * Documents technical decisions and reasoning with distinction between
 * implemented changes and discussed-only ideas.
 */

import OpenAI from 'openai';
import { getAllGuidelines } from './prompts/guidelines/index.js';
import { technicalDecisionsPrompt } from './prompts/sections/technical-decisions-prompt.js';
import { extractTextFromMessages } from '../integrators/context-integrator.js';
import { selectContext } from './utils/context-selector.js';
import { formatSessionsForAI } from '../utils/session-formatter.js';
import { analyzeCommitContent } from './utils/commit-content-analyzer.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { DEFAULT_MODEL } from '../config/openai.js';
import { OTEL, getProviderFromModel } from '../telemetry/standards.js';
import { createNarrativeLogger } from '../utils/trace-logger.js';

// Get tracer instance for technical decisions generation instrumentation
const tracer = trace.getTracer('commit-story-technical-decisions', '1.0.0');


/**
 * Generates technical decisions documentation for a development session
 *
 * @param {Object} context - The context object from context integrator
 * @param {Object} context.commit - Git commit data
 * @param {Array} context.chatMessages - Chat messages from development session
 * @param {Object|null} context.previousCommit - Previous commit data or null
 * @returns {Promise<string>} Generated technical decisions section
 */
export async function generateTechnicalDecisions(context) {
  return await tracer.startActiveSpan(OTEL.span.ai.technical(), {
    attributes: {
      ...OTEL.attrs.commit(context.commit.data),
      ...OTEL.attrs.genAI.request(DEFAULT_MODEL, 0.1, context.chatSessions.data.length),
      ...OTEL.attrs.chat({
        count: context.chatSessions.data.reduce((sum, session) => sum + session.messageCount, 0),
        sessions: context.chatSessions.data.length
      }),
      'code.function': 'generateTechnicalDecisions'
    }
  }, async (span) => {
    const logger = createNarrativeLogger('ai.generate_technical_decisions');

    try {
      logger.start('technical decisions generation', 'Starting technical decisions extraction from development session');

      // Select both commit and chat data for technical decisions analysis
      const selected = selectContext(context, ['commit', 'chatSessions']);
      const chatSessions = selected.data.chatSessions;

      // Check if any user messages are substantial enough for technical decisions analysis
      if (context.chatMetadata.data.userMessages.overTwentyCharacters === 0) {
        logger.decision('technical decisions generation', 'No substantial user messages found - skipping technical decisions generation');
        return "No significant technical decisions documented for this development session";
      }

      logger.progress('technical decisions generation', `Found ${context.chatMetadata.data.userMessages.overTwentyCharacters} substantial user messages for analysis`);

      // Analyze commit content to determine implementation status
      const { docFiles, functionalFiles } = analyzeCommitContent(selected.data.commit.diff);

      // Generate dynamic prompt addition based on file analysis
      let implementationGuidance = '';
      if (functionalFiles.length > 0) {
        implementationGuidance = `

IMPLEMENTED vs DISCUSSED:
- "Implemented" = Related to changed non-documentation files: ${functionalFiles.join(', ')}
- "Discussed" = Related only to documentation files (${docFiles.join(', ')}) or no related files changed

INSTRUCTION: Mark decisions as "Implemented" only if they relate to these changed files: ${functionalFiles.join(', ')}`;
      } else {
        implementationGuidance = `

INSTRUCTION: This commit only changes documentation files (${docFiles.join(', ')}). Mark ALL technical decisions as "Discussed" since no functional code was changed.`;
      }

      // Create fresh OpenAI instance (DD-016: prevent context bleeding)
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Build the complete prompt (DD-018: compose guidelines + section prompt)
      const guidelines = getAllGuidelines();

      const systemPrompt = `
${selected.description}

${technicalDecisionsPrompt}${implementationGuidance}

${guidelines}
  `.trim();

      // Prepare the filtered context for the AI with session grouping
      const contextForAI = {
        git: {
          hash: selected.data.commit.hash,
          ...(selected.data.commit.message !== null && { message: selected.data.commit.message }),
          author: selected.data.commit.author,
          timestamp: selected.data.commit.timestamp,
          diff: selected.data.commit.diff
        },
        chat_sessions: formatSessionsForAI(chatSessions)
      };

      const userContentString = `Here is the development session data:\n\n${JSON.stringify(contextForAI, null, 2)}`;

      // Prepare request payload
      const requestPayload = {
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the development session data:\n\n${JSON.stringify(contextForAI, null, 2)}` }
        ],
        temperature: 0.1, // Low temperature for consistent, factual extraction
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
      const response = await Promise.race([
        openai.chat.completions.create(requestPayload),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout after 60 seconds')), 60000)
        )
      ]);

      const technicalDecisions = response.choices[0].message.content.trim();

      // Add response attributes to span
      const usageAttrs = OTEL.attrs.genAI.usage({
        model: response.model,
        content: technicalDecisions,
        usage: response.usage
      });
      span.setAttributes(usageAttrs);

      // Emit usage metrics for cost analysis and performance monitoring
      Object.entries(usageAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });

      span.setStatus({ code: SpanStatusCode.OK, message: 'Technical decisions generated successfully' });
      return technicalDecisions;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      console.error(`⚠️ Technical Decisions generation failed: ${error.message}`);
      return `[Technical Decisions generation failed: ${error.message}]`;
    } finally {
      span.end();
    }
  });
}