---
phase: 07-message-formatting
plan: 02
type: gap-closure
wave: 1
subsystem: Message Formatting
tags: [code-review, input-validation, error-handling]
title: "修复代码审查发现的输入验证和错误处理问题"
one_liner: "修复代码审查中发现的 2 个 Critical 和 5 个 Warning 级别问题"
punchline: "从脆弱到健壮 - 输入验证的强化之路"
derived_from:
  - .planning/phases/07-message-formatting/07-REVIEW.md
---

# Phase 07 Plan 02: Code Review Gap Closure

## Overview

**目标：** 修复代码审查（07-REVIEW.md）中发现的输入验证和错误处理问题。

**来源：** 基于代码审查报告，关闭 2 个 Critical 和 5 个 Warning 级别问题。

**范围：** 仅修复 formaters 模块和 handlers 模块中的输入验证和错误处理问题。

## 问题摘要

| ID | 文件 | 问题 | 级别 | 影响 |
|----|------|------|------|------|
| CR-01 | base.js | 缺少对 sender/actionLabel 参数的验证 | Critical | 生成 "by @undefined" 无效消息 |
| CR-02 | labels.js | label 对象结构验证不完整 | Critical | 非字符串 name/color 生成无意义标签 |
| WR-01 | actions.js | getActionLabel 返回值不一致 | Warning | 降低代码可维护性 |
| WR-02 | urls.js | formatGithubUrl 对 type 参数缺少验证 | Warning | 静默失败难以调试 |
| WR-03 | comment.js | 缺少对 issueNumber 的空值检查 | Warning | 生成 "Issue #null" 无效消息 |
| WR-04 | release.js | assetsCount 类型假设不安全 | Warning | 意外结果 |
| WR-05 | pull-request.js | SHA 截取缺少边界检查 | Warning | TypeError 崩溃 |

## 任务分解

### Task 1: 修复 base.js 中的参数验证（CR-01）

**文件：** `src/lib/formatters/base.js`

**问题：** `buildBaseMessage` 函数没有验证 `sender` 和 `actionLabel` 参数。

**修复：** 在函数开始处添加参数验证。

```javascript
export function buildBaseMessage(sender, actionLabel) {
  if (!sender || typeof sender !== 'string') {
    throw new Error('Invalid sender: expected non-empty string');
  }
  if (!actionLabel || typeof actionLabel !== 'string') {
    throw new Error('Invalid actionLabel: expected non-empty string');
  }
  const lines = [];
  lines.push(`${actionLabel} by @${sender}`);
  return { lines };
}
```

**测试：** 验证传入 null/undefined/非字符串参数时抛出错误。

---

### Task 2: 修复 labels.js 中的对象结构验证（CR-02）

**文件：** `src/lib/formatters/labels.js`

**问题：** `formatLabels` 函数允许 `label.name` 和 `label.color` 为非字符串类型。

**修复：** 添加类型检查。

```javascript
export function formatLabels(labels) {
  if (!Array.isArray(labels) || labels.length === 0) {
    return '';
  }

  return labels.map(label => {
    if (!label || typeof label !== 'object') {
      return '⚫ unknown';
    }
    const emoji = getEmojiForColor(label?.color);
    const name = (label?.name && typeof label.name === 'string') ? label.name : 'unknown';
    return `${emoji} ${name}`;
  }).join(' ');
}
```

**测试：** 验证传入非字符串 name/color 时使用默认值。

---

### Task 3: 统一 actions.js 中的返回值格式（WR-01）

**文件：** `src/lib/formatters/actions.js`

**问题：** `getActionLabel` 在参数为空时返回 "Unknown Action"（首字母大写，无 emoji），在其他未知情况返回 "unknown unknown"（小写，无 emoji）。

**修复：** 统一为 emoji + 文本格式。

```javascript
export function getActionLabel(eventType, action) {
  if (!eventType || !action) {
    return '❓ Unknown Action';
  }

  const eventActions = ACTION_LABELS[eventType];

  if (!eventActions) {
    return `❓ ${eventType} ${action}`;
  }

  const label = eventActions[action];

  if (!label) {
    return `❓ ${eventType} ${action}`;
  }

  return label;
}
```

**测试：** 验证所有未知情况都返回带 emoji 的格式。

---

### Task 4: 添加 urls.js 中的 type 参数验证（WR-02）

**文件：** `src/lib/formatters/urls.js`

**问题：** `formatGithubUrl` 接受任意 `type` 值，静默返回 null。

**修复：** 添加支持的类型检查和警告。

```javascript
export function formatGithubUrl(owner, repo, type, number) {
  if (!owner || !repo || typeof owner !== 'string' || typeof repo !== 'string') {
    return null;
  }

  const SUPPORTED_TYPES = new Set(['issues', 'pull', 'repo']);
  if (!SUPPORTED_TYPES.has(type)) {
    console.warn(`[formatGithubUrl] Unsupported type: ${type}`);
    return null;
  }

  const baseUrl = `https://github.com/${owner}/${repo}`;

  if (type === 'issues' && number != null) {
    return `${baseUrl}/issues/${number}`;
  }

  if (type === 'pull' && number != null) {
    return `${baseUrl}/pull/${number}`;
  }

  if (type === 'repo') {
    return baseUrl;
  }

  return null;
}
```

**测试：** 验证传入不支持的 type 时记录警告并返回 null。

---

### Task 5: 添加 comment.js 中的 issueNumber 验证（WR-03）

**文件：** `src/lib/handlers/comment.js`

**问题：** `formatCommentMessage` 函数使用 `issueNumber` 构建消息，但如果传入 null，会生成 "Issue #null" 的无效消息。

**修复：** 在函数开始处添加验证。

```javascript
function formatCommentMessage(action, sender, issueTitle, issueNumber, commentBody, commentUrl, isPr) {
  if (issueNumber == null || typeof issueNumber !== 'number') {
    throw new Error('Invalid issueNumber: expected non-null number');
  }
  // ... rest of function
}
```

**测试：** 验证传入 null/非数字 issueNumber 时抛出错误。

---

### Task 6: 改进 release.js 中的 assetsCount 验证（WR-04）

**文件：** `src/lib/handlers/release.js`

**问题：** 使用 `Array.isArray(release.assets) ? release.assets.length : 0`，但没有验证数组元素是否为有效对象。

**修复：** 添加数组元素验证。

```javascript
const assetsCount = (Array.isArray(release.assets) && release.assets.every(a => a && typeof a === 'object'))
  ? release.assets.length
  : 0;
