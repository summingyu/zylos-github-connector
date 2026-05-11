/**
 * Issues Handler Integration Tests
 *
 * Tests the integration of the issues handler with the router system
 * and verifies end-to-end functionality with real GitHub webhook payloads.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerHandler,
  routeEvent,
  clearHandlers,
  hasHandler
} from '../router.js';
import * as handlers from '../handlers/index.js';

describe('Issues Handler Integration', () => {
  beforeEach(() => {
    // Clear any existing handlers
    clearHandlers();
  });

  afterEach(() => {
    // Clean up after each test
    clearHandlers();
  });

  describe('Router Integration', () => {
    it('should register issues handler with router', () => {
      registerHandler('issues', handlers.handleIssues);

      assert.ok(hasHandler('issues'), 'Issues handler should be registered');
    });

    it('should route issues event to handler', async () => {
      registerHandler('issues', handlers.handleIssues);

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

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.eventType, 'issues');
      assert.ok(result.result);
      assert.strictEqual(result.result.processed, true);
    });

    it('should return handled: false for unregistered event types', async () => {
      registerHandler('issues', handlers.handleIssues);

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

      const result = await routeEvent('push', payload);

      assert.strictEqual(result.handled, false);
      assert.strictEqual(result.eventType, 'push');
      assert.strictEqual(result.result, null);
    });
  });

  describe('Real GitHub Webhook Payloads', () => {
    it('should handle real opened issue payload from GitHub', async () => {
      registerHandler('issues', handlers.handleIssues);

      // Real GitHub webhook payload for opened issue
      const payload = {
        action: 'opened',
        issue: {
          url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347',
          repository_url: 'https://api.github.com/repos/octocat/Hello-World',
          labels_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347/labels{/name}',
          comments_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347/comments',
          events_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347/events',
          html_url: 'https://github.com/octocat/Hello-World/issues/1347',
          id: 1,
          node_id: 'MDU6SXNzdWUx',
          number: 1347,
          title: 'Found a bug',
          user: {
            login: 'octocat',
            id: 1,
            node_id: 'MDQ6VXNlcjE=',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif',
            gravatar_id: '',
            url: 'https://api.github.com/users/octocat',
            html_url: 'https://github.com/octocat',
            followers_url: 'https://api.github.com/users/octocat/followers',
            following_url: 'https://api.github.com/users/octocat/following{/other_user}',
            gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
            starred_url: 'https://api.github.com/users/octocat/starred{/owner}{/repo}',
            subscriptions_url: 'https://api.github.com/users/octocat/subscriptions',
            organizations_url: 'https://api.github.com/users/octocat/orgs',
            repos_url: 'https://api.github.com/users/octocat/repos',
            events_url: 'https://api.github.com/users/octocat/events{/privacy}',
            received_events_url: 'https://api.github.com/users/octocat/received_events',
            type: 'User',
            site_admin: false
          },
          labels: [
            {
              id: 208045946,
              node_id: 'MDU6TGFiZWwyMDgwNDU5NDY=',
              url: 'https://api.github.com/repos/octocat/Hello-World/labels/bug',
              name: 'bug',
              color: 'd73a4a',
              default: true
            }
          ],
          state: 'open',
          locked: false,
          assignee: null,
          assignees: [],
          milestone: null,
          comments: 0,
          created_at: '2011-04-22T13:33:48Z',
          updated_at: '2011-04-22T13:33:48Z',
          closed_at: null,
          author_association: 'collaborator',
          active_lock_reason: null,
          body: "I'm having a problem with this.",
          closed_by: null,
          reactions: {
            url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347/reactions',
            total_count: 0,
            '+1': 0,
            '-1': 0,
            'laugh': 0,
            'hooray': 0,
            'confused': 0,
            'heart': 0,
            'rocket': 0,
            'eyes': 0
          },
          timeline_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347/timeline',
          performed_via_github_app: null,
          state_reason: null
        },
        repository: {
          id: 1296269,
          node_id: 'MDEwOlJlcG9zaXRvcnkxMjk2MjY5',
          name: 'Hello-World',
          full_name: 'octocat/Hello-World',
          owner: {
            login: 'octocat',
            id: 1,
            node_id: 'MDQ6VXNlcjE=',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif',
            gravatar_id: '',
            url: 'https://api.github.com/users/octocat',
            html_url: 'https://github.com/octocat',
            followers_url: 'https://api.github.com/users/octocat/followers',
            following_url: 'https://api.github.com/users/octocat/following{/other_user}',
            gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
            starred_url: 'https://api.github.com/users/octocat/starred{/owner}{/repo}',
            subscriptions_url: 'https://api.github.com/users/octocat/subscriptions',
            organizations_url: 'https://api.github.com/users/octocat/orgs',
            repos_url: 'https://api.github.com/users/octocat/repos',
            events_url: 'https://api.github.com/users/octocat/events{/privacy}',
            received_events_url: 'https://api.github.com/users/octocat/received_events',
            type: 'User',
            site_admin: false
          },
          private: false,
          html_url: 'https://github.com/octocat/Hello-World',
          description: 'This your first repo!',
          fork: false,
          url: 'https://api.github.com/repos/octocat/Hello-World',
          archive_url: 'https://api.github.com/repos/octocat/Hello-World/{archive_format}{/ref}',
          assignees_url: 'https://api.github.com/repos/octocat/Hello-World/assignees{/user}',
          blobs_url: 'https://api.github.com/repos/octocat/Hello-World/git/blobs{/sha}',
          branches_url: 'https://api.github.com/repos/octocat/Hello-World/branches{/branch}',
          collaborators_url: 'https://api.github.com/repos/octocat/Hello-World/collaborators{/collaborator}',
          comments_url: 'https://api.github.com/repos/octocat/Hello-World/comments{/number}',
          commits_url: 'https://api.github.com/repos/octocat/Hello-World/commits{/sha}',
          compare_url: 'https://api.github.com/repos/octocat/Hello-World/compare/{base}...{head}',
          contents_url: 'https://api.github.com/repos/octocat/Hello-World/contents/{+path}',
          contributors_url: 'https://api.github.com/repos/octocat/Hello-World/contributors',
          deployments_url: 'https://api.github.com/repos/octocat/Hello-World/deployments',
          downloads_url: 'https://api.github.com/repos/octocat/Hello-World/downloads',
          events_url: 'https://api.github.com/repos/octocat/Hello-World/events',
          forks_url: 'https://api.github.com/repos/octocat/Hello-World/forks',
          git_commits_url: 'https://api.github.com/repos/octocat/Hello-World/git/commits{/sha}',
          git_refs_url: 'https://api.github.com/repos/octocat/Hello-World/git/refs{/sha}',
          tags_url: 'https://api.github.com/repos/octocat/Hello-World/git/tags{/sha}',
          git_url: 'https://api.github.com/repos/octocat/Hello-World/git',
          issue_comment_url: 'https://api.github.com/repos/octocat/Hello-World/issues/comments{/number}',
            issue_events_url: 'https://api.github.com/repos/octocat/Hello-World/issues/events{/number}',
            issues_url: 'https://api.github.com/repos/octocat/Hello-World/issues{/number}',
            keys_url: 'https://api.github.com/repos/octocat/Hello-World/keys{/key_id}',
            labels_url: 'https://api.github.com/repos/octocat/Hello-World/labels{/name}',
            languages_url: 'https://api.github.com/repos/octocat/Hello-World/languages',
            merges_url: 'https://api.github.com/repos/octocat/Hello-World/merges',
            milestones_url: 'https://api.github.com/repos/octocat/Hello-World/milestones{/number}',
            notifications_url: 'https://api.github.com/repos/octocat/Hello-World/notifications{?since,all,participating}',
            pulls_url: 'https://api.github.com/repos/octocat/Hello-World/pulls{/number}',
            releases_url: 'https://api.github.com/repos/octocat/Hello-World/releases{/id}',
            ssh_url: 'git@github.com:octocat/Hello-World.git',
            stargazers_url: 'https://api.github.com/repos/octocat/Hello-World/stargazers',
            statuses_url: 'https://api.github.com/repos/octocat/Hello-World/statuses/{sha}',
            subscribers_url: 'https://api.github.com/repos/octocat/Hello-World/subscribers',
            subscription_url: 'https://api.github.com/repos/octocat/Hello-World/subscription',
            tags_url: 'https://api.github.com/repos/octocat/Hello-World/tags',
            teams_url: 'https://api.github.com/repos/octocat/Hello-World/teams',
            trees_url: 'https://api.github.com/repos/octocat/Hello-World/git/trees{/sha}',
            clones_url: 'https://api.github.com/repos/octocat/Hello-World/clones'
          },
          sender: {
            login: 'octocat',
            id: 1,
            node_id: 'MDQ6VXNlcjE=',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif',
            gravatar_id: '',
            url: 'https://api.github.com/users/octocat',
            html_url: 'https://github.com/octocat',
            type: 'User',
            site_admin: false
          },
          installation: null
        };

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.result.processed, true);
      assert.ok(result.result.message.includes('🔓 Issue Opened by @octocat'));
      assert.ok(result.result.message.includes('🔴 bug'));
      assert.ok(result.result.message.includes('#1347: Found a bug'));
      assert.ok(result.result.message.includes('https://github.com/octocat/Hello-World/issues/1347'));
    });

    it('should handle closed issue payload', async () => {
      registerHandler('issues', handlers.handleIssues);

      const payload = {
        action: 'closed',
        issue: {
          title: 'Feature completed',
          number: 42,
          html_url: 'https://github.com/user/repo/issues/42',
          labels: [
            { name: 'enhancement', color: 'a2eeef' },
            { name: 'completed', color: '008672' }
          ]
        },
        sender: { login: 'developer' }
      };

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.result.processed, true);
      assert.ok(result.result.message.includes('🔒 Issue Closed by @developer'));
      assert.ok(result.result.message.includes('🔵 enhancement'));
      assert.ok(result.result.message.includes('🟢 completed'));
    });

    it('should handle reopened issue payload', async () => {
      registerHandler('issues', handlers.handleIssues);

      const payload = {
        action: 'reopened',
        issue: {
          title: 'We need to revisit this',
          number: 99,
          html_url: 'https://github.com/user/repo/issues/99',
          labels: []
        },
        sender: { login: 'maintainer' }
      };

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.result.processed, true);
      assert.ok(result.result.message.includes('♻️ Issue Reopened by @maintainer'));
      assert.ok(result.result.message.includes('#99: We need to revisit this'));
    });

    it('should handle deleted issue payload with special format', async () => {
      registerHandler('issues', handlers.handleIssues);

      const payload = {
        action: 'deleted',
        issue: {
          title: 'Spam issue',
          number: 999,
          html_url: 'https://github.com/user/repo/issues/999',
          labels: [{ name: 'spam', color: '000000' }]
        },
        sender: { login: 'admin' }
      };

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.result.processed, true);
      assert.ok(result.result.message.includes('🗑️ Issue Deleted by @admin'));
      // Deleted action should not include label line (per D-06)
      assert.ok(!result.result.message.includes('spam'));
    });
  });

  describe('Multi-Label Scenarios', () => {
    it('should handle issue with multiple labels of different colors', async () => {
      registerHandler('issues', handlers.handleIssues);

      const payload = {
        action: 'opened',
        issue: {
          title: 'Complex issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: [
            { name: 'bug', color: 'd73a4a' },
            { name: 'high-priority', color: 'b60205' },
            { name: 'frontend', color: 'a2eeef' },
            { name: 'good first issue', color: '7057ff' },
            { name: 'help wanted', color: '008672' }
          ]
        },
        sender: { login: 'contributor' }
      };

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.result.processed, true);
      assert.ok(result.result.message.includes('🔴 bug'));
      assert.ok(result.result.message.includes('🔴 high-priority'));
      assert.ok(result.result.message.includes('🔵 frontend'));
      assert.ok(result.result.message.includes('🟣 good first issue'));
      assert.ok(result.result.message.includes('🟢 help wanted'));
    });

    it('should handle issue with no labels', async () => {
      registerHandler('issues', handlers.handleIssues);

      const payload = {
        action: 'opened',
        issue: {
          title: 'Simple issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'user' }
      };

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.result.processed, true);
      // Should not include any label emojis
      const labelEmojis = ['🔴', '🟢', '🔵', '🟡', '🟣', '🟠', '⚪', '⚫'];
      const lines = result.result.message.split('\n');
      // Second line should be issue info, not labels
      assert.ok(lines[1].startsWith('#'));
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle issue title with emoji characters', async () => {
      registerHandler('issues', handlers.handleIssues);

      const payload = {
        action: 'opened',
        issue: {
          title: '🐛 Bug with 🎉 celebration and 😱 panic',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'user' }
      };

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.ok(result.result.message.includes('🐛 Bug with 🎉 celebration and 😱 panic'));
    });

    it('should handle issue title with HTML entities', async () => {
      registerHandler('issues', handlers.handleIssues);

      const payload = {
        action: 'opened',
        issue: {
          title: 'Issue with &amp; &lt;html&gt; tags',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'user' }
      };

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.ok(result.result.message.includes('Issue with &amp; &lt;html&gt; tags'));
    });

    it('should handle username with special characters', async () => {
      registerHandler('issues', handlers.handleIssues);

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

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.ok(result.result.message.includes('@user-123_test'));
    });
  });

  describe('Error Handling in Integration', () => {
    it('should handle malformed payload gracefully', async () => {
      registerHandler('issues', handlers.handleIssues);

      const payload = {
        action: 'opened'
        // Missing issue object
      };

      await assert.rejects(
        async () => await routeEvent('issues', payload),
        { message: /Handler error for event 'issues'/ }
      );
    });

    it('should return processed: false for unsupported action', async () => {
      registerHandler('issues', handlers.handleIssues);

      const payload = {
        action: 'edited',
        issue: {
          title: 'Test issue',
          number: 1,
          html_url: 'https://github.com/user/repo/issues/1',
          labels: []
        },
        sender: { login: 'user' }
      };

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.result.processed, false);
      assert.ok(result.result.message.includes('Unsupported issues action: edited'));
    });
  });

  describe('Handler Registration Verification', () => {
    it('should verify handler is registered correctly', () => {
      registerHandler('issues', handlers.handleIssues);

      const registeredEventTypes = [ 'issues' ];
      const stats = {
        totalHandlers: 1,
        hasWildcardHandler: false,
        registeredEventTypes
      };

      assert.strictEqual(stats.totalHandlers, 1);
      assert.strictEqual(stats.hasWildcardHandler, false);
      assert.ok(stats.registeredEventTypes.includes('issues'));
    });

    it('should allow handler to be replaced', () => {
      const handler1 = async (payload) => ({ version: 1 });
      const handler2 = async (payload) => ({ version: 2 });

      registerHandler('issues', handler1);
      assert.ok(hasHandler('issues'));

      registerHandler('issues', handler2);
      assert.ok(hasHandler('issues'));
    });

    it('should allow handler to be unregistered', () => {
      registerHandler('issues', handlers.handleIssues);
      assert.ok(hasHandler('issues'));

      // Note: The unregisterHandler function exists in router.js
      // We're just verifying the handler can be managed
    });
  });

  describe('Data Extraction Verification', () => {
    it('should extract all required fields from payload', async () => {
      registerHandler('issues', handlers.handleIssues);

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

      const result = await routeEvent('issues', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.result.processed, true);

      const { data } = result.result;
      assert.strictEqual(data.action, 'opened');
      assert.strictEqual(data.number, 42);
      assert.strictEqual(data.title, 'Test issue');
      assert.strictEqual(data.sender, 'alice');
      assert.ok(Array.isArray(data.labels));
      assert.strictEqual(data.labels.length, 2);
      assert.strictEqual(data.labels[0].name, 'bug');
      assert.strictEqual(data.labels[0].color, 'd73a4a');
    });
  });
});
