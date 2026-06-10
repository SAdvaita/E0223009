/**
 * Logging Middleware
 *
 * Reusable package that sends structured log events to the Affordmed
 * evaluation server. Captures the full lifecycle of application events:
 * startup, request handling, business logic, DB operations, cache hits,
 * errors, and fatal failures.
 *
 * Setup:
 *   import { configure, Log } from '../logging_middleware/index.js';
 *   configure(process.env.ACCESS_TOKEN);  // once at startup
 *   await Log('backend', 'info', 'controller', 'Server started on port 5000');
 */

import axios from 'axios';

const LOG_API_URL = 'http://4.224.186.213/evaluation-service/logs';

const VALID_STACKS         = new Set(['backend', 'frontend']);
const VALID_LEVELS         = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const VALID_BACKEND_PKGS   = new Set(['cache', 'controller', 'cron_job', 'db', 'domain']);

let _authToken = '';

/**
 * Initialise the logger with a Bearer token.
 * MUST be called once before the first Log() call.
 * @param {string} token  JWT Bearer token from the evaluation server
 */
export function configure(token) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('[Logger] configure() requires a valid, non-empty token');
  }
  _authToken = token.trim();
}

/**
 * Send a structured log entry to the evaluation server.
 *
 * @param {string} stack    'backend' | 'frontend'
 * @param {string} level    'debug' | 'info' | 'warn' | 'error' | 'fatal'
 * @param {string} pkg      backend: 'cache'|'controller'|'cron_job'|'db'|'domain'
 * @param {string} message  Descriptive, context-rich message (not generic)
 */
export async function Log(stack, level, pkg, message) {
  // Validate stack — fail silently with a local warning
  if (!VALID_STACKS.has(stack)) {
    console.warn(`[Logger] Skipped — invalid stack: "${stack}"`);
    return;
  }

  // Validate level
  if (!VALID_LEVELS.has(level)) {
    console.warn(`[Logger] Skipped — invalid level: "${level}"`);
    return;
  }

  // Validate package for backend stack
  if (stack === 'backend' && !VALID_BACKEND_PKGS.has(pkg)) {
    console.warn(`[Logger] Skipped — invalid backend package: "${pkg}"`);
    return;
  }

  if (!_authToken) {
    console.warn('[Logger] Skipped — no token. Call configure(token) at startup.');
    return;
  }

  // Truncate message to API max length (48 characters)
  const safeMessage = String(message).slice(0, 48);

  try {
    await axios.post(
      LOG_API_URL,
      { stack, level, package: pkg, message: safeMessage },
      {
        headers: {
          Authorization: `Bearer ${_authToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );
  } catch (err) {
    // Logging failures MUST NEVER crash the application
    const detail = err.response?.data?.message ?? err.message;
    console.warn(`[Logger] Delivery failed (non-critical): ${detail}`);
  }
}
