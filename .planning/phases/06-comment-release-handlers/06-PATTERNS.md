# Phase 6: Comment and Release Event Handlers - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 4 new files, 2 modified files
**Analogs found:** 4 / 4 (100%)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/handlers/comment.js` | handler | request-response | `src/lib/handlers/issues.js` | exact |
| `src/lib/handlers/release.js` | handler | request-response | `src/lib/handlers/issues.js` | exact |
| `src/lib/__tests__/comment-handler.test.js` | test | unit | `src/lib/__tests__/issues-handler.test.js` | exact |
| `src/lib/__tests__/comment-integration.test.js` | test | integration | `src/lib/__tests__/pull-request-integration.test.js` | exact |
| `src/lib/__tests__/release-handler.test.js` | test | unit | `src/lib/__tests__/issues-handler.test.js` | exact |
| `src/lib/__tests__/release-integration.test.js` | test | integration | `src/lib/__tests__/pull-request-integration.test.js` | exact |
| `src/lib/handlers/index.js` | config | request-response | `src/lib/handlers/index.js` | same-file |

## Pattern Assignments

### `src/lib/handlers/comment.js` (handler, request-response)

**Analog:** `src/lib/handlers/issues.js`

**File structure and imports** (lines 1-17):
```javascript
/**
 * Issues Event Handler
 *
 * Processes GitHub issues webhook events and formats them into readable messages.
 * Supports opened, closed, reopened, and deleted actions.
 *
 * @module handlers/issues
 */

// Logger will be passed from the main app via Fastify's app.log
// For now, we use console for warnings (will be integrated with app.log in main flow)
const logger = {
  warn: ({ event, action, issueNumber }, msg) => {
    console.warn(`[issues-handler] ${msg}`, { event, action, issueNumber });
  }
};
```

**Action constants and labels pattern** (lines 19-37):
```javascript
/**
 * Supported issue actions
 *
 * @type {Set<string>}
 */
const SUPPORTED_ACTIONS = new Set(['opened', 'closed', 'reopened', 'deleted']);

/**
 * Action label mapping for message formatting
 *
 * Maps action types to their display labels with emojis.
 *
 * @type {Object<string, string>}
 */
const ACTION_LABELS = {
  opened: '🔓 Issue Opened',
  closed: '🔒 Issue Closed',
  reopened: '♻️ Issue Reopened',
  deleted: '🗑️ Issue Deleted'
};
```

**Utility functions pattern - COLOR_EMOJI_MAP** (lines 39-99):
```javascript
/**
 * Color to emoji mapping for issue labels
 *
 * Maps GitHub label colors to emoji dots.
 *
 * @type {Object<string, string>}
 */
const COLOR_EMOJI_MAP = {
  'd73a4a': '🔴',  // red
  'a2eeef': '🔵',  // blue
  '7057ff': '🟣',  // purple
  // ... more mappings
};

// Freeze COLOR_EMOJI_MAP to prevent prototype pollution (CR-01)
Object.freeze(COLOR_EMOJI_MAP);

/**
 * Maps a hex color code to an emoji dot
 *
 * @param {string} color - 6-character hex color code
 * @returns {string} Emoji representing the color
 */
function getEmojiForColor(color) {
  if (!color || typeof color !== 'string') {
    return '⚫';
  }

  // Normalize color to lowercase
  const normalizedColor = color.toLowerCase().trim();

  // Return mapped emoji or default black dot
  return COLOR_EMOJI_MAP[normalizedColor] || '⚫';
}
```

**Utility functions pattern - formatLabels** (lines 101-126):
```javascript
/**
 * Formats issue labels into a string with emoji dots
 *
 * @param {Array<Object>} labels - Array of label objects with name and color
 * @returns {string} Formatted label string or empty string if no labels
 *
 * @example
 * formatLabels([{ name: 'bug', color: 'd73a4a' }])
 * // Returns '🔴 bug'
 */
function formatLabels(labels) {
  if (!Array.isArray(labels) || labels.length === 0) {
    return '';
  }

  return labels.map(label => {
    // Validate label object structure (CR-02)
    if (!label || typeof label !== 'object') {
      return '⚫ unknown';
    }
    const emoji = getEmojiForColor(label?.color);
    const name = label?.name || 'unknown';
    return `${emoji} ${name}`;
  }).join(' ');
}
```

**Message formatting function pattern** (lines 128-180):
```javascript
/**
 * Formats an issue event into a readable message
 *
 * @param {Object} issueData - Extracted issue data
 * @param {string} issueData.action - The action performed
 * @param {string} issueData.title - Issue title
 * @param {number|null} issueData.number - Issue number
 * @param {string} issueData.sender - Username of the sender
 * @param {string} issueData.htmlUrl - Issue URL
 * @param {Array<Object>} issueData.labels - Array of labels
 * @returns {string} Formatted message
 */
