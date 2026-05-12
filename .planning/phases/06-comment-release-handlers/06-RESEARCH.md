# Phase 6: Comment and Release Event Handlers - Research

**Researched:** 2026-05-12
**Domain:** GitHub Webhook Event Handling (issue_comment, release)
**Confidence:** HIGH

## Summary

Phase 6 需要实现两个新的 GitHub webhook 事件处理器：`issue_comment` 和 `release`。基于对 GitHub 官方文档的研究和现有处理器模式（issues.js 和 pull-request.js），这两个事件的结构清晰且与现有模式高度一致。

**关键发现：**
1. **issue_comment 事件**支持 `created`、`edited`、`deleted` 三个动作，但根据需求 COMM-01，我们只需要处理 `created` 动作
2. **release 事件**文档中显示 `created` 动作，但需求 REL-01 要求处理 `published` 动作 —— 需要在实现时验证 `published` 是否为有效动作
3. 两个事件都包含 `issue`/`release` 对象、`sender` 对象和 `repository` 对象，结构与现有处理器相同
4. issue_comment 事件需要特殊处理：它可以附加到 issue 或 pull request 上，需要通过 `issue.pull_request` 字段区分

**主要建议：**
- 遵循现有的 issues.js 和 pull-request.js 处理器模式
- 为 issue_comment 只支持 `created` 动作（按需求）
- 为 release 支持 `published` 动作（按需求），并测试 `created` 是否也适用
- 复用 COLOR_EMOJI_MAP 和 formatLabels 工具函数（如需要）
- 创建完整的单元测试和集成测试，覆盖输入验证、动作过滤、消息格式化

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| issue_comment 事件处理 | API / Backend | — | 在事件路由层处理 webhook 负载并分派到相应处理器 |
| release 事件处理 | API / Backend | — | 同上，在事件路由层处理并格式化消息 |
| 消息格式化 | API / Backend | — | 与现有处理器一致，在处理器内部完成格式化 |
| 输入验证 | API / Backend | — | 验证 payload 结构和必需字段 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in modules | — | crypto, assert | 项目已使用，无需额外依赖 |
| Node.js test runner | 20+ | 单元测试和集成测试 | 与现有测试框架一致 [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| 无 | — | — | 此阶段不需要额外的库 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| (无替代) | 其他测试框架 (Jest, Mocha) | Node.js 内置测试运行器已足够，引入额外依赖增加复杂度 |

**Installation:**
```bash
# 无需安装新依赖
# 使用现有的 Node.js 内置模块和测试框架
```

**Version verification:**
```bash
node --version  # 应为 v20+ (项目要求)
npm test        # 使用现有的测试脚本
```

## Architecture Patterns

### System Architecture Diagram

```
GitHub Webhook
      ↓
HTTP Server (Fastify)
      ↓
Signature Verifier
      ↓
Event Router (X-GitHub-Event header)
      ↓
      ├─→ issues handler (已实现)
      ├─→ pull_request handler (已实现)
      ├─→ issue_comment handler (本阶段实现)
      └─→ release handler (本阶段实现)
           ↓
      Message Formatter
           ↓
      C4 Communication Bridge (未实现，未来阶段)
```

### Recommended Project Structure
```
src/
├── lib/
│   ├── handlers/
│   │   ├── issues.js              # 已存在
│   │   ├── pull-request.js        # 已存在
│   │   ├── comment.js             # 新增：issue_comment 处理器
│   │   └── release.js             # 新增：release 处理器
│   └── __tests__/
│       ├── issues-handler.test.js              # 已存在
│       ├── issues-integration.test.js          # 已存在
│       ├── pull-request-handler.test.js        # 已存在
│       ├── pull-request-integration.test.js    # 已存在
│       ├── comment-handler.test.js             # 新增：单元测试
│       ├── comment-integration.test.js         # 新增：集成测试
│       ├── release-handler.test.js             # 新增：单元测试
│       └── release-integration.test.js         # 新增：集成测试
```

### Pattern 1: Event Handler Structure (from issues.js, pull-request.js)

**What:** 标准的事件处理器模式，包括：
- 支持/不支持的动作常量 (SUPPORTED_ACTIONS Set)
- 动作标签映射 (ACTION_LABELS 对象)
- 输入验证（payload 结构检查）
- 动作过滤（不支持的动作返回 `processed: false`）
- 消息格式化函数
- 完整的 JSDoc 注释

**When to use:** 所有 GitHub webhook 事件处理器

**Example:**
```javascript
// Source: src/lib/handlers/issues.js (existing pattern)

const SUPPORTED_ACTIONS = new Set(['opened', 'closed', 'reopened', 'deleted']);

const ACTION_LABELS = {
  opened: '🔓 Issue Opened',
  closed: '🔒 Issue Closed',
  reopened: '♻️ Issue Reopened',
  deleted: '🗑️ Issue Deleted'
};

export async function handleIssues(payload) {
  // Input validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  // Validate action field
  if (!payload.action || typeof payload.action !== 'string') {
    throw new Error('Invalid payload: missing or invalid action field');
  }

  // Validate issue object
  if (!payload.issue || typeof payload.issue !== 'object') {
    throw new Error('Invalid payload: missing or invalid issue object');
  }

  const { action, issue, sender } = payload;

  // Check if action is supported
  if (!SUPPORTED_ACTIONS.has(action)) {
    return {
      processed: false,
      message: `Unsupported issues action: ${action}`,
      event: 'issues',
      data: { action, issueNumber: issue?.number, title: issue?.title }
    };
  }

  // Extract data with placeholders
  const title = (typeof issue.title === 'string' && issue.title.trim())
    ? issue.title
    : '[No title]';
  // ... more extraction

  // Format message
  const message = formatIssueMessage({ /* extracted data */ });

  return { processed: true, message, event: 'issues', data: { /* ... */ } };
}
```

### Pattern 2: Message Formatting

**What:** 多行消息格式，包含：
- 动作标签和发送者
- 标签信息（如有）
- 主要信息（标题、编号）
- URL 链接

**When to use:** 所有事件通知消息

**Example:**
```javascript
// Source: src/lib/handlers/issues.js

function formatIssueMessage(issueData) {
  const { action, title, number, sender, htmlUrl, labels } = issueData;
  const actionLabel = ACTION_LABELS[action] || `Issue ${action}`;

  const lines = [];
  lines.push(`${actionLabel} by @${sender}`);
  
  if (action !== 'deleted') {
    const labelLine = formatLabels(labels);
    if (labelLine) lines.push(labelLine);
  }
  
  lines.push(`#${number}: ${title}`);
  
  if (number !== null && htmlUrl) {
    lines.push(`🔗 ${htmlUrl}`);
  }

  return lines.join('\n');
}
```

### Pattern 3: Utility Function Reuse

**What:** 复用现有的工具函数，避免重复代码

**When to use:** 当新处理器需要相同功能时

**Example:**
```javascript
// Source: src/lib/handlers/issues.js

