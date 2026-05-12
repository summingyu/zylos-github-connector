---
name: github-connector
version: 0.1.0
description: >-
  GitHub Webhook connector for Zylos AI Agent platform (单向：GitHub → Zylos，通过 webhook 接收事件).
  Use when: (1) receiving GitHub webhook events (issues, pull requests, comments, releases),
  (2) sending notifications to configured communication endpoints,
  (3) configuring webhook secret and server port,
  (4) troubleshooting webhook signature verification or event delivery.
  Config at ~/zylos/components/github-connector/config.json. Service: pm2 zylos-github-connector.
type: communication  # communication | capability | utility

lifecycle:
  npm: true
  service:
    type: pm2
    name: zylos-github-connector
    entry: src/index.js
  data_dir: ~/zylos/components/github-connector
  hooks:
    configure: hooks/configure.js
    post-install: hooks/post-install.js
    pre-upgrade: hooks/pre-upgrade.js
    post-upgrade: hooks/post-upgrade.js
  preserve:
    - config.json
    - data/

# 对于通过 Zylos Caddy 暴露的 HTTP 服务，首选内部根应用：
# - 组件监听 localhost 并在 / 提供内部路由
# - Caddy 在 /github-connector/* 暴露，去除此前缀并转发
#   X-Forwarded-Prefix。浏览器 URL 默认应为相对路径，并在存在
#   X-Forwarded-Prefix 时使用它。
# http_routes:
#   - path: /github-connector/*
#     type: reverse_proxy
#     target: localhost:3461
#     strip_prefix: /github-connector

upgrade:
  repo: zylos-ai/zylos-github-connector
  branch: main

config:
  required:
    - name: GITHUB_WEBHOOK_SECRET
      description: GitHub Webhook 密钥（用于验证 HMAC-SHA256 签名）
      sensitive: true
  optional:
    - name: GITHUB_WEBHOOK_PORT
      description: HTTP 服务器监听端口
      default: "3461"
    - name: GITHUB_WEBHOOK_LOG_LEVEL
      description: 日志级别（debug、info、error）
      default: "info"

dependencies:
  - comm-bridge

---

# GitHub Webhook 连接器

Zylos AI Agent 的 GitHub Webhook 连接器组件。

Depends on: comm-bridge (C4 message routing).

## 功能

接收 GitHub Webhook 事件并通过配置的通信通道发送通知。

## 支持的事件

- **issues**：opened、closed、reopened
- **pull_request**：opened、closed、merged、ready_for_review
- **issue_comment**：created
- **release**：published

## 配置

组件配置存储在 `~/zylos/components/github-connector/config.json`：

```json
{
  "enabled": true,
  "port": 3461,
  "webhookSecret": "your-webhook-secret",
  "commBridge": {
    "enabled": true,
    "defaultEndpoint": "default"
  },
  "events": {
    "issues": { "enabled": true, "actions": ["opened", "closed", "reopened"] },
    "pull_request": { "enabled": true, "actions": ["opened", "closed", "merged"] },
    "issue_comment": { "enabled": true, "actions": ["created"] },
    "release": { "enabled": true, "actions": ["published"] }
  },
  "logging": {
    "level": "info"
  }
}
```

## 使用方式

### 测试消息发送

通过 C4 桥接（始终使用 stdin 格式）：

```bash
cat <<'EOF' | node ~/zylos/.claude/skills/comm-bridge/scripts/c4-send.js "github-connector" ""
测试消息
EOF
```

或直接（用于测试）：

```bash
node ~/zylos/.claude/skills/github-connector/scripts/send.js "test-endpoint" "测试消息"
```

## 管理

```bash
# 启动
pm2 start ecosystem.config.cjs

# 停止
pm2 stop zylos-github-connector

# 重启
pm2 restart zylos-github-connector

# 查看日志
pm2 logs zylos-github-connector

# 查看状态
pm2 status
```

## 安全

- 使用 HMAC-SHA256 验证 Webhook 签名
- 内存中跟踪 X-GitHub-Delivery ID 防止重复处理
- 快速确认模式（202 Accepted）+ 异步处理
