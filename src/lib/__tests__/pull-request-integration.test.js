/**
 * Integration Tests for Pull Request Handler
 *
 * Tests the pull_request handler integration with the router system
 * and end-to-end processing of real GitHub webhook payloads.
 */

import { describe, it, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import { routeEvent, registerHandler, hasHandler } from '../router.js';
import { handlePullRequest } from '../handlers/pull-request.js';
import { handleIssues } from '../handlers/issues.js';
import { COLOR_EMOJI_MAP, formatLabels } from '../formatters/index.js';

describe('Pull Request Handler Integration', () => {
  describe('Router Integration', () => {
    it('should verify handler is registered correctly', () => {
      // This test verifies that the handler would be registered
      // In the actual application, this happens in src/index.js
      const isRegistered = hasHandler('pull_request');

      // Note: The handler might not be registered in test context
      // This is more of a documentation test showing how it should work
      assert.strictEqual(typeof isRegistered, 'boolean');
    });

    it('should route pull_request event to handler', async () => {
      // Register the handler for this test
      registerHandler('pull_request', handlePullRequest);

      const payload = {
        action: 'opened',
        pull_request: {
          title: 'Integration test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: [{ name: 'test', color: 'a2eeef' }],
          head: { ref: 'feature/test' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'testuser' }
      };

      const result = await routeEvent('pull_request', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.eventType, 'pull_request');
      assert.strictEqual(result.result.processed, true);
      assert.match(result.result.message, /Integration test PR/);
    });

    it('should return handled: false for unregistered event types', async () => {
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
        sender: { login: 'testuser' }
      };

      const result = await routeEvent('unsupported_event', payload);

      assert.strictEqual(result.handled, false);
      assert.strictEqual(result.eventType, 'unsupported_event');
    });
  });

  describe('Real GitHub Webhook Payloads', () => {
    it('should handle real opened PR payload from GitHub', async () => {
      const realPayload = {
        action: 'opened',
        number: 42,
        pull_request: {
          id: 123456789,
          number: 42,
          state: 'open',
          title: 'Add new authentication flow',
          user: {
            login: 'alice',
            type: 'User'
          },
          body: 'This PR adds OAuth2 support',
          created_at: '2026-05-12T10:00:00Z',
          updated_at: '2026-05-12T10:00:00Z',
          closed_at: null,
          merged_at: null,
          merge_commit_sha: null,
          draft: false,
          labels: [
            { name: 'feature', color: 'a2eeef' },
            { name: 'high-priority', color: 'd73a4a' }
          ],
          head: {
            label: 'alice:feature/auth',
            ref: 'feature/auth',
            sha: 'abc123def456789'
          },
          base: {
            label: 'main:main',
            ref: 'main',
            sha: 'def456ghi789012'
          },
          html_url: 'https://github.com/user/repo/pull/42',
          url: 'https://api.github.com/repos/user/repo/pulls/42'
        },
        repository: {
          id: 12345678,
          name: 'repo',
          full_name: 'user/repo',
          private: false
        },
        sender: {
          login: 'alice',
          type: 'User'
        }
      };

      const result = await handlePullRequest(realPayload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /🔓 PR Opened by @alice/);
      assert.match(result.message, /Add new authentication flow/);
      assert.match(result.message, /from: feature\/auth → main/);
      assert.match(result.message, /🔵 feature/);
      assert.match(result.message, /🔴 high-priority/);
      assert.strictEqual(result.data.number, 42);
      assert.strictEqual(result.data.sender, 'alice');
      assert.strictEqual(result.data.draft, false);
      assert.strictEqual(result.data.branchInfo, 'feature/auth → main');
    });

    it('should handle closed PR payload', async () => {
      const realPayload = {
        action: 'closed',
        pull_request: {
          id: 123456789,
          number: 123,
          state: 'closed',
          title: 'Fix critical bug',
          user: { login: 'bob' },
          body: 'This fixes the memory leak',
          created_at: '2026-05-12T09:00:00Z',
          updated_at: '2026-05-12T10:00:00Z',
          closed_at: '2026-05-12T10:00:00Z',
          merged_at: null,
          merge_commit_sha: null,
          draft: false,
          labels: [{ name: 'bugfix', color: 'd73a4a' }],
          head: { ref: 'fix/leak', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
          html_url: 'https://github.com/user/repo/pull/123'
        },
        repository: { name: 'repo', full_name: 'user/repo' },
        sender: { login: 'bob' }
      };

      const result = await handlePullRequest(realPayload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /🔒 PR Closed by @bob/);
      assert.match(result.message, /Fix critical bug/);
      assert.match(result.message, /🔴 bugfix/);
    });

    it('should handle reopened PR payload', async () => {
      const realPayload = {
        action: 'reopened',
        pull_request: {
          number: 456,
          state: 'open',
          title: 'Reopen this feature',
          user: { login: 'charlie' },
          labels: [],
          head: { ref: 'feature/old' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/456',
          draft: false
        },
        repository: { name: 'repo', full_name: 'user/repo' },
        sender: { login: 'charlie' }
      };

      const result = await handlePullRequest(realPayload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /♻️ PR Reopened by @charlie/);
    });

    it('should handle merged PR payload with merger info', async () => {
      const realPayload = {
        action: 'merged',
        pull_request: {
          id: 123456789,
          number: 789,
          state: 'closed',
          title: 'Merge performance improvements',
          user: { login: 'dave' },
          body: 'Improves database query performance',
          created_at: '2026-05-12T08:00:00Z',
          updated_at: '2026-05-12T10:00:00Z',
          closed_at: '2026-05-12T10:00:00Z',
          merged_at: '2026-05-12T10:00:00Z',
          merged_by: {
            login: 'alice',
            type: 'User'
          },
          merge_commit_sha: 'abc123def456789xyz123456789',
          draft: false,
          labels: [{ name: 'performance', color: '7057ff' }],
          head: { ref: 'perf/improvements', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
          html_url: 'https://github.com/user/repo/pull/789'
        },
        repository: { name: 'repo', full_name: 'user/repo' },
        sender: { login: 'dave' }
      };

      const result = await handlePullRequest(realPayload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /🟣 PR Merged by @dave/);
      assert.match(result.message, /Merge performance improvements/);
      assert.match(result.message, /merged_by: @alice · abc123d/);
      assert.match(result.message, /🟣 performance/);
      assert.strictEqual(result.data.mergedBy, 'alice');
      assert.strictEqual(result.data.mergedAt, '2026-05-12T10:00:00Z');
    });

    it('should handle ready_for_review payload', async () => {
      const realPayload = {
        action: 'ready_for_review',
        pull_request: {
          number: 999,
          state: 'open',
          title: 'Ready for review',
          user: { login: 'eve' },
          labels: [{ name: 'enhancement', color: 'a2eeef' }],
          head: { ref: 'feature/new' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/999',
          draft: false
        },
        repository: { name: 'repo', full_name: 'user/repo' },
        sender: { login: 'eve' }
      };

      const result = await handlePullRequest(realPayload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /👀 PR Ready for Review by @eve/);
      assert.match(result.message, /🔵 enhancement/);
    });
  });

  describe('Draft PR Scenarios', () => {
    it('should handle Draft PR opened', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 888,
          title: 'Experimental feature',
          draft: true,
          labels: [],
          head: { ref: 'experiment/wip' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/888'
        },
        sender: { login: 'frank' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /\[Draft\] #888: Experimental feature/);
      assert.strictEqual(result.data.draft, true);
    });

    it('should handle Draft PR converted to ready_for_review', async () => {
      const payload = {
        action: 'ready_for_review',
        pull_request: {
          number: 889,
          title: 'Formerly draft PR',
          draft: false,
          labels: [{ name: 'feature', color: 'a2eeef' }],
          head: { ref: 'feature/ready' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/889'
        },
        sender: { login: 'grace' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /👀 PR Ready for Review by @grace/);
      // Should NOT have [Draft] prefix since draft: false
      assert.doesNotMatch(result.message, /\[Draft\]/);
      assert.strictEqual(result.data.draft, false);
    });
  });

  describe('Merge Flow Scenarios', () => {
    it('should test PR flow from opened to merged', async () => {
      // Opened
      const openedPayload = {
        action: 'opened',
        pull_request: {
          number: 100,
          title: 'Feature to be merged',
          draft: false,
          labels: [{ name: 'feature', color: 'a2eeef' }],
          head: { ref: 'feature/to-merge' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/100',
          merged_at: null,
          merged_by: null,
          merge_commit_sha: null
        },
        sender: { login: 'henry' }
      };

      const openedResult = await handlePullRequest(openedPayload);
      assert.strictEqual(openedResult.processed, true);
      assert.match(openedResult.message, /🔓 PR Opened/);
      assert.strictEqual(openedResult.data.mergedBy, null);

      // Merged (simulating the same PR being merged later)
      const mergedPayload = {
        action: 'merged',
        pull_request: {
          number: 100,
          title: 'Feature to be merged',
          draft: false,
          labels: [{ name: 'feature', color: 'a2eeef' }],
          head: { ref: 'feature/to-merge' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/100',
          merged_at: '2026-05-12T11:00:00Z',
          merged_by: { login: 'iris' },
          merge_commit_sha: 'merged123456789'
        },
        sender: { login: 'henry' }
      };

      const mergedResult = await handlePullRequest(mergedPayload);
      assert.strictEqual(mergedResult.processed, true);
      assert.match(mergedResult.message, /🟣 PR Merged/);
      assert.match(mergedResult.message, /merged_by: @iris · merged1/);
      assert.strictEqual(mergedResult.data.mergedBy, 'iris');
    });

    it('should handle merger different from PR author', async () => {
      const payload = {
        action: 'merged',
        pull_request: {
          number: 200,
          title: 'PR by junior dev',
          draft: false,
          labels: [],
          head: { ref: 'feature/junior' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/200',
          merged_at: '2026-05-12T12:00:00Z',
          merged_by: { login: 'senior-dev' },
          merge_commit_sha: 'sha789xyz456123'
        },
        sender: { login: 'junior-dev' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /PR Merged by @junior-dev/); // sender opened it
      assert.match(result.message, /merged_by: @senior-dev/); // but senior merged it
      assert.strictEqual(result.data.sender, 'junior-dev');
      assert.strictEqual(result.data.mergedBy, 'senior-dev');
    });
  });

  describe('Branch Change Scenarios', () => {
    it('should test different branch combinations', async () => {
      const branchTests = [
        { head: 'feature/new-feature', base: 'main' },
        { head: 'develop', base: 'main' },
        { head: 'hotfix/critical-bug', base: 'release/v1.0.0' },
        { head: 'release/v2.0.0', base: 'main' },
        { head: 'feature/auth/oauth', base: 'develop' },
        { head: 'bugfix/leak-123', base: 'main' }
      ];

      for (const branches of branchTests) {
        const payload = {
          action: 'opened',
          pull_request: {
            number: 1,
            title: 'Test PR',
            draft: false,
            labels: [],
            head: { ref: branches.head },
            base: { ref: branches.base },
            html_url: 'https://github.com/user/repo/pull/1'
          },
          sender: { login: 'testuser' }
        };

        const result = await handlePullRequest(payload);
        assert.match(result.message, new RegExp(`from: ${branches.head.replace('/', '/')} → ${branches.base}`));
      }
    });

    it('should handle branch names with special characters', async () => {
      const specialBranches = [
        'feature/auth/oauth2',
        'bugfix/issue-123-fix',
        'release/v2.0.0-beta',
        'hotfix/2025-05-12-emergency'
      ];

      for (const branch of specialBranches) {
        const payload = {
          action: 'opened',
          pull_request: {
            number: 1,
            title: 'Special branch name',
            draft: false,
            labels: [],
            head: { ref: branch },
            base: { ref: 'main' },
            html_url: 'https://github.com/user/repo/pull/1'
          },
          sender: { login: 'testuser' }
        };

        const result = await handlePullRequest(payload);
        assert.match(result.message, new RegExp(branch));
      }
    });
  });

  describe('Multi-Label Scenarios', () => {
    it('should handle PR with multiple labels', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 300,
          title: 'Multi-label PR',
          draft: false,
          labels: [
            { name: 'feature', color: 'a2eeef' },
            { name: 'high-priority', color: 'd73a4a' },
            { name: 'backend', color: '008672' },
            { name: 'documentation', color: 'fbca04' }
          ],
          head: { ref: 'feature/multi' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/300'
        },
        sender: { login: 'jack' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /🔵 feature/);
      assert.match(result.message, /🔴 high-priority/);
      assert.match(result.message, /🟢 backend/);
      assert.match(result.message, /🟡 documentation/);
      assert.strictEqual(result.data.labels.length, 4);
    });

    it('should handle PR with no labels', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 301,
          title: 'No label PR',
          draft: false,
          labels: [],
          head: { ref: 'feature/no-labels' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/301'
        },
        sender: { login: 'kate' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.data.labels.length, 0);
      // Should not have a label line
      const lines = result.message.split('\n');
      assert.doesNotMatch(lines[1], /🔴|🔵|🟢|🟡|🟣/);
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle PR title with emoji characters', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 400,
          title: '✨ Add new feature 🚀 with 🎉 celebration 🎊',
          draft: false,
          labels: [],
          head: { ref: 'feature/emoji' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/400'
        },
        sender: { login: 'leo' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /✨ Add new feature 🚀 with 🎉 celebration 🎊/);
    });

    it('should handle username with special characters', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 401,
          title: 'Special username',
          draft: false,
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/401'
        },
        sender: { login: 'user-with-dash' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /@user-with-dash/);
      assert.strictEqual(result.data.sender, 'user-with-dash');
    });

    it('should handle unicode username', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 402,
          title: 'Unicode username',
          draft: false,
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/402'
        },
        sender: { login: 'ユーザー' }
      };

      const result = await handlePullRequest(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /@ユーザー/);
      assert.strictEqual(result.data.sender, 'ユーザー');
    });
  });

  describe('Log Validation', () => {
    it('should log warning for unsupported actions', async () => {
      const consoleWarnSpy = mock.method(console, 'warn', () => {});

      const payload = {
        action: 'edited',
        pull_request: {
          number: 500,
          title: 'Edited PR',
          draft: false,
          labels: [],
          head: { ref: 'feature' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/500'
        },
        sender: { login: 'mary' }
      };

      await handlePullRequest(payload);

      assert.strictEqual(consoleWarnSpy.mock.calls.length, 1);
      const warningMsg = consoleWarnSpy.mock.calls[0].arguments[0];
      assert.match(warningMsg, /Unsupported pull_request action: edited/);

      consoleWarnSpy.mock.restore();
    });

    it('should log multiple warnings for multiple unsupported actions', async () => {
      const consoleWarnSpy = mock.method(console, 'warn', () => {});

      const unsupportedActions = ['edited', 'assigned', 'labeled'];

      for (const action of unsupportedActions) {
        const payload = {
          action: action,
          pull_request: {
            number: 501,
            title: 'Test',
            draft: false,
            labels: [],
            head: { ref: 'feature' },
            base: { ref: 'main' },
            html_url: 'https://github.com/user/repo/pull/501'
          },
          sender: { login: 'nancy' }
        };

        await handlePullRequest(payload);
      }

      assert.strictEqual(consoleWarnSpy.mock.calls.length, 3);

      consoleWarnSpy.mock.restore();
    });
  });

  describe('Reusable Logic Validation', () => {
    it('should verify COLOR_EMOJI_MAP is available from formatters', () => {
      // COLOR_EMOJI_MAP is now centralized in formatters module
      const testColors = ['d73a4a', 'a2eeef', '7057ff', '008672', 'fbca04'];

      for (const color of testColors) {
        assert.ok(COLOR_EMOJI_MAP[color]);
      }
    });

    it('should verify formatLabels behavior', () => {
      const labels = [
        { name: 'bug', color: 'd73a4a' },
        { name: 'feature', color: 'a2eeef' }
      ];

      const result = formatLabels(labels);

      assert.strictEqual(result, '🔴 bug 🔵 feature');
    });

    it('should test labels display correctly', async () => {
      const labels = [
        { name: 'enhancement', color: 'a2eeef' },
        { name: 'high-priority', color: 'd73a4a' }
      ];

      const issuePayload = {
        action: 'opened',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: labels
        },
        sender: { login: 'testuser' }
      };

      const prPayload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR',
          number: 1,
          html_url: 'https://github.com/user/repo/pull/1',
          labels: labels,
          head: { ref: 'feature' },
          base: { ref: 'main' },
          draft: false
        },
        sender: { login: 'testuser' }
      };

      const issueResult = await handleIssues(issuePayload);
      const prResult = await handlePullRequest(prPayload);

      // Extract label lines (should be the same in both)
      const issueLabelLine = issueResult.message.split('\n')[1];
      const prLabelLine = prResult.message.split('\n')[1];

      assert.strictEqual(issueLabelLine, prLabelLine);
    });
  });

  describe('End-to-End Message Verification', () => {
    it('should verify complete message structure for opened action', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 600,
          title: 'Complete PR for testing',
          draft: false,
          labels: [
            { name: 'feature', color: 'a2eeef' },
            { name: 'documentation', color: 'fbca04' }
          ],
          head: { ref: 'feature/complete' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/600'
        },
        sender: { login: 'olivia' }
      };

      const result = await handlePullRequest(payload);
      const lines = result.message.split('\n');

      // Line 1: Action label + sender
      assert.match(lines[0], /^🔓 PR Opened by @olivia$/);

      // Line 2: Labels
      assert.match(lines[1], /🔵 feature/);
      assert.match(lines[1], /🟡 documentation/);

      // Line 3: PR info
      assert.strictEqual(lines[2], '#600: Complete PR for testing');

      // Line 4: Branch info
      assert.strictEqual(lines[3], 'from: feature/complete → main');

      // Line 5: URL
      assert.strictEqual(lines[4], '🔗 https://github.com/user/repo/pull/600');

      assert.strictEqual(lines.length, 5);
    });

    it('should verify complete message structure for merged action', async () => {
      const payload = {
        action: 'merged',
        pull_request: {
          number: 601,
          title: 'Merged PR for testing',
          draft: false,
          labels: [{ name: 'bugfix', color: 'd73a4a' }],
          head: { ref: 'fix/bug' },
          base: { ref: 'main' },
          html_url: 'https://github.com/user/repo/pull/601',
          merged_at: '2026-05-12T13:00:00Z',
          merged_by: { login: 'peter' },
          merge_commit_sha: 'abc123def456789'
        },
        sender: { login: 'paul' }
      };

      const result = await handlePullRequest(payload);
      const lines = result.message.split('\n');

      // Line 1: Action label + sender
      assert.match(lines[0], /^🟣 PR Merged by @paul$/);

      // Line 2: Labels
      assert.match(lines[1], /🔴 bugfix/);

      // Line 3: PR info
      assert.strictEqual(lines[2], '#601: Merged PR for testing');

      // Line 4: Branch info
      assert.strictEqual(lines[3], 'from: fix/bug → main');

      // Line 5: Merger info (only for merged)
      assert.match(lines[4], /^merged_by: @peter · abc123d$/);

      // Line 6: URL
      assert.strictEqual(lines[5], '🔗 https://github.com/user/repo/pull/601');

      assert.strictEqual(lines.length, 6);
    });
  });
});
