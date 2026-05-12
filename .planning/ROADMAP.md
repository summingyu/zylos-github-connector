# Roadmap: Zylos GitHub Webhook Connector

**Created:** 2025-05-11
**Mode:** Fine-grained (8-12 phases, 5-10 plans per phase)
**Project Mode:** MVP (Vertical Slices)

## Overview

**12 Phases** | **43 Requirements** | **100% Coverage** ✓

此路线图将 GitHub Webhook 连接器构建为 Zylos 通信组件。每个阶段都提供垂直切片的工作功能，从核心 webhook 基础设施到事件处理、配置、生命周期和文档。

---

## Phase 1: HTTP Server Foundation

**Goal:** 建立带有原始体捕获和安全头的 Fastify HTTP 服务器。

**Mode:** mvp

**Success Criteria:**

1. Fastify 服务器监听可配置端口
2. 原始请求体在解析前保留为 Buffer
3. 应用安全头（Helmet）
4. Webhook 路由接受 POST 请求
5. 服务器可以优雅地启动和停止

**Requirements:** WEBH-01、WEBH-02、WEBH-04

**Plans:**

- 使用可配置端口初始化 Fastify 服务器
- 注册 fastify-raw-body 中间件以保留请求字节
- 配置 Helmet 中间件设置安全头
- 定义接受请求的 POST /webhook 路由
- 实现优雅关闭处理程序（SIGINT/SIGTERM）
- 使用 Pino 添加基本请求日志

---

## Phase 2: Signature Verification

**Goal:** 实现安全的 HMAC-SHA256 webhook 签名验证。

**Mode:** mvp

**Success Criteria:**

1. 提取并验证 X-Hub-Signature-256 头
2. HMAC 计算基于原始请求体
3. 常量时间比较防止时序攻击
4. 无效签名返回 401 状态
5. 合法的 GitHub webhook 验证成功

**Requirements:** SECU-01、SECU-02、SECU-03、SECU-04、SECU-05、WEBH-03

**Plans:**

- 从传入请求中提取 X-Hub-Signature-256 头
- 使用 webhook secret 计算原始体的 HMAC-SHA256
- 使用 crypto.timingSafeEqual 实现常量时间比较
- 对签名不匹配返回 401 和通用错误消息
- 确保从配置加载 webhook secret（不硬编码）
- 添加验证成功/失败日志（不含 secret）
- 使用有效和无效签名进行测试

---

## Phase 3: Event Routing and Deduplication

**Goal:** 解析事件类型，路由到处理程序，防止重复处理。

**Mode:** mvp

**Success Criteria:**

1. X-GitHub-Event 头确定事件类型
2. X-GitHub-Delivery 头被跟踪用于去重
3. 重复传递 ID 返回 200 而不重新处理
4. 事件路由到相应的处理程序函数
5. 验证后解析请求负载为 JSON

**Requirements:** EVENT-01、EVENT-02、EVENT-03、EVENT-04

**Plans:**

- 提取 X-GitHub-Event 头确定事件类型
- 提取 X-GitHub-Delivery 头用于去重
- 实现内存 Set 跟踪已处理的传递 ID
- 检查传递 ID，如果是重复则返回 200
- 验证后将请求负载解析为 JSON
- 创建按事件类型分派到处理程序函数的路由器
- 添加事件类型和路由决策的日志

---

## Phase 4: Issues Event Handler

**Goal:** 处理 issues 事件（opened、closed、reopened）并格式化通知。

**Mode:** mvp

**Success Criteria:**

1. 接收并解析 issues 事件
2. Issue 通知包括标题、作者、动作、URL
3. 动作被过滤（opened、closed、reopened）
4. 处理程序返回格式化的消息字符串

**Requirements:** ISSUE-01、ISSUE-02、FMT-01、FMT-03

**Plans:**

- [x] 04-01-PLAN.md — 实现 issues 事件处理程序，包含输入验证、动作过滤、标签格式化和消息构建，以及全面的单元测试和集成测试

