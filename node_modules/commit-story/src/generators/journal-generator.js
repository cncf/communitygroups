/**
 * Unified Journal Generator
 * 
 * Orchestrates all three AI content generators and creates complete journal entries
 * with the four-section structure: Summary, Development Dialogue, Technical Decisions, Commit Details
 * 
 * Uses hybrid parallel/sequential approach:
 * 1. Run Summary + Technical Decisions in parallel (independent), generate Commit Details immediately
 * 2. Wait for Summary completion
 * 3. Run Development Dialogue with summary result
 */

import fs from 'fs';
import { generateSummary } from './summary-generator.js';
import { generateDevelopmentDialogue } from './dialogue-generator.js';
import { generateTechnicalDecisions } from './technical-decisions-generator.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTEL } from '../telemetry/standards.js';

// Get tracer instance for journal generation instrumentation
const tracer = trace.getTracer('commit-story-generator', '1.0.0');

// Debug mode detection from config file
let isDebugMode = false;
try {
  const configPath = './commit-story.config.json';
  if (fs.existsSync(configPath)) {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    isDebugMode = configData.debug === true;
  }
} catch (error) {
  // Silently ignore config file errors - debug mode defaults to false
}

// Debug-only logging
const debugLog = (message) => {
  if (isDebugMode) {
    console.log(message);
  }
};

/**
 * Generates a complete journal entry for a development session
 * 
 * @param {Object} context - The context object from context integrator
 * @param {Object} context.commit - Git commit data with hash, message, author, timestamp, files
 * @param {Array} context.chatMessages - Chat messages from development session
 * @param {Object} context.chatMetadata - Chat statistics and metrics
 * @param {Object|null} context.previousCommit - Previous commit data or null
 * @returns {Promise<Object>} Object containing all journal sections
 */
export async function generateJournalEntry(context) {
  return await tracer.startActiveSpan(OTEL.span.journal.generate(), {
    attributes: {
      ...OTEL.attrs.commit(context.commit.data),
      ...OTEL.attrs.chat({
        count: context.chatMessages.data.length,
        total: context.chatMetadata.data.totalMessages
      }),
      'code.function': 'generateJournalEntry'
    }
  }, async (span) => {
    // Emit initial request metrics for journal generation analysis
    const requestAttrs = {
      ...OTEL.attrs.commit(context.commit.data),
      ...OTEL.attrs.chat({
        count: context.chatMessages.data.length,
        total: context.chatMetadata.data.totalMessages
      })
    };
    Object.entries(requestAttrs).forEach(([name, value]) => {
      if (typeof value === 'number') {
        OTEL.metrics.gauge(name, value);
      }
    });
    try {
      debugLog('Started journal generation');
      
      // Phase 1: Run independent generators in parallel + generate commit details immediately
      span.addEvent('phase1.start', { phase: 'parallel-generation' });
      
      const [summaryPromise, technicalDecisionsPromise] = [
        generateSummary(context),
        generateTechnicalDecisions(context)
      ];
      
      const commitDetails = generateCommitDetailsSection(context);
      
      // Phase 2: Wait for summary (needed for dialogue), let technical decisions continue
      span.addEvent('phase2.start', { phase: 'waiting-for-summary' });
      const summary = await summaryPromise;
      
      const sectionAttrs = OTEL.attrs.sections({
        summary: summary.length,
        details: commitDetails.length
      });
      span.setAttributes(sectionAttrs);

      // Emit section metrics for journal composition analysis
      Object.entries(sectionAttrs).forEach(([name, value]) => {
        if (typeof value === 'number') {
          OTEL.metrics.gauge(name, value);
        }
      });
      
      // Phase 3: Start dialogue with summary result
      span.addEvent('phase3.start', { phase: 'dialogue-generation' });
      const dialoguePromise = generateDevelopmentDialogue(context, summary);
      
      // Phase 4: Wait for all remaining generators to complete
      span.addEvent('phase4.start', { phase: 'waiting-for-completion' });
      const [dialogue, technicalDecisions] = await Promise.all([
        dialoguePromise,
        technicalDecisionsPromise
      ]);
      
      // Add final section lengths to span
      const finalAttrs = {
        ...OTEL.attrs.sections({
          dialogue: dialogue.length,
          technical: technicalDecisions.length
        }),
        [`${OTEL.NAMESPACE}.sections.total_count`]: 4,
        [`${OTEL.NAMESPACE}.generation.completed`]: true
      };
      span.setAttributes(finalAttrs);

      // Emit final metrics for journal completion analysis
      Object.entries(finalAttrs).forEach(([name, value]) => {
        if (typeof value === 'number' || typeof value === 'boolean') {
          OTEL.metrics.gauge(name, typeof value === 'boolean' ? (value ? 1 : 0) : value);
        }
      });
      
      // Return sections object for journal-manager to format
      const sections = {
        summary,
        dialogue,
        technicalDecisions,
        commitDetails
      };
      
      debugLog('✅ Successfully generated journal');
      span.setStatus({ code: SpanStatusCode.OK, message: 'Journal sections generated successfully' });
      return sections;
    
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      debugLog(`❌ ERROR: ${error.message}`);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Generates the programmatic Commit Details section from existing git context
 * 
 * @param {Object} context - The context object containing commit data
 * @returns {string} Formatted commit details section
 */
function generateCommitDetailsSection(context) {
  const { commit } = context;
  const { message, diff } = commit.data;
  
  // Extract file names from diff headers
  const files = extractFilesFromDiff(diff);
  
  // Count lines changed (rough estimate from diff)
  const linesChanged = countDiffLines(diff);
  
  // Get first line of commit message only
  const commitMessage = message.split('\n')[0];
  
  let detailsContent = '';
  
  // Files changed section
  if (files.length > 0) {
    detailsContent += '**Files Changed**:\n';
    files.forEach(file => {
      detailsContent += `- ${file}\n`;
    });
    detailsContent += '\n';
  }
  
  // Lines changed
  if (linesChanged > 0) {
    detailsContent += `**Lines Changed**: ~${linesChanged} lines\n`;
  }
  
  // Commit message (first line only)
  detailsContent += `**Message**: "${commitMessage}"\n`;
  
  return detailsContent.trim();
}

/**
 * Extract file paths from git diff headers
 * @param {string} diff - Git diff content
 * @returns {Array<string>} Array of file paths
 */
function extractFilesFromDiff(diff) {
  if (!diff) return [];
  
  const files = [];
  const lines = diff.split('\n');
  
  for (const line of lines) {
    // Look for diff headers: "diff --git a/path/file.js b/path/file.js"
    if (line.startsWith('diff --git ')) {
      const match = line.match(/diff --git a\/(.+) b\/.+/);
      if (match && match[1]) {
        files.push(match[1]);
      }
    }
  }
  
  return files;
}

/**
 * Count approximate lines changed from diff content
 * @param {string} diff - Git diff content
 * @returns {number} Approximate number of lines changed
 */
function countDiffLines(diff) {
  if (!diff) return 0;
  
  const lines = diff.split('\n');
  let count = 0;
  
  for (const line of lines) {
    // Count lines that start with + or - (but not +++ or ---)
    if ((line.startsWith('+') && !line.startsWith('+++')) || 
        (line.startsWith('-') && !line.startsWith('---'))) {
      count++;
    }
  }
  
  return count;
}

