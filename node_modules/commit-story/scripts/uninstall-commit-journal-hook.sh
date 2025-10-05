#!/bin/bash

# Uninstall Commit Journal Hook
# Removes the post-commit hook and optionally cleans up configuration

set -e  # Exit on any error

echo "🗑️  Uninstalling Commit Story post-commit hook..."

# Validate we're in a git repository
if [[ ! -d ".git" ]]; then
    echo "❌ Error: Not in a git repository"
    echo "   Run this script from the root of a git repository"
    exit 1
fi

# Check if hook exists
if [[ ! -f ".git/hooks/post-commit" ]]; then
    echo "⚠️  No post-commit hook found to remove"
else
    # Remove the hook
    echo "🔗 Removing post-commit hook..."
    rm ".git/hooks/post-commit"
    echo "   ✅ Hook removed"
fi

# Ask about configuration cleanup
if [[ -f "commit-story.config.json" ]]; then
    echo ""
    echo "❓ Remove commit-story.config.json file? (y/N)"
    read -r REMOVE_CONFIG
    
    if [[ "$REMOVE_CONFIG" =~ ^[Yy]$ ]]; then
        rm "commit-story.config.json"
        echo "   ✅ Configuration file removed"
    else
        echo "   📝 Configuration file preserved"
    fi
fi

echo "✅ Commit Story post-commit hook uninstalled successfully!"
echo ""
echo "📋 To reinstall:"
echo "   • Run: npm run install-commit-journal-hook"