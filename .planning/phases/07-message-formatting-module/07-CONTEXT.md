# Phase 7: Message Formatting Module - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

---

## Phase Boundary

集中消息格式化逻辑，确保一致的结构和 URL 处理。创建 `src/lib/formatters/` 目录，将分散在各处理程序中的格式化函数重构为可重用的模块化组件。这是重构阶段，不是添加新功能 —— 所有格式化行为应保持与现有实现一致。

---

## Implementation Decisions

### 模块组织结构
- **D-01:** 按事件类型分组：`formatters/issues.js`、`formatters/pull-request.js`、`formatters/comment.js`、`formatters/release.js`
- **D-02:** 创建 `formatters/common.js` 存放共享工具函数
- **D-03:** 创建 `formatters/index.js` 导出所有格式化函数，便于处理程序导入

### 共享函数范围
- **D-04:** `formatUrl(url)` - URL 助手函数，添加 🔗 emoji
- **D-05:** `formatLabels(labels)` - 标签行生成器（已存在于 issues.js，迁移到 common.js）
- **D-06:** `formatUsername(username)` - 用户名格式化，添加 @ 前缀
- **D-07:** 消息模板构建器 - 定义标准行结构（动作行 + 标签行 + 信息行 + URL 行）

### 动作标签管理
- **D-08:** ACTION_LABELS 分散管理 - 每个事件类型模块保持自己的动作标签映射
- **D-09:** 符合按事件类型分组的组织结构，便于维护单个事件类型的标签

### 重构策略
- **D-10:** 渐进式迁移 - 一个处理程序一个处理程序地迁移
- **D-11:** 迁移顺序：pull-request → issues → comment → release
- **D-12:** 每个处理程序迁移后运行测试验证，确保不破坏现有功能
- **D-13:** 从 PR 开始是因为它复用了 issues 的工具，可以测试模块间导入关系

### 向后兼容
- **D-14:** 保持处理程序导出的函数签名不变
- **D-15:** 消息格式输出保持与现有实现完全一致

### Claude's Discretion
无 - 用户对所有关键领域都提供了明确决策。

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 7 目标、成功标准和计划列表

### Requirements
- `.planning/REQUIREMENTS.md` — FMT-01、FMT-02、FMT-03（消息格式化要求）

### Architecture & Patterns
- `DESIGN.md` — 架构设计和技术栈决策
- `CLAUDE.md` — 实现说明和安全提醒

### Existing Code (Current Formatting Patterns)
- `src/lib/handlers/issues.js` — Issues 处理程序和格式化函数（formatIssueMessage、ACTION_LABELS、COLOR_EMOJI_MAP、formatLabels）
- `src/lib/handlers/pull-request.js` — PR 处理程序和格式化函数（formatPRMessage、ACTION_LABELS、formatBranchInfo、formatMergerInfo）
- `src/lib/handlers/comment.js` — 评论处理程序和格式化函数（formatCommentMessage、ACTION_LABELS）
- `src/lib/handlers/release.js` — 发布处理程序和格式化函数（formatReleaseMessage、ACTION_LABELS）

### Prior Phase Context
- `.planning/phases/04-issues-event-handler/04-CONTEXT.md` — Phase 4 消息格式决策（两行格式、emoji 标签、用户名格式）
- `.planning/phases/05-pull-request-handler/05-CONTEXT.md` — Phase 5 消息格式决策（分支信息、合并者信息、draft 前缀）

### Infrastructure
- `src/lib/handlers/index.js` — 处理程序导出模块
- `src/lib/router.js` — 事件路由系统

---

## Existing Code Insights

### Reusable Assets
- **COLOR_EMOJI_MAP**: 标签颜色到 emoji 的映射（issues.js 中定义，已导出）
- **formatLabels**: 标签格式化函数（issues.js 中定义，已导出）
- **消息行结构模式**: 所有处理程序都遵循相似的行结构（动作行 + 标签行 + 信息行 + URL 行）

### Current Formatting Patterns
所有处理程序遵循一致的消息格式：
1. **Line 1**: 动作标签 + "by @" + sender
2. **Line 2**: 标签行（可选）
3. **Line 3**: 主信息（issue/PR 标题、评论预览、发布名称等）
4. **Line 4+**: 特定信息（分支信息、合并者、资源数量等）
5. **Last line**: 🔗 URL

### Integration Points
- **处理程序导入**: 处理程序需要从 `formatters/index.js` 导入格式化函数
- **测试更新**: 单元测试和集成测试需要更新导入路径

---

## Specific Ideas

### formatters 目录结构
```
src/lib/formatters/
├── index.js           # 导出所有格式化函数
├── common.js          # 共享工具（formatUrl、formatLabels、formatUsername、消息模板构建器）
├── issues.js          # Issue 相关格式化（ISSUE_ACTION_LABELS、formatIssueMessage）
├── pull-request.js    # PR 相关格式化（PR_ACTION_LABELS、formatPRMessage、formatBranchInfo、formatMergerInfo）
├── comment.js         # 评论相关格式化（COMMENT_ACTION_LABELS、formatCommentMessage）
└── release.js         # 发布相关格式化（RELEASE_ACTION_LABELS、formatReleaseMessage）
```

### 共享函数示例
```javascript
// common.js
export function formatUrl(url) {
  return `🔗 ${url}`;
}

export function formatUsername(username) {
  return `@${username}`;
}

export function formatLabels(labels) {
  // 从 issues.js 迁移现有的实现
}
```

### 消息格式保持一致
重构后的消息输出应与现有实现完全一致。例如：

Issue 消息：
```
🔓 Issue Opened by @alice
🔴 bug
#42: Fix login bug
🔗 https://github.com/user/repo/issues/42
```

PR 消息：
```
🟣 PR Merged by @bob
🔴 bugfix
#123: Fix critical memory leak
from: fix/leak → main
merged_by: @alice · abc123f
🔗 https://github.com/user/repo/pull/123
```

---

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 07-message-formatting-module*
*Context gathered: 2026-05-12*
