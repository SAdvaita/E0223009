/**
 * Notifications Router
 * Mounts all /api/notifications routes and delegates to the controller layer.
 */

import { Router } from 'express';
import {
  getAllNotifications,
  getPriorityNotifications,
} from '../controllers/notifications.controller.js';

const router = Router();

/**
 * GET /api/notifications
 * Query: page (int), limit (int), notification_type (Event|Result|Placement)
 */
router.get('/', getAllNotifications);

/**
 * GET /api/notifications/priority
 * Query: n (int, default 10) — returns top-n priority notifications
 */
router.get('/priority', getPriorityNotifications);

export default router;
