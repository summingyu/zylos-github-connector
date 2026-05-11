/**
 * Event Parser Module
 *
 * Extracts and validates GitHub webhook event metadata from request headers.
 * Provides constants for supported event types and validation utilities.
 *
 * @module event-parser
 */

/**
 * Supported GitHub webhook event types
 *
 * @constant {Object<string, string>}
 * @readonly
 */
export const EVENT_TYPES = Object.freeze({
  PUSH: 'push',
  ISSUES: 'issues',
  ISSUE_COMMENT: 'issue_comment',
  PULL_REQUEST: 'pull_request',
  PULL_REQUEST_REVIEW: 'pull_request_review',
  PULL_REQUEST_REVIEW_COMMENT: 'pull_request_review_comment',
  RELEASE: 'release',
  FORK: 'fork',
  WATCH: 'watch',
  CREATE: 'create',
  DELETE: 'delete',
  MEMBER: 'member',
  PUBLIC: 'public',
  STATUS: 'status',
  DEPLOYMENT: 'deployment',
  DEPLOYMENT_STATUS: 'deployment_status'
});

/**
 * Array of all supported event type values
 *
 * @constant {string[]}
 * @readonly
 */
export const SUPPORTED_EVENTS = Object.freeze(Object.values(EVENT_TYPES));

/**
 * Extracts the X-GitHub-Event header value from request headers
 *
 * @param {Object} headers - Request headers object
 * @param {string} [headers['x-github-event']] - X-GitHub-Event header value
 * @returns {string} The event type (e.g., 'push', 'issues')
 *
 * @example
 * const eventType = getEventType(request.headers);
 * // Returns: 'push'
 */
export function getEventType(headers) {
  return headers['x-github-event'] || 'unknown';
}

/**
 * Extracts the X-GitHub-Delivery header value from request headers
 *
 * Each webhook delivery has a unique GUID to prevent duplicate processing.
 *
 * @param {Object} headers - Request headers object
 * @param {string} [headers['x-github-delivery']] - X-GitHub-Delivery header value
 * @returns {string} The delivery ID (GUID)
 *
 * @example
 * const deliveryId = getDeliveryId(request.headers);
 * // Returns: '12345678-1234-1234-1234-123456789abc'
 */
export function getDeliveryId(headers) {
  return headers['x-github-delivery'] || 'unknown';
}

/**
 * Validates if an event type is supported by this connector
 *
 * @param {string} eventType - The event type to validate
 * @returns {boolean} True if the event type is supported
 *
 * @example
 * isValidEventType('push');        // true
 * isValidEventType('issues');       // true
 * isValidEventType('unknown');      // false
 * isValidEventType('custom_event'); // false
 */
export function isValidEventType(eventType) {
  return SUPPORTED_EVENTS.includes(eventType);
}

/**
 * Returns a list of all supported event types
 *
 * Useful for logging and documentation
 *
 * @returns {string[]} Array of supported event type names
 *
 * @example
 * const supported = getSupportedEventTypes();
 * // Returns: ['push', 'issues', 'issue_comment', 'pull_request', ...]
 */
export function getSupportedEventTypes() {
  return SUPPORTED_EVENTS;
}

/**
 * Extracts all relevant GitHub webhook metadata from headers
 *
 * Convenience function that extracts both event type and delivery ID
 *
 * @param {Object} headers - Request headers object
 * @returns {Object} Parsed metadata
 * @returns {string} returns.eventType - The event type
 * @returns {string} returns.deliveryId - The delivery ID
 * @returns {boolean} returns.isSupported - Whether the event type is supported
 *
 * @example
 * const metadata = extractEventMetadata(request.headers);
 * // Returns: {
 * //   eventType: 'push',
 * //   deliveryId: '12345678-1234-1234-1234-123456789abc',
 * //   isSupported: true
 * // }
 */
export function extractEventMetadata(headers) {
  const eventType = getEventType(headers);
  const deliveryId = getDeliveryId(headers);

  return {
    eventType,
    deliveryId,
    isSupported: isValidEventType(eventType)
  };
}
