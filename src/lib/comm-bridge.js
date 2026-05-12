/**
 * C4 Communication Bridge Module
 *
 * Wrapper module for sending messages to Claude via the C4 communication bridge.
 * Provides retry logic, timeout handling, and proper shell escaping for message content.
 *
 * @module comm-bridge
 */

import { exec } from 'child_process';
import path from 'path';

/**
 * Path to the C4 receive script
 *
 * This script receives messages from components and forwards them to Claude.
 *
 * @constant {string}
 */
const C4_RECEIVE = path.join(process.env.HOME,
  'zylos/.claude/skills/comm-bridge/scripts/c4-receive.js');

/**
 * Default channel to use for C4 communication
 *
 * TODO: Register github channel in C4 and change this to 'github'
 *
 * @constant {string}
 */
const DEFAULT_CHANNEL = 'system';

/**
 * Default timeout for C4 calls
 *
 * If C4 doesn't respond within this time, the call is marked as timed out.
 *
 * @constant {number}
 */
const DEFAULT_TIMEOUT = 3000;

/**
 * Default retry count for failed C4 calls
 *
 * @constant {number}
 */
const DEFAULT_MAX_RETRIES = 2;

/**
 * Retry delay in milliseconds
 *
 * @constant {number}
 */
const RETRY_DELAY = 500;

/**
 * Sends a message to Claude via the C4 communication bridge
 *
 * @param {string} channel - The channel identifier (e.g., 'github')
 * @param {string} endpoint - The endpoint identifier (e.g., 'user/repo')
 * @param {string} message - The message content to send
 * @param {number} timeout - Timeout in milliseconds (default: 3000)
 * @returns {Promise<Object>} Result object
 * @returns {boolean} returns.ok - Whether the send was successful
 * @returns {string|undefined} returns.error - Error message if failed
 *
 * @example
 * const result = await sendToC4('github', 'user/repo', 'Hello Claude');
 * if (result.ok) {
 *   console.log('Message sent successfully');
 * } else {
 *   console.error('Failed to send:', result.error);
 * }
 */
export async function sendToC4(channel, endpoint, message, timeout = DEFAULT_TIMEOUT) {
  // Validate inputs
  if (typeof channel !== 'string' || channel.length === 0) {
    return { ok: false, error: 'invalid_channel' };
  }
  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    return { ok: false, error: 'invalid_endpoint' };
  }
  if (typeof message !== 'string' || message.length === 0) {
    return { ok: false, error: 'invalid_message' };
  }

  // Shell escape single quotes by replacing ' with '\''
  const safeContent = message.replace(/'/g, "'\\''");
  // Use --no-reply since we don't need reply routing for webhooks
  const cmd = `node "${C4_RECEIVE}" --channel "${channel}" --endpoint "${endpoint}" --json --no-reply --content '${safeContent}'`;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, error: 'timeout' });
    }, timeout);

    exec(cmd, { encoding: 'utf8' }, (error, stdout, stderr) => {
      clearTimeout(timer);

      if (!error) {
        try {
          const response = JSON.parse(stdout.trim());
          if (response.ok === true) {
            resolve({ ok: true });
          } else {
            resolve({ ok: false, error: response.error?.message || 'unknown_error' });
          }
        } catch (parseErr) {
          resolve({ ok: false, error: 'parse_error' });
        }
        return;
      }

      // Try to parse JSON from error output (C4 may return JSON in stderr)
      try {
        const errorOutput = error.stdout || stderr || stdout;
        const response = JSON.parse(errorOutput);
        if (response.ok === false) {
          resolve({ ok: false, error: response.error?.message || error.message });
          return;
        }
      } catch {
        // Not JSON, use the error message
      }

      resolve({ ok: false, error: error.message });
    });
  });
}

/**
 * Sends a message to C4 with retry logic
 *
 * Retries the send operation up to maxRetries times if it fails.
 * Waits RETRY_DELAY milliseconds between retry attempts.
 *
 * @param {string} channel - The channel identifier (e.g., 'github')
 * @param {string} endpoint - The endpoint identifier (e.g., 'user/repo')
 * @param {string} message - The message content to send
 * @param {number} maxRetries - Maximum number of retry attempts (default: 2)
 * @returns {Promise<Object>} Result object
 * @returns {boolean} returns.ok - Whether the send was successful
 * @returns {string|undefined} returns.error - Error message if failed
 *
 * @example
 * const result = await sendWithRetry('github', 'user/repo', 'Hello Claude');
 * if (result.ok) {
 *   console.log('Message sent successfully');
 * } else {
 *   console.error('Failed to send after retries:', result.error);
 * }
 */
export async function sendWithRetry(channel, endpoint, message, maxRetries = DEFAULT_MAX_RETRIES) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.warn(`[github-connector] C4 send retry ${attempt}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }

    const result = await sendToC4(channel, endpoint, message);

    if (result.ok) {
      return result;
    }

    lastError = result.error;
  }

  return { ok: false, error: lastError };
}
