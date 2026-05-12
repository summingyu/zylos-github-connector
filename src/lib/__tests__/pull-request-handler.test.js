/**
 * Unit Tests for Pull Request Handler
 *
 * Tests the handlePullRequest function with various scenarios including:
 * - Input validation
 * - Supported actions (opened, closed, reopened, merged, ready_for_review)
 * - Unsupported actions
 * - Placeholder handling
 * - PR-specific features (draft, merged_by, branch info)
 * - Label formatting
 * - Return value structure
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handlePullRequest, COLOR_EMOJI_MAP, formatLabels } from '../handlers/pull-request.js';

describe('Pull Request Handler', () => {
  describe('Input Validation', () => {
    it('should throw error for null payload', async () => {
      await assert.rejects(
        async () => await handlePullRequest(null),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for undefined payload', async () => {
      await assert.rejects(
        async () => await handlePullRequest(undefined),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for array payload', async () => {
      await assert.rejects(
        async () => await handlePullRequest([]),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for missing action field', async () => {
      const payload = {
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      await assert.rejects(
        async () => await handlePullRequest(payload),
        { message: /missing or invalid action field/ }
      );
    });

    it('should throw error for invalid action field (non-string)', async () => {
      const payload = {
        action: 123,
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      await assert.rejects(
        async () => await handlePullRequest(payload),
        { message: /missing or invalid action field/ }
      );
    });

    it('should throw error for missing pull_request object', async () => {
      const payload = {
        action: 'opened',
        sender: { login: 'alice' }
      };

      await assert.rejects(
        async () => await handlePullRequest(payload),
        { message: /missing or invalid pull_request object/ }
      );
    });

    it('should throw error for null pull_request object', async () => {
      const payload = {
        action: 'opened',
        pull_request: null,
        sender: { login: 'alice' }
      };

      await assert.rejects(
        async () => await handlePullRequest(payload),
        { message: /missing or invalid pull_request object/ }
      );
    });
  });

  describe('Supported Actions', () => {
    const basePayload = {
      pull_request: {
        title: 'Test PR',
        number: 42,
        html_url: 'https://github.com/user/repo/pull/42',
        labels: [{ name: 'feature', color: 'a2eeef' }],
        head: { ref: 'feature/test' },
        base: { ref: 'main' },
        draft: false
      },
      sender: { login: 'alice' }
    };

    it('should handle opened action', async () => {
      const result = await handlePullRequest({ ...basePayload, action: 'opened' });

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.event, 'pull_request');
      assert.match(result.message, /🔓 PR Opened by @alice/);
      assert.match(result.message, /#42: Test PR/);
      assert.match(result.message, /from: feature\/test → main/);
      assert.match(result.message, /🔗 https:\/\/github\.com\/user\/repo\/pull\/42/);
    });

    it('should handle closed action', async () => {
      const result = await handlePullRequest({ ...basePayload, action: 'closed' });

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /🔒 PR Closed by @alice/);
      assert.match(result.message, /#42: Test PR/);
    });

    it('should handle reopened action', async () => {
      const result = await handlePullRequest({ ...basePayload, action: 'reopened' });

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /♻️ PR Reopened by @alice/);
      assert.match(result.message, /#42: Test PR/);
    });

    it('should handle merged action with merger info', async () => {
      const payload = {
        action: 'merged',
        pull_request: {
          title: 'Merge feature',
          number: 123,
          html_url: 'https://github.com/user/repo/pull/123',
          labels: [{ name: 'feature', color: 'a2eeef' }],
          head: { ref: 'feature/new' },
          base: { ref: 'main' },
          draft: false,
          merged_at: '2026-05-12T10:00:00Z',
          merged_by: { login: 'bob' },
          merge_commit_sha: 'abcdef123456789'
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /🟣 PR Merged by @alice/);
      assert.match(result.message, /merged_by: @bob · abcdef1/);
      assert.match(result.message, /#123: Merge feature/);
      assert.strictEqual(result.data.mergedBy, 'bob');
    });

    it('should handle ready_for_review action', async () => {
      const result = await handlePullRequest({ ...basePayload, action: 'ready_for_review' });

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /👀 PR Ready for Review by @alice/);
      assert.match(result.message, /#42: Test PR/);
    });
  });

  describe('Unsupported Actions', () => {
    const basePayload = {
      pull_request: {
        title: 'Test PR',
        number: 42,
        html_url: 'https://github.com/user/repo/pull/42',
        labels: [],
        head: { ref: 'feature' },
        base: { ref: 'main' },
        draft: false
      },
      sender: { login: 'alice' }
    };

    const unsupportedActions = [
      'edited',
      'assigned',
      'unassigned',
      'review_requested',
      'review_request_removed',
      'labeled',
      'unlabeled',
      'synchronize',
      'locked',
      'unlocked'
    ];

    unsupportedActions.forEach((action) => {
      it(`should return processed: false for ${action} action`, async () => {
        const consoleWarnSpy = mock.method(console, 'warn', () => {});

        const result = await handlePullRequest({ ...basePayload, action });

        assert.strictEqual(result.processed, false);
        assert.match(result.message, new RegExp(`Unsupported pull_request action: ${action}`));

        consoleWarnSpy.mock.restore();
      });
    });
  });

  describe('Placeholder Handling', () => {
    it('should use [No title] placeholder for empty title', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: '',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /\[No title\]/);
      assert.strictEqual(result.data.title, '[No title]');
    });

    it('should use [No title] placeholder for whitespace-only title', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: '   ',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /\[No title\]/);
    });

    it('should use @unknown placeholder for null sender', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: null
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /@unknown/);
      assert.strictEqual(result.data.sender, 'unknown');
    });

    it('should skip URL line when number is null', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: null,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.doesNotMatch(result.message, /🔗/);
      assert.strictEqual(result.data.number, null);
    });

    it('should handle missing labels array', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.deepStrictEqual(result.data.labels, []);
    });

    it('should handle long title without truncation', async () => {
      const longTitle = 'This is a very long pull request title that exceeds normal length and should not be truncated because per requirements long titles should wrap automatically in the UI';
      const payload = {
        action: 'opened',
        pull_request: {
          title: longTitle,
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, new RegExp(longTitle));
      assert.strictEqual(result.data.title, longTitle);
    });
  });

  describe('PR-Specific Features', () => {
    it('should display [Draft] prefix for draft PRs', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Experimental feature',
          number: 789,
          html_url: 'https://github.com/user/repo/pull/789',
          labels: [],
          head: { ref: 'experiment' },
          base: { ref: 'main' },
          draft: true
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /\[Draft\] #789: Experimental feature/);
      assert.strictEqual(result.data.draft, true);
    });

    it('should format branch information correctly', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature/auth' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /from: feature\/auth → main/);
      assert.strictEqual(result.data.branchInfo, 'feature/auth → main');
    });

    it('should handle special characters in branch names', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'bugfix/leak-123' },
          base: { ref: 'release/v2.0.0' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /from: bugfix\/leak-123 → release\/v2\.0\.0/);
    });

    it('should display merger info for merged action', async () => {
      const payload = {
        action: 'merged',
        pull_request: {
          title: 'Merge feature',
          number: 123,
          html_url: 'https://github.com/user/repo/pull/123',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false,
          merged_at: '2026-05-12T10:00:00Z',
          merged_by: { login: 'bob' },
          merge_commit_sha: 'abcdef123456789'
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /merged_by: @bob · abcdef1/);
      assert.strictEqual(result.data.mergedBy, 'bob');
      assert.strictEqual(result.data.mergedAt, '2026-05-12T10:00:00Z');
    });

    it('should handle merged action without merger info', async () => {
      const payload = {
        action: 'merged',
        pull_request: {
          title: 'Merge feature',
          number: 123,
          html_url: 'https://github.com/user/repo/pull/123',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false,
          merged_at: '2026-05-12T10:00:00Z',
          merged_by: null,
          merge_commit_sha: null
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.doesNotMatch(result.message, /merged_by:/);
      assert.strictEqual(result.data.mergedBy, null);
    });

    it('should handle merged action without merge commit SHA', async () => {
      const payload = {
        action: 'merged',
        pull_request: {
          title: 'Merge feature',
          number: 123,
          html_url: 'https://github.com/user/repo/pull/123',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false,
          merged_at: '2026-05-12T10:00:00Z',
          merged_by: { login: 'bob' },
          merge_commit_sha: null
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.doesNotMatch(result.message, /merged_by:/);
    });

    it('should use short SHA format (7 characters)', async () => {
      const payload = {
        action: 'merged',
        pull_request: {
          title: 'Merge feature',
          number: 123,
          html_url: 'https://github.com/user/repo/pull/123',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false,
          merged_at: '2026-05-12T10:00:00Z',
          merged_by: { login: 'alice' },
          merge_commit_sha: 'abc123def456789xyz123456789'
        },
        sender: { login: 'bob' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /merged_by: @alice · abc123d/);
    });
  });

  describe('Label Formatting', () => {
    it('should format single label correctly', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [{ name: 'bug', color: 'd73a4a' }],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /🔴 bug/);
    });

    it('should format multiple labels correctly', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [
            { name: 'feature', color: 'a2eeef' },
            { name: 'high-priority', color: 'd73a4a' }
          ],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /🔵 feature/);
      assert.match(result.message, /🔴 high-priority/);
    });

    it('should map different label colors to correct emojis', async () => {
      const colorTests = [
        { color: 'd73a4a', emoji: '🔴', name: 'red' },
        { color: 'a2eeef', emoji: '🔵', name: 'blue' },
        { color: '7057ff', emoji: '🟣', name: 'purple' },
        { color: '008672', emoji: '🟢', name: 'green' },
        { color: 'fbca04', emoji: '🟡', name: 'yellow' }
      ];

      for (const test of colorTests) {
        const payload = {
          action: 'opened',
          pull_request: {
            title: 'Test PR',
            number: 1,
            html_url: 'https://github.com/user/repo/pull/1',
            labels: [{ name: test.name, color: test.color }],
            head: { ref: 'feature' },
            base: { ref: 'main' },
            draft: false
          },
          sender: { login: 'alice' }
        };

        const result = await handlePullRequest(payload);
        assert.match(result.message, new RegExp(`${test.emoji} ${test.name}`));
      }
    });

    it('should use default black dot for unknown colors', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [{ name: 'custom', color: 'abcdef' }],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /⚫ custom/);
    });

    it('should not include label line when no labels', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      // Should skip from action label directly to PR info
      const lines = result.message.split('\n');
      assert.match(lines[0], /🔓 PR Opened/);
      assert.match(lines[1], /#1: Test PR/);
    });
  });

  describe('Return Value Structure', () => {
    it('should return correct structure for supported action', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 42,
          html_url: 'https://github.com/user/repo/pull/42',
          labels: [{ name: 'feature', color: 'a2eeef' }],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(typeof result.message, 'string');
      assert.strictEqual(result.event, 'pull_request');
      assert.strictEqual(typeof result.data, 'object');

      assert.strictEqual(result.data.action, 'opened');
      assert.strictEqual(result.data.number, 42);
      assert.strictEqual(result.data.title, 'Test PR');
      assert.strictEqual(result.data.sender, 'alice');
      assert.strictEqual(Array.isArray(result.data.labels), true);
      assert.strictEqual(result.data.draft, false);
      assert.strictEqual(result.data.branchInfo, 'feature → main');
    });

    it('should include mergedBy in data for merged action', async () => {
      const payload = {
        action: 'merged',
        pull_request: {
          title: 'Merge feature',
          number: 123,
          html_url: 'https://github.com/user/repo/pull/123',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false,
          merged_at: '2026-05-12T10:00:00Z',
          merged_by: { login: 'bob' },
          merge_commit_sha: 'abcdef123456789'
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.data.mergedBy, 'bob');
      assert.strictEqual(result.data.mergedAt, '2026-05-12T10:00:00Z');
    });

    it('should return processed: false for unsupported action', async () => {
      const consoleWarnSpy = mock.method(console, 'warn', () => {});

      const payload = {
        action: 'edited',
        pull_request: {
          title: 'Test PR',
          number: 42,
          html_url: 'https://github.com/user/repo/pull/42',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, false);
      assert.strictEqual(result.event, 'pull_request');
      assert.strictEqual(result.data.action, 'edited');
      assert.strictEqual(result.data.prNumber, 42);
      assert.strictEqual(result.data.title, 'Test PR');

      consoleWarnSpy.mock.restore();
    });
  });

  describe('Reusable Utilities', () => {
    it('should export COLOR_EMOJI_MAP', () => {
      assert.strictEqual(typeof COLOR_EMOJI_MAP, 'object');
      assert.strictEqual(COLOR_EMOJI_MAP['d73a4a'], '🔴');
      assert.strictEqual(COLOR_EMOJI_MAP['a2eeef'], '🔵');
    });

    it('should export formatLabels function', () => {
      assert.strictEqual(typeof formatLabels, 'function');
    });

    it('formatLabels should format labels correctly', () => {
      const labels = [
        { name: 'bug', color: 'd73a4a' },
        { name: 'feature', color: 'a2eeef' }
      ];

      const result = formatLabels(labels);

      assert.match(result, /🔴 bug/);
      assert.match(result, /🔵 feature/);
    });

    it('formatLabels should return empty string for no labels', () => {
      const result = formatLabels([]);
      assert.strictEqual(result, '');
    });

    it('formatLabels should return empty string for null labels', () => {
      const result = formatLabels(null);
      assert.strictEqual(result, '');
    });
  });

  describe('Edge Cases', () => {
    it('should handle PR without head branch', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /from: unknown → main/);
    });

    it('should handle PR without base branch', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /from: feature → unknown/);
    });

    it('should handle PR with emoji in title', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: '✨ Add new feature 🚀',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'alice' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /✨ Add new feature 🚀/);
    });

    it('should handle PR with unicode in sender name', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'ユーザー' }
      };

      const result = await handlePullRequest(payload);

      assert.match(result.message, /@ユーザー/);
      assert.strictEqual(result.data.sender, 'ユーザー');
    });
  });
});