// Export reusable utilities
export { COLOR_EMOJI_MAP, formatLabels };

// In comment.js or release.js:
import { COLOR_EMOJI_MAP, formatLabels } from './issues.js';
```

### Anti-Patterns to Avoid
- **硬编码动作标签:** 使用 ACTION_LABELS 对象而非 if/else 链
- **跳过输入验证:** 始终验证 payload 结构和必需字段
- **不处理缺失字段:** 使用占位符（如 '[No title]'）而非直接使用 undefined/null
- **重复代码:** 复用现有工具函数而非重新实现

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 输入验证逻辑 | 自定义验证函数 | 使用现有的模式（issues.js） | 已验证的模式，一致的错误处理 |
| 动作过滤 | 自定义过滤逻辑 | 使用 Set 和 has() 方法 | O(1) 查找，代码清晰 |
| 消息格式化 | 复杂的模板系统 | 简单的字符串拼接和数组 | 项目规模不需要，现有模式已足够 |
| 测试工具 | 自定义测试辅助函数 | 复用现有测试模式（如有） | 一致性，减少维护成本 |

**Key insight:** 项目已有成熟的处理器模式，新处理器应严格遵循这些模式，而非引入新的抽象或依赖。

## Common Pitfalls

### Pitfall 1: issue_comment 事件的上下文混淆
**What goes wrong:** issue_comment 事件可以附加到 issue 或 pull request 上，如果不区分会导致错误的上下文信息
**Why it happens:** issue_comment payload 中的 `issue` 对象在 PR 评论时实际上包含 PR 信息，需要通过 `issue.pull_request` 字段判断
**How to avoid:** 检查 `payload.issue.pull_request` 是否存在，如果存在则为 PR 评论，否则为 issue 评论
**Warning signs:** 消息中显示 "Issue #123" 但实际是 PR 评论

### Pitfall 2: release 事件的动作名称不匹配
**What goes wrong:** 需求要求处理 `published` 动作，但 GitHub 文档显示示例为 `created`
**Why it happens:** GitHub 可能在不同版本中更改了动作名称，或者 `published` 是更具体的动作
**How to avoid:** 在实现时先测试 `published` 是否有效，如果无效则回退到 `created`，或支持两者
**Warning signs:** 所有 release 事件都被标记为 "Unsupported action"

### Pitfall 3: 评论正文过长导致消息过长
**What goes wrong:** 评论正文可能很长，直接包含在通知消息中会导致可读性问题
**Why it happens:** 需求 COMM-02 要求包含"正文预览"，但没有明确长度限制
**How to avoid:** 截断评论正文至合理长度（如 200 字符），添加 "..." 后缀
**Warning signs:** 通知消息包含整篇长文，影响阅读体验

### Pitfall 4: release 资源信息缺失
**What goes wrong:** release payload 中的 `assets` 数组可能为空，导致没有资源信息
**Why it happens:** 不是所有 release 都包含附件资源
**How to avoid:** 检查 `assets.length`，如果为 0 则跳过资源信息或显示 "No assets"
**Warning signs:** 消息中显示 "Assets: undefined" 或类似错误

### Pitfall 5: 不一致的占位符处理
**What goes wrong:** 某些字段使用 '[No title]'，其他使用 'unknown' 或 'N/A'
**Why it happens:** 不同处理器使用不同的占位符风格
**How to avoid:** 遵循现有模式：标题类字段用 '[No title]'，用户名用 'unknown'
**Warning signs:** 消息中出现多种风格的占位符

## Code Examples

### issue_comment Payload Structure
```javascript
// Source: [CITED: https://docs.github.com/en/webhooks/webhook-events-and-payloads#issue_comment]

