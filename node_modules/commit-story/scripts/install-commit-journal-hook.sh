#!/bin/bash

# Install Commit Journal Hook
# Installs the universal post-commit hook for automated journal generation

set -e  # Exit on any error

echo "🔧 Installing Commit Story post-commit hook..."

# Validate we're in a git repository
if [[ ! -d ".git" ]]; then
    echo "❌ Error: Not in a git repository"
    echo "   Run this script from the root of a git repository"
    exit 1
fi

# Validate Commit Story is available (local install or development mode)
if [[ ! -f "node_modules/.bin/commit-story" ]] && [[ ! -f "src/index.js" ]]; then
    echo "❌ Error: Commit Story not found"
    echo "   Local install: npm install commit-story"
    echo "   Or run from Commit Story development repository"
    exit 1
fi

# Create the post-commit hook content
create_hook_content() {
    cat << 'EOF'
#!/bin/bash

# Universal Git Post-Commit Hook
# Works in any repository where Commit Story is locally installed
# Only triggers journal generation if Commit Story is configured for this repo

# Function to log debug messages if debug mode is enabled
debug_log() {
    if [[ -f "commit-story.config.json" ]] && command -v node >/dev/null 2>&1; then
        DEBUG_ENABLED=$(node -e "
            try {
                const config = require('./commit-story.config.json');
                console.log(config.debug || false);
            } catch(e) {
                console.log(false);
            }
        " 2>/dev/null || echo "false")

        if [[ "$DEBUG_ENABLED" == "true" ]]; then
            echo "🪝 Git Hook: $1" >&2
        fi
    fi
}

# Check if Commit Story is configured for this repository
is_commit_story_enabled() {
    # Must have config file and either local installation or development mode
    [[ -f "commit-story.config.json" ]] && ([[ -f "node_modules/.bin/commit-story" ]] || [[ -f "src/index.js" ]])
}

# Function to check if debug mode is enabled
is_debug_enabled() {
    if [[ -f "commit-story.config.json" ]] && command -v node >/dev/null 2>&1; then
        DEBUG_ENABLED=$(node -e "
            try {
                const config = require('./commit-story.config.json');
                console.log(config.debug || false);
            } catch(e) {
                console.log(false);
            }
        " 2>/dev/null || echo "false")

        [[ "$DEBUG_ENABLED" == "true" ]]
    else
        return 1  # Debug disabled if no config or node
    fi
}

# Main execution
debug_log "Commit Story starting"

# Only run if Commit Story is configured for this repository
if is_commit_story_enabled; then
    # Run in foreground if debug mode, background otherwise
    if is_debug_enabled; then
        if [[ -f "node_modules/.bin/commit-story" ]]; then
            ./node_modules/.bin/commit-story HEAD
            EXIT_CODE=$?
        else
            node src/index.js HEAD
            EXIT_CODE=$?
        fi

        # Only show completion message if it succeeded
        if [[ $EXIT_CODE -eq 0 ]]; then
            debug_log "Commit Story completed"
        fi
    else
        if [[ -f "node_modules/.bin/commit-story" ]]; then
            (./node_modules/.bin/commit-story HEAD >/dev/null 2>&1 &)
        else
            (node src/index.js HEAD >/dev/null 2>&1 &)
        fi
    fi
fi

exit 0
EOF
}

# Create commit-story.config.json if it doesn't exist
if [[ ! -f "commit-story.config.json" ]]; then
    echo "📝 Creating commit-story.config.json..."
    cat > commit-story.config.json << 'EOF'
{
  "_instructions": "Commit Story Configuration - Place your OpenAI API key in .env file as OPENAI_API_KEY=your_key_here",
  
  "debug": false,
  "_debug_help": "Set to true to run journal generation in foreground with detailed logging visible during commits. Use for troubleshooting hook execution.",
  
  "enabled": true,
  "_enabled_help": "Set to false to temporarily disable automatic journal generation while keeping the hook installed."
}
EOF
    echo "   ✅ Configuration file created"
else
    echo "📝 Using existing commit-story.config.json"
fi

# Add journal/ to .gitignore for privacy by default
echo "🔒 Adding journal/ to .gitignore for privacy..."
if [[ -f ".gitignore" ]]; then
    # Check if journal/ is already ignored
    if ! grep -q "^journal/" .gitignore; then
        echo "" >> .gitignore
        echo "# Journal entries (private by default - remove this line to make journals public)" >> .gitignore
        echo "journal/" >> .gitignore
        echo "   ✅ Added journal/ to .gitignore"
    else
        echo "   📝 journal/ already in .gitignore"
    fi
else
    # Create .gitignore if it doesn't exist
    cat > .gitignore << 'EOF'
# Journal entries (private by default - remove this line to make journals public)
journal/
EOF
    echo "   ✅ Created .gitignore with journal/ entry"
fi

# Install the hook
echo "🔗 Installing post-commit hook..."
create_hook_content > ".git/hooks/post-commit"
chmod +x ".git/hooks/post-commit"

echo "✅ Commit Story post-commit hook installed successfully!"
echo ""
echo "📋 Next steps:"
echo "   • Ensure OPENAI_API_KEY is set in your .env file"
echo "   • Make a commit to test the automated journal generation"
echo ""
echo "🔧 Other available actions:"
echo "   • Enable debug mode: Edit commit-story.config.json and set debug: true"
echo "   • Disable journal generation: Edit commit-story.config.json and set enabled: false"
echo "   • Make journals public: Remove journal/ from .gitignore"
echo "   • Uninstall hook completely: npm run commit-story:remove-hook"