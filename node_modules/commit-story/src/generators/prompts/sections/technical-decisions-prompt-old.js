/**
 * Technical Decisions Section Prompt
 * 
 * Documents technical decisions and reasoning with distinction between
 * implemented changes and discussed-only ideas.
 */

export const technicalDecisionsPrompt = `
PURPOSE: Document technical decisions and reasoning from this development session

FOCUS ON: Architectural choices, implementation approaches, algorithm selections, framework decisions, performance optimizations, error handling strategies, data structure choices, API design decisions.

OUTPUT FORMAT: Use bullet point format:
- **DECISION: [Decision title]** (Implemented | Discussed) - FILES: [List specific related files from git diff that support this classification]
  - [Brief reason/phrase]
  - [Brief reason/phrase]
  - [Additional reasons as needed]
  Tradeoffs: [Trade-off when explicitly discussed]

Keep each reason as a brief phrase. Break long reasoning into multiple separate bullet points.

CRITICAL: The quality of the entire development journal depends on accurately documenting the technical reasoning behind code changes. This section captures the "why" that makes development decisions understandable months later.

Find technical decisions discussed in the chat, then use the code changes to figure out which were IMPLEMENTED vs which were DISCUSSED, and label them accordingly.


ANALYSIS STEPS:
1. Find technical discussions in the chat conversations
2. Extract only explicitly stated reasoning from the chat - do not infer or assume reasoning that isn't clearly stated
3. Follow the INSTRUCTION above to mark each decision appropriately
4. Format output with clear evidence - each reason should be traceable to the chat conversations

FALLBACK (when no decisions found):
If no technical decisions were discussed in the chat, return only: "No significant technical decisions documented for this development session"

REMINDER: Document technical decisions and reasoning so future developers can understand why choices were made
`.trim();