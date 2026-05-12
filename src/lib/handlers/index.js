/**
 * Event Handlers
 *
 * This module exports all event handlers for GitHub webhook events.
 * Handlers are registered with the router system in src/index.js.
 *
 * Each handler returns an object with:
 * - processed: boolean - Whether the event was processed
 * - message: string - Formatted message or status message
 * - event: string - Event type
 * - data: object - Extracted event data
 */

// Export actual handlers
export { handleIssues } from './issues.js';
export { handlePullRequest } from './pull-request.js';
export { handleIssueComment } from './comment.js';
export { handleRelease } from './release.js';

/**
 * Placeholder handler for push events
 *
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Handler result
 */
export async function handlePush(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: expected object');
  }
  return {
    processed: false,
    message: 'Push handler not yet implemented',
    event: 'push',
    data: {
      ref: payload.ref || 'unknown',
      repository: payload.repository?.full_name || 'unknown'
    }
  };
}

/**
 * Default wildcard handler for unsupported events
 *
 * @param {string} eventType - The event type
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Handler result
 */
export async function handleUnsupported(eventType, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: expected object');
  }
  return {
    processed: false,
    message: `Unsupported event type: ${eventType}`,
    event: eventType,
    reason: 'unsupported_event'
  };
}
