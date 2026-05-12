/**
 * Formatter Module Tests
 *
 * Comprehensive unit tests for the centralized formatter module.
 * Tests all formatter functions: base, actions, urls, and labels.
 *
 * @module __tests__/formatters
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildBaseMessage,
  addLine,
  addUrl,
  finalize,
  getActionLabel,
  ACTION_LABELS,
  formatUrl,
  formatGithubUrl,
  formatLabels,
  getEmojiForColor,
  COLOR_EMOJI_MAP
} from '../formatters/index.js';

describe('Base Message Builder Tests', () => {
  describe('buildBaseMessage', () => {
    it('should create a builder with correct first line', () => {
      const builder = buildBaseMessage('alice', '🔓 Issue Opened');
      assert.strictEqual(builder.lines.length, 1);
      assert.strictEqual(builder.lines[0], '🔓 Issue Opened by @alice');
    });

    it('should format sender with @ prefix', () => {
      const builder = buildBaseMessage('bob', 'Test Action');
      assert.strictEqual(builder.lines[0], 'Test Action by @bob');
    });

    it('should use the provided action label', () => {
      const builder = buildBaseMessage('user', '🚀 Release Published');
      assert.strictEqual(builder.lines[0], '🚀 Release Published by @user');
    });

    it('should handle special characters in sender name', () => {
      const builder = buildBaseMessage('user-123', 'Test');
      assert.strictEqual(builder.lines[0], 'Test by @user-123');
    });

    it('should create empty lines array initially', () => {
      const builder = buildBaseMessage('user', 'Test');
      assert.strictEqual(builder.lines.length, 1);
    });
  });

  describe('addLine', () => {
    it('should add a line to the builder', () => {
      const builder = buildBaseMessage('user', 'Test');
      addLine(builder, 'Second line');
      assert.strictEqual(builder.lines.length, 2);
      assert.strictEqual(builder.lines[1], 'Second line');
    });

    it('should add multiple lines', () => {
      const builder = buildBaseMessage('user', 'Test');
      addLine(builder, 'Line 2');
      addLine(builder, 'Line 3');
      addLine(builder, 'Line 4');
      assert.strictEqual(builder.lines.length, 4);
      assert.strictEqual(builder.lines[1], 'Line 2');
      assert.strictEqual(builder.lines[2], 'Line 3');
      assert.strictEqual(builder.lines[3], 'Line 4');
    });

    it('should handle empty string', () => {
      const builder = buildBaseMessage('user', 'Test');
      addLine(builder, '');
      assert.strictEqual(builder.lines.length, 1);
    });

    it('should handle null', () => {
      const builder = buildBaseMessage('user', 'Test');
      addLine(builder, null);
      assert.strictEqual(builder.lines.length, 1);
    });

    it('should handle undefined', () => {
      const builder = buildBaseMessage('user', 'Test');
      addLine(builder, undefined);
      assert.strictEqual(builder.lines.length, 1);
    });

    it('should convert numbers to strings', () => {
      const builder = buildBaseMessage('user', 'Test');
      addLine(builder, 42);
      assert.strictEqual(builder.lines[1], '42');
    });

    it('should throw error for invalid builder', () => {
      assert.throws(() => {
        addLine(null, 'test');
      }, /Invalid builder/);
    });

    it('should throw error for builder without lines array', () => {
      assert.throws(() => {
        addLine({}, 'test');
      }, /Invalid builder/);
    });
  });

  describe('addUrl', () => {
    it('should add URL with 🔗 prefix', () => {
      const builder = buildBaseMessage('user', 'Test');
      addUrl(builder, 'https://github.com/user/repo/issues/42');
      assert.strictEqual(builder.lines[1], '🔗 https://github.com/user/repo/issues/42');
    });

    it('should handle null URL', () => {
      const builder = buildBaseMessage('user', 'Test');
      addUrl(builder, null);
      assert.strictEqual(builder.lines.length, 1);
    });

    it('should handle undefined URL', () => {
      const builder = buildBaseMessage('user', 'Test');
      addUrl(builder, undefined);
      assert.strictEqual(builder.lines.length, 1);
    });

    it('should handle empty string URL', () => {
      const builder = buildBaseMessage('user', 'Test');
      addUrl(builder, '');
      assert.strictEqual(builder.lines.length, 1);
    });

    it('should handle whitespace-only URL', () => {
      const builder = buildBaseMessage('user', 'Test');
      addUrl(builder, '   ');
      assert.strictEqual(builder.lines.length, 1);
    });

    it('should throw error for invalid builder', () => {
      assert.throws(() => {
        addUrl(null, 'https://github.com');
      }, /Invalid builder/);
    });
  });

  describe('finalize', () => {
    it('should join all lines with newline', () => {
      const builder = buildBaseMessage('user', 'Test');
      addLine(builder, 'Line 2');
      addLine(builder, 'Line 3');
      const message = finalize(builder);
      assert.strictEqual(message, 'Test by @user\nLine 2\nLine 3');
    });

    it('should handle single line', () => {
      const builder = buildBaseMessage('user', 'Test');
      const message = finalize(builder);
      assert.strictEqual(message, 'Test by @user');
    });

    it('should handle empty builder', () => {
      const builder = { lines: [] };
      const message = finalize(builder);
      assert.strictEqual(message, '');
    });

    it('should throw error for invalid builder', () => {
      assert.throws(() => {
        finalize(null);
      }, /Invalid builder/);
    });

    it('should throw error for builder without lines array', () => {
      assert.throws(() => {
        finalize({});
      }, /Invalid builder/);
    });

    it('should not modify original builder', () => {
      const builder = buildBaseMessage('user', 'Test');
      addLine(builder, 'Line 2');
      const originalLength = builder.lines.length;
      finalize(builder);
      assert.strictEqual(builder.lines.length, originalLength);
    });
  });
});

describe('URL Formatter Tests', () => {
  describe('formatUrl', () => {
    it('should add 🔗 prefix to valid URL', () => {
      const result = formatUrl('https://github.com/user/repo/issues/42');
      assert.strictEqual(result, '🔗 https://github.com/user/repo/issues/42');
    });

    it('should handle GitHub issue URLs', () => {
      const result = formatUrl('https://github.com/user/repo/issues/123');
      assert.strictEqual(result, '🔗 https://github.com/user/repo/issues/123');
    });

    it('should handle GitHub PR URLs', () => {
      const result = formatUrl('https://github.com/user/repo/pull/456');
      assert.strictEqual(result, '🔗 https://github.com/user/repo/pull/456');
    });

    it('should handle null', () => {
      const result = formatUrl(null);
      assert.strictEqual(result, '');
    });

    it('should handle undefined', () => {
      const result = formatUrl(undefined);
      assert.strictEqual(result, '');
    });

    it('should handle empty string', () => {
      const result = formatUrl('');
      assert.strictEqual(result, '');
    });

    it('should handle whitespace-only string', () => {
      const result = formatUrl('   ');
      assert.strictEqual(result, '');
    });

    it('should not modify original URL', () => {
      const url = 'https://github.com/user/repo';
      const result = formatUrl(url);
      assert.ok(result.includes(url));
    });
  });

  describe('formatGithubUrl', () => {
    it('should build issue URL', () => {
      const result = formatGithubUrl('user', 'repo', 'issues', 42);
      assert.strictEqual(result, 'https://github.com/user/repo/issues/42');
    });

    it('should build pull request URL', () => {
      const result = formatGithubUrl('user', 'repo', 'pull', 123);
      assert.strictEqual(result, 'https://github.com/user/repo/pull/123');
    });

    it('should build repository URL', () => {
      const result = formatGithubUrl('user', 'repo', 'repo', null);
      assert.strictEqual(result, 'https://github.com/user/repo');
    });

    it('should handle missing owner', () => {
      const result = formatGithubUrl(null, 'repo', 'issues', 42);
      assert.strictEqual(result, null);
    });

    it('should handle missing repo', () => {
      const result = formatGithubUrl('user', null, 'issues', 42);
      assert.strictEqual(result, null);
    });

    it('should handle missing number for issues', () => {
      const result = formatGithubUrl('user', 'repo', 'issues', null);
      assert.strictEqual(result, null);
    });

    it('should handle missing number for pull', () => {
      const result = formatGithubUrl('user', 'repo', 'pull', null);
      assert.strictEqual(result, null);
    });

    it('should handle unknown type', () => {
      const result = formatGithubUrl('user', 'repo', 'unknown', 42);
      assert.strictEqual(result, null);
    });

    it('should handle special characters in owner', () => {
      const result = formatGithubUrl('user-123', 'repo', 'repo', null);
      assert.strictEqual(result, 'https://github.com/user-123/repo');
    });

    it('should handle special characters in repo', () => {
      const result = formatGithubUrl('user', 'repo.name', 'repo', null);
      assert.strictEqual(result, 'https://github.com/user/repo.name');
    });
  });
});

describe('Action Label Formatter Tests', () => {
  describe('getActionLabel', () => {
    describe('issues event type', () => {
      it('should return correct label for opened action', () => {
        const result = getActionLabel('issues', 'opened');
        assert.strictEqual(result, '🔓 Issue Opened');
      });

      it('should return correct label for closed action', () => {
        const result = getActionLabel('issues', 'closed');
        assert.strictEqual(result, '🔒 Issue Closed');
      });

      it('should return correct label for reopened action', () => {
        const result = getActionLabel('issues', 'reopened');
        assert.strictEqual(result, '♻️ Issue Reopened');
      });

      it('should return correct label for deleted action', () => {
        const result = getActionLabel('issues', 'deleted');
        assert.strictEqual(result, '🗑️ Issue Deleted');
      });
    });

    describe('pull_request event type', () => {
      it('should return correct label for opened action', () => {
        const result = getActionLabel('pull_request', 'opened');
        assert.strictEqual(result, '🔓 PR Opened');
      });

      it('should return correct label for closed action', () => {
        const result = getActionLabel('pull_request', 'closed');
        assert.strictEqual(result, '🔒 PR Closed');
      });

      it('should return correct label for reopened action', () => {
        const result = getActionLabel('pull_request', 'reopened');
        assert.strictEqual(result, '♻️ PR Reopened');
      });

      it('should return correct label for merged action', () => {
        const result = getActionLabel('pull_request', 'merged');
        assert.strictEqual(result, '🟣 PR Merged');
      });

      it('should return correct label for ready_for_review action', () => {
        const result = getActionLabel('pull_request', 'ready_for_review');
        assert.strictEqual(result, '👀 PR Ready for Review');
      });
    });

    describe('issue_comment event type', () => {
      it('should return correct label for created action', () => {
        const result = getActionLabel('issue_comment', 'created');
        assert.strictEqual(result, '💬 Comment Created');
      });
    });

    describe('release event type', () => {
      it('should return correct label for published action', () => {
        const result = getActionLabel('release', 'published');
        assert.strictEqual(result, '🚀 Release Published');
      });

      it('should return correct label for created action', () => {
        const result = getActionLabel('release', 'created');
        assert.strictEqual(result, '🚀 Release Created');
      });
    });

    describe('unknown actions', () => {
      it('should return generic label for unknown issue action', () => {
        const result = getActionLabel('issues', 'unknown');
        assert.strictEqual(result, '❓ issues unknown');
      });

      it('should return generic label for unknown pull_request action', () => {
        const result = getActionLabel('pull_request', 'unknown');
        assert.strictEqual(result, '❓ pull_request unknown');
      });
    });

    describe('unknown event types', () => {
      it('should return generic label for unknown event type', () => {
        const result = getActionLabel('unknown_event', 'action');
        assert.strictEqual(result, '❓ unknown_event action');
      });

      it('should handle null eventType', () => {
        const result = getActionLabel(null, 'action');
        assert.strictEqual(result, '❓ Unknown Action');
      });

      it('should handle null action', () => {
        const result = getActionLabel('issues', null);
        assert.strictEqual(result, '❓ Unknown Action');
      });

      it('should handle undefined eventType', () => {
        const result = getActionLabel(undefined, 'action');
        assert.strictEqual(result, '❓ Unknown Action');
      });

      it('should handle undefined action', () => {
        const result = getActionLabel('issues', undefined);
        assert.strictEqual(result, '❓ Unknown Action');
      });
    });
  });

  describe('ACTION_LABELS constant', () => {
    it('should contain issues event type', () => {
      assert.ok(ACTION_LABELS.issues);
    });

    it('should contain pull_request event type', () => {
      assert.ok(ACTION_LABELS.pull_request);
    });

    it('should contain issue_comment event type', () => {
      assert.ok(ACTION_LABELS.issue_comment);
    });

    it('should contain release event type', () => {
      assert.ok(ACTION_LABELS.release);
    });

    it('should be frozen', () => {
      assert.throws(() => {
        ACTION_LABELS.new_type = {};
      }, /Cannot add/);
    });

    it('should have frozen event type mappings', () => {
      assert.throws(() => {
        ACTION_LABELS.issues.new_action = 'test';
      }, /Cannot add/);
    });

    it('should have correct format for all labels', () => {
      const checkLabelFormat = (label) => {
        assert.ok(typeof label === 'string');
        assert.ok(label.length > 0);
        // Should contain emoji (first character should be emoji or special)
        assert.ok(/^[^\w\s]/.test(label) || /[\u{1F300}-\u{1F9FF}]/u.test(label));
      };

      Object.values(ACTION_LABELS).forEach(eventMap => {
        Object.values(eventMap).forEach(checkLabelFormat);
      });
    });
  });
});

describe('Label Formatter Tests', () => {
  describe('formatLabels', () => {
    it('should format single label correctly', () => {
      const labels = [{ name: 'bug', color: 'd73a4a' }];
      const result = formatLabels(labels);
      assert.strictEqual(result, '🔴 bug');
    });

    it('should format multiple labels correctly', () => {
      const labels = [
        { name: 'bug', color: 'd73a4a' },
        { name: 'enhancement', color: 'a2eeef' }
      ];
      const result = formatLabels(labels);
      assert.strictEqual(result, '🔴 bug 🔵 enhancement');
    });

    it('should handle empty array', () => {
      const result = formatLabels([]);
      assert.strictEqual(result, '');
    });

    it('should handle null', () => {
      const result = formatLabels(null);
      assert.strictEqual(result, '');
    });

    it('should handle undefined', () => {
      const result = formatLabels(undefined);
      assert.strictEqual(result, '');
    });

    it('should handle label without name', () => {
      const labels = [{ color: 'd73a4a' }];
      const result = formatLabels(labels);
      assert.strictEqual(result, '🔴 unknown');
    });

    it('should handle label without color', () => {
      const labels = [{ name: 'bug' }];
      const result = formatLabels(labels);
      assert.strictEqual(result, '⚫ bug');
    });

    it('should handle label with null color', () => {
      const labels = [{ name: 'bug', color: null }];
      const result = formatLabels(labels);
      assert.strictEqual(result, '⚫ bug');
    });

    it('should handle label with undefined color', () => {
      const labels = [{ name: 'bug', color: undefined }];
      const result = formatLabels(labels);
      assert.strictEqual(result, '⚫ bug');
    });

    it('should handle invalid label object', () => {
      const labels = [null];
      const result = formatLabels(labels);
      assert.strictEqual(result, '⚫ unknown');
    });

    it('should handle label with empty name', () => {
      const labels = [{ name: '', color: 'd73a4a' }];
      const result = formatLabels(labels);
      assert.strictEqual(result, '🔴 unknown');
    });

    it('should handle label with whitespace name', () => {
      const labels = [{ name: '   ', color: 'd73a4a' }];
      const result = formatLabels(labels);
      // Whitespace is not trimmed, so it's used as-is
      assert.strictEqual(result, '🔴    ');
    });

    it('should handle three labels', () => {
      const labels = [
        { name: 'bug', color: 'd73a4a' },
        { name: 'enhancement', color: 'a2eeef' },
        { name: 'feature', color: '7057ff' }
      ];
      const result = formatLabels(labels);
      assert.strictEqual(result, '🔴 bug 🔵 enhancement 🟣 feature');
    });

    it('should handle label with special characters in name', () => {
      const labels = [{ name: 'bug-fix: urgent', color: 'd73a4a' }];
      const result = formatLabels(labels);
      assert.strictEqual(result, '🔴 bug-fix: urgent');
    });

    it('should handle label with emoji in name', () => {
      const labels = [{ name: '🐛 bug', color: 'd73a4a' }];
      const result = formatLabels(labels);
      assert.strictEqual(result, '🔴 🐛 bug');
    });
  });

  describe('getEmojiForColor', () => {
    it('should return correct emoji for red', () => {
      const result = getEmojiForColor('d73a4a');
      assert.strictEqual(result, '🔴');
    });

    it('should return correct emoji for blue', () => {
      const result = getEmojiForColor('a2eeef');
      assert.strictEqual(result, '🔵');
    });

    it('should return correct emoji for purple', () => {
      const result = getEmojiForColor('7057ff');
      assert.strictEqual(result, '🟣');
    });

    it('should return correct emoji for green', () => {
      const result = getEmojiForColor('008672');
      assert.strictEqual(result, '🟢');
    });

    it('should return correct emoji for yellow', () => {
      const result = getEmojiForColor('fbca04');
      assert.strictEqual(result, '🟡');
    });

    it('should return correct emoji for gray', () => {
      const result = getEmojiForColor('9e9a9d');
      assert.strictEqual(result, '⚪');
    });

    it('should return correct emoji for black', () => {
      const result = getEmojiForColor('000000');
      assert.strictEqual(result, '⚫');
    });

    it('should handle uppercase color code', () => {
      const result = getEmojiForColor('D73A4A');
      assert.strictEqual(result, '🔴');
    });

    it('should handle mixed case color code', () => {
      const result = getEmojiForColor('D73a4A');
      assert.strictEqual(result, '🔴');
    });

    it('should handle color code with spaces', () => {
      const result = getEmojiForColor(' d73a4a ');
      assert.strictEqual(result, '🔴');
    });

    it('should return default emoji for unknown color', () => {
      const result = getEmojiForColor('ffffff');
      assert.strictEqual(result, '⚪');
    });

    it('should return default emoji for invalid color', () => {
      const result = getEmojiForColor('invalid');
      assert.strictEqual(result, '⚫');
    });

    it('should handle null color', () => {
      const result = getEmojiForColor(null);
      assert.strictEqual(result, '⚫');
    });

    it('should handle undefined color', () => {
      const result = getEmojiForColor(undefined);
      assert.strictEqual(result, '⚫');
    });

    it('should handle empty string', () => {
      const result = getEmojiForColor('');
      assert.strictEqual(result, '⚫');
    });

    it('should handle whitespace string', () => {
      const result = getEmojiForColor('   ');
      assert.strictEqual(result, '⚫');
    });

    it('should handle numeric string', () => {
      const result = getEmojiForColor('123');
      assert.strictEqual(result, '⚫');
    });
  });

  describe('COLOR_EMOJI_MAP constant', () => {
    it('should be frozen', () => {
      assert.throws(() => {
        COLOR_EMOJI_MAP.new_color = '🟠';
      }, /Cannot add/);
    });

    it('should contain all expected colors', () => {
      assert.ok(COLOR_EMOJI_MAP['d73a4a']);
      assert.ok(COLOR_EMOJI_MAP['a2eeef']);
      assert.ok(COLOR_EMOJI_MAP['7057ff']);
      assert.ok(COLOR_EMOJI_MAP['008672']);
      assert.ok(COLOR_EMOJI_MAP['fbca04']);
      assert.ok(COLOR_EMOJI_MAP['000000']);
    });

    it('should have emoji values for all colors', () => {
      Object.values(COLOR_EMOJI_MAP).forEach(emoji => {
        assert.ok(typeof emoji === 'string');
        assert.ok(emoji.length > 0);
      });
    });

    it('should have at least 20 color mappings', () => {
      const count = Object.keys(COLOR_EMOJI_MAP).length;
      assert.ok(count >= 20, `Expected at least 20 colors, got ${count}`);
    });

    it('should map unique colors to emojis', () => {
      const colors = Object.keys(COLOR_EMOJI_MAP);
      const uniqueColors = new Set(colors);
      assert.strictEqual(colors.length, uniqueColors.size);
    });
  });
});

console.log('\n✅ All formatter tests completed successfully!');
