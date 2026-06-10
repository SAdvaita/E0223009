/**
 * Token Manager
 *
 * Automatically refreshes the JWT Bearer token before it expires.
 * The evaluation server issues tokens with a ~15-minute TTL.
 * This module keeps a valid token in memory at all times and
 * re-authenticates transparently when the token nears expiry.
 *
 * Secure coding: credentials stored only in .env, never hardcoded.
 */

import axios from 'axios';

const AUTH_API = 'http://4.224.186.213/evaluation-service/auth';

// Buffer: refresh 60 seconds BEFORE expiry to avoid race conditions
const REFRESH_BUFFER_SECONDS = 60;

let _cachedToken     = process.env.ACCESS_TOKEN || '';
let _tokenExpiresAt  = 0; // Unix timestamp (seconds)

/**
 * Parse the expiry from a JWT (without external libraries).
 * @param {string} token
 * @returns {number} Unix timestamp in seconds, or 0 if unreadable
 */
function parseTokenExpiry(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8')
    );
    // The eval server stores exp inside MapClaims
    return payload?.MapClaims?.exp ?? payload?.exp ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Fetches a fresh token from the evaluation auth endpoint.
 * Uses credentials from environment variables.
 */
async function refreshToken() {
  const { AUTH_EMAIL, AUTH_NAME, AUTH_ROLL_NO, AUTH_ACCESS_CODE,
          AUTH_CLIENT_ID, AUTH_CLIENT_SECRET } = process.env;

  if (!AUTH_CLIENT_ID || !AUTH_CLIENT_SECRET) {
    console.warn('[TokenManager] Auth credentials not in .env — using static token');
    return;
  }

  try {
    const response = await axios.post(
      AUTH_API,
      {
        email       : AUTH_EMAIL,
        name        : AUTH_NAME,
        rollNo      : AUTH_ROLL_NO,
        accessCode  : AUTH_ACCESS_CODE,
        clientID    : AUTH_CLIENT_ID,
        clientSecret: AUTH_CLIENT_SECRET,
      },
      { timeout: 8000 }
    );

    const newToken = response.data?.access_token;
    if (!newToken) throw new Error('No access_token in auth response');

    _cachedToken    = newToken;
    _tokenExpiresAt = parseTokenExpiry(newToken);

    // Update the logger's token too
    const { configure } = await import('../../logging_middleware/index.js');
    configure(_cachedToken);

    console.log('[TokenManager] Token refreshed successfully');
  } catch (err) {
    console.error(`[TokenManager] Refresh failed: ${err.message}`);
  }
}

/**
 * Returns a valid token, refreshing automatically if expired or close to expiry.
 * @returns {Promise<string>} Valid Bearer token
 */
export async function getToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Initialize expiry from the token already in .env if not parsed yet
  if (_tokenExpiresAt === 0 && _cachedToken) {
    _tokenExpiresAt = parseTokenExpiry(_cachedToken);
  }

  // Refresh if token is missing or will expire within the buffer window
  if (!_cachedToken || nowSeconds >= (_tokenExpiresAt - REFRESH_BUFFER_SECONDS)) {
    console.log('[TokenManager] Token expired or close to expiry — refreshing...');
    await refreshToken();
  }

  return _cachedToken;
}

/**
 * Initialise token manager at startup.
 * Parses expiry from existing .env token and schedules periodic checks.
 */
export function initTokenManager() {
  if (_cachedToken) {
    _tokenExpiresAt = parseTokenExpiry(_cachedToken);
    const expiresIn = _tokenExpiresAt - Math.floor(Date.now() / 1000);
    console.log(`[TokenManager] Token loaded — expires in ${expiresIn}s`);
  }

  // Check every 2 minutes whether a refresh is needed
  setInterval(async () => {
    await getToken(); // Will auto-refresh if close to expiry
  }, 2 * 60 * 1000);
}