function formatIssueMessage(issueData) {
  const { action, title, number, sender, htmlUrl, labels } = issueData;

  // Get action label
  const actionLabel = ACTION_LABELS[action] || `Issue ${action}`;

  // Build message lines
  const lines = [];

  // Line 1: Action label with sender
  lines.push(`${actionLabel} by @${sender}`);

  // Line 2: Labels (skip for deleted action per D-06)
  if (action !== 'deleted') {
    const labelLine = formatLabels(labels);
    if (labelLine) {
      lines.push(labelLine);
    }
  }

  // Line 3: Issue information (always included)
  lines.push(`#${number}: ${title}`);

  // Line 4: URL (only if number is not null)
  if (number !== null && htmlUrl) {
    lines.push(`🔗 ${htmlUrl}`);
  }

  return lines.join('\n');
}
```

**Input validation pattern** (lines 213-227):
```javascript
export async function handleIssues(payload) {
  // Input validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  // Validate action field (per D-07)
  if (!payload.action || typeof payload.action !== 'string') {
    throw new Error('Invalid payload: missing or invalid action field');
  }

  // Validate issue object (per D-13)
  if (!payload.issue || typeof payload.issue !== 'object') {
    throw new Error('Invalid payload: missing or invalid issue object');
  }

  const { action, issue, sender } = payload;
  // ... rest of handler
}
```

**Action filtering pattern** (lines 231-250):
```javascript
  // Check if action is supported
  if (!SUPPORTED_ACTIONS.has(action)) {
    // Log warning for unsupported actions (per D-05)
    logger.warn({
      event: 'issues',
      action,
      issueNumber: issue?.number
    }, `Unsupported issues action: ${action}`);

    return {
      processed: false,
      message: `Unsupported issues action: ${action}`,
      event: 'issues',
      data: {
        action,
        issueNumber: issue?.number,
        title: issue?.title
      }
    };
  }
```

**Data extraction with placeholders pattern** (lines 252-260):
```javascript
  // Extract data with placeholders (per D-14, D-15, D-16)
  const title = (typeof issue.title === 'string' && issue.title.trim())
    ? issue.title
    : '[No title]';
  const number = issue.number ?? null;
  const htmlUrl = issue.html_url ?? null;
  const labels = issue.labels ?? [];
  const senderLogin = sender?.login ?? 'unknown';
```

**Return value structure pattern** (lines 273-290):
```javascript
  return {
    processed: true,
    message,
    event: 'issues',
    data: {
      action,
      number,
      title,
      sender: senderLogin,
      labels: labels
        .filter(label => label && typeof label === 'object')
        .map(label => ({
          name: label.name || 'unknown',
          color: label.color || '000000'
        }))
    }
  };
```

**Export utilities for reuse pattern** (lines 293-294):
```javascript
// Export reusable utilities for use in other handlers
export { COLOR_EMOJI_MAP, formatLabels };
```

---

### `src/lib/handlers/release.js` (handler, request-response)

**Analog:** `src/lib/handlers/issues.js`

**Note:** Follow the same pattern as comment.js, with these key differences:
- Use `release` instead of `issue` in payload validation
- Handle `tag_name`, `name`, `author` fields from release object
- Include assets count in message
- Support `published` action (and potentially `created` as fallback)

---

### `src/lib/__tests__/comment-handler.test.js` (test, unit)

**Analog:** `src/lib/__tests__/issues-handler.test.js`

**Test file structure** (lines 1-16):
```javascript
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
```

**Input validation test pattern** (lines 18-94):
```javascript
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

  it('should throw error for missing action field', async () => {
    await assert.rejects(
      async () => await handleIssues({
        issue: { title: 'Test', number: 1 }
      }),
      { message: 'Invalid payload: missing or invalid action field' }
    );
  });
  // ... more validation tests
});
```

**Supported actions test pattern** (lines 96-192):
```javascript
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
    assert.ok(result.message.includes('#42: Fix login bug'));
  });
  // ... more action tests
});
```

**Unsupported actions test pattern** (lines 194-277):
```javascript
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
```

**Placeholder handling test pattern** (lines 279-438):
```javascript
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
  // ... more placeholder tests
});
```

**Return value structure test pattern** (lines 601-681):
```javascript
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
  });
});
```

---

### `src/lib/__tests__/comment-integration.test.js` (test, integration)

**Analog:** `src/lib/__tests__/pull-request-integration.test.js`

**Integration test structure** (lines 1-14):
```javascript
/**
 * Integration Tests for Pull Request Handler
 *
 * Tests the pull_request handler integration with the router system
 * and end-to-end processing of real GitHub webhook payloads.
 */

