# Phase 4: Issues Event Handler - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

---

## Phase Boundary

实现 issues 事件处理程序，解析 GitHub webhook 负载，提取 issue 数据（标题、作者、动作、URL、标签），并将事件格式化为可读的通知消息。处理程序应支持 opened、closed、reopened 动作，并为 deleted 动作提供特殊处理。

---

## Implementation Decisions

### 消息格式风格
- **D-01:** 使用标准两行格式，平衡信息量和可读性
- **D-02:** 包含 issue 标签的名称和颜色（如 🔴 bug 🔴 high-priority）
- **D-03:** 显示用户名（@alice），而非全名
- **D-04:** 长标题自动换行，不截断

### 动作过滤策略
- **D-05:** 对于不支持的动作（edited、assigned、labeled 等），使用 `app.log.warn` 记录警告
- **D-06:** deleted 动作使用特殊处理格式（与其他核心动作区分）
- **D-07:** 缺失 action 字段时抛出错误
- **D-08:** 使用 switch/if-else 结构或动作映射表，便于未来扩展

### 动作标签格式
- **D-09:** 使用 Emoji + 文字组合：🔓 Opened、🔒 Closed、♻️ Reopened
- **D-10:** deleted 动作使用 🗑️ Deleted 格式
- **D-11:** 动作标签放在消息开头
- **D-12:** 使用标题大小写（Opened/Closed/Reopened）

### 错误处理方式
- **D-13:** payload.issue 为 null/undefined 时抛出错误
- **D-14:** title 为空时使用占位符 `[No title]`
- **D-15:** number 为 null 时跳过 URL 生成
- **D-16:** sender 为 null 时使用占位符 `@unknown`

### Claude's Discretion
无 — 用户对所有关键领域都提供了明确决策。

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 4 目标、成功标准和计划列表

### Requirements
- `.planning/REQUIREMENTS.md` — ISSUE-01、ISSUE-02、FMT-01、FMT-03

### Architecture & Patterns
- `DESIGN.md` — 架构设计和技术栈决策
- `CLAUDE.md` — 原始体捕获和签名验证实现说明
- `.planning/phases/01-http-server-foundation/01-CONTEXT.md` — Phase 1 上下文（服务器配置、日志策略）

### Existing Code
- `src/index.js` — 主入口点，事件处理程序注册模式
- `src/lib/router.js` — 事件路由系统（registerHandler、routeEvent）
- `src/lib/handlers/index.js` — 占位符处理程序（将被 Phase 4 替换）
- `src/lib/event-parser.js` — 事件元数据提取（extractEventMetadata）

---

## Existing Code Insights

### Reusable Assets
- **Router 系统**: `src/lib/router.js` 提供 `registerHandler(eventType, handler)` 和 `routeEvent(eventType, payload)`
- **事件解析器**: `src/lib/event-parser.js` 提取 X-GitHub-Event 和 X-GitHub-Delivery 头
- **占位符模式**: `src/lib/handlers/index.js` 中的 `handleIssues()` 显示输入验证模式（检查 payload 是否为对象）

### Established Patterns
- **处理程序返回值**: `{ processed: boolean, message: string, event: string, data: object }`
- **日志模式**: 使用 `app.log.info/warn/error`，包含结构化数据
- **错误处理**: 验证失败抛出错误，让错误冒泡到主处理程序

### Integration Points
- **处理程序注册**: 在 `src/index.js` 中通过 `registerHandler('issues', handlers.handleIssues)` 注册
- **日志系统**: 通过 Fastify logger 实例（`app.log`）记录
- **配置访问**: 通过 `getConfig()` 访问配置（如日志级别）

---

## Specific Ideas

消息格式示例（基于 D-01、D-02、D-03、D-09、D-11）：

```
🔓 Issue Opened by @alice
🔴 bug
#42: Fix login bug
🔗 https://github.com/user/repo/issues/42
```

deleted 动作特殊格式（基于 D-06、D-10）：

```
🗑️ Issue Deleted by @bob
#123: Old feature request
🔗 https://github.com/user/repo/issues/123
```

---

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 04-issues-event-handler*
*Context gathered: 2026-05-12*
