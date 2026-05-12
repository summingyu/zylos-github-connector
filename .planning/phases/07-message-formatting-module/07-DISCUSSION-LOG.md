# Phase 7: Message Formatting Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 07-message-formatting-module
**Areas discussed:** 模块组织结构, 共享函数范围, 动作标签管理, 重构策略

---

## 模块组织结构

| Option | Description | Selected |
|--------|-------------|----------|
| 单文件 (formatters.js) | 单个 formatters.js 文件，包含所有格式化函数和工具。简单直接，易于导入，但文件可能变大。 | |
| 多文件模块化 | 多文件：formatters/actions.js (动作标签), formatters/url.js (URL), formatters/labels.js (标签)。更模块化，职责分离，但导入路径更复杂。 | |
| 按事件类型分组 | 按事件类型分组：formatters/issues.js, formatters/pr.js, formatters/comment.js, formatters/release.js。保持每个事件的格式化逻辑独立，但共享通用工具。 | ✓ |

**User's choice:** 按事件类型分组
**Notes:** 符合现有处理程序的分离结构，便于维护单个事件类型的格式化逻辑。

---

## 共享函数范围

| Option | Description | Selected |
|--------|-------------|----------|
| URL 助手函数 | 通用的 URL 格式化函数，添加 🔗 emoji。所有事件都用 '🔗 ' + url 的模式。 | ✓ |
| 标签行生成器 | 通用的标签行格式化，用于多个处理程序。formatLabels 已经在做这个，是否需要增强？ | ✓ |
| 用户名格式化 | 通用的用户名格式化，添加 @ 前缀。现在是内联在消息中，是否需要独立函数？ | ✓ |
| 消息模板构建器 | 消息模板系统，定义行结构（动作行 + 标签行 + 信息行 + URL 行）。便于未来扩展新事件类型。 | ✓ |

**User's choice:** 全部选择
**Notes:** 用户希望将所有共享的格式化功能都集中到 common.js 中，包括 URL 助手、标签行生成器、用户名格式化和消息模板构建器。

---

## 动作标签管理

| Option | Description | Selected |
|--------|-------------|----------|
| 统一集中管理 | 在 formatters/common.js 中创建统一的所有事件的 ACTION_LABELS 映射。便于查看所有动作，但文件会变大。 | |
| 分散在各模块 | 每个事件类型保持自己的 ACTION_LABELS（issues.js, pull-request.js 等）。符合按事件类型分组的组织结构，便于维护。 | ✓ |
| Emoji 映射 + 文本分离 | 在 common.js 中定义通用的 emoji（🔓=opened, 🔒=closed），各模块组合使用。如 '🔓 ' + 'Issue Opened'。 | |

**User's choice:** 分散在各模块
**Notes:** 符合按事件类型分组的组织结构决策。每个事件类型的 ACTION_LABELS 与其格式化逻辑紧密相关，分散管理便于维护。

---

## 重构策略

| Option | Description | Selected |
|--------|-------------|----------|
| 一次性全部迁移 | 一次性将所有处理程序迁移到新的 formatters 模块。快速完成，但风险较高，如果出现问题需要全部回滚。 | |
| 渐进式迁移 | 一个处理程序一个处理程序地迁移（issues → pull-request → comment → release）。每个处理程序迁移后验证测试通过。更安全，但需要更多时间。 | ✓ |
| 并行过渡期 | 创建新的 formatters 模块，但保持处理程序中的旧函数作为适配器。逐步切换，确保随时可以回退。最安全，但有代码重复。 | |

**User's choice:** 渐进式迁移
**Follow-up:** 迁移顺序为 PR → issues → comment → release
**Notes:** 从 PR 开始是因为它复用了 issues 的工具，可以测试模块间的导入关系。

---

## Claude's Discretion

无 - 用户对所有关键领域都提供了明确决策。

## Deferred Ideas

None — discussion stayed within phase scope.
