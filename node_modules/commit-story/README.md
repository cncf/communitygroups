# Commit Story: Your Engineering Journey, Remembered

[![npm version](https://badge.fury.io/js/commit-story.svg)](https://badge.fury.io/js/commit-story)
[![npm downloads](https://img.shields.io/npm/dt/commit-story.svg)](https://www.npmjs.com/package/commit-story)

Automatically capture not just what you built, but why it mattered and how you solved it.

## What is Commit Story?

Commit Story transforms your git commits into rich journal entries by combining:
- Your actual code changes
- Conversations with your AI coding assistant (currently Claude Code)
- The technical decisions and trade-offs you made

Every commit triggers a background process that creates a narrative record of your development work - no workflow interruption, just automatic documentation that captures the real story.

## Why Use It?

**For yourself:**
- Remember why you made certain choices and how you overcame obstacles
- See your growth as a developer, not just a list of commits
- Boost your learning - [15 minutes of daily reflection improves performance by 20-25%](https://larryferlazzo.edublogs.org/files/2013/08/reflection-1di0i76.pdf)

**For your career:**
- Evidence for performance reviews and career advancement
- Material for conference talks and blog posts
- Documentation that captures the real engineering journey

**For your team:**
- Onboard new developers with the actual story behind decisions
- Make retrospectives meaningful with concrete examples
- Preserve institutional knowledge that usually gets lost

## Prerequisites

- Node.js 18.0.0 or higher
- Git repository
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- Active Claude Code usage

## Quick Start

### 1. Install the Package

```bash
npm install --save-dev commit-story
```

### 2. Set Up Your OpenAI API Key

Add your OpenAI API key to your `.env` file:

```bash
OPENAI_API_KEY=your-api-key-here
```

Need an API key? Get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 3. Activate Git Hook

**Note:** This will overwrite any existing `.git/hooks/post-commit` file in this repository. If you have other post-commit hooks in this repo, you'll need to merge them manually.

```bash
npx commit-story-init
```

This installs a git hook that automatically generates journal entries after each commit.

### 4. Start Developing

That's it! Your next git commit will automatically generate a journal entry in the `journal/entries/` directory.

## Usage Examples

Here's what a journal entry looks like after you commit some development work:

### Sample Entry: `journal/entries/2025-09/2025-09-05.md`

```markdown
## 9:46:42 AM CDT - Commit: 1502704e

### Summary - 1502704e
The developer created a new PRD for restructuring the prompts used in the system. They analyzed successful prompt patterns from existing commands and proposed applying the same step-based principles to avoid format-first antipatterns that could lead to lower quality outputs.

### Development Dialogue - 1502704e
**Human:** "Look at prompts that consistently work well for me like /prd-create and /prd-next. I'm considering whether the Technical Decisions section prompt needs to be updated to follow steps to prevent AI from skipping ahead."

**Human:** "I like this except I want two additional things: an analysis step to make sure no critical bit gets lost, and before/after tests on multiple commits with human approval."

### Technical Decisions - 1502704e
- **DECISION: Step-Based Prompt Architecture PRD Creation** (Discussed)
  - Restructuring prompts to follow successful patterns
  - Emphasis on preventing AI from skipping critical analysis steps
  - Inclusion of mandatory human approval testing

### Commit Details - 1502704e
**Files Changed**: prds/1-automated-git-journal-system.md, prds/4-step-based-prompt-architecture.md  
**Lines Changed**: ~213 lines  
**Message**: "feat(prd-4): create step-based prompt architecture PRD"
```

Each entry captures what you built, why it mattered, and the key conversations that led to your decisions.

## Configuration

Commit Story creates a `commit-story.config.json` file automatically during installation. You can modify it to change the behavior:

### Configuration Options

Edit `commit-story.config.json` in your project root:

- **`debug`**: Set to `true` to see journal generation output during commits. Set to `false` (default) to run silently in background.

## Troubleshooting

### First Step: Enable Debug Mode

For any issue, start by enabling debug mode to see exactly what's happening:

1. Edit `commit-story.config.json` and set `"debug": true`
2. Make a test commit
3. Watch the output for detailed status information

The debug output will show you:
- Git hook execution (`🪝 Git Hook: Commit Story starting`)
- Config and app startup (`⚙️ Config loaded`, `🚀 Main app started`)
- Context collection (`🔍 Collecting context...`, `💬 Claude: Found X messages`)
- OpenAI connectivity (`✅ OpenAI connectivity confirmed`)
- Journal generation progress (`🤖 Generating journal sections...`)
- Detailed error messages with next steps for any failures

### Common Issues

**Hook not running at all:**
- Missing `commit-story.config.json` file
- Hook not installed (missing `.git/hooks/post-commit`)

**Hook runs but no journal created:**
- Invalid OpenAI API key in `.env` file  
- No Claude Code chat data for the time window
- OpenAI API errors or rate limits

**Can't find journal entries:**
- Check `journal/entries/YYYY-MM/YYYY-MM-DD.md`
- Journal directory is in `.gitignore` by default (private)

## Uninstalling

To fully remove Commit Story from your project:

```bash
npx commit-story-remove
npm uninstall commit-story
```

This removes the git hook, optionally removes the configuration file, and uninstalls the package. Your existing journal entries are preserved.

## MCP Server Integration

Commit Story includes a Model Context Protocol (MCP) server that lets Claude Code add reflections to your journal during development sessions.

### What is the MCP Server?

The MCP server provides a `journal_add_reflection` tool that Claude Code can use to capture your thoughts, decisions, and insights in real-time. These reflections are automatically included in your commit journal entries.

### Setup Instructions

Create a `.mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "commit-story": {
      "type": "stdio",
      "command": "node",
      "args": [
        "node_modules/commit-story/src/mcp/server.js"
      ]
    }
  }
}
```

### Using Reflections

Once configured, you can ask Claude Code to add reflections during your development:

```
"Add a reflection: I thought of this idea and I want to jot it down
so I don't forget! What if we bypass the orchestration layer altogether
and call the service directly? Could reduce latency by 50%."
```

Reflections are saved with timestamps to `journal/entries/YYYY-MM/YYYY-MM-DD.md` for easy access, and are automatically included in your commit journal entries when you commit. This captures those "aha!" moments and design ideas as they happen, creating a continuous development narrative.

**Tip:** Your journal entries are perfect for catching up. Try asking Claude Code: "Read my journal and summarize what I worked on yesterday"
