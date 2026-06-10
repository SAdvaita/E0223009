/**
 * Frontend Logger Utility
 *
 * Browser-compatible logging that sends structured log events
 * to the Affordmed evaluation server via the backend proxy,
 * avoiding CORS issues with direct browser → eval-server calls.
 *
 * Usage:
 *   import { logFE } from '../utils/logger.js';
 *   await logFE('info', 'component', 'AllNotifications page mounted');
 */

import axios from 'axios';

const LOG_API = 'http://localhost:5000/api/log';

/**
 * Send a frontend log entry via the backend proxy.
 * Failures are swallowed — logging must never break the UI.
 *
 * @param {'debug'|'info'|'warn'|'error'|'fatal'} level
 * @param {'component'|'api'|'auth'|'render'|'routing'} pkg
 * @param {string} message  Max 48 chars (truncated automatically)
 */
export async function logFE(level, pkg, message) {
  try {
    await axios.post(LOG_API, {
      stack  : 'frontend',
      level,
      package: pkg,
      message: String(message).slice(0, 48),
    });
  } catch {
    // Logging failures must never crash the UI
  }
}
