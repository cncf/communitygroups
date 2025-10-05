/**
 * Development Dialogue Section Prompt
 * 
 * Extracts supporting human quotes based on summary content
 * using the summary-guided extraction approach.
 */

export const dialoguePrompt = `
CRITICAL: The quality of the entire development journal depends on getting this dialogue extraction exactly right. This section captures the authentic human voice that brought the development session to life.

Overall Goal:
Your goal is to find human quotes from the chat messages that illustrate, support, or provide authentic voice to the points made in the development session summary. Use the summary as your guide for what matters.

Summary-Guided Approach:
You have been provided with a summary of this development session. Use it as your roadmap to identify what was important in this session, then find human quotes that show how those important moments actually unfolded in conversation.

Step 1: Understand the summary context
Read the provided summary carefully.
Identify the key points, decisions, discoveries, and challenges mentioned.
These are your targets for finding supporting quotes.
CRITICAL: In the chat data, type:"user" messages are from the HUMAN DEVELOPER, type:"assistant" messages are from the AI ASSISTANT.

Step 2: Find supporting human quotes
Look through the chat messages for messages where type: "user" - ONLY these messages contain the human developer's actual input. Messages where type: "assistant" are AI responses and must NEVER be attributed to the human.

Find user messages that:
- Illustrate decisions or reasoning mentioned in the summary
- Show the human's authentic reaction to challenges described
- Demonstrate the problem-solving process that led to outcomes in the summary  
- Capture the human's voice and mood during key moments identified in the summary
- Reveal the human's thought process behind actions summarized

AVOID simple confirmations and commands like "yes", "ok", "git push", "run the tests", or other routine responses.

Extract no more than {maxQuotes} quotes maximum.
Quality over quantity - only include quotes that genuinely support or illustrate the summary narrative.
If no user messages support the summary narrative, return "No significant dialogue found for this development session".

Step 3: Verify authenticity
Every human quote must be EXACTLY verbatim from the chat messages.
Do not paraphrase, shorten, edit, or "improve" any human text.
If a quote needs context to be understood, add AI context in Step 4.
If a quote can't be extracted verbatim, skip it entirely.

Step 4: Add AI context where helpful (STRONGLY ENCOURAGED)
For each human quote, look for nearby AI messages that would add value. Most human quotes benefit from AI context showing:
- What the AI suggested that the human responded to
- AI validation, agreement, or disagreement with human ideas
- Technical explanations that informed the human's thinking
- Clarifying exchanges that led to the human's conclusion
- Questions or prompts that sparked the human's response

When adding AI context (do this generously):
- Include relevant assistant quotes immediately before or after the human quote
- Use [...] to truncate long assistant replies, keeping only the relevant part
- Do not paraphrase, rephrase, or fabricate any assistant text - only truncate if needed

Step 5: Quality check before final output
Before presenting your final dialogue, verify:
✓ No duplicate or repetitive human quotes (each human quote should be unique)
✓ Quotes are in chronological order from the chat
✓ Each human quote genuinely supports the summary narrative
✓ AI context is included where it adds value for understanding
✓ All quotes are exactly verbatim from the source messages
✓ All human quotes come from messages with type: "user" ONLY
✓ 3-8 quotes maximum - quality over quantity

Step 6: Final output
Present quotes in chronological order.
Separate each quote block with an empty line.
IMPORTANT: When human and AI messages are part of the same conversational exchange, do NOT put empty lines between them.
Always use "Human:" not "User:" in the labels.
Format each as shown below.
No commentary, explanations, or analysis.
Let the authentic dialogue speak for itself.

Format examples (DO NOT include these examples in your actual output):
> **Human:** "Wait, why is this function returning undefined?"
> **Assistant:** "[...] That happens because the variable is declared inside the block."

> **Human:** "Actually, let's try a different approach - this is getting too complex."

ANTI-HALLUCINATION RULES FOR EXTRACTION:
- Every quote must be EXACTLY verbatim from the chat messages - never paraphrase, edit, or improve
- Only extract quotes that actually exist in the provided chat data
- If no meaningful human quotes support the summary narrative, return "No significant dialogue found for this development session"
- Do not fabricate, invent, or create any quotes
- Do not combine multiple messages into one quote
- Human and assistant quotes can be truncated with [...] if needed, but remaining text must be verbatim

Reminder:
Use the summary as your guide to find quotes that matter. Extract only verbatim text. The goal is to let readers hear the human developer's authentic voice during the key moments that shaped this development session.
`.trim();