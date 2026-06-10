/**
 * Notifications Service
 *
 * Business logic layer.
 *
 * Upstream API constraints (confirmed by testing):
 *  - Max limit = 10 per page
 *  - No params → returns all available notifications (~20)
 *  - notification_type filter works on upstream
 *  - page & limit supported (limit ≤ 10)
 *
 * Priority: fetches all notifications (no params) then ranks via min-heap.
 */

import axios from 'axios';
import { Log }      from '../../logging_middleware/index.js';
import { getToken } from './token.service.js';
import { computeTopN } from './priority.service.js';

const NOTIFICATIONS_API = 'http://4.224.186.213/evaluation-service/notifications';
const UPSTREAM_MAX_LIMIT = 10;

async function authHeaders() {
  const token = await getToken();
  return {
    Authorization : `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch from upstream with optional params.
 * @param {Object} params - query params to pass upstream (omit for all)
 */
async function fetchFromUpstream(params = {}) {
  await Log('backend', 'debug', 'domain', `Upstream fetch: ${JSON.stringify(params)}`.slice(0, 48));

  try {
    const response = await axios.get(NOTIFICATIONS_API, {
      headers: await authHeaders(),
      params : Object.keys(params).length ? params : undefined,
      timeout: 8000,
    });

    const notifications = response.data?.notifications ?? [];
    await Log('backend', 'debug', 'domain', `Upstream returned ${notifications.length} items`);
    return notifications;
  } catch (err) {
    const errMsg = err.response?.data?.message ?? err.message;
    await Log('backend', 'error', 'domain', `Upstream failed: ${errMsg}`.slice(0, 48));
    throw new Error(errMsg);
  }
}

/**
 * Returns paginated notifications using upstream pagination (limit ≤ 10).
 * hasNextPage is detected by checking if returned count === requested limit.
 */
export async function getPaginatedNotifications({ page = 1, limit = 10, notification_type }) {
  // Clamp to upstream max
  const safeLimit = Math.min(limit, UPSTREAM_MAX_LIMIT);

  await Log('backend', 'info', 'domain', `getPaginated p=${page} l=${safeLimit}`);

  const params = { page, limit: safeLimit };
  if (notification_type) params.notification_type = notification_type;

  const notifications = await fetchFromUpstream(params);

  // If upstream returned exactly safeLimit items, there MAY be a next page
  const hasNextPage = notifications.length === safeLimit;

  return {
    notifications,
    pagination: {
      currentPage    : page,
      limit          : safeLimit,
      hasNextPage,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Returns the top N priority notifications.
 * Fetches ALL notifications (no params) for ranking — avoids pagination limits.
 */
export async function getTopPriorityNotifications(n = 10) {
  await Log('backend', 'info', 'domain', `getPriorityTop n=${n}`);

  // Fetch all available without pagination params
  const allNotifications = await fetchFromUpstream({});

  await Log('backend', 'debug', 'domain', `Priority input: ${allNotifications.length} items`);

  const topN = computeTopN(allNotifications, n);

  await Log('backend', 'info', 'domain', `Priority done: ${topN.length} selected`);

  return topN;
}
