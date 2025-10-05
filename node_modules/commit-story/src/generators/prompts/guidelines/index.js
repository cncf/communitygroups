/**
 * Guidelines Index
 * 
 * Exports all guideline modules for easy importing and composition.
 */

import { antiHallucinationGuidelines } from './anti-hallucination.js';
import { accessibilityGuidelines } from './accessibility.js';

/**
 * Combines all guidelines into a single formatted string
 * for inclusion in system prompts
 */
export function getAllGuidelines() {
  return `
${antiHallucinationGuidelines}

${accessibilityGuidelines}
  `.trim();
}

// Export individual guidelines for selective use if needed
export {
  antiHallucinationGuidelines,
  accessibilityGuidelines
};