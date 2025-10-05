/**
 * Summary Section Prompt
 *
 * Generates the prompt for creating summary narratives that describe
 * what happened in a development session with authentic significance matching.
 */

export const summaryPrompt = `
PURPOSE: Describe what happened in this development session, matching your tone to what actually occurred.

HOW TO ANALYZE THIS SESSION:
1. Start with the code: What files changed? What was added/removed/modified?
2. Find the why: Look in chat for discussions about these specific changes - why were they made? What problems did they solve? What alternatives were considered?
3. Include important discussions and discoveries, even if they didn't result in code changes
4. Tell the complete story: Combine the what (code) with the why (chat reasoning) to explain both what happened and the thinking behind it, in addition to other ideas and learnings that were only discussed

AUTHENTICITY PRINCIPLE:
Write like you're telling a colleague about your work. Some work is interesting, some is routine - both deserve accurate description.

PRIORITIZATION:
When deciding what to emphasize, consider:
- Areas that generated significant discussion tend to be more important than code volume
- Complex problem-solving deserves more attention than routine implementation
- Learning moments and decisions are often more valuable than the final code

DESCRIBE WHAT ACTUALLY HAPPENED:
Tell the story of this development session factually, without adding drama or invented connections. If multiple activities occurred, give them proportional attention based on their actual significance.

PLANNING vs IMPLEMENTATION:
- Creating PRDs, documentation, or design documents = planning/design work
- Writing functional code that changes system behavior = implementation work
- Use accurate verbs: "planned", "designed", "documented" for documentation work; "implemented", "built", "coded" for functional code changes

SIGNIFICANCE MATCHING:
- Routine work gets straightforward, factual description
- Complex work gets more detailed explanation
- Don't inflate ordinary tasks with dramatic language
- Don't minimize genuinely complex work

THE TEST:
What would you actually tell someone about this work session? Say that.

OUTPUT: Conversational prose (not a list or bullet points).
`.trim();
