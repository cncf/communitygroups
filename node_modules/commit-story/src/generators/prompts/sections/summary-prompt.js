/**
 * Summary Section Prompt - Restructured with Step-Based Architecture
 *
 * Generates narrative summaries of development sessions with authentic significance matching.
 *
 * Following the successful pattern from technical-decisions-prompt.js and dialogue-prompt.js
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../../../telemetry/standards.js';
import { createNarrativeLogger } from '../../../utils/trace-logger.js';

const tracer = trace.getTracer('commit-story', '1.0.0');

// Always present - opening sentence
const openingSentence = `Write one opening sentence that states what changed. Lead with the thing that changed as the subject, followed by a strong past-tense verb. Avoid filler adjectives like significant, notable, or meaningful. Avoid "The session..." or "The developer..." openings.`;

// Code changes with chat context
const codeWithContext = `Describe what changed in the code and why (not documentation files like .md, .txt, or task management files). This is usually the longest part of the summary. Include the problems solved, alternatives considered, and the reasoning behind decisions. Discussion depth and complexity matter more than code volume. Write in friendly, direct language - avoid jargon and tech-speak when explaining to the mentor.`;

// Discussions
const discussions = `Summarize discussions that didn't produce functional code. Length should match significance - major strategic decisions deserve detail, minor discussions can be brief or omitted.`;

// Code without chat context
const codeWithoutContext = `Describe what changed in the code (not documentation files like .md, .txt, or task management files). Keep it brief and factual - you don't have chat context to explain why. Length should match the scope of changes.`;

// Documentation only
const documentationOnly = `Is your opening sentence enough information about this commit? It probably is, since there was not much discussion between the AI and the developer. However, if there is an important detail you may take one more sentence and describe it.`;

/**
 * Generates the summary prompt with conditional instructions
 * @param {boolean} hasFunctionalCode - Whether commit has functional code changes
 * @param {boolean} hasSubstantialChat - Whether session has substantial discussions
 * @returns {string} Complete summary prompt
 */
