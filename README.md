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
- **健康检查** — 提供 `/health` 端点用于服务监控
- **配置热重载** — 配置更改即时生效，无需重启
- **优雅关闭** — 支持优雅关闭和超时保护
- **安全防护** — 通过 Helmet 中间件添加安全头
- **大负载支持** — 可配置的最大负载大小（默认 10MB）

---

## 当前状态

**阶段：** Phase 2 已完成 — 签名验证

**已完成功能：**
- ✓ Fastify HTTP 服务器
- ✓ Raw body 捕获用于 HMAC 验证
- ✓ 安全头（Helmet）
- ✓ 健康检查和 webhook 路由
- ✓ 优雅关闭和超时保护
- ✓ HMAC-SHA256 签名验证
- ✓ 配置管理和热重载
- ✓ 完整测试覆盖（27 个单元测试）

**下一步：** Phase 3 — 事件路由和去重

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
   - **Payload URL:** `https://your-domain.com:3461/webhook`
   - **Content type:** `application/json`
   - **Secret:** 与配置中的 `webhookSecret` 相同
   - **Events:** 选择需要的事件类型

### 2. 推荐的事件类型

- **Issues** — 仓库问题（opened、closed、reopened）
- **Pull Requests** — 拉取请求（opened、closed、merged）
- **Issue comments** — 问题评论（created）
- **Releases** — 发布（published）

### 3. 验证设置

发送测试 webhook 确保 202 响应：

```bash
# 检查服务状态
curl http://localhost:3461/health
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
- ✓ 27 个单元测试
- ✓ 签名验证（有效、无效、格式错误）
- ✓ 配置加载和热重载
- ✓ 集成测试（真实 HTTP 请求）

---

## 项目结构

```
zylos-github-connector/
├── src/
│   ├── index.js              # 入口点（启动/关闭生命周期）
│   └── lib/
│       ├── config.js         # 配置加载器（支持热重载）
│       ├── verifier.js       # HMAC-SHA256 签名验证
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
**Phase 3:** 事件路由和去重
**Phase 4:** 事件处理和格式化
**Phase 5:** C4 通信桥集成
**Phase 6:** 错误处理和重试
**Phase 7:** 监控和指标
**Phase 8:** 性能优化
**Phase 9:** 文档和测试完善
**Phase 10:** 生产就绪检查
**Phase 11:** 部署和运维
**Phase 12:** MVP 发布

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