{
  "action": "created",
  "comment": {
    "id": 123456789,
    "node_id": "MDI0Ok1vcmlzU3RhdGVNZW50SXNzdWUiMTIzNDU2Nzg5",
    "user": {
      "login": "octocat",
      "id": 1,
      // ...
    },
    "body": "This is a comment",
    "created_at": "2026-05-12T00:00:00Z",
    "updated_at": "2026-05-12T00:00:00Z",
    "html_url": "https://github.com/user/repo/issues/42#issuecomment-123456789",
    // ...
  },
  "issue": {
    "id": 123456,
    "number": 42,
    "title": "Issue title",
    "html_url": "https://github.com/user/repo/issues/42",
    "pull_request": null,  // 如果是 PR 评论，此字段包含 PR 信息
    // ...
  },
  "repository": {
    "id": 1296269,
    "name": "repo",
    "full_name": "user/repo",
    // ...
  },
  "sender": {
    "login": "octocat",
    "id": 1
  }
}
```

### release Payload Structure
```javascript
// Source: [CITED: https://docs.github.com/en/webhooks/webhook-events-and-payloads#release]

{
  "action": "created",  // 或可能是 "published"
  "release": {
    "id": 12345678,
    "tag_name": "v1.0.0",
    "name": "Release v1.0.0",
    "body": "Release notes here",
    "draft": false,
    "prerelease": false,
    "created_at": "2026-05-12T00:00:00Z",
    "published_at": "2026-05-12T00:00:00Z",
    "author": {
      "login": "octocat",
      "id": 1
    },
    "html_url": "https://github.com/user/repo/releases/tag/v1.0.0",
    "assets": [
      {
        "id": 123,
        "name": "example.tar.gz",
        "size": 5678,
        "download_count": 42,
        "browser_download_url": "https://github.com/user/repo/releases/download/v1.0.0/example.tar.gz"
      }
    ],
    // ...
  },
  "repository": {
    "id": 1296269,
    "name": "repo",
    "full_name": "user/repo",
    // ...
  },
  "sender": {
    "login": "octocat",
    "id": 1
  }
}
```

### Handler Skeleton (comment.js)
```javascript
/**
 * Issue Comment Event Handler
 *
 * Processes GitHub issue_comment webhook events and formats them into readable messages.
 * Supports created action (per requirement COMM-01).
 *
 * @module handlers/comment
 */

