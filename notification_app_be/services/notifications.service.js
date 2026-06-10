/**
 * Notifications Service
 *
 * Business logic layer.
 * - Fetches notifications from the Affordmed evaluation server
 * - Passes page, limit and notification_type directly to upstream
 *   (the API now supports these query parameters natively)
 * - notification_type filtering is applied client-side as a safety net
 *   in case upstream returns mixed types
 * - Delegates priority ranking to priority.service.js
 */

import axios from 'axios';
import { Log }      from '../../logging_middleware/index.js';
import { getToken } from './token.service.js';
import { computeTopN } from './priority.service.js';

const NOTIFICATIONS_API = 'http://4.224.186.213/evaluation-service/notifications';

// Always fetches a valid (auto-refreshed) token before each upstream call
async function authHeaders() {
  const token = await getToken();
  return {
    Authorization : `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Core fetch — calls upstream evaluation API with native pagination support.
 * @param {Object} opts
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=10]
 * @param {string} [opts.notification_type]
 * @returns {Promise<Array>}
 */
async function fetchFromUpstream({ page = 1, limit = 10, notification_type } = {}) {
  await Log(
    'backend', 'debug', 'domain',
    `Upstream: page=${page} limit=${limit} type=${notification_type ?? 'all'}`
  );

  // Build params — upstream supports page, limit, notification_type
  const params = { page, limit };
  if (notification_type) params.notification_type = notification_type;

  try {
    const response = await axios.get(NOTIFICATIONS_API, {
      headers: await authHeaders(),
      params,
      timeout: 8000,
    });

    const notifications = response.data?.notifications ?? [];

    await Log(
      'backend', 'debug', 'domain',
      `Upstream returned ${notifications.length} notifications`
    );

    return notifications;
  } catch (err) {
    const errMsg = err.response?.data?.message ?? err.message;
    await Log(
      'backend', 'error', 'domain',
      `Upstream failed: ${errMsg}`.slice(0, 48)
    );
    throw new Error(errMsg);
  }
}

/**
 * Returns paginated notifications.
 * Uses upstream pagination — fetches (limit + 1) to detect hasNextPage.
 */
export async function getPaginatedNotifications({ page = 1, limit = 10, notification_type }) {
  await Log(
    'backend', 'info', 'domain',
    `getPaginated: page=${page} limit=${limit}`
  );

  // Fetch limit+1 to detect if there's a next page (no COUNT query needed)
  const data        = await fetchFromUpstream({ page, limit: limit + 1, notification_type });
  const hasNextPage = data.length > limit;
  const notifications = hasNextPage ? data.slice(0, limit) : data;

  await Log(
    'backend', 'debug', 'domain',
    `Page ${page}: ${notifications.length} items, hasNext=${hasNextPage}`
  );

  return {
    notifications,
    pagination: {
      currentPage    : page,
      limit,
      hasNextPage,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Returns the top N priority notifications.
 * Fetches a large batch for ranking via the priority algorithm.
 */
export async function getTopPriorityNotifications(n = 10) {
  await Log(
    'backend', 'info', 'domain',
    `getPriorityTop: n=${n}, fetching batch`
  );

  // Fetch up to 100 for ranking; upstream handles the limit
  const allNotifications = await fetchFromUpstream({ page: 1, limit: 100 });

  await Log(
    'backend', 'debug', 'domain',
    `Priority input: ${allNotifications.length} notifications`
  );

  const topN = computeTopN(allNotifications, n);

  await Log(
    'backend', 'info', 'domain',
    `Priority done: top ${topN.length} selected`
  );

  return topN;
}
