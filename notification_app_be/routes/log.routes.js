/**
 * Log Proxy Router
 *
 * Receives frontend log entries from the React app and forwards them
 * to the Affordmed evaluation server using the backend's Bearer token.
 *
 * This avoids CORS issues with direct browser → eval-server requests.
 * Route: POST /api/log
 */

import { Router } from 'express';
import { Log }    from '../../logging_middleware/index.js';

const router = Router();

const VALID_STACKS  = new Set(['backend', 'frontend']);
const VALID_LEVELS  = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const VALID_FE_PKGS = new Set(['component', 'api', 'auth', 'render', 'routing']);
const VALID_BE_PKGS = new Set(['cache', 'controller', 'cron_job', 'db', 'domain']);

/**
 * POST /api/log
 * Body: { stack, level, package, message }
 */
router.post('/', async (req, res) => {
  const { stack, level, package: pkg, message } = req.body ?? {};

  // Validate required fields
  if (!stack || !level || !pkg || !message) {
    return res.status(400).json({ success: false, message: 'Missing required log fields' });
  }

  if (!VALID_STACKS.has(stack)) {
    return res.status(400).json({ success: false, message: `Invalid stack: ${stack}` });
  }

  if (!VALID_LEVELS.has(level)) {
    return res.status(400).json({ success: false, message: `Invalid level: ${level}` });
  }

  const validPkgs = stack === 'frontend' ? VALID_FE_PKGS : VALID_BE_PKGS;
  if (!validPkgs.has(pkg)) {
    return res.status(400).json({ success: false, message: `Invalid package: ${pkg}` });
  }

  try {
    await Log(stack, level, pkg, String(message).slice(0, 48));
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
