# Requirements Document: Zylos GitHub Webhook Connector

**Date:** 2025-05-11
**Core Value:** AI Agent 实时了解 GitHub 仓库活动，无需轮询。

## v1 Requirements

### Webhook Reception

- [x] **WEBH-01**：HTTP 服务器在可配置端口上接收 GitHub Webhook POST 请求
- [x] **WEBH-02**：组件在任何解析之前保留原始请求字节用于签名验证
- [x] **WEBH-03**：服务器在 GitHub 超时窗口内（约 10 秒）响应 2xx 状态
- [x] **WEBH-04**：组件通过 helmet 中间件应用安全头（HSTS、X-Frame-Options、nosniff）

### Security

- [x] **SECU-01**：组件使用 HMAC-SHA256 验证原始请求体的 X-Hub-Signature-256 头
- [x] **SECU-02**：签名比较使用 crypto.timingSafeEqual() 防止时序攻击
- [x] **SECU-03**：Webhook secret 安全存储在 config.json 中（不硬编码）
- [x] **SECU-04**：组件对无效签名尝试返回 401 状态
- [x] **SECU-05**：日志不包含 webhook secret 或完整请求体

### Event Handling

- [x] **EVENT-01**：组件从 X-GitHub-Event 头解析事件类型
- [x] **EVENT-02**：组件根据事件类型将事件路由到相应的处理程序
- [x] **EVENT-03**：组件跟踪已处理的 X-GitHub-Delivery ID 以防止重复处理
- [x] **EVENT-04**：组件对重复的传递 ID 返回 200 状态（确认但跳过处理）

### Event Type Support

- [x] **ISSUE-01**：组件处理 issues 事件（opened、closed、reopened 动作）
- [x] **ISSUE-02**：Issue 通知包括 issue 标题、作者、动作和 URL
- [x] **PR-01**：组件处理 pull_request 事件（opened、closed、merged、ready_for_review 动作）
- [x] **PR-02**：PR 通知包括 PR 标题、作者、动作、合并状态和 URL
- [x] **COMM-01**：组件处理 issue_comment 事件（created 动作）
- [x] **COMM-02**：评论通知包括评论作者、issue/PR 上下文和正文预览
- [x] **REL-01**：组件处理 release 事件（published 动作）
- [x] **REL-02**：发布通知包括发布标签、名称、作者和资源

### Message Formatting

- [x] **FMT-01**：组件将事件数据格式化为人类可读的通知消息
- [x] **FMT-02**：消息包含相关 GitHub 资源的可点击 URL
- [x] **FMT-03**：消息清晰指示发生的动作（opened、closed、merged 等）

### Notification Delivery

- [x] **SEND-01**：组件通过 C4 通信桥传递通知
- [x] **SEND-02**：组件支持可配置的通知端点
- [x] **SEND-03**：组件记录通知传递尝试的成功/失败

### Configuration

- [x] **CONF-01**：组件从 ~/zylos/components/github-connector/config.json 加载配置
- [x] **CONF-02**：组件通过文件监视器支持配置更改的热重载
- [x] **CONF-03**：可配置的 webhook secret 用于签名验证
- [x] **CONF-04**：可配置的服务器端口（默认：3461）
- [x] **CONF-05**：可配置的日志级别（info、debug、error）

### Component Lifecycle

- [x] **LIFE-01**：组件可以通过 PM2 启动和停止
- [x] **LIFE-02**：组件在 SIGINT/SIGTERM 信号上实现优雅关闭
- [x] **LIFE-03**：ecosystem.config.cjs 定义 PM2 服务配置
- [x] **LIFE-04**：组件遵守配置中的启用标志（如果禁用则退出）

### Component Metadata

- [x] **META-01**：SKILL.md 包含组件元数据（name、version、type、description、config）
- [x] **META-02**：SKILL.md type 设置为 "communication"
- [x] **META-03**：SKILL.md 声明对 comm-bridge 的依赖
- [x] **META-04**：SKILL.md config 部分定义必需的 webhook secret 参数

### Documentation

- [x] **DOC-01**：README.md 包含安装说明
- [x] **DOC-02**：README.md 包含配置说明（端口、secret、端点）
- [x] **DOC-03**：README.md 包含 GitHub Webhook 设置说明（URL 配置）

### Testing

