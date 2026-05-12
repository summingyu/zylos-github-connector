/**
 * Comment Handler Unit Tests
 *
 * Tests the issue_comment event handler with comprehensive coverage of:
 * - Input validation
 * - Supported actions (created)
 * - Unsupported actions (edited, deleted)
 * - Placeholder handling for missing fields
 * - Comment body truncation
 * - Issue/PR context detection
 * - Return value structure
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleIssueComment } from '../handlers/comment.js';

describe('Comment Handler', () => {
  describe('Input Validation', () => {
    it('should throw error for null payload', async () => {
      await assert.rejects(
        async () => await handleIssueComment(null),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for undefined payload', async () => {
      await assert.rejects(
        async () => await handleIssueComment(undefined),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for array payload', async () => {
      await assert.rejects(
        async () => await handleIssueComment([]),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for non-object payload', async () => {
      await assert.rejects(
        async () => await handleIssueComment('string'),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for missing action field', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          comment: { body: 'Test' },
          issue: { title: 'Test', number: 1 }
        }),
        { message: 'Invalid payload: missing or invalid action field' }
      );
    });

    it('should throw error for non-string action field', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          action: 123,
          comment: { body: 'Test' },
          issue: { title: 'Test', number: 1 }
        }),
        { message: 'Invalid payload: missing or invalid action field' }
      );
    });

    it('should throw error for null action field', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          action: null,
          comment: { body: 'Test' },
          issue: { title: 'Test', number: 1 }
        }),
        { message: 'Invalid payload: missing or invalid action field' }
      );
    });

    it('should throw error for undefined action field', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          action: undefined,
          comment: { body: 'Test' },
          issue: { title: 'Test', number: 1 }
        }),
        { message: 'Invalid payload: missing or invalid action field' }
      );
    });

    it('should throw error for missing comment object', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          action: 'created',
          issue: { title: 'Test', number: 1 }
        }),
        { message: 'Invalid payload: missing or invalid comment object' }
      );
    });

    it('should throw error for null comment object', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          action: 'created',
          comment: null,
          issue: { title: 'Test', number: 1 }
        }),
        { message: 'Invalid payload: missing or invalid comment object' }
      );
    });

    it('should throw error for non-object comment', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          action: 'created',
          comment: 'string',
          issue: { title: 'Test', number: 1 }
        }),
        { message: 'Invalid payload: missing or invalid comment object' }
      );
    });

    it('should throw error for missing issue object', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          action: 'created',
          comment: { body: 'Test' }
        }),
        { message: 'Invalid payload: missing or invalid issue object' }
      );
    });

    it('should throw error for null issue object', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          action: 'created',
          comment: { body: 'Test' },
          issue: null
        }),
        { message: 'Invalid payload: missing or invalid issue object' }
      );
    });

    it('should throw error for non-object issue', async () => {
      await assert.rejects(
        async () => await handleIssueComment({
          action: 'created',
          comment: { body: 'Test' },
          issue: 'string'
        }),
        { message: 'Invalid payload: missing or invalid issue object' }
      );
    });
  });

  describe('Supported Actions', () => {
    it('should process created action on issue', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'This looks good to me!',
          html_url: 'https://github.com/user/repo/issues/42#issuecomment-123'
        },
        issue: {
          title: 'Fix login bug',
          number: 42,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.event, 'issue_comment');
      assert.ok(result.message.includes('💬 Comment Created by @alice'));
      assert.ok(result.message.includes('Issue #42: Fix login bug'));
      assert.ok(result.message.includes('This looks good to me!'));
      assert.ok(result.message.includes('🔗 https://github.com/user/repo/issues/42#issuecomment-123'));
    });

    it('should process created action on pull request', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'LGTM!',
          html_url: 'https://github.com/user/repo/pull/123#issuecomment-456'
        },
        issue: {
          title: 'Add new feature',
          number: 123,
          pull_request: {}
        },
        sender: { login: 'bob' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.processed, true);
      assert.ok(result.message.includes('💬 Comment Created by @bob'));
      assert.ok(result.message.includes('PR #123: Add new feature'));
      assert.ok(result.message.includes('LGTM!'));
      assert.ok(result.message.includes('🔗 https://github.com/user/repo/pull/123#issuecomment-456'));
    });

    it('should format message with exactly 4 lines for issue comment', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);
      const lines = result.message.split('\n');

      assert.strictEqual(lines.length, 4);
      assert.ok(lines[0].includes('💬 Comment Created'));
      assert.ok(lines[1].startsWith('Issue #'));
      assert.strictEqual(lines[2], 'Test comment');
      assert.ok(lines[3].startsWith('🔗'));
    });

    it('should format message with exactly 4 lines for PR comment', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment',
          html_url: 'https://github.com/user/repo/pull/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: {}
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);
      const lines = result.message.split('\n');

      assert.strictEqual(lines.length, 4);
      assert.ok(lines[0].includes('💬 Comment Created'));
      assert.ok(lines[1].startsWith('PR #'));
      assert.strictEqual(lines[2], 'Test comment');
      assert.ok(lines[3].startsWith('🔗'));
    });

    it('should include correct data structure in return value', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Great work!',
          html_url: 'https://github.com/user/repo/issues/5#issuecomment-5'
        },
        issue: {
          title: 'Feature request',
          number: 5,
          pull_request: null
        },
        sender: { login: 'charlie' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.data.action, 'created');
      assert.strictEqual(result.data.number, 5);
      assert.strictEqual(result.data.title, 'Feature request');
      assert.strictEqual(result.data.sender, 'charlie');
      assert.strictEqual(result.data.commentBody, 'Great work!');
      assert.strictEqual(result.data.commentUrl, 'https://github.com/user/repo/issues/5#issuecomment-5');
      assert.strictEqual(result.data.isPr, false);
    });
  });

  describe('Unsupported Actions', () => {
    it('should return processed: false for edited action', async () => {
      const payload = {
        action: 'edited',
        comment: {
          body: 'Updated comment',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.processed, false);
      assert.ok(result.message.includes('Unsupported issue_comment action: edited'));
      assert.strictEqual(result.event, 'issue_comment');
    });

    it('should return processed: false for deleted action', async () => {
      const payload = {
        action: 'deleted',
        comment: {
          body: 'Deleted comment',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.processed, false);
      assert.ok(result.message.includes('Unsupported issue_comment action: deleted'));
      assert.strictEqual(result.event, 'issue_comment');
    });

    it('should log warning for unsupported action', async () => {
      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        warnings.push(args.join(' '));
      };

      const payload = {
        action: 'edited',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      await handleIssueComment(payload);

      console.warn = originalWarn;

      assert.ok(warnings.some(w => w.includes('Unsupported issue_comment action: edited')));
    });

    it('should include issue number in warning log', async () => {
      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        warnings.push(JSON.stringify(args));
      };

      const payload = {
        action: 'deleted',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/42#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 42,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      await handleIssueComment(payload);

      console.warn = originalWarn;

      assert.ok(warnings.some(w => w.includes('42')));
    });

    it('should include minimal data for unsupported action', async () => {
      const payload = {
        action: 'edited',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test issue',
          number: 7,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.data.action, 'edited');
      assert.strictEqual(result.data.issueNumber, 7);
      assert.strictEqual(result.data.title, 'Test issue');
    });
  });

  describe('Placeholder Handling', () => {
    it('should use [No comment text] for empty comment body', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: '',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('[No comment text]'));
    });

    it('should use [No comment text] for whitespace-only comment body', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: '   ',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('[No comment text]'));
    });

    it('should use [No comment text] for null comment body', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: null,
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('[No comment text]'));
    });

    it('should use [No title] for empty issue title', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: '',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('[No title]'));
    });

    it('should use [No title] for whitespace-only issue title', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: '   ',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('[No title]'));
    });

    it('should use [No title] for null issue title', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: null,
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('[No title]'));
    });

    it('should use @unknown for null sender', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: null
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('@unknown'));
    });

    it('should use @unknown for undefined sender', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('@unknown'));
    });

    it('should skip URL line when commentUrl is null', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment',
          html_url: null
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(!result.message.includes('🔗'));
      const lines = result.message.split('\n');
      assert.strictEqual(lines.length, 3);
    });

    it('should skip URL line when commentUrl is undefined', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(!result.message.includes('🔗'));
    });

    it('should handle null issue number gracefully', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test comment',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: null,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('#null: Test'));
    });
  });

  describe('Comment Body Truncation', () => {
    it('should not truncate short comments (< 200 chars)', async () => {
      const shortComment = 'This is a short comment';
      const payload = {
        action: 'created',
        comment: {
          body: shortComment,
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes(shortComment));
      assert.ok(!result.message.includes('...'));
    });

    it('should truncate long comments (> 200 chars)', async () => {
      const longComment = 'a'.repeat(250);
      const payload = {
        action: 'created',
        comment: {
          body: longComment,
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      // Should be truncated to 200 chars + '...'
      const lines = result.message.split('\n');
      assert.strictEqual(lines[2].length, 203);
      assert.ok(lines[2].endsWith('...'));
    });

    it('should not truncate exactly 200 character comment', async () => {
      const exactComment = 'a'.repeat(200);
      const payload = {
        action: 'created',
        comment: {
          body: exactComment,
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      const lines = result.message.split('\n');
      assert.strictEqual(lines[2].length, 200);
      assert.ok(!lines[2].endsWith('...'));
    });

    it('should preserve original comment body in data object', async () => {
      const longComment = 'a'.repeat(300);
      const payload = {
        action: 'created',
        comment: {
          body: longComment,
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      // data.commentBody should have original full comment
      assert.strictEqual(result.data.commentBody, longComment);
      assert.strictEqual(result.data.commentBody.length, 300);
    });
  });

  describe('Issue/PR Context Detection', () => {
    it('should detect issue comment when pull_request is null', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.data.isPr, false);
      assert.ok(result.message.includes('Issue #'));
    });

    it('should detect issue comment when pull_request is undefined', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.data.isPr, false);
      assert.ok(result.message.includes('Issue #'));
    });

    it('should detect PR comment when pull_request is present', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/pull/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: {}
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.data.isPr, true);
      assert.ok(result.message.includes('PR #'));
    });

    it('should use correct prefix for issue comments', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/42#issuecomment-1'
        },
        issue: {
          title: 'Bug fix',
          number: 42,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      const lines = result.message.split('\n');
      assert.strictEqual(lines[1], 'Issue #42: Bug fix');
    });

    it('should use correct prefix for PR comments', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/pull/42#issuecomment-1'
        },
        issue: {
          title: 'Feature',
          number: 42,
          pull_request: {}
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      const lines = result.message.split('\n');
      assert.strictEqual(lines[1], 'PR #42: Feature');
    });
  });

  describe('Return Value Structure', () => {
    it('should return processed: true for supported actions', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.processed, true);
    });

    it('should return non-empty message string', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(typeof result.message, 'string');
      assert.ok(result.message.length > 0);
    });

    it('should return event type as issue_comment', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.event, 'issue_comment');
    });

    it('should return data object with all required fields', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Great!',
          html_url: 'https://github.com/user/repo/issues/10#issuecomment-10'
        },
        issue: {
          title: 'Feature X',
          number: 10,
          pull_request: null
        },
        sender: { login: 'bob' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(typeof result.data, 'object');
      assert.strictEqual(result.data.action, 'created');
      assert.strictEqual(result.data.number, 10);
      assert.strictEqual(result.data.title, 'Feature X');
      assert.strictEqual(result.data.sender, 'bob');
      assert.strictEqual(result.data.commentBody, 'Great!');
      assert.strictEqual(result.data.commentUrl, 'https://github.com/user/repo/issues/10#issuecomment-10');
      assert.strictEqual(result.data.isPr, false);
    });

    it('should return data object for PR comment', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'LGTM!',
          html_url: 'https://github.com/user/repo/pull/20#issuecomment-20'
        },
        issue: {
          title: 'PR Feature',
          number: 20,
          pull_request: {}
        },
        sender: { login: 'charlie' }
      };

      const result = await handleIssueComment(payload);

      assert.strictEqual(result.data.isPr, true);
      assert.strictEqual(result.data.number, 20);
      assert.strictEqual(result.data.title, 'PR Feature');
    });
  });

  describe('Edge Cases', () => {
    it('should handle comment body with special characters', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Comment with <html> & "quotes" and \'apostrophes\'',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('Comment with <html> & "quotes" and \'apostrophes\''));
    });

    it('should handle comment body with emoji', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Great work! 🎉👍💯',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('Great work! 🎉👍💯'));
    });

    it('should handle comment body with newlines', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Line 1\nLine 2\nLine 3',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      // Newlines should be preserved in comment body
      // The message will have more than 4 lines because the comment body contains newlines
      assert.ok(result.message.includes('Line 1'));
      assert.ok(result.message.includes('Line 2'));
      assert.ok(result.message.includes('Line 3'));
      // Verify the structure is preserved: Line 1, Line 2, and Line 3 appear in order
      const line1Index = result.message.indexOf('Line 1');
      const line2Index = result.message.indexOf('Line 2');
      const line3Index = result.message.indexOf('Line 3');
      assert.ok(line1Index < line2Index && line2Index < line3Index, 'Lines should appear in order');
    });

    it('should handle issue title with emoji', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: '🐛 Bug fix with emoji 😱',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('🐛 Bug fix with emoji 😱'));
    });

    it('should handle issue title with special characters', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Issue with <html> & "quotes"',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('Issue with <html> & "quotes"'));
    });

    it('should handle very long issue title', async () => {
      const longTitle = 'This is a very long issue title that exceeds normal length and should still be displayed properly in the message without any truncation occurring';
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: longTitle,
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      // Full title should be present
      assert.ok(result.message.includes(longTitle));
    });

    it('should handle username with special characters', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'user-123_test' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('@user-123_test'));
    });

    it('should handle comment body with only whitespace', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: '  \n\t  ',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('[No comment text]'));
    });

    it('should handle URL with special characters', async () => {
      const payload = {
        action: 'created',
        comment: {
          body: 'Test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-abc123-def456'
        },
        issue: {
          title: 'Test',
          number: 1,
          pull_request: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleIssueComment(payload);

      assert.ok(result.message.includes('https://github.com/user/repo/issues/1#issuecomment-abc123-def456'));
    });
  });
});
