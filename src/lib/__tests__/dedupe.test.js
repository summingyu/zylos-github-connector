/**
 * Deduplication Module Tests
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  seenDeliveries,
  hasDeliveryBeenSeen,
  markDeliveryAsSeen,
  getDedupeStats,
  clearSeenDeliveries,
  pruneOldDeliveries,
  isValidDeliveryId
} from '../dedupe.js';

describe('Deduplication Module', () => {
  afterEach(() => {
    // Clear state after each test
    clearSeenDeliveries();
  });

  describe('seenDeliveries Set', () => {
    it('should be an instance of Set', () => {
      assert.ok(seenDeliveries instanceof Set);
    });

    it('should start empty', () => {
      assert.equal(seenDeliveries.size, 0);
    });
  });

  describe('hasDeliveryBeenSeen', () => {
    it('should return false for unseen delivery', () => {
      const result = hasDeliveryBeenSeen('12345678-1234-1234-1234-123456789abc');
      assert.equal(result, false);
    });

    it('should return true for seen delivery', () => {
      const deliveryId = '12345678-1234-1234-1234-123456789abc';
      seenDeliveries.add(deliveryId);
      const result = hasDeliveryBeenSeen(deliveryId);
      assert.equal(result, true);
    });

    it('should return false for null delivery ID', () => {
      assert.equal(hasDeliveryBeenSeen(null), false);
    });

    it('should return false for undefined delivery ID', () => {
      assert.equal(hasDeliveryBeenSeen(undefined), false);
    });

    it('should return false for empty string', () => {
      assert.equal(hasDeliveryBeenSeen(''), false);
    });

    it('should return false for non-string input', () => {
      assert.equal(hasDeliveryBeenSeen(123), false);
      assert.equal(hasDeliveryBeenSeen({}), false);
      assert.equal(hasDeliveryBeenSeen([]), false);
    });
  });

  describe('markDeliveryAsSeen', () => {
    it('should add new delivery ID and return true', () => {
      const deliveryId = '12345678-1234-1234-1234-123456789abc';
      const result = markDeliveryAsSeen(deliveryId);

      assert.equal(result, true);
      assert.ok(seenDeliveries.has(deliveryId));
    });

    it('should not duplicate existing delivery ID and return false', () => {
      const deliveryId = '12345678-1234-1234-1234-123456789abc';
      seenDeliveries.add(deliveryId);

      const result = markDeliveryAsSeen(deliveryId);

      assert.equal(result, false);
      assert.equal(seenDeliveries.size, 1);
    });

    it('should handle multiple unique delivery IDs', () => {
      const ids = [
        '12345678-1234-1234-1234-123456789abc',
        '87654321-4321-4321-4321-cba987654321',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      ];

      ids.forEach(id => {
        const result = markDeliveryAsSeen(id);
        assert.equal(result, true);
      });

      assert.equal(seenDeliveries.size, 3);
    });

    it('should return false for null delivery ID', () => {
      const result = markDeliveryAsSeen(null);
      assert.equal(result, false);
      assert.equal(seenDeliveries.size, 0);
    });

    it('should return false for undefined delivery ID', () => {
      const result = markDeliveryAsSeen(undefined);
      assert.equal(result, false);
      assert.equal(seenDeliveries.size, 0);
    });

    it('should return false for empty string', () => {
      const result = markDeliveryAsSeen('');
      assert.equal(result, false);
      assert.equal(seenDeliveries.size, 0);
    });
  });

  describe('getDedupeStats', () => {
    it('should return zero stats for empty set', () => {
      const stats = getDedupeStats();

      assert.equal(stats.totalSeen, 0);
      assert.equal(stats.currentSetSize, 0);
      assert.ok(stats.memoryEstimate.includes('MB'));
    });

    it('should return accurate stats after adding deliveries', () => {
      markDeliveryAsSeen('12345678-1234-1234-1234-123456789abc');
      markDeliveryAsSeen('87654321-4321-4321-4321-cba987654321');

      const stats = getDedupeStats();

      assert.equal(stats.totalSeen, 2);
      assert.equal(stats.currentSetSize, 2);
    });

    it('should not count duplicates in stats', () => {
      const deliveryId = '12345678-1234-1234-1234-123456789abc';
      markDeliveryAsSeen(deliveryId);
      markDeliveryAsSeen(deliveryId);
      markDeliveryAsSeen(deliveryId);

      const stats = getDedupeStats();

      assert.equal(stats.totalSeen, 1);
    });

    it('should include memory estimate', () => {
      // Add some deliveries
      for (let i = 0; i < 100; i++) {
        markDeliveryAsSeen(`12345678-1234-1234-1234-${String(i).padStart(12, '0')}`);
      }

      const stats = getDedupeStats();

      assert.ok(stats.memoryEstimate);
      assert.ok(typeof stats.memoryEstimate === 'string');
      assert.ok(stats.memoryEstimate.includes('MB'));
    });
  });

  describe('clearSeenDeliveries', () => {
    it('should clear all delivery IDs', () => {
      markDeliveryAsSeen('12345678-1234-1234-1234-123456789abc');
      markDeliveryAsSeen('87654321-4321-4321-4321-cba987654321');

      assert.equal(seenDeliveries.size, 2);

      const count = clearSeenDeliveries();

      assert.equal(count, 2);
      assert.equal(seenDeliveries.size, 0);
    });

    it('should return zero when clearing empty set', () => {
      const count = clearSeenDeliveries();
      assert.equal(count, 0);
    });
  });

  describe('pruneOldDeliveries', () => {
    it('should be a no-op in current implementation', () => {
      // Add some deliveries
      markDeliveryAsSeen('12345678-1234-1234-1234-123456789abc');
      markDeliveryAsSeen('87654321-4321-4321-4321-cba987654321');

      // Call prune with various options
      const removed1 = pruneOldDeliveries();
      const removed2 = pruneOldDeliveries({ maxSize: 1 });
      const removed3 = pruneOldDeliveries({ maxAgeHours: 1 });

      assert.equal(removed1, 0);
      assert.equal(removed2, 0);
      assert.equal(removed3, 0);

      // All deliveries should still be present
      assert.equal(seenDeliveries.size, 2);
    });
  });

  describe('isValidDeliveryId', () => {
    it('should validate correct GUID format', () => {
      assert.equal(isValidDeliveryId('12345678-1234-1234-1234-123456789abc'), true);
      assert.equal(isValidDeliveryId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
      assert.equal(isValidDeliveryId('AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'), true);
      assert.equal(isValidDeliveryId('01234567-89ab-cdef-0123-456789abcdef'), true);
    });

    it('should reject invalid GUID formats', () => {
      assert.equal(isValidDeliveryId('not-a-guid'), false);
      assert.equal(isValidDeliveryId('12345678123412341234123456789abc'), false); // No hyphens
      assert.equal(isValidDeliveryId('12345678-1234-1234-1234-123456789ab'), false); // Too short
      assert.equal(isValidDeliveryId('12345678-1234-1234-1234-123456789abcd'), false); // Too long
      assert.equal(isValidDeliveryId('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'), false); // Invalid hex
    });

    it('should reject null and undefined', () => {
      assert.equal(isValidDeliveryId(null), false);
      assert.equal(isValidDeliveryId(undefined), false);
    });

    it('should reject empty string', () => {
      assert.equal(isValidDeliveryId(''), false);
    });

    it('should reject non-string input', () => {
      assert.equal(isValidDeliveryId(123), false);
      assert.equal(isValidDeliveryId({}), false);
      assert.equal(isValidDeliveryId([]), false);
    });
  });

  describe('Integration: mark and check workflow', () => {
    it('should handle complete dedupe workflow', () => {
      const deliveryId = '12345678-1234-1234-1234-123456789abc';

      // First time: should not be seen
      assert.equal(hasDeliveryBeenSeen(deliveryId), false);

      // Mark as seen
      const wasNew = markDeliveryAsSeen(deliveryId);
      assert.equal(wasNew, true);

      // Second time: should be seen
      assert.equal(hasDeliveryBeenSeen(deliveryId), true);

      // Try to mark again
      const wasNewAgain = markDeliveryAsSeen(deliveryId);
      assert.equal(wasNewAgain, false);

      // Stats should reflect one unique delivery
      const stats = getDedupeStats();
      assert.equal(stats.totalSeen, 1);
    });
  });
});
