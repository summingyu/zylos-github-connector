/**
 * Event Parser Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEventType,
  getDeliveryId,
  isValidEventType,
  getSupportedEventTypes,
  extractEventMetadata,
  EVENT_TYPES
} from '../event-parser.js';

describe('Event Parser Module', () => {
  describe('getEventType', () => {
    it('should extract push event type', () => {
      const headers = { 'x-github-event': 'push' };
      assert.equal(getEventType(headers), 'push');
    });

    it('should extract issues event type', () => {
      const headers = { 'x-github-event': 'issues' };
      assert.equal(getEventType(headers), 'issues');
    });

    it('should return "unknown" for missing event header', () => {
      const headers = {};
      assert.equal(getEventType(headers), 'unknown');
    });

    it('should return "unknown" for undefined event header', () => {
      const headers = { 'x-github-event': undefined };
      assert.equal(getEventType(headers), 'unknown');
    });
  });

  describe('getDeliveryId', () => {
    it('should extract delivery ID', () => {
      const headers = { 'x-github-delivery': '12345678-1234-1234-1234-123456789abc' };
      assert.equal(getDeliveryId(headers), '12345678-1234-1234-1234-123456789abc');
    });

    it('should return "unknown" for missing delivery header', () => {
      const headers = {};
      assert.equal(getDeliveryId(headers), 'unknown');
    });
  });

  describe('isValidEventType', () => {
    it('should validate push event', () => {
      assert.equal(isValidEventType('push'), true);
    });

    it('should validate issues event', () => {
      assert.equal(isValidEventType('issues'), true);
    });

    it('should validate issue_comment event', () => {
      assert.equal(isValidEventType('issue_comment'), true);
    });

    it('should validate pull_request event', () => {
      assert.equal(isValidEventType('pull_request'), true);
    });

    it('should validate release event', () => {
      assert.equal(isValidEventType('release'), true);
    });

    it('should reject unknown event type', () => {
      assert.equal(isValidEventType('unknown'), false);
    });

    it('should reject custom event type', () => {
      assert.equal(isValidEventType('custom_event'), false);
    });

    it('should reject empty string', () => {
      assert.equal(isValidEventType(''), false);
    });
  });

  describe('getSupportedEventTypes', () => {
    it('should return array of supported events', () => {
      const events = getSupportedEventTypes();
      assert.ok(Array.isArray(events));
      assert.ok(events.length > 0);
    });

    it('should include core event types', () => {
      const events = getSupportedEventTypes();
      assert.ok(events.includes('push'));
      assert.ok(events.includes('issues'));
      assert.ok(events.includes('pull_request'));
      assert.ok(events.includes('release'));
    });

    it('should return frozen array (immutable)', () => {
      const events = getSupportedEventTypes();
      assert.ok(Object.isFrozen(events));
    });
  });

  describe('extractEventMetadata', () => {
    it('should extract all metadata for valid event', () => {
      const headers = {
        'x-github-event': 'push',
        'x-github-delivery': '12345678-1234-1234-1234-123456789abc'
      };
      const metadata = extractEventMetadata(headers);

      assert.equal(metadata.eventType, 'push');
      assert.equal(metadata.deliveryId, '12345678-1234-1234-1234-123456789abc');
      assert.equal(metadata.isSupported, true);
    });

    it('should handle unsupported event type', () => {
      const headers = {
        'x-github-event': 'custom_event',
        'x-github-delivery': '87654321-4321-4321-4321-cba987654321'
      };
      const metadata = extractEventMetadata(headers);

      assert.equal(metadata.eventType, 'custom_event');
      assert.equal(metadata.deliveryId, '87654321-4321-4321-4321-cba987654321');
      assert.equal(metadata.isSupported, false);
    });

    it('should handle missing headers', () => {
      const headers = {};
      const metadata = extractEventMetadata(headers);

      assert.equal(metadata.eventType, 'unknown');
      assert.equal(metadata.deliveryId, 'unknown');
      assert.equal(metadata.isSupported, false);
    });
  });

  describe('EVENT_TYPES constant', () => {
    it('should be frozen', () => {
      assert.ok(Object.isFrozen(EVENT_TYPES));
    });

    it('should contain expected event types', () => {
      assert.equal(EVENT_TYPES.PUSH, 'push');
      assert.equal(EVENT_TYPES.ISSUES, 'issues');
      assert.equal(EVENT_TYPES.ISSUE_COMMENT, 'issue_comment');
      assert.equal(EVENT_TYPES.PULL_REQUEST, 'pull_request');
      assert.equal(EVENT_TYPES.RELEASE, 'release');
    });
  });
});
