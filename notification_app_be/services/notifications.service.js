/**
 * Notifications Service
 *
 * Business logic layer.
 * - Fetches ALL notifications from the Affordmed evaluation server in one call
 *   (the upstream API does not support pagination or limit params)
 * - Applies filtering and pagination CLIENT-SIDE
 * - Delegates priority ranking to priority.service.js
 */

import axios from 'axios';
import { Log } from '../../logging_middleware/index.js';
import { computeTopN } from './priority.service.js';

const NOTIFICATIONS_API = 'http://4.224.186.213/evaluation-service/notifications';

function authHeaders() {
  return {
    Authorization : `Bearer ${process.env.ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch ALL notifications from the upstream evaluation API.
 * Supports optional notification_type query param (server-side filter).
 * Returns raw array.
 *
 * @param {string} [notification_type]  'Event' | 'Result' | 'Placement'
 * @returns {Promise<Array>}
 */
async function fetchAllFromUpstream(notification_type) {
  await Log(
    'backend', 'debug', 'domain',
    `Upstream call — GET /evaluation-service/notifications type:${notification_type ?? 'all'}`
  );

  // Only pass notification_type if provided — upstream rejects unknown params
  const params = {};
  if (notification_type) params.notification_type = notification_type;

  try {
    const response = await axios.get(NOTIFICATIONS_API, {
      headers: authHeaders(),
      params,
      timeout: 8000,
    });

    const notifications = response.data?.notifications ?? [];

    await Log(
      'backend', 'debug', 'domain',
      `Upstream responded — ${notifications.length} notification(s) received`
    );

    return notifications;
  } catch (err) {
    const errMsg = err.response?.data?.message ?? err.message;
    await Log(
      'backend', 'error', 'domain',
      `Upstream notifications API failed: ${errMsg} (status: ${err.response?.status ?? 'N/A'})`
    );
    throw new Error(errMsg);
  }
}

/**
 * Returns paginated notifications with navigation metadata.
 * Pagination is handled client-side since upstream returns all items.
 */
export async function getPaginatedNotifications({ page = 1, limit = 10, notification_type }) {
  await Log(
    'backend', 'info', 'domain',
    `getPaginatedNotifications — building page ${page} (limit:${limit} type:${notification_type ?? 'all'})`
  );

  // Fetch all from upstream (apply type filter if provided)
  const all = await fetchAllFromUpstream(notification_type);

  // Client-side pagination
  const totalItems  = all.length;
  const totalPages  = Math.ceil(totalItems / limit) || 1;
  const startIndex  = (page - 1) * limit;
  const notifications = all.slice(startIndex, startIndex + limit);

  await Log(
    'backend', 'debug', 'domain',
    `Pagination result — page:${page}/${totalPages} items:${notifications.length} total:${totalItems}`
  );

  return {
    notifications,
    pagination: {
      totalItems,
      totalPages,
      currentPage    : page,
      limit,
      hasNextPage    : page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Returns the top N priority notifications.
 * Fetches all notifications and runs the priority algorithm.
 */
export async function getTopPriorityNotifications(n = 10) {
  await Log(
    'backend', 'info', 'domain',
    `getTopPriorityNotifications — fetching all for priority ranking, target n:${n}`
  );

  const allNotifications = await fetchAllFromUpstream();

  await Log(
    'backend', 'debug', 'domain',
    `Priority algorithm input — ${allNotifications.length} notifications to rank`
  );

  const topN = computeTopN(allNotifications, n);

  await Log(
    'backend', 'info', 'domain',
    `Priority ranking complete — selected top ${topN.length} from ${allNotifications.length} total`
  );

  return topN;
}