const SUPPORTED_ACTIONS = new Set(['created']);

const ACTION_LABELS = {
  created: '💬 Comment Created'
};

function formatCommentMessage(commentData) {
  const { action, sender, issueTitle, issueNumber, commentBody, commentUrl, isPr } = commentData;
  const actionLabel = ACTION_LABELS[action] || `Comment ${action}`;

  const lines = [];
  lines.push(`${actionLabel} by @${sender}`);
  
  const contextPrefix = isPr ? 'PR' : 'Issue';
  lines.push(`${contextPrefix} #${issueNumber}: ${issueTitle}`);
  
  // Truncate comment body to 200 characters
  const preview = commentBody.length > 200 
    ? commentBody.substring(0, 200) + '...'
    : commentBody;
  lines.push(`"${preview}"`);
  
  lines.push(`🔗 ${commentUrl}`);

  return lines.join('\n');
}

export async function handleIssueComment(payload) {
  // Input validation (following issues.js pattern)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  if (!payload.action || typeof payload.action !== 'string') {
    throw new Error('Invalid payload: missing or invalid action field');
  }

  if (!payload.comment || typeof payload.comment !== 'object') {
    throw new Error('Invalid payload: missing or invalid comment object');
  }

  if (!payload.issue || typeof payload.issue !== 'object') {
    throw new Error('Invalid payload: missing or invalid issue object');
  }

  const { action, comment, issue, sender } = payload;

  // Check if action is supported
  if (!SUPPORTED_ACTIONS.has(action)) {
    return {
      processed: false,
      message: `Unsupported issue_comment action: ${action}`,
      event: 'issue_comment',
      data: { action, issueNumber: issue?.number }
    };
  }

  // Extract data with placeholders
  const commentBody = (typeof comment.body === 'string' && comment.body.trim())
    ? comment.body
    : '[No comment]';
  const issueTitle = (typeof issue.title === 'string' && issue.title.trim())
    ? issue.title
    : '[No title]';
  const issueNumber = issue.number ?? null;
  const commentUrl = comment.html_url ?? null;
  const senderLogin = sender?.login ?? 'unknown';
  const isPr = !!(issue.pull_request);

  const commentData = {
    action,
    sender: senderLogin,
    issueTitle,
    issueNumber,
    commentBody,
    commentUrl,
    isPr
  };

  const message = formatCommentMessage(commentData);

  return {
    processed: true,
    message,
    event: 'issue_comment',
    data: {
      action,
      issueNumber,
      issueTitle,
      commentAuthor: senderLogin,
      isPr
    }
  };
}
```

### Handler Skeleton (release.js)
```javascript
/**
 * Release Event Handler
 *
 * Processes GitHub release webhook events and formats them into readable messages.
 * Supports published action (per requirement REL-01).
 *
 * @module handlers/release
 */

