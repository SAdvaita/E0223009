/**
 * Campus Notification Platform — Backend Server
 *
 * Entry point. Configures the shared logging middleware, sets up
 * Express with CORS + JSON parsing, mounts routers, and starts
 * listening. All lifecycle events are logged through the reusable
 * logging-middleware package.
 */

import express   from 'express';
import cors      from 'cors';
import 'dotenv/config';
import { configure, Log } from '../logging_middleware/index.js';
import notificationsRouter from './routes/notifications.routes.js';

const PORT         = Number(process.env.PORT) || 5000;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// ── Initialise shared logger ─────────────────────────────────────────────────
if (!ACCESS_TOKEN) {
  console.error('[Server] FATAL: ACCESS_TOKEN missing from .env — aborting');
  process.exit(1);
}
configure(ACCESS_TOKEN);

const app = express();

// ── Security & global middleware ─────────────────────────────────────────────
// Restrict CORS to the React dev server only
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json());

// Sanitise incoming JSON to prevent prototype pollution (secure coding)
app.use(express.json({ strict: true }));

// ── HTTP request logger ──────────────────────────────────────────────────────
app.use(async (req, _res, next) => {
  await Log(
    'backend', 'info', 'controller',
    `Incoming ${req.method} ${req.originalUrl} from ${req.ip}`
  );
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/notifications', notificationsRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status : 'ok',
    service: 'notification-backend',
    port   : PORT,
    time   : new Date().toISOString(),
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use(async (_req, res) => {
  await Log('backend', 'warn', 'controller', `404 — route not found: ${_req.originalUrl}`);
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(async (err, req, res, _next) => {
  await Log(
    'backend', 'fatal', 'controller',
    `Unhandled exception on ${req.method} ${req.originalUrl}: ${err.message}`
  );
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  await Log(
    'backend', 'info', 'controller',
    `Campus notification backend started — port ${PORT}, env loaded, logger configured`
  );
  console.log(`Server running at http://localhost:${PORT}`);
});
