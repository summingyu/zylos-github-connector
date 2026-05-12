<!-- generated-by: gsd-doc-writer -->
<p align="center">
  <img src="./assets/logo.png" alt="Zylos" height="120">
</p>

<h1 align="center">zylos-github-connector</h1>

<p align="center">
  GitHub Webhook 连接器 —— Zylos AI Agent 平台组件
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg" alt="Node.js"></a>
  <a href="https://discord.gg/GS2J39EGff"><img src="https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://x.com/ZylosAI"><img src="https://img.shields.io/badge/X-follow-000000?logo=x&logoColor=white" alt="X"></a>
  <a href="https://zylos.ai"><img src="https://img.shields.io/badge/website-zylos.ai-blue" alt="Website"></a>
  <a href="https://coco.xyz"><img src="https://img.shields.io/badge/Built%20by%20Coco-orange" alt="Built by Coco"></a>
</p>

---

## 项目概述

**zylos-github-connector** 是 Zylos AI Agent 平台的通信组件，用于接收 GitHub Webhook 事件并通过平台的通信通道转发格式化的通知。该组件运行 HTTP 服务器接收 GitHub 事件负载，验证 webhook 签名，将事件格式化为可读消息，并通过 C4 通信桥传递。

### 核心价值

AI Agent 实时了解 GitHub 仓库活动，无需轮询。

---

## 功能特性

- **GitHub 事件接收** — 接收 GitHub Webhook 事件推送
- **签名验证** — HMAC-SHA256 签名验证确保安全性
- **事件处理** — 支持 issues、pull_request、issue_comment、release 事件
- **消息格式化** — 一致的通知格式，包含可点击的 GitHub URL
- **去重机制** — 基于 X-GitHub-Delivery ID 的内存去重
- **异步通信** — 通过 C4 通信桥异步传递通知
- **配置验证** — 深度默认值合并和配置验证
- **健康检查** — 提供 `/health` 端点用于服务监控
- **配置热重载** — 配置更改即时生效，无需重启
- **优雅关闭** — 支持优雅关闭和超时保护
- **安全防护** — 通过 Helmet 中间件添加安全头
- **大负载支持** — 可配置的最大负载大小（默认 10MB）

---

## 当前状态

**阶段：** Phase 12 已完成 — 项目完成（生产就绪）

**已完成功能：**
- ✓ Fastify HTTP 服务器
- ✓ Raw body 捕获用于 HMAC 验证
- ✓ 安全头（Helmet）
- ✓ 健康检查和 webhook 路由
- ✓ 优雅关闭和超时保护
- ✓ HMAC-SHA256 签名验证
- ✓ 事件路由和去重（X-GitHub-Event、X-GitHub-Delivery）
- ✓ Issues 事件处理程序（opened、closed、reopened）
- ✓ Pull Request 事件处理程序（opened、closed、merged、ready_for_review）
- ✓ Issue Comment 事件处理程序（created）
- ✓ Release 事件处理程序（published）
- ✓ 消息格式化模块（一致的格式、可点击 URL）
- ✓ C4 通信桥集成（异步消息传递）
- ✓ 配置管理和热重载（深度默认值合并、验证）
- ✓ PM2 生命周期集成（优雅关闭、进程管理）
- ✓ 组件元数据（SKILL.md）
- ✓ 完整测试覆盖（519+ 个测试）

**项目状态：** 生产就绪

---

## 支持的 GitHub 事件

### Issues（问题）

- **opened** — 新问题创建
- **closed** — 问题关闭
- **reopened** — 问题重新打开

### Pull Requests（拉取请求）

- **opened** — 新 PR 创建
- **closed** — PR 关闭（未合并）
- **merged** — PR 合并
- **ready_for_review** — Draft PR 准备好审查

### Issue Comments（问题评论）

- **created** — 新评论发布

### Releases（发布）

- **published** — 新发布发布

---

## 安装

### 通过 Zylos CLI（推荐）