```

**测试：** 验证传入损坏的 assets 数组时返回 0。

---

### Task 7: 添加 pull-request.js 中的 SHA 边界检查（WR-05）

**文件：** `src/lib/handlers/pull-request.js`

**问题：** `formatMergerInfo` 函数检查 `sha.length >= 7`，但没有验证 sha 是否为字符串。

**修复：** 添加字符串类型检查。

```javascript
function formatMergerInfo(prData) {
  if (!prData.merged_by?.login || !prData.merge_commit_sha) {
    return null;
  }

  const merger = prData.merged_by.login;
  const sha = prData.merge_commit_sha;

  if (typeof sha !== 'string' || sha.length === 0) {
    return null;
  }

  const shortSha = sha.length >= 7 ? sha.substring(0, 7) : sha;
  return `merged_by: @${merger} · ${shortSha}`;
}
```

**测试：** 验证传入 null/非字符串 sha 时返回 null。

---

### Task 8: 改进 base.js 中的错误消息（IN-02）

**文件：** `src/lib/formatters/base.js`

**问题：** 三个函数都抛出相同的错误消息，使得调试时难以确定哪个函数失败了。

**修复：** 使用更具体的错误消息。

```javascript
// In addLine
throw new Error('Invalid builder in addLine: expected object with lines array');

// In addUrl
throw new Error('Invalid builder in addUrl: expected object with lines array');

// In finalize
throw new Error('Invalid builder in finalize: expected object with lines array');
```

**测试：** 验证错误消息明确指示失败的函数。

---

### Task 9: 运行完整测试套件验证修复

**目标：** 确保所有修复不会破坏现有功能。

**命令：**
```bash
npm test
```

**验证点：**
- 所有现有测试通过
- 新的边界情况处理正确
- 错误消息清晰有用

---

## 执行顺序

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9
```

所有任务可以顺序执行，因为每个任务修改不同的文件。

## 依赖关系

**无内部依赖：** 每个任务修改不同的文件，可以独立执行。

**外部依赖：** 无

## 成功标准

### Critical Issues（必须修复）

- ✅ CR-01: buildBaseMessage 验证 sender 和 actionLabel 参数
- ✅ CR-02: formatLabels 验证 label.name 和 label.color 类型

### Warning Issues（应该修复）

- ✅ WR-01: getActionLabel 返回值格式一致
- ✅ WR-02: formatGithubUrl 验证 type 参数
- ✅ WR-03: formatCommentMessage 验证 issueNumber
- ✅ WR-04: formatReleaseMessage 改进 assetsCount 验证
- ✅ WR-05: formatMergerInfo 验证 sha 类型

### Info Issues（可选改进）

- IN-01: Console logger 问题（已在注释中说明，v1 可接受）
- IN-02: 错误消息改进（已包含在 Task 8）
- IN-03: COLOR_EMOJI_MAP 改进（v1 不需要）

### 测试验证

- ✅ 所有现有测试通过（510 个测试）
- ✅ 新的输入验证逻辑正确处理边界情况
- ✅ 错误消息清晰明确

## 威胁模型

### 新增威胁

无新增威胁。所有修复都是增强输入验证，不会引入新的安全漏洞。

### 现有威胁状态

| ID | 威胁 | 状态 |
|----|------|------|
| T-07-01 | 动作标签篡改 | ✅ 已缓解 |
| T-07-02 | 信息泄露（URL） | ✅ 已缓解 |
| T-07-03 | 拒绝服务（标签） | ✅ 已缓解 |
| T-07-04 | 消息构建器篡改 | ✅ 已缓解 |
| T-07-05 | 信息泄露（所有格式化函数） | ✅ 已缓解 |

## 回滚计划

如果修复导致问题：

1. 每个任务都是独立的原子提交
2. 可以单独回滚任何有问题的修复
3. 回滚后系统恢复到修复前的状态

## 完成后活动

1. 更新 07-REVIEW.md 状态为 "issues_resolved"
2. 创建 07-02-SUMMARY.md 记录修复详情
3. 更新 07-01-VERIFICATION.md 的 gaps 数组为空

## 指标

**修复计数：**
- Critical: 2
- Warning: 5
- Info: 1
- **总计: 8**

**预期时间：** 15 分钟

**文件修改：**
- base.js: 2 处修改
- labels.js: 1 处修改
- actions.js: 1 处修改
- urls.js: 1 处修改
- comment.js: 1 处修改
- release.js: 1 处修改
- pull-request.js: 1 处修改

---

**创建日期：** 2026-05-12
**来源：** 代码审查报告（07-REVIEW.md）
**状态：** 准备执行
