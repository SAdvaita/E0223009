/**
 * Notifications Controller
 *
 * Handles the HTTP request/response cycle.
 * Validates query parameters, calls the service layer,
 * and returns consistent JSON responses.
 * All significant actions are logged via the shared logger.
 */

import { Log } from '../../logging_middleware/index.js';
import {
  getPaginatedNotifications,
  getTopPriorityNotifications,
} from '../services/notifications.service.js';

const VALID_TYPES = new Set(['Event', 'Result', 'Placement']);

/**
 * GET /api/notifications
 */
export async function getAllNotifications(req, res) {
  // Parse and clamp pagination params
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const { notification_type } = req.query;

  // Input validation — reject unknown notification types early
  if (notification_type && !VALID_TYPES.has(notification_type)) {
    await Log(
      'backend', 'warn', 'controller',
      `getAllNotifications — invalid notification_type param: "${notification_type}"`
    );
    return res.status(400).json({
      success: false,
      message: `notification_type must be one of: ${[...VALID_TYPES].join(', ')}`,
    });
  }

  await Log(
    'backend', 'info', 'controller',
    `getAllNotifications — page:${page} limit:${limit} type:${notification_type ?? 'all'}`
  );

  try {
    const result = await getPaginatedNotifications({ page, limit, notification_type });

    await Log(
      'backend', 'debug', 'controller',
      `getAllNotifications — returned ${result.notifications.length} items for page ${page}`
    );

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    await Log(
      'backend', 'error', 'controller',
      `getAllNotifications failed — upstream error: ${err.message}`
    );
    return res.status(502).json({
      success: false,
      message : 'Failed to fetch notifications from upstream service',
      detail  : err.message,
    });
  }
}

/**
 * GET /api/notifications/priority
 */
export async function getPriorityNotifications(req, res) {
  const n = Math.min(50, Math.max(1, parseInt(req.query.n, 10) || 10));

  await Log(
    'backend', 'info', 'controller',
    `getPriorityNotifications — top ${n} requested`
  );

  try {
    const notifications = await getTopPriorityNotifications(n);

    await Log(
      'backend', 'info', 'controller',
      `getPriorityNotifications — computed and returned ${notifications.length} priority items`
    );

    return res.status(200).json({
      success      : true,
      count        : notifications.length,
      notifications,
    });
  } catch (err) {
    await Log(
      'backend', 'error', 'controller',
      `getPriorityNotifications failed: ${err.message}`
    );
    return res.status(502).json({
      success: false,
      message: 'Failed to compute priority inbox',
      detail : err.message,
    });
  }
}
