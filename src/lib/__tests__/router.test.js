/**
 * Event Router Tests
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerHandler,
  registerWildcardHandler,
  routeEvent,
  hasHandler,
  unregisterHandler,
  getRegisteredEventTypes,
  getRouterStats,
  clearHandlers,
  defaultWildcardHandler
} from '../router.js';

describe('Event Router Module', () => {
  afterEach(() => {
    // Clear state after each test
    clearHandlers();
  });

  describe('registerHandler', () => {
    it('should register a handler for an event type', () => {
      const handler = async (payload) => ({ processed: true });
      registerHandler('push', handler);

      assert.ok(hasHandler('push'));
    });

    it('should return the registered handler', () => {
      const handler = async (payload) => ({ processed: true });
      const result = registerHandler('push', handler);

      assert.equal(result, handler);
    });

    it('should throw error for invalid event type', () => {
      const handler = async (payload) => ({ processed: true });

      assert.throws(
        () => registerHandler('', handler),
        { message: 'Event type must be a non-empty string' }
      );

      assert.throws(
        () => registerHandler(null, handler),
        { message: 'Event type must be a non-empty string' }
      );
    });

    it('should throw error for non-function handler', () => {
      assert.throws(
        () => registerHandler('push', 'not-a-function'),
        { message: 'Handler must be a function' }
      );

      assert.throws(
        () => registerHandler('push', null),
        { message: 'Handler must be a function' }
      );
    });

    it('should allow replacing existing handler', () => {
      const handler1 = async (payload) => ({ version: 1 });
      const handler2 = async (payload) => ({ version: 2 });

      registerHandler('push', handler1);
      registerHandler('push', handler2);

      assert.ok(hasHandler('push'));
    });
  });

  describe('registerWildcardHandler', () => {
    it('should register a wildcard handler', () => {
      const handler = async (eventType, payload) => ({ handled: true });
      registerWildcardHandler(handler);

      const stats = getRouterStats();
      assert.equal(stats.hasWildcardHandler, true);
    });

    it('should return the registered handler', () => {
      const handler = async (eventType, payload) => ({ handled: true });
      const result = registerWildcardHandler(handler);

      assert.equal(result, handler);
    });

    it('should throw error for non-function handler', () => {
      assert.throws(
        () => registerWildcardHandler('not-a-function'),
        { message: 'Wildcard handler must be a function' }
      );
    });

    it('should allow replacing existing wildcard handler', () => {
      const handler1 = async (eventType, payload) => ({ version: 1 });
      const handler2 = async (eventType, payload) => ({ version: 2 });

      registerWildcardHandler(handler1);
      registerWildcardHandler(handler2);

      const stats = getRouterStats();
      assert.equal(stats.hasWildcardHandler, true);
    });
  });

  describe('routeEvent', () => {
    it('should route event to registered handler', async () => {
      const handler = async (payload) => ({
        processed: true,
        data: payload.ref
      });

      registerHandler('push', handler);

      const result = await routeEvent('push', { ref: 'refs/heads/main' });

      assert.equal(result.handled, true);
      assert.equal(result.eventType, 'push');
      assert.equal(result.result.data, 'refs/heads/main');
    });

    it('should route to wildcard handler if no specific handler', async () => {
      const wildcardHandler = async (eventType, payload) => ({
        handled: true,
        fallbackEvent: eventType
      });

      registerWildcardHandler(wildcardHandler);

      const result = await routeEvent('custom_event', { data: 'test' });

      assert.equal(result.handled, true);
      assert.equal(result.result.fallbackEvent, 'custom_event');
    });

    it('should return unhandled result if no handler available', async () => {
      const result = await routeEvent('unsupported_event', { data: 'test' });

      assert.equal(result.handled, false);
      assert.equal(result.eventType, 'unsupported_event');
      assert.equal(result.result, null);
      assert.equal(result.reason, 'No handler registered for this event type');
    });

    it('should throw error if handler throws', async () => {
      const handler = async (payload) => {
        throw new Error('Handler failed');
      };

      registerHandler('push', handler);

      await assert.rejects(
        () => routeEvent('push', {}),
        { message: "Handler error for event 'push': Handler failed" }
      );
    });

    it('should throw error if wildcard handler throws', async () => {
      const wildcardHandler = async (eventType, payload) => {
        throw new Error('Wildcard handler failed');
      };

      registerWildcardHandler(wildcardHandler);

      await assert.rejects(
        () => routeEvent('custom_event', {}),
        { message: "Wildcard handler error for event 'custom_event': Wildcard handler failed" }
      );
    });

    it('should prefer specific handler over wildcard', async () => {
      const specificHandler = async (payload) => ({ type: 'specific' });
      const wildcardHandler = async (eventType, payload) => ({ type: 'wildcard' });

      registerHandler('push', specificHandler);
      registerWildcardHandler(wildcardHandler);

      const result = await routeEvent('push', {});

      assert.equal(result.handled, true);
      assert.equal(result.result.type, 'specific');
    });
  });

  describe('hasHandler', () => {
    it('should return true for registered handler', () => {
      registerHandler('push', async (payload) => ({}));
      assert.equal(hasHandler('push'), true);
    });

    it('should return false for unregistered handler', () => {
      assert.equal(hasHandler('push'), false);
    });
  });

  describe('unregisterHandler', () => {
    it('should remove registered handler', () => {
      registerHandler('push', async (payload) => ({}));
      assert.equal(hasHandler('push'), true);

      const removed = unregisterHandler('push');
      assert.equal(removed, true);
      assert.equal(hasHandler('push'), false);
    });

    it('should return false when removing non-existent handler', () => {
      const removed = unregisterHandler('push');
      assert.equal(removed, false);
    });
  });

  describe('getRegisteredEventTypes', () => {
    it('should return empty array when no handlers registered', () => {
      const types = getRegisteredEventTypes();
      assert.ok(Array.isArray(types));
      assert.equal(types.length, 0);
    });

    it('should return list of registered event types', () => {
      registerHandler('push', async (payload) => ({}));
      registerHandler('issues', async (payload) => ({}));
      registerHandler('pull_request', async (payload) => ({}));

      const types = getRegisteredEventTypes();

      assert.equal(types.length, 3);
      assert.ok(types.includes('push'));
      assert.ok(types.includes('issues'));
      assert.ok(types.includes('pull_request'));
    });
  });

  describe('getRouterStats', () => {
    it('should return stats for empty router', () => {
      const stats = getRouterStats();

      assert.equal(stats.totalHandlers, 0);
      assert.equal(stats.hasWildcardHandler, false);
      assert.ok(Array.isArray(stats.registeredEventTypes));
      assert.equal(stats.registeredEventTypes.length, 0);
    });

    it('should return stats with handlers', () => {
      registerHandler('push', async (payload) => ({}));
      registerHandler('issues', async (payload) => ({}));

      const stats = getRouterStats();

      assert.equal(stats.totalHandlers, 2);
      assert.equal(stats.hasWildcardHandler, false);
      assert.equal(stats.registeredEventTypes.length, 2);
    });

    it('should return stats with wildcard handler', () => {
      registerWildcardHandler(async (eventType, payload) => ({}));

      const stats = getRouterStats();

      assert.equal(stats.totalHandlers, 0);
      assert.equal(stats.hasWildcardHandler, true);
    });

    it('should return stats with both handlers and wildcard', () => {
      registerHandler('push', async (payload) => ({}));
      registerWildcardHandler(async (eventType, payload) => ({}));

      const stats = getRouterStats();

      assert.equal(stats.totalHandlers, 1);
      assert.equal(stats.hasWildcardHandler, true);
    });
  });

  describe('clearHandlers', () => {
    it('should clear all registered handlers', () => {
      registerHandler('push', async (payload) => ({}));
      registerHandler('issues', async (payload) => ({}));
      registerWildcardHandler(async (eventType, payload) => ({}));

      assert.equal(getRouterStats().totalHandlers, 2);
      assert.equal(getRouterStats().hasWildcardHandler, true);

      const count = clearHandlers();

      assert.equal(count, 2);
      assert.equal(getRouterStats().totalHandlers, 0);
      assert.equal(getRouterStats().hasWildcardHandler, false);
    });

    it('should return zero when clearing empty router', () => {
      const count = clearHandlers();
      assert.equal(count, 0);
    });
  });

  describe('defaultWildcardHandler', () => {
    it('should return unhandled result', async () => {
      const result = await defaultWildcardHandler('custom_event', {});

      assert.equal(result.handled, false);
      assert.equal(result.eventType, 'custom_event');
      assert.equal(result.reason, 'unsupported_event');
    });
  });

  describe('Integration: complete routing workflow', () => {
    it('should handle complete event routing workflow', async () => {
      // Register handlers for different event types
      registerHandler('push', async (payload) => ({
        type: 'push',
        ref: payload.ref
      }));

      registerHandler('issues', async (payload) => ({
        type: 'issues',
        action: payload.action
      }));

      registerWildcardHandler(async (eventType, payload) => ({
        type: 'wildcard',
        eventType
      }));

      // Test push event
      const pushResult = await routeEvent('push', { ref: 'main' });
      assert.equal(pushResult.handled, true);
      assert.equal(pushResult.result.type, 'push');

      // Test issues event
      const issuesResult = await routeEvent('issues', { action: 'opened' });
      assert.equal(issuesResult.handled, true);
      assert.equal(issuesResult.result.type, 'issues');

      // Test unsupported event (should use wildcard)
      const customResult = await routeEvent('custom_event', {});
      assert.equal(customResult.handled, true);
      assert.equal(customResult.result.type, 'wildcard');
    });
  });
});
