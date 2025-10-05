/**
 * Minimal security filter for sensitive data
 * Catches the obvious leaks without over-engineering
 *
 * Follows DD-004 (Minimal Implementation Only) - ship fast, learn fast
 */

/**
 * Redacts common sensitive data patterns from text
 * @param {string} text - Text to filter
 * @returns {string} Text with sensitive data redacted
 */
export function redactSensitiveData(text) {
  if (!text) return text;

  let result = text;

  // Known API key prefixes (comprehensive)
  result = result.replace(/\b(sk-|pk-|rk-|AIza|AKIA|gho_|ghp_|ghs_|ghu_|glpat-)[a-zA-Z0-9_-]{10,}/g, '[REDACTED_KEY]');

  // Contextual key detection - hex keys near key-related words
  result = result.replace(/\b(api_?key|token|secret|password|credential)[\s:=]+[a-f0-9]{16,64}\b/gi, '[REDACTED_KEY]');

  // Contextual key detection - alphanumeric keys near key-related words
  result = result.replace(/\b(api_?key|token|secret|password|credential)[\s:=]+[a-zA-Z0-9_-]{20,}\b/gi, '[REDACTED_KEY]');

  // Partial keys with truncation indicators
  result = result.replace(/\b[a-zA-Z0-9_-]{8,}(\*{3}|\.{3})\b/g, '[REDACTED_KEY]');

  // JWT tokens (base64 with dots)
  result = result.replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]');

  // Auth Bearer tokens
  result = result.replace(/Bearer\s+[a-zA-Z0-9-._~+/]+/gi, '[REDACTED_TOKEN]');

  // Email addresses
  result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

  return result;
}