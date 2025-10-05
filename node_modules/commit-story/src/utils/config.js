/**
 * Configuration utilities for commit-story
 * Provides centralized config file parsing and validation
 */

import fs from 'fs';
import path from 'path';

/**
 * Read and parse the commit-story configuration file
 * @returns {Object} Configuration object with debug and dev flags
 */
export function getConfig() {
  try {
    const configPath = './commit-story.config.json';
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        debug: configData.debug === true,
        dev: configData.dev === true
      };
    }
  } catch (error) {
    // Silently ignore config file errors - both modes default to false
  }
  return { debug: false, dev: false };
}

/**
 * Get the absolute path to the config file
 * @returns {string} Absolute path to commit-story.config.json
 */
export function getConfigPath() {
  const workingDirectory = process.cwd();
  return path.join(workingDirectory, 'commit-story.config.json');
}