- [x] **TEST-01**：组件包含签名验证测试（有效和无效签名）
- [x] **TEST-02**：组件包含事件类型解析测试
- [x] **TEST-03**：组件包含传递 ID 去重测试

## v2 Requirements

延迟到未来版本。已跟踪但不在当前路线图中。

### Enhanced Reliability

- **RELIA-01**：持久化去重存储（Redis）用于跨重启的传递 ID 跟踪
- **RELIA-02**：失败通知传递的重试逻辑和指数退避
- **RELIA-03**：永久失败事件的死信队列

### Advanced Features

- **FEAT-01**：按标签、作者、分支或动作过滤事件
- **FEAT-02**：自定义消息模板用于用户定义的通知格式
- **FEAT-03**：多仓库配置支持
- **FEAT-04**：通过用户提供的 JavaScript 函数进行负载转换

### Observability

- **OBS-01**：带有请求元数据的结构化 JSON 日志
- **OBS-02**：请求数、验证失败、传递延迟的指标
- **OBS-03**：用于监控的健康检查端点（/health）

## Out of Scope

| Feature | Reason |
|------|------|
| 双向 GitHub API 交互 | 仅单向通知流（已声明需求） |
| 实时流式传输（SSE/WebSocket） | GitHub 使用 webhook 推送模式，非流式 |
| 历史事件同步 | 不属于 webhook 契约；单独使用 GitHub API |
| Webhook 管理界面 | 面向通知的组件；UI 在 v2+ |
| 多种认证方式 | v1 的 webhook secret 已足够 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WEBH-01 | Phase 1 | 待处理 |
| WEBH-02 | Phase 1 | 待处理 |
| WEBH-03 | Phase 1 | 待处理 |
| WEBH-04 | Phase 1 | 待处理 |
| SECU-01 | Phase 1 | 待处理 |
| SECU-02 | Phase 1 | 待处理 |
| SECU-03 | Phase 1 | 待处理 |
| SECU-04 | Phase 1 | 待处理 |
| SECU-05 | Phase 1 | 待处理 |
| EVENT-01 | Phase 1 | 待处理 |
| EVENT-02 | Phase 1 | 待处理 |
| EVENT-03 | Phase 1 | 待处理 |
| EVENT-04 | Phase 1 | 待处理 |
| ISSUE-01 | Phase 2 | 待处理 |
| ISSUE-02 | Phase 2 | 待处理 |
| PR-01 | Phase 2 | 待处理 |
| PR-02 | Phase 2 | 待处理 |
| COMM-01 | Phase 2 | 待处理 |
| COMM-02 | Phase 2 | 待处理 |
| REL-01 | Phase 2 | 待处理 |
| REL-02 | Phase 2 | 待处理 |
| FMT-01 | Phase 2 | 待处理 |
| FMT-02 | Phase 2 | 待处理 |
| FMT-03 | Phase 2 | 待处理 |
| SEND-01 | Phase 2 | 待处理 |
| SEND-02 | Phase 2 | 待处理 |
| SEND-03 | Phase 2 | 待处理 |
| CONF-01 | Phase 3 | 待处理 |
| CONF-02 | Phase 3 | 待处理 |
| CONF-03 | Phase 3 | 待处理 |
| CONF-04 | Phase 3 | 待处理 |
| CONF-05 | Phase 3 | 待处理 |
| LIFE-01 | Phase 10 | 完成 (2026-05-12) |
| LIFE-02 | Phase 10 | 完成 (2026-05-12) |
| LIFE-03 | Phase 10 | 完成 (2026-05-12) |
| LIFE-04 | Phase 10 | 完成 (2026-05-12) |
| META-01 | Phase 4 | 待处理 |
| META-02 | Phase 4 | 待处理 |
| META-03 | Phase 4 | 待处理 |
| META-04 | Phase 4 | 待处理 |
| DOC-01 | Phase 4 | 待处理 |
| DOC-02 | Phase 4 | 待处理 |
| DOC-03 | Phase 4 | 待处理 |
| TEST-01 | Phase 4 | 待处理 |
| TEST-02 | Phase 4 | 待处理 |
| TEST-03 | Phase 4 | 待处理 |

**Coverage:**
- v1 Requirements：43 个总计
- Mapped to Phases：43 个
- Unmapped：0 个 ✓

---
*Requirements defined: 2025-05-11*
*Last updated: 2025-05-11 after initial definition*