```bash
zylos add github-connector
```

### 手动安装

```bash
cd ~/zylos/.claude/skills
git clone https://github.com/zylos-ai/zylos-github-connector.git github-connector
cd github-connector && npm install
```

### 系统要求

- Node.js >= 20.0.0
- PM2（进程管理）

### 验证安装

```bash
# 验证安装
npm test

# 检查配置文件
cat ~/zylos/components/github-connector/config.json
```

---

## 配置

配置文件：`~/zylos/components/github-connector/config.json`

```json
{
  "enabled": true,
  "port": 3461,
  "webhookSecret": "your-webhook-secret",
  "maxPayloadSize": "10mb",
  "commBridge": {
    "enabled": true,
    "defaultEndpoint": "default"
  },
  "logging": {
    "level": "info",
    "pretty": true
  }
}
```

### 配置选项

| 选项 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `enabled` | boolean | 是 | - | 是否启用组件 |
| `port` | number | 是 | 3461 | HTTP 服务监听端口 |
| `webhookSecret` | string | 是 | - | GitHub Webhook 密钥 |
| `maxPayloadSize` | string | 否 | "10mb" | 最大负载大小 |
| `commBridge.enabled` | boolean | 是 | - | 是否启用 C4 通信桥 |
| `commBridge.defaultEndpoint` | string | 是 | "default" | 默认通信端点 |
| `logging.level` | string | 否 | "info" | 日志级别 |
| `logging.pretty` | boolean | 否 | true | 是否美化日志输出 |

### 环境变量

也可以通过环境变量配置：

- `GITHUB_WEBHOOK_SECRET` — Webhook 密钥
- `GITHUB_CONNECTOR_PORT` — 服务端口
- `GITHUB_CONNECTOR_ENABLED` — 是否启用

---

## GitHub Webhook 设置

### 1. 在仓库设置中添加 Webhook

1. 进入 GitHub 仓库设置 → Webhooks → Add webhook
2. 配置以下选项：
   - **Payload URL:** 见下方示例
   - **Content type:** `application/json`
   - **Secret:** 与配置中的 `webhookSecret` 相同
   - **Events:** 选择需要的事件类型

### 2. Payload URL 配置

**Payload URL 示例：**
- **本地测试：** `http://localhost:3461/webhook`
- **生产环境：** `https://your-domain.com:3461/webhook`

**注意：** 确保你的服务器可以从 GitHub 访问（公网 URL 或通过隧道服务如 ngrok）。

### 3. 推荐的事件类型

- **Issues** — 仓库问题（opened、closed、reopened）
- **Pull Requests** — 拉取请求（opened、closed、merged、ready_for_review）
- **Issue Comments** — 问题评论（created）
- **Releases** — 发布（published）

### 4. 验证设置

发送测试 webhook 确保 202 响应：

```bash
# 检查服务状态
curl http://localhost:3461/health

# 预期响应：{"status":"ok"}
```

---

## 使用方法

### 启动服务

```bash
pm2 start ecosystem.config.cjs
```

### 停止服务

```bash
pm2 stop zylos-github-connector
```

### 查看日志

```bash
pm2 logs zylos-github-connector
```

### 重启服务

```bash
pm2 restart zylos-github-connector
```

### 监控服务

```bash
pm2 monit
```

---

## 测试

### 运行测试

```bash
npm test
```

### 监听模式

```bash
npm run test:watch
```

### Webhook 测试脚本

```bash
npm run test:webhook
```

测试覆盖：
- ✓ 519+ 个测试（单元测试 + 集成测试）
- ✓ 签名验证（有效、无效、格式错误、常量时间比较）
- ✓ 事件类型解析（X-GitHub-Event、X-GitHub-Delivery）
- ✓ 传递 ID 去重（重复检测、Map 跟踪）
- ✓ Issues 事件处理（opened、closed、reopened）
- ✓ Pull Request 事件处理（opened、closed、merged、ready_for_review）
- ✓ Issue Comment 事件处理（created）
- ✓ Release 事件处理（published）
- ✓ 消息格式化（URL 格式化、动作标签）
- ✓ C4 通信桥集成（消息传递、重试逻辑）
- ✓ 配置管理（加载、验证、热重载）
- ✓ 生命周期（PM2 启动/停止、优雅关闭）

