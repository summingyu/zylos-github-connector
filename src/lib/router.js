/**
 * Event Router Module
 *
 * Routes GitHub webhook events to appropriate handler functions based on event type.
 * Provides a flexible routing system with wildcard support and error handling.
 *
 * @module router
 */

import { isValidEventType } from './event-parser.js';

/**
 * Registered event handlers
 *
 * Maps event types to their handler functions.
 *
 * @type {Map<string, Function>}
 *
 * @example
 * handlers.set('push', async (payload) => {
 *   console.log('Push event:', payload.ref);
 * });
 */
const handlers = new Map();

/**
 * Wildcard handler for unsupported or unregistered events
 *
 * @type {Function|null}
 *
 * @example
 * registerWildcardHandler(async (eventType, payload) => {
 *   console.log(`No handler for ${eventType}`);
 * });
 */
let wildcardHandler = null;

/**
 * Registers an event handler for a specific event type
 *
 * @param {string} eventType - The GitHub event type (e.g., 'push', 'issues')
 * @param {Function} handler - Async handler function
 * @param {Object} payload - The webhook payload (passed to handler)
 * @returns {Function} The handler function (for chaining)
 *
 * @throws {Error} If eventType is invalid or handler is not a function
 *
 * @example
 * registerHandler('push', async (payload) => {
 *   console.log('Push to', payload.ref);
 *   return { processed: true };
 * });
 */
export function registerHandler(eventType, handler) {
  if (!eventType || typeof eventType !== 'string') {
    throw new Error('Event type must be a non-empty string');
  }

  if (typeof handler !== 'function') {
    throw new Error('Handler must be a function');
  }

  handlers.set(eventType, handler);

  return handler;
}

/**
 * Registers a wildcard handler for unsupported events
 *
 * The wildcard handler receives both the event type and payload,
 * allowing for custom fallback behavior.
 *
 * @param {Function} handler - Async wildcard handler function
 * @param {string} eventType - The event type (first argument)
 * @param {Object} payload - The webhook payload (second argument)
 * @returns {Function} The handler function (for chaining)
 *
 * @throws {Error} If handler is not a function
 *
 * @example
 * registerWildcardHandler(async (eventType, payload) => {
 *   console.log(`No handler registered for ${eventType}`);
 *   return { handled: false, reason: 'unsupported_event' };
 * });
 */
export function registerWildcardHandler(handler) {
  if (typeof handler !== 'function') {
    throw new Error('Wildcard handler must be a function');
  }

  wildcardHandler = handler;

  return handler;
}

/**
 * Routes an event to the appropriate handler
 *
 * @param {string} eventType - The GitHub event type
 * @param {Object} payload - The webhook payload
 * @returns {Promise<Object>} Handler result object
 * @returns {boolean} returns.handled - Whether the event was handled
 * @returns {string} returns.eventType - The event type that was routed
 * @returns {*} returns.result - The handler's return value (if any)
 *
 * @throws {Error} If handler throws an error
 *
 * @example
 * const result = await routeEvent('push', { ref: 'refs/heads/main' });
 * // Returns: { handled: true, eventType: 'push', result: { processed: true } }
 */
export async function routeEvent(eventType, payload) {
  // Check if we have a registered handler for this event type
  if (handlers.has(eventType)) {
    const handler = handlers.get(eventType);

    try {
      const result = await handler(payload);

      return {
        handled: true,
        eventType,
        result
      };
    } catch (err) {
      // Re-throw handler errors for upstream handling
      throw new Error(`Handler error for event '${eventType}': ${err.message}`);
    }
  }

  // Fall back to wildcard handler if registered
  if (wildcardHandler) {
    try {
      const result = await wildcardHandler(eventType, payload);

      return {
        handled: true,
        eventType,
        result
      };
    } catch (err) {
      throw new Error(`Wildcard handler error for event '${eventType}': ${err.message}`);
    }
  }

  // No handler available
  return {
    handled: false,
    eventType,
    result: null,
    reason: 'No handler registered for this event type'
  };
}

/**
 * Checks if a handler is registered for an event type
 *
 * @param {string} eventType - The event type to check
 * @returns {boolean} True if a handler is registered
 *
 * @example
 * if (hasHandler('push')) {
 *   console.log('Push events are handled');
 * }
 */
export function hasHandler(eventType) {
  return handlers.has(eventType);
}

/**
 * Removes a handler for an event type
 *
 * @param {string} eventType - The event type to unregister
 * @returns {boolean} True if a handler was removed
 *
 * @example
 * unregisterHandler('push');
 */
export function unregisterHandler(eventType) {
  return handlers.delete(eventType);
}

/**
 * Returns all registered event types
 *
 * @returns {string[]} Array of registered event types
 *
 * @example
 * const registered = getRegisteredEventTypes();
 * // Returns: ['push', 'issues', 'pull_request']
 */
export function getRegisteredEventTypes() {
  return Array.from(handlers.keys());
}

/**
 * Returns router statistics
 *
 * @returns {Object} Statistics object
 * @returns {number} returns.totalHandlers - Total number of registered handlers
 * @returns {boolean} returns.hasWildcardHandler - Whether a wildcard handler is registered
 * @returns {string[]} returns.registeredEventTypes - List of registered event types
 *
 * @example
 * const stats = getRouterStats();
 * console.log(`Registered ${stats.totalHandlers} handlers`);
 */
export function getRouterStats() {
  return {
    totalHandlers: handlers.size,
    hasWildcardHandler: wildcardHandler !== null,
    registeredEventTypes: getRegisteredEventTypes()
  };
}

/**
 * Clears all registered handlers
 *
 * WARNING: This should typically only be used in testing.
 *
 * @returns {number} The number of handlers that were cleared
 *
 * @example
 * // In a test suite
 * afterEach(() => {
 *   clearHandlers();
 * });
 */
export function clearHandlers() {
  const count = handlers.size;
  handlers.clear();
  wildcardHandler = null;
  return count;
}

/**
 * Default wildcard handler (logs unsupported events)
 *
 * This is used as a fallback when no wildcard handler is registered.
 * It logs the unsupported event type and returns a handled: false result.
 *
 * @param {string} eventType - The unsupported event type
 * @param {Object} payload - The webhook payload
 * @returns {Promise<Object>} Result object
 *
 * @example
 * const result = await defaultWildcardHandler('custom_event', payload);
 * // Returns: { handled: false, reason: 'unsupported_event' }
 */
export async function defaultWildcardHandler(eventType, payload) {
  return {
    handled: false,
    eventType,
    reason: 'unsupported_event'
  };
}
