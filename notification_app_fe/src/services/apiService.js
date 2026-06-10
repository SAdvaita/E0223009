/**
 * API Service
 * All backend communication is centralised here.
 * Components must NEVER call axios directly.
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Fetch paginated notifications.
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @param {string} [params.notification_type]
 */
export async function fetchAllNotifications({ page = 1, limit = 10, notification_type } = {}) {
  const params = { page, limit };
  if (notification_type) params.notification_type = notification_type;
  const res = await api.get('/api/notifications', { params });
  return res.data;
}

/**
 * Fetch top-N priority notifications.
 * @param {number} [n=10]
 */
export async function fetchPriorityNotifications(n = 10) {
  const res = await api.get('/api/notifications/priority', { params: { n } });
  return res.data;
}