export function summaryPrompt(hasFunctionalCode, hasSubstantialChat) {
  return tracer.startActiveSpan(OTEL.span.prompts.summary(), (span) => {
    const logger = createNarrativeLogger('prompts.summary_construction');

    try {
      // Determine scenario for telemetry
      let scenario;
      if (hasFunctionalCode && hasSubstantialChat) {
        scenario = 'code_with_chat';
      } else if (hasFunctionalCode && !hasSubstantialChat) {
        scenario = 'code_without_chat';
      } else if (!hasFunctionalCode && hasSubstantialChat) {
        scenario = 'chat_only';
      } else {
        scenario = 'documentation_only';
      }

      logger.start('summary prompt construction', `Building summary prompt for scenario: ${scenario}`);

      // Step 2: Conditional based on chat and code presence
      let step2;
      if (hasSubstantialChat && hasFunctionalCode) {
        logger.decision('summary prompt construction', 'Using "Code + Chat" scenario - full context with why behind changes');
        // Scenario 1: Code + Chat - look for why behind code changes
        step2 = `## Step 2: Find the Why in the Chat

In the chat data, type:"user" messages are from the human developer. type:"assistant" messages are from the AI. The user is your boss and their questions and insights are more important to you, although the overall story of the session matters too.

Look through the chat conversations for discussions about these specific changes. Why were they made? What problems did they solve? What alternatives were considered?

Also include important discussions and discoveries, even if they didn't result in code changes.`;
      } else if (hasSubstantialChat && !hasFunctionalCode) {
        logger.decision('summary prompt construction', 'Using "Chat Only" scenario - discussions without code');
        // Scenario 3: No Code + Chat - look for what was discussed/decided
        step2 = `## Step 2: Find What Was Discussed

In the chat data, type:"user" messages are from the human developer. type:"assistant" messages are from the AI. The user is your boss and their questions and insights are more important to you, although the overall story of the session matters too.

Look through the chat conversations. What was discussed, planned, or decided? What problems were explored? What alternatives were considered?`;
      } else {
        logger.decision('summary prompt construction', 'Skipping Step 2 - no substantial chat available');
        // Scenario 2 & 4: No substantial chat - skip
        step2 = `## Step 2: Skip this step.`;
      }

      // Step 3 instructions based on scenario
      let step3Instructions = openingSentence;

      if (hasFunctionalCode && hasSubstantialChat) {
        logger.progress('summary prompt construction', 'Building Step 3 with code context and discussions');
        // Scenario 1: Code + Chat - full context available
        step3Instructions += `\n\n${codeWithContext}`;
        step3Instructions += `\n\n${discussions}`;
      } else if (hasFunctionalCode && !hasSubstantialChat) {
        logger.progress('summary prompt construction', 'Building Step 3 with code without chat context');
        // Scenario 2: Code + No Chat - just describe what changed
        step3Instructions += `\n\n${codeWithoutContext}`;
      } else if (!hasFunctionalCode && hasSubstantialChat) {
        logger.progress('summary prompt construction', 'Building Step 3 with discussions only');
        // Scenario 3: No Code + Chat - discussions only
        step3Instructions += `\n\n${discussions}`;
      } else {
        logger.progress('summary prompt construction', 'Building Step 3 for documentation-only changes');
        // Scenario 4: No Code + No Chat - documentation only
        step3Instructions += `\n\n${documentationOnly}`;
      }

      // Conditional intro for Step 3 based on scenario
      let step3Intro;
      if (!hasFunctionalCode && !hasSubstantialChat) {
        // Scenario 4: No code, no chat - routine documentation update
        step3Intro = `## Step 3: Write the Summary

This is a routine documentation update with minimal discussion. Write a brief factual summary.

**Important guidelines:**
- Use accurate verbs: "planned/designed/documented" for planning work, "implemented/built/coded" for functional code
- Be honest - some work is interesting, some is routine. Both deserve accurate description without inflation or minimization
- Avoid subjective qualifiers like "successfully", "significant", "major progress"
- One sentence is often enough for simple changes`;
      } else {
        // Scenarios 1, 2, 3: Normal framing
        step3Intro = `## Step 3: Write the Summary

You're helping the developer summarize this session for their mentor (who's also a friend). The developer wants to acknowledge both successes and challenges honestly. Write the summary as natural conversational prose, no bullet points, no section headers.

**Important guidelines:**
- Never mention the mentor in your output.
- Use accurate verbs: "planned/designed/documented" for planning work, "implemented/built/coded" for functional code
- Be honest - some work is interesting, some is routine. Both deserve accurate description without inflation or minimization
- Avoid subjective qualifiers like "successfully", "significant", "major progress"`;
      }

      const prompt = `
## Step 1: Understand the Code Changes

You are the developer's assistant, trained to write in a direct-yet-friendly tone.

Start by analyzing the git diff. What files changed? What was added, removed, or modified? Distinguish between documentation files and functional code files.

${step2}

${step3Intro}

${step3Instructions}

## Step 4: Output

Before you output, verify your summary is authentic - not inflated, not minimized, just honest. If it is not honest, revise the summary so that it is. Then output only your final narrative prose.
`.trim();

      // Add attributes and metrics
      const attrs = {
        'code.function': 'summaryPrompt',
        ...OTEL.attrs.prompts.summary({
          hasFunctionalCode,
          hasSubstantialChat,
          scenario,
          length: prompt.length
        })
      };

      span.setAttributes(attrs);

      // Emit metrics for prompt construction analysis
      Object.entries(attrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        } else if (typeof value === 'boolean') {
          OTEL.metrics.gauge(name, value ? 1 : 0);
        }
      });

      logger.complete('summary prompt construction', `Prompt constructed: ${prompt.length} characters for ${scenario} scenario`);

      span.setStatus({ code: SpanStatusCode.OK, message: 'Summary prompt constructed successfully' });
      return prompt;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      logger.error('summary prompt construction', 'Failed to construct summary prompt', error, {
        hasFunctionalCode,
        hasSubstantialChat
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