---

## Phase 5: Pull Request Event Handler

**Goal:** 处理 pull_request 事件（opened、closed、merged、ready_for_review）并格式化通知。

**Mode:** mvp

**Success Criteria:**

1. 接收并解析 PR 事件
2. PR 通知包括标题、作者、动作、合并状态、URL
3. 动作被过滤（opened、closed、merged、ready_for_review）
4. 合并状态被正确识别

**Requirements:** PR-01、PR-02、FMT-01、FMT-03

**Plans:**

- [x] 05-01-PLAN.md — 创建 pull_request 事件处理程序函数，包含完整的单元测试和集成测试

---

## Phase 6: Comment and Release Event Handlers ✅

**Goal:** 处理 issue_comment 和 release 事件并格式化通知。

**Mode:** mvp

**Completed:** 2026-05-12

**Success Criteria:**

1. 接收并解析评论事件和 issue/PR 上下文
2. 接收并解析发布事件和资源
3. 评论通知包括作者、上下文、正文预览
4. 发布通知包括标签、名称、作者、资源

**Requirements:** COMM-01、COMM-02、REL-01、REL-02、FMT-01、FMT-02、FMT-03

**Plans:**

- [x] 06-01-PLAN.md — 实现 issue_comment 和 release 事件处理程序，包含输入验证、动作过滤、消息格式化和全面的测试覆盖 (1/1 plans complete)

---

## Phase 7: Message Formatting Module ✅

**Goal:** 集中消息格式化逻辑，确保一致的结构和 URL 处理。

**Mode:** mvp

**Completed:** 2026-05-12

**Success Criteria:**

1. 所有通知使用一致的消息格式
2. URL 被包含并可点击
3. 消息中清晰指示动作
4. 格式化程序模块化且可重用

**Requirements:** FMT-01、FMT-02、FMT-03

**Plans:**

- 创建具有一致消息结构的基础格式化程序
- 实现可点击 GitHub 链接的 URL 助手
- 实现动作标签格式化程序（opened/closed/merged 等）
- 重构处理程序使用集中式格式化程序
- 确保所有消息遵循相同的格式模式
- 测试所有事件类型的格式化

---

## Phase 8: C4 Communication Bridge Integration ✅

**Goal:** 通过 C4 通信桥传递格式化通知。

**Mode:** mvp

**Completed:** 2026-05-12

**Success Criteria:**

1. 消息通过 C4 通信桥发送
2. 通知端点可配置
3. 记录传递成功/失败
4. 与测试消息集成工作

**Requirements:** SEND-01、SEND-02、SEND-03

**Plans:**

- [x] 集成 C4 通信桥发送脚本执行 — Committed: 19beab7
- [x] 将格式化消息传递给通信桥 — Committed: 19beab7
- [x] 支持来自配置的可配置通知端点 — Committed: 19beab7
- [x] 记录传递成功/失败 — Committed: 19beab7
- [x] 优雅处理通信桥错误 — Committed: 19beab7
- [x] 测试端到端消息传递 — Committed: c728f30 (UAT)

---

## Phase 9: Configuration Management ✅

**Goal:** 实现配置加载和热重载以及默认值。

**Mode:** mvp

**Completed:** 2026-05-12

**Goal:** 实现配置加载和热重载以及默认值。

**Mode:** mvp

**Success Criteria:**

1. 配置从 ~/zylos/components/github-connector/config.json 加载
2. 配置更改通过文件监视器热重载
3. 为缺失配置应用默认值
4. Webhook secret、端口和日志级别可配置

**Requirements:** CONF-01、CONF-02、CONF-03、CONF-04、CONF-05

**Plans:**

- [x] 09-01-PLAN.md — 重构配置加载器以支持深度默认值合并、配置验证和敏感字段保护 — Committed: f3c662f
- [x] 09-02-PLAN.md — 实现配置文件热重载功能，支持防抖机制和错误恢复 — Committed: 45a5c27

---

## Phase 10: Lifecycle and PM2 Integration ✅

