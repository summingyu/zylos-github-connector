/**
 * Ping Event Handler
 *
 * Processes GitHub ping webhook events (webhook health checks).
 * Ping events are sent by GitHub when a webhook is created or tested.
 *
 * @module handlers/ping
 */

/**
 * Handles ping webhook events
 *
 * Ping events are GitHub's way of verifying that a webhook is working.
 * They are typically sent when:
 * - A webhook is newly created
 * - A webhook is manually tested from GitHub's webhook settings
 *
 * We handle these silently (no message sent to user) since they are
 * just health checks and not user actions.
 *
 * @param {Object} payload - GitHub webhook payload for ping event
 * @param {number} payload.zen - Random zen quote (GitHub's signature)
 * @param {Object} payload.hook - The webhook object
 * @returns {Promise<Object>} Handler result
 * @returns {boolean} returns.processed - Always true for ping events
 * @returns {string} returns.message - Empty string (no user-visible message)
 * @returns {string} returns.event - Event type ('ping')
 * @returns {Object} returns.data - Ping metadata
 *
 * @throws {Error} If payload is invalid
 *
 * @example
 * const result = await handlePing({
 *   zen: 'Talk is cheap. Show me the code.',
 *   hook: { id: 123456, url: 'https://example.com/webhook' }
 * });
 * // Returns: { processed: true, message: '', event: 'ping', data: {...} }
 */
export async function handlePing(payload) {
  // Input validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  const { zen, hook } = payload;

  return {
    processed: true,
    message: '', // Empty message - no notification needed for health checks
    event: 'ping',
    data: {
      zen: zen || null,
      hookId: hook?.id || null,
      hookUrl: hook?.url || null
    }
  };
}
