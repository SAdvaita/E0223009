/**
 * Campus Notification Platform — Backend Server
 *
 * Entry point. Initialises the token manager (auto-refresh),
 * configures the shared logging middleware, sets up Express
 * with CORS + JSON parsing, mounts routers, and starts listening.
 * All lifecycle events are logged through the reusable logging-middleware.
 */

import express from 'express';
import cors    from 'cors';
import 'dotenv/config';

import { configure, Log }   from '../logging_middleware/index.js';
import { initTokenManager, getToken } from './services/token.service.js';
import notificationsRouter  from './routes/notifications.routes.js';

const PORT = Number(process.env.PORT) || 5000;

// ── Initialise token manager (handles auto-refresh every 2 min) ───────────────
initTokenManager();

// ── Seed logger with the initial token from .env ──────────────────────────────
const initialToken = process.env.ACCESS_TOKEN;
if (!initialToken) {
  console.error('[Server] FATAL: ACCESS_TOKEN missing from .env — aborting');
  process.exit(1);
}
configure(initialToken);

const app = express();

// ── Security & global middleware ──────────────────────────────────────────────
// Restrict CORS to the React dev-server only
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
// strict:true prevents prototype-pollution via crafted JSON payloads
app.use(express.json({ strict: true }));

// ── HTTP request logger ───────────────────────────────────────────────────────
app.use(async (req, _res, next) => {
  await Log(
    'backend', 'info', 'controller',
    `${req.method} ${req.path} — ${req.ip}`
  );
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/notifications', notificationsRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status : 'ok',
    service: 'notification-backend',
    port   : PORT,
    time   : new Date().toISOString(),
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use(async (req, res) => {
  await Log('backend', 'warn', 'controller', `404 not found: ${req.path}`);
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(async (err, req, res, _next) => {
  await Log(
    'backend', 'fatal', 'controller',
    `Unhandled error ${req.method} ${req.path}: ${err.message}`.slice(0, 48)
  );
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  const token = await getToken(); // ensures a fresh token on startup
  configure(token);               // update logger with freshest token
  await Log('backend', 'info', 'controller', `Server started on port ${PORT}`);
  console.log(`Server running at http://localhost:${PORT}`);
});