测试文件结构：
```
src/lib/__tests__/
├── verifier.test.js          # 签名验证测试
├── event-parser.test.js      # 事件解析测试
├── dedupe.test.js            # 去重测试
├── issues-handler.test.js    # Issues 处理测试
├── pull-request-handler.test.js  # PR 处理测试
├── comment-handler.test.js   # Comment 处理测试
├── release-handler.test.js   # Release 处理测试
├── comm-bridge.test.js       # 通信桥测试
└── *.test.js                 # 其他集成测试
```

---

## 项目结构

```
zylos-github-connector/
├── src/
│   ├── index.js              # 入口点（启动/关闭生命周期）
│   └── lib/
│       ├── config.js         # 配置加载器（支持热重载）
│       ├── verifier.js       # HMAC-SHA256 签名验证
│       ├── handlers/         # 事件处理程序
│       ├── formatters/       # 消息格式化
│       ├── comm-bridge.js    # C4 通信桥集成
│       └── __tests__/        # 单元测试
├── scripts/
│   └── test-webhook.js       # Webhook 测试脚本
├── hooks/
│   ├── configure.js          # 配置钩子
│   ├── post-install.js       # 安装后设置
│   ├── pre-upgrade.js        # 升级前备份
│   └── post-upgrade.js       # 升级后配置迁移
├── tests/
│   └── README.md             # 测试文档
├── SKILL.md                  # 组件规范（Zylos CLI 自动发现）
├── ecosystem.config.cjs      # PM2 服务配置
├── config.example.json       # 配置示例
├── package.json              # 依赖和脚本
└── README.md                 # 本文档
```

---

## 技术栈

- **运行时:** Node.js 20+
- **HTTP 框架:** Fastify 5.x
- **安全头:** @fastify/helmet
- **Raw body 解析:** fastify-raw-body
- **进程管理:** PM2
- **测试框架:** Node.js 内置 test runner

---

## 安全特性

- ✓ HMAC-SHA256 签名验证
- ✓ 常量时间比较防止时序攻击
- ✓ Raw body 在解析前捕获（关键安全要求）
- ✓ Helmet 安全头中间件
- ✓ 可配置的最大负载大小防止 DoS
- ✓ 快速确认 + 异步处理模式（防止超时）

---

## 开发路线图

**Phase 1:** ✓ HTTP 服务器基础
**Phase 2:** ✓ 签名验证
**Phase 3:** ✓ 事件路由和去重
**Phase 4:** ✓ Issues 事件处理程序
**Phase 5:** ✓ Pull Request 事件处理程序
**Phase 6:** ✓ Comment 和 Release 事件处理程序
**Phase 7:** ✓ 消息格式化模块
**Phase 8:** ✓ C4 通信桥集成
**Phase 9:** ✓ 配置管理
**Phase 10:** ✓ 生命周期和 PM2 集成
**Phase 11:** ✓ 组件元数据（SKILL.md）
**Phase 12:** ✓ 文档和测试验证

查看 `.planning/ROADMAP.md` 了解完整路线图。

---

## 贡献

欢迎贡献！请查看项目文档和贡献指南。

---

## 许可证

[MIT](./LICENSE)

---

## Built by Coco

Zylos 是 [Coco](https://coco.xyz/) 的开源核心 —— 一个 AI 员工平台。

---

## 联系方式

- **Discord:** https://discord.gg/GS2J39EGff
- **X (Twitter):** https://x.com/ZylosAI
- **Website:** https://zylos.ai
- **Issues:** https://github.com/zylos-ai/zylos-github-connector/issues
