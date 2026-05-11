/**
 * Issues Handler Unit Tests
 *
 * Tests the issues event handler with comprehensive coverage of:
 * - Input validation
 * - Supported actions (opened, closed, reopened, deleted)
 * - Unsupported actions (edited, assigned, labeled, etc.)
 * - Placeholder handling for missing fields
 * - Label formatting and color mapping
 * - Return value structure
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleIssues } from '../handlers/issues.js';

describe('Issues Handler', () => {
  describe('Input Validation', () => {
    it('should throw error for null payload', async () => {
      await assert.rejects(
        async () => await handleIssues(null),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for undefined payload', async () => {
      await assert.rejects(
        async () => await handleIssues(undefined),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for non-object payload', async () => {
      await assert.rejects(
        async () => await handleIssues('string'),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for array payload', async () => {
      await assert.rejects(
        async () => await handleIssues([]),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for missing action field', async () => {
      await assert.rejects(
        async () => await handleIssues({
          issue: { title: 'Test', number: 1 }
        }),
        { message: 'Invalid payload: missing or invalid action field' }
      );
    });

    it('should throw error for invalid action field', async () => {
      await assert.rejects(
        async () => await handleIssues({
          action: 123,
          issue: { title: 'Test', number: 1 }
        }),
        { message: 'Invalid payload: missing or invalid action field' }
      );
    });

    it('should throw error for missing issue object', async () => {
      await assert.rejects(
        async () => await handleIssues({
          action: 'opened'
        }),
        { message: 'Invalid payload: missing or invalid issue object' }
      );
    });

    it('should throw error for null issue object', async () => {
      await assert.rejects(
        async () => await handleIssues({
          action: 'opened',
          issue: null
        }),
        { message: 'Invalid payload: missing or invalid issue object' }
      );
    });

    it('should throw error for undefined issue object', async () => {
      await assert.rejects(
        async () => await handleIssues({
          action: 'opened',
          issue: undefined
        }),
        { message: 'Invalid payload: missing or invalid issue object' }
      );
    });
  });

  describe('Supported Actions', () => {
    it('should format opened action with labels', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Fix login bug',
          number: 42,
          html_url: 'https://github.com/user/repo/issues/42',
          labels: [
            { name: 'bug', color: 'd73a4a' },
            { name: 'high-priority', color: 'b60205' }
          ]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.event, 'issues');
      assert.ok(result.message.includes('🔓 Issue Opened by @alice'));
      assert.ok(result.message.includes('🔴 bug'));
      assert.ok(result.message.includes('🔴 high-priority'));
      assert.ok(result.message.includes('#42: Fix login bug'));
      assert.ok(result.message.includes('🔗 https://github.com/user/repo/issues/42'));
    });

    it('should format closed action with labels', async () => {
      const payload = {
        action: 'closed',
        issue: {
          title: 'Implement feature X',
          number: 123,
          html_url: 'https://github.com/user/repo/issues/123',
          labels: [{ name: 'enhancement', color: 'a2eeef' }]
        },
        sender: { login: 'bob' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(result.processed, true);
      assert.ok(result.message.includes('🔒 Issue Closed by @bob'));
      assert.ok(result.message.includes('🔵 enhancement'));
      assert.ok(result.message.includes('#123: Implement feature X'));
    });

    it('should format reopened action without labels', async () => {
      const payload = {
        action: 'reopened',
        issue: {
          title: 'Old bug resurfaced',
          number: 456,
          html_url: 'https://github.com/user/repo/issues/456',
          labels: []
        },
        sender: { login: 'charlie' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(result.processed, true);
      assert.ok(result.message.includes('♻️ Issue Reopened by @charlie'));
      assert.ok(result.message.includes('#456: Old bug resurfaced'));

      // Verify the message structure - should have exactly 3 lines
      const lines = result.message.split('\n');
      assert.strictEqual(lines.length, 3);
      // Line 1: action label
      // Line 2: should be issue info (no label line)
      // Line 3: URL
      assert.ok(lines[0].includes('♻️ Issue Reopened'));
      assert.ok(lines[1].startsWith('#'));
      assert.ok(lines[2].startsWith('🔗'));
    });

    it('should format deleted action without label line (special format)', async () => {
      const payload = {
        action: 'deleted',
        issue: {
          title: 'Spam issue',
          number: 789,
          html_url: 'https://github.com/user/repo/issues/789',
          labels: [{ name: 'spam', color: '000000' }]
        },
        sender: { login: 'admin' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(result.processed, true);
      assert.ok(result.message.includes('🗑️ Issue Deleted by @admin'));
      assert.ok(result.message.includes('#789: Spam issue'));
      // Deleted action should NOT include label line (per D-06)
      assert.ok(!result.message.includes('spam'));
    });
  });

  describe('Unsupported Actions', () => {
    it('should return processed: false for edited action', async () => {
      const payload = {
        action: 'edited',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(result.processed, false);
      assert.ok(result.message.includes('Unsupported issues action: edited'));
      assert.strictEqual(result.event, 'issues');
    });

    it('should return processed: false for assigned action', async () => {
      const payload = {
        action: 'assigned',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(result.processed, false);
      assert.ok(result.message.includes('Unsupported issues action: assigned'));
    });

    it('should return processed: false for labeled action', async () => {
      const payload = {
        action: 'labeled',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(result.processed, false);
      assert.ok(result.message.includes('Unsupported issues action: labeled'));
    });

    it('should log warning for unsupported action', async () => {
      // Mock console.warn to capture log output
      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        warnings.push(args.join(' '));
      };

      const payload = {
        action: 'edited',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      await handleIssues(payload);

      // Restore console.warn
      console.warn = originalWarn;

      // Verify warning was logged
      assert.ok(warnings.some(w => w.includes('Unsupported issues action: edited')));
    });
  });

  describe('Placeholder Handling', () => {
    it('should use [No title] placeholder for empty title', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: '',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('[No title]'));
    });

    it('should use [No title] placeholder for whitespace-only title', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: '   ',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('[No title]'));
    });

    it('should use [No title] placeholder for missing title', async () => {
      const payload = {
        action: 'opened',
        issue: {
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('[No title]'));
    });

    it('should skip URL line when number is null', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: null,
          html_url: null,
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      // Should not include URL line
      assert.ok(!result.message.includes('🔗'));
      // Should still include issue info line
      assert.ok(result.message.includes('#null: Test issue'));
    });

    it('should skip URL line when number is undefined', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(!result.message.includes('🔗'));
    });

    it('should use @unknown placeholder for null sender', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: null
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('@unknown'));
    });

    it('should use @unknown placeholder for undefined sender', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('@unknown'));
    });

    it('should handle long titles without truncation', async () => {
      const longTitle = 'This is a very long issue title that exceeds 100 characters and should not be truncated but should wrap naturally when displayed in the notification message';
      const payload = {
        action: 'opened',
        issue: {
          title: longTitle,
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      // Full title should be present
      assert.ok(result.message.includes(longTitle));
    });

    it('should handle empty labels array', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      // Should not include label line
      const lines = result.message.split('\n');
      // Line 1: action label
      // Line 2: should be issue info (no label line)
      assert.ok(lines[1].startsWith('#'));
    });
  });

  describe('Label Formatting', () => {
    it('should format single label correctly', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [{ name: 'bug', color: 'd73a4a' }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('🔴 bug'));
    });

    it('should format multiple labels correctly', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [
            { name: 'bug', color: 'd73a4a' },
            { name: 'high-priority', color: 'b60205' },
            { name: 'frontend', color: 'a2eeef' }
          ]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('🔴 bug'));
      assert.ok(result.message.includes('🔴 high-priority'));
      assert.ok(result.message.includes('🔵 frontend'));
    });

    it('should map red color to red emoji', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [{ name: 'bug', color: 'd73a4a' }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('🔴 bug'));
    });

    it('should map green color to green emoji', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [{ name: 'feature', color: '008672' }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('🟢 feature'));
    });

    it('should map blue color to blue emoji', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [{ name: 'enhancement', color: 'a2eeef' }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('🔵 enhancement'));
    });

    it('should map yellow color to yellow emoji', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [{ name: 'question', color: 'fbca04' }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('🟡 question'));
    });

    it('should map purple color to purple emoji', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [{ name: 'design', color: '7057ff' }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('🟣 design'));
    });

    it('should use default black emoji for unknown color', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [{ name: 'custom', color: 'ff00ff' }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('⚫ custom'));
    });

    it('should handle labels with missing color', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [{ name: 'nocolor' }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('⚫ nocolor'));
    });
  });

  describe('Return Value Structure', () => {
    it('should return processed: true for supported actions', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(result.processed, true);
    });

    it('should return non-empty message string', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(typeof result.message, 'string');
      assert.ok(result.message.length > 0);
    });

    it('should return event type as issues', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(result.event, 'issues');
    });

    it('should return data object with all extracted fields', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 42,
          html_url: 'https://github.com/user/repo/issues/42',
          labels: [
            { name: 'bug', color: 'd73a4a' },
            { name: 'high-priority', color: 'b60205' }
          ]
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.strictEqual(typeof result.data, 'object');
      assert.strictEqual(result.data.action, 'opened');
      assert.strictEqual(result.data.number, 42);
      assert.strictEqual(result.data.title, 'Test issue');
      assert.strictEqual(result.data.sender, 'alice');
      assert.ok(Array.isArray(result.data.labels));
      assert.strictEqual(result.data.labels.length, 2);
      assert.strictEqual(result.data.labels[0].name, 'bug');
      assert.strictEqual(result.data.labels[0].color, 'd73a4a');
    });
  });

  describe('Edge Cases', () => {
    it('should handle issue title with emoji characters', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: '🐛 Bug with emoji 😱 in title',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('🐛 Bug with emoji 😱 in title'));
    });

    it('should handle issue title with special characters', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Issue with <html> & "quotes" and \'apostrophes\'',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('Issue with <html> & "quotes" and \'apostrophes\''));
    });

    it('should handle username with special characters', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'user-123_test' }
      };

      const result = await handleIssues(payload);

      assert.ok(result.message.includes('@user-123_test'));
    });

    it('should handle issue title with newlines (should preserve)', async () => {
      const payload = {
        action: 'opened',
        issue: {
          title: 'Line 1\nLine 2\nLine 3',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssues(payload);

      // Title with newlines should be preserved
      assert.ok(result.message.includes('Line 1\nLine 2\nLine 3'));
    });
  });
});