import { describe, it, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import { routeEvent, registerHandler, hasHandler } from '../router.js';
import { handlePullRequest, COLOR_EMOJI_MAP as prColorMap } from '../handlers/pull-request.js';
import { handleIssues, COLOR_EMOJI_MAP as issuesColorMap, formatLabels as issuesFormatLabels } from '../handlers/issues.js';
```

**Router integration test pattern** (lines 16-73):
```javascript
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
  });
});
```

**Real GitHub webhook payload test pattern** (lines 75-260):
```javascript
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
    // ... more real payload tests
  });
```

**End-to-end message verification test pattern** (lines 691-773):
```javascript
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
  });
```

---

### `src/lib/__tests__/release-handler.test.js` (test, unit)

**Analog:** `src/lib/__tests__/issues-handler.test.js`

**Note:** Follow the same pattern as comment-handler.test.js, with these key differences:
- Test `release` payload structure instead of `issue`
- Test `tag_name`, `name`, `author`, `assets` fields
- Test assets count handling
- Test both `published` and potentially `created` actions

---

### `src/lib/__tests__/release-integration.test.js` (test, integration)

**Analog:** `src/lib/__tests__/pull-request-integration.test.js`

**Note:** Follow the same pattern as comment-integration.test.js, with these key differences:
- Use real GitHub release webhook payloads
- Test release-specific fields (tag_name, assets, etc.)
- Test draft vs published releases
- Test prerelease vs regular releases

---

### `src/lib/handlers/index.js` (config, request-response)

**Analog:** `src/lib/handlers/index.js` (same file)

**Current placeholder handlers to replace** (lines 39-82):
```javascript
/**
 * Placeholder handler for issue_comment events
 *
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Handler result
 */
export async function handleIssueComment(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: expected object');
  }
  return {
    processed: false,
    message: 'Issue comment handler not yet implemented',
    event: 'issue_comment',
    data: {
      action: payload.action,
      issueNumber: payload.issue?.number,
      commentBody: payload.comment?.body ? payload.comment.body.substring(0, 50) + '...' : null
    }
  };
}


/**
 * Placeholder handler for release events
 *
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Handler result
 */
