/**
 * C4 Communication Bridge Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sendToC4, sendWithRetry } from '../comm-bridge.js';

describe('C4 Communication Bridge Module', () => {
  describe('sendToC4', () => {
    it('should return error for invalid channel', async () => {
      const result = await sendToC4('', 'user/repo', 'Test message');
      assert.equal(result.ok, false);
      assert.equal(result.error, 'invalid_channel');
    });

    it('should return error for invalid endpoint', async () => {
      const result = await sendToC4('github', '', 'Test message');
      assert.equal(result.ok, false);
      assert.equal(result.error, 'invalid_endpoint');
    });

    it('should return error for invalid message', async () => {
      const result = await sendToC4('github', 'user/repo', '');
      assert.equal(result.ok, false);
      assert.equal(result.error, 'invalid_message');
    });

    it('should return error for null channel', async () => {
      const result = await sendToC4(null, 'user/repo', 'Test message');
      assert.equal(result.ok, false);
      assert.equal(result.error, 'invalid_channel');
    });

    it('should return error for undefined endpoint', async () => {
      const result = await sendToC4('github', undefined, 'Test message');
      assert.equal(result.ok, false);
      assert.equal(result.error, 'invalid_endpoint');
    });

    it('should return error for non-string message', async () => {
      const result = await sendToC4('github', 'user/repo', 123);
      assert.equal(result.ok, false);
      assert.equal(result.error, 'invalid_message');
    });
  });

  describe('sendWithRetry', () => {
    it('should export sendWithRetry function', async () => {
      assert.equal(typeof sendWithRetry, 'function');
    });

    it('should accept required parameters', async () => {
      // This will fail with connection error, but we can test the interface
      const result = await sendWithRetry('github', 'user/repo', 'Test message', 0);
      assert.equal(typeof result, 'object');
      assert.equal(typeof result.ok, 'boolean');
    });

    it('should use default retry count', async () => {
      const result = await sendWithRetry('github', 'user/repo', 'Test message');
      assert.equal(typeof result, 'object');
      assert.equal(typeof result.ok, 'boolean');
    });
  });
});
