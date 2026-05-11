# Phase 4: Issues Event Handler - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 04-issues-event-handler
**Areas discussed:** 消息格式风格, 动作过滤策略, 动作标签格式, 错误处理方式

---

## 消息格式风格

| Option | Description | Selected |
|--------|-------------|----------|
| 简洁一行 | 「Issue #42 opened by user: Fix login bug」— 适合快速浏览 | |
| 标准两行 | 「Issue opened by @user\n#42: Fix login bug\n🔗 https://...」 | ✓ |
| 详细多行 | 包含动作、作者、标题、编号、URL、标签、里程碑等 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 不包含 | 保持简洁，Phase 4 只关注核心字段 | |
| 包含名称 | 显示标签名称，如「[bug] [high-priority]」 | |
| 包含名称和颜色 | 如「🔴 bug 🔴 high-priority」 | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| 用户名 | 如「@alice」 | ✓ |
| 全名 | 如「Alice Chen」 | |
| 两者 | 如「Alice Chen (@alice)」 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 完整显示 | 不管多长都完整显示标题 | |
| 智能截断 | 超过 80 字符截断并添加「...」 | |
| 自动换行 | 保留完整标题，依赖显示端自动换行 | ✓ |

**User's choice:** 标准两行，包含名称和颜色，用户名，自动换行
**Notes:** 无额外说明

---

## 动作过滤策略

| Option | Description | Selected |
|--------|-------------|----------|
| 静默忽略 | 不记录任何日志，直接返回 {processed: false} | |
| 记录警告 | 用 app.log.warn 记录未支持的动作，然后返回 | ✓ |
| 处理但简化 | 所有动作都生成通知，非核心动作使用简化格式 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 与 opened/closed 一致 | 生成「Issue deleted by @user」通知 | |
| 特殊处理 | 生成不同的通知格式，如「⚠️ Issue deleted by @user」 | ✓ |
| 静默忽略 | 已删除的 issue 可能没有完整信息，跳过处理 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 抛出错误 | throw new Error('Missing action field') | ✓ |
| 记录并返回 | 记录错误日志，返回 {processed: false, reason: 'missing_action'} | |

| Option | Description | Selected |
|--------|-------------|----------|
| 是 | 使用 switch/if-else 结构便于添加新动作 | ✓ |
| 否 | 只实现 opened/closed/reopened，保持简单 | |

**User's choice:** 记录警告，特殊处理，抛出错误，是（预留扩展空间）
**Notes:** 无额外说明

---

## 动作标签格式

| Option | Description | Selected |
|--------|-------------|----------|
| 纯文字 | 「Issue opened」「Issue closed」「Issue reopened」 | |
| Emoji + 文字 | 「🔓 Issue opened」「🔒 Issue closed」「♻️ Issue reopened」 | ✓ |
| Emoji 替代 | 完全用 emoji 表示：🔓🔒♻️ | |

| Option | Description | Selected |
|--------|-------------|----------|
| ⚠️ 警告风格 | 「⚠️ Issue deleted」— 突出这是破坏性动作 | |
| 🗑️ 删除风格 | 「🗑️ Issue deleted」 | ✓ |
| 📕 禁用风格 | 「📕 Issue deleted」 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 开头 | 如「🔓 Issue opened by @user」 | ✓ |
| 结尾 | 如「Issue opened by @user 🔓」 | |
| 嵌入 | 如「Issue was opened by @user」 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 大写 | 「OPENED」「CLOSED」「REOPENED」 | |
| 小写 | 「opened」「closed」「reopened」 | |
| 标题大小写 | 「Opened」「Closed」「Reopened」 | ✓ |

**User's choice:** Emoji + 文字，🗑️ 删除风格，开头，标题大小写
**Notes:** 无额外说明

---

## 错误处理方式

| Option | Description | Selected |
|--------|-------------|----------|
| 抛出错误 | throw new Error('Missing issue data') | ✓ |
| 优雅降级 | 使用默认值，如「Unknown issue」 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 使用占位符 | 显示「[No title]」或「Untitled」 | ✓ |
| 使用编号 | 显示「Issue #42」（只要有编号） | |
| 抛出错误 | 认为这是无效数据 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 跳过 URL | 生成通知但不包含可点击的 URL | ✓ |
| 使用搜索 URL | 使用 issues?q=xxx 搜索 URL 作为替代 | |
| 抛出错误 | 编号是必需字段 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 使用占位符 | 显示「Unknown user」或「@unknown」 | ✓ |
| 省略发送者 | 消息格式变为「🔓 Issue Opened: Fix bug」 | |
| 抛出错误 | 认为这是无效数据 | |

**User's choice:** payload.issue=null 时抛出错误，title=null 时使用占位符，number=null 时跳过 URL，sender=null 时使用占位符
**Notes:** 无额外说明

---

## Claude's Discretion

无 — 用户对所有关键领域都提供了明确决策。

## Deferred Ideas

无 — 讨论保持在阶段范围内。