export async function handleRelease(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: expected object');
  }
  return {
    processed: false,
    message: 'Release handler not yet implemented',
    event: 'release',
    data: {
      action: payload.action,
      tagName: payload.release?.tag_name,
      name: payload.release?.name
    }
  };
}
```

**Import pattern to add** (lines 14-16):
```javascript
// Export actual handlers
export { handleIssues } from './issues.js';
export { handlePullRequest } from './pull-request.js';
// Add these lines:
export { handleIssueComment } from './comment.js';
export { handleRelease } from './release.js';
```

---

## Shared Patterns

### 1. Input Validation Pattern
**Source:** `src/lib/handlers/issues.js` (lines 213-227)
**Apply to:** All handler files

Always validate payload structure before processing:
1. Check payload is an object (not null, not array)
2. Validate action field exists and is a string
3. Validate the main object (issue, pull_request, comment, release) exists
4. Throw descriptive error messages for each validation failure

### 2. Action Filtering Pattern
**Source:** `src/lib/handlers/issues.js` (lines 231-250)
**Apply to:** All handler files

Use Set for O(1) action lookup:
- Define SUPPORTED_ACTIONS as a Set
- Check action support with `SUPPORTED_ACTIONS.has(action)`
- Return `processed: false` for unsupported actions
- Log warning for unsupported actions using logger.warn()

### 3. Data Extraction with Placeholders Pattern
**Source:** `src/lib/handlers/issues.js` (lines 252-260)
**Apply to:** All handler files

Use consistent placeholder values:
- `[No title]` for missing/empty titles
- `@unknown` for missing sender usernames
- `null` for missing URLs/IDs
- `[]` for missing arrays
- Use `??` operator for default values

### 4. Message Formatting Pattern
**Source:** `src/lib/handlers/issues.js` (lines 150-179)
**Apply to:** All handler files

Build messages as line arrays:
- Line 1: Action label with sender
- Line 2: Labels (conditional)
- Line 3: Main information (number, title)
- Line 4: Additional context (branches, assets, etc.)
- Line 5: URL (conditional)
- Join with `\n`

### 5. Return Value Structure Pattern
**Source:** `src/lib/handlers/issues.js` (lines 273-290)
**Apply to:** All handler files

Always return consistent structure:
```javascript
{
  processed: boolean,     // true if action was supported
  message: string,        // formatted message or error message
  event: string,          // event type
  data: object           // extracted/cleaned data
}
```

### 6. Utility Export Pattern
**Source:** `src/lib/handlers/issues.js` (lines 293-294)
**Apply to:** handlers that can share utilities

Export reusable utilities:
- `COLOR_EMOJI_MAP` for label color mapping
- `formatLabels()` for label formatting
- Import in other handlers: `import { COLOR_EMOJI_MAP, formatLabels } from './issues.js'`

### 7. Test Structure Pattern
**Source:** `src/lib/__tests__/issues-handler.test.js`
**Apply to:** All test files

Organize tests into describe blocks:
1. Input Validation (null, undefined, missing fields)
2. Supported Actions (each action with variations)
3. Unsupported Actions (return processed: false)
4. Placeholder Handling (missing fields)
5. Label/Color Formatting (if applicable)
6. Return Value Structure (consistent format)
7. Edge Cases (emoji, special characters, etc.)

### 8. Integration Test Pattern
**Source:** `src/lib/__tests__/pull-request-integration.test.js`
**Apply to:** All integration test files

Test real GitHub webhook payloads:
- Router integration (register, route, verify)
- Real GitHub payloads (complete structure)
- End-to-end message verification (line-by-line)
- Log validation (warnings for unsupported actions)

### 9. Logger Pattern
**Source:** `src/lib/handlers/issues.js` (lines 12-16)
**Apply to:** All handler files

Use console-based logger for warnings:
```javascript
const logger = {
  warn: ({ event, action, [contextKey] }, msg) => {
    console.warn(`[handler-name] ${msg}`, { event, action, [contextKey] });
  }
};
```

### 10. JSDoc Documentation Pattern
**Source:** `src/lib/handlers/issues.js` (lines 1-8, 181-212)
**Apply to:** All handler and test files

Include comprehensive JSDoc:
- Module description with supported actions
- Function descriptions with @param tags
- @returns tags describing return structure
- @example tags showing usage
- @throws tags for error conditions

---

## Special Considerations for Phase 6

### Issue Comment Event Specifics

**Context Detection:** Check `payload.issue.pull_request` to distinguish between issue comments and PR comments:
```javascript
const isPr = !!(issue.pull_request);
const contextPrefix = isPr ? 'PR' : 'Issue';
lines.push(`${contextPrefix} #${issueNumber}: ${issueTitle}`);
```

**Comment Body Truncation:** Truncate long comments to prevent message overflow:
```javascript
const preview = commentBody.length > 200
  ? commentBody.substring(0, 200) + '...'
  : commentBody;
lines.push(`"${preview}"`);
```

### Release Event Specifics

**Action Name Validation:** GitHub documentation shows `created` but requirements specify `published`. Test both:
```javascript
const SUPPORTED_ACTIONS = new Set(['published']);  // May need to add 'created'
const ACTION_LABELS = {
  published: '🚀 Release Published',
  created: '🚀 Release Created'  // Fallback
};
```

**Assets Handling:** Check assets array length before including in message:
```javascript
const assetsCount = Array.isArray(release.assets) ? release.assets.length : 0;
if (assetsCount > 0) {
  lines.push(`Assets: ${assetsCount} file(s)`);
}
```

**Tag Name Fallback:** Use tag_name as fallback if name is missing:
```javascript
const releaseName = (typeof release.name === 'string' && release.name.trim())
  ? release.name
  : tagName;
```

---

## No Analog Found

None - all files have exact or near-exact analogs in the codebase.

---

## Metadata

**Analog search scope:**
- `src/lib/handlers/*.js` - Handler implementations
- `src/lib/__tests__/*.test.js` - Test files
- `src/lib/router.js` - Router registration
- `src/index.js` - Handler registration in main app

**Files scanned:** 8 handler/test files
**Pattern extraction date:** 2026-05-12

**Key findings:**
1. Issues handler provides the foundational pattern for all event handlers
2. Pull-request handler demonstrates how to import and reuse utilities
3. Test files follow a consistent structure with comprehensive coverage
4. Integration tests validate end-to-end processing with real payloads
5. All handlers use consistent input validation, action filtering, and return value structures