const SUPPORTED_ACTIONS = new Set(['published']);  // May need to add 'created'

const ACTION_LABELS = {
  published: '🚀 Release Published',
  created: '🚀 Release Created'  // Fallback
};

function formatReleaseMessage(releaseData) {
  const { action, tagName, releaseName, author, assetsCount, releaseUrl } = releaseData;
  const actionLabel = ACTION_LABELS[action] || `Release ${action}`;

  const lines = [];
  lines.push(`${actionLabel} by @${author}`);
  lines.push(`${releaseName} (${tagName})`);
  
  if (assetsCount > 0) {
    lines.push(`Assets: ${assetsCount} file(s)`);
  }
  
  lines.push(`🔗 ${releaseUrl}`);

  return lines.join('\n');
}

export async function handleRelease(payload) {
  // Input validation (following issues.js pattern)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  if (!payload.action || typeof payload.action !== 'string') {
    throw new Error('Invalid payload: missing or invalid action field');
  }

  if (!payload.release || typeof payload.release !== 'object') {
    throw new Error('Invalid payload: missing or invalid release object');
  }

  const { action, release, sender } = payload;

  // Check if action is supported
  if (!SUPPORTED_ACTIONS.has(action)) {
    return {
      processed: false,
      message: `Unsupported release action: ${action}`,
      event: 'release',
      data: { action, tagName: release?.tag_name }
    };
  }

  // Extract data with placeholders
  const tagName = (typeof release.tag_name === 'string' && release.tag_name.trim())
    ? release.tag_name
    : '[No tag]';
  const releaseName = (typeof release.name === 'string' && release.name.trim())
    ? release.name
    : tagName;
  const releaseUrl = release.html_url ?? null;
  const senderLogin = sender?.login ?? 'unknown';
  const assetsCount = Array.isArray(release.assets) ? release.assets.length : 0;

  const releaseData = {
    action,
    tagName,
    releaseName,
    author: senderLogin,
    assetsCount,
    releaseUrl
  };

  const message = formatReleaseMessage(releaseData);

  return {
    processed: true,
    message,
    event: 'release',
    data: {
      action,
      tagName,
      releaseName,
      author: senderLogin,
      assetsCount
    }
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 手动验证所有字段 | 结构化输入验证模式 | Phase 4 (issues.js) | 一致性和可维护性提升 |
| 每个处理器独立实现工具函数 | 导出和复用工具函数 | Phase 4 (issues.js) | 减少代码重复 |

**Deprecated/outdated:**
- 跳过输入验证的做法（不再接受）
- 每个处理器重新实现相同功能（不再接受）

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | release 事件的 `published` 动作存在且有效 | Standard Stack | 如果 `published` 不存在，需要回退到 `created` 或其他动作 |
| A2 | issue_comment 事件的 `issue.pull_request` 字段可用于区分 PR 评论 | Common Pitfalls | 如果此字段不存在或不可靠，PR 评论可能被错误标记 |
| A3 | 评论正文截断至 200 字符是合理的 | Code Examples | 如果用户需要完整评论，这个假设可能导致信息丢失 |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions (RESOLVED)

1. **release 事件的有效动作名称**
   - What we know: GitHub 文档示例使用 `created`，但需求要求 `published`
   - What's unclear: `published` 是否为实际动作名称，还是仅为文档描述
   - Recommendation: 在实现时测试 `published`，如果无效则支持 `created`，或记录实际动作名称
   - **RESOLVED:** 实现 `published` 作为主要支持的动作，添加 `created` 作为后备支持。如果 GitHub 实际使用不同的动作名称，可以在测试时验证并调整。

2. **评论正文的最佳截断长度**
   - What we know: 需求要求"正文预览"，但无具体长度限制
   - What's unclear: 200 字符是否适合所有场景
   - Recommendation: 先使用 200 字符，根据实际使用反馈调整，或考虑可配置
   - **RESOLVED:** 使用 200 字符作为截断长度。这是合理的平衡点，提供足够的上下文同时保持消息简洁。如有需要，可在未来版本中将其设为可配置。

## Environment Availability

**Step 2.6: SKIPPED (no external dependencies identified)**

本阶段仅需要 Node.js 内置模块和现有测试框架，无需外部工具、服务或运行时。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner |
| Config file | package.json (test scripts) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMM-01 | 处理 issue_comment created 动作 | unit | `npm test -- src/lib/__tests__/comment-handler.test.js` | ❌ Wave 0 |
| COMM-02 | 评论通知包含作者、上下文、正文预览 | unit | `npm test -- src/lib/__tests__/comment-handler.test.js` | ❌ Wave 0 |
| REL-01 | 处理 release published 动作 | unit | `npm test -- src/lib/__tests__/release-handler.test.js` | ❌ Wave 0 |
| REL-02 | 发布通知包含标签、名称、作者、资源 | unit | `npm test -- src/lib/__tests__/release-handler.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- <new-test-file>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/comment-handler.test.js` — 覆盖 COMM-01, COMM-02
- [ ] `src/lib/__tests__/comment-integration.test.js` — 集成测试
- [ ] `src/lib/__tests__/release-handler.test.js` — 覆盖 REL-01, REL-02
- [ ] `src/lib/__tests__/release-integration.test.js` — 集成测试

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | 输入验证（payload 结构检查）已在处理器模式中实现 |
| V6 Cryptography | no | 本阶段不涉及加密操作 |

### Known Threat Patterns for GitHub Webhook Handlers

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 注入攻击（评论/发布正文） | Tampering | 不执行评论/发布正文，仅作为字符串处理；在消息格式化时转义特殊字符（如需要） |
| XSS（通过消息内容） | Tampering | C4 通信桥应正确转义 HTML 特殊字符；本阶段仅格式化消息，不负责最终显示 |
| 拒绝服务（超长消息） | Denial of Service | 截断评论正文至 200 字符，防止消息过长 |

## Sources

### Primary (HIGH confidence)
- [GitHub Webhook Events and Payloads - Official Documentation](https://docs.github.com/en/webhooks/webhook-events-and-payloads) - 完整的事件类型和负载结构
- [issue_comment Event Documentation](https://docs.github.com/en/webhooks/webhook-events-and-payloads#issue_comment) - issue_comment 事件详细结构 [CITED]
- [release Event Documentation](https://docs.github.com/en/webhooks/webhook-events-and-payloads#release) - release 事件详细结构 [CITED]
- [src/lib/handlers/issues.js](file:///Users/summingyu/work/zylos-github-connector/src/lib/handlers/issues.js) - 现有处理器模式参考 [VERIFIED: codebase]
- [src/lib/handlers/pull-request.js](file:///Users/summingyu/work/zylos-github-connector/src/lib/handlers/pull-request.js) - 现有处理器模式参考 [VERIFIED: codebase]
- [package.json](file:///Users/summingyu/work/zylos-github-connector/package.json) - 测试框架配置 [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- (无) - 本研究主要依赖官方文档和代码库现有模式

### Tertiary (LOW confidence)
- (无) - 所有关键信息均来自 HIGH 或 MEDIUM 信源

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 基于 Node.js 内置模块和现有项目配置
- Architecture: HIGH - 基于现有处理器模式（issues.js, pull-request.js）和 GitHub 官方文档
- Pitfalls: MEDIUM - 某些假设（如 release 事件的 `published` 动作）需要实现时验证

**Research date:** 2026-05-12
**Valid until:** 30 days (GitHub webhook 事件结构相对稳定，但动作名称可能需要验证)
