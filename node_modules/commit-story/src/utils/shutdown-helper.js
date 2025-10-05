/**
 * Shutdown Helper Utility
 *
 * Provides consistent timeout-bounded shutdown behavior for telemetry systems.
 * Prevents hanging processes while ensuring exporters have time to flush data.
 */

import { getConfig } from './config.js';

/**
 * Execute an async shutdown operation with a timeout
 *
 * This utility ensures that shutdown operations complete within a bounded time,
 * preventing processes from hanging while still giving exporters (OTLP/HTTP)
 * sufficient time to flush pending data.
 *
 * @param {Function} shutdownFn - Async function to execute (e.g., sdk.shutdown())
 * @param {number} timeoutMs - Maximum time to wait (default: 2000ms)
 * @param {string} systemName - Name for error messages (e.g., "Telemetry", "Logging")
 * @returns {Promise<void>}
 *
 * @example
 * await shutdownWithTimeout(() => sdk.shutdown(), 2000, 'Telemetry');
 */
export async function shutdownWithTimeout(shutdownFn, timeoutMs, systemName) {
  try {
    await Promise.race([
      shutdownFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${systemName} shutdown timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  } catch (error) {
    // Log warning in debug mode, but don't throw - we're exiting anyway
    try {
      const config = await getConfig();
      if (config.debug) {
        console.error(`⚠️  ${systemName} shutdown warning:`, error.message);
      }
    } catch {
      // Ignore config read errors during shutdown
    }
  }
}