**Goal:** 实现带有优雅关闭和启用标志的 PM2 进程管理。

**Mode:** mvp

**Completed:** 2026-05-12

**Success Criteria:**

1. 组件通过 PM2 启动和停止
2. 优雅关闭正确关闭连接
3. ecosystem.config.cjs 定义 PM2 服务
4. 组件在配置中禁用时退出

**Requirements:** LIFE-01、LIFE-02、LIFE-03、LIFE-04

**Plans:**

- [x] 10-01-PLAN.md — 修复 PM2 配置路径、验证优雅关闭、创建集成测试和测试脚本 — Committed: f5953b5

---

## Phase 11: Component Metadata (SKILL.md) ✅

**Goal:** 完成包含组件元数据和配置架构的 SKILL.md。

**Mode:** mvp

**Completed:** 2026-05-12

**Success Criteria:**

1. SKILL.md 包含所有必需字段（name、version、type、description、config）
2. type 设置为 "communication"
3. 声明对 comm-bridge 的依赖
4. config 部分定义必需的 webhook secret 参数

**Requirements:** META-01、META-02、META-03、META-04

**Plans:**

- [x] 11-01-PLAN.md — 完善 SKILL.md 组件元数据：添加 dependencies 字段、改进 description 触发模式、添加文档正文依赖说明 — Committed: (pending)

---

## Phase 12: Documentation and Testing 🔄

**Goal:** 更新 README 以反映完整项目状态并验证测试覆盖要求。

**Mode:** mvp

**Status:** Ready to Execute

**Success Criteria:**

1. README 包含安装说明（DOC-01）
2. README 包含配置说明（端口、secret、端点）（DOC-02）
3. README 包含 GitHub Webhook 设置说明（URL 配置）（DOC-03）
4. 组件包含签名验证测试（TEST-01）
5. 组件包含事件类型解析测试（TEST-02）
6. 组件包含传递 ID 去重测试（TEST-03）

**Requirements:** DOC-01、DOC-02、DOC-03、TEST-01、TEST-02、TEST-03

**Plans:**

- [ ] 12-01-PLAN.md — 更新 README.md 反映 Phase 11 完成状态，完善安装、配置、GitHub Webhook 设置说明，添加支持的 GitHub 事件详细说明
- [ ] 12-02-PLAN.md — 验证测试覆盖满足 TEST-01、TEST-02、TEST-03 要求，更新 README.md 测试部分反映 519+ 测试覆盖

---

## Phase Dependencies

```
Phase 1 (HTTP Server)
    ↓
Phase 2 (Signature Verification)
    ↓
Phase 3 (Event Routing)
    ↓
    ├──→ Phase 4 (Issues)────────┐
    ├──→ Phase 5 (PRs)───────────┤
    ├──→ Phase 6 (Comments/Releases)─────┤
    │                             ↓
    │                     Phase 7 (Formatting)
    │                             ↓
    └────────────────────→ Phase 8 (Comm Bridge)
                                  ↓
                           Phase 9 (Configuration)
                                  ↓
                           Phase 10 (Lifecycle)
                                  ↓
                           Phase 11 (Metadata)
                                  ↓
                           Phase 12 (Docs/Tests) 🔄
```

---

## Milestone Definitions

**Milestone 1: Core Infrastructure (Phases 1-3)**

- 工作中的 HTTP 服务器和签名验证
- 事件路由和去重
- 可以接收和验证 GitHub webhook

**Milestone 2: Event Processing (Phases 4-7)**

- 处理所有事件类型（issues、PRs、评论、发布）
- 格式化通知消息
- 端到端事件流程工作

**Milestone 3: Integration (Phases 8-10)**

- C4 通信桥传递
- 配置管理
- PM2 生命周期管理

**Milestone 4: Production Ready (Phases 11-12)**

- 完整的元数据和文档
- 基本测试覆盖
- 准备安装和使用

---

**Last Updated:** 2026-05-12 (Phase 12 planning complete)
