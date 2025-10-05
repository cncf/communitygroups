/**
 * Development Dialogue Section Prompt - Restructured with Step-Based Architecture
 *
 * Extracts supporting human quotes based on summary content
 * using the summary-guided extraction approach.
 *
 * Following the successful pattern from technical-decisions-prompt.js
 */

export const dialoguePrompt = `
## Step 1: Understand What Matters

You are a journalist writing about this development session. The summary is your article - already written. Read the summary carefully and identify key moments.

## Step 2: Find Supporting Human Quotes

As a journalist, your job is to find compelling quotes from the developer that bring the story to life.

CRITICAL: In the chat data, type:"user" messages are from the human developer. type:"assistant" messages are from the AI. Only extract from type:"user" messages.

Find ALL user quotes that support the key moments from the summary. Keep referring back to the summary - it's your article. Extract quotes verbatim - misquoting someone is not acceptable. Use [...] to truncate quotes when needed to keep them focused and interesting.

If no meaningful quotes exist, return: "No significant dialogue found for this development session" and skip to Step 8.

## Step 3: Remove Routine Responses

From the quotes you just extracted, remove the boring ones. Journalists don't quote "yes" or "ok" - that's not newsworthy. Remove quotes that are routine responses like simple commands or confirmations.

## Step 4: Narrow to Best Quotes

Consider each quote in your filtered list systematically. For each one, ask: will my readers find this interesting? Does it bring the story to life?

From this evaluation, select the very best quotes, up to {maxQuotes} quotes. Journalists choose quality over quantity. You can narrow significantly below {maxQuotes} quotes if needed - do what you need to, to best serve the story.

## Step 5: Verify Finalists

Journalists verify sources. Mishandling quotes is career suicide. For EACH quote in your narrowed list, verify:

1. **Attribution**: Does this message have type:"user"? If not, DISCARD IT.
2. **Verbatim**: Is this EXACTLY word-for-word from the chat? No paraphrasing.
3. **Exists**: Does this quote actually appear in the provided data?

If a quote fails any check, remove it.

## Step 6: Add AI Context Generously

For each verified human quote, look for nearby AI messages (type:"assistant") that add value:
- What the AI suggested that sparked the human's response
- AI explanations that informed the human's thinking
- Clarifying exchanges that led to the human's conclusion

IMPORTANT: Group each exchange together. A human quote with its AI response should stay together as one conversational unit. Use [...] to truncate AI replies to keep them focused and interesting. Do not paraphrase.

## Step 7: Final Quality Check

Before publishing, journalists fact-check. For your complete set of quotes with AI context, verify:

✓ **Summary alignment**: Every quote supports the story told in the summary
✓ **Deduplication**: Scan all quotes - remove duplicates or near-duplicates
✓ **Attribution accuracy**: Every "Human:" is type:"user", every "Assistant:" is type:"assistant"
✓ **Chronological order**: Quotes appear in chat order
✓ **Verbatim accuracy**: All quotes are exactly word-for-word
✓ **Conversation grouping**: Each Human-Assistant exchange is grouped together as one unit

## Step 8: Format Output

Keep conversations grouped. When a human quote has an AI response, they must stay together with NO blank line between them. Only add blank lines BETWEEN conversational exchanges, not within them.

Format each conversational exchange as follows:

> **Human:** "[Quote text]"
> **Assistant:** "[...] [Relevant part of assistant response]"

> **Human:** "[Another quote]"

Always use "Human:" not "User:" in labels.

No commentary or explanations beyond the step outputs. Let the dialogue speak for itself.
`.trim();
