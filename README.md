<p align="center">
  <img src="./assets/logo.png" alt="Zylos" height="120">
</p>

<h1 align="center">zylos-github-webhook</h1>

<p align="center">
  Zylos AI Agent 平台的 GitHub Webhook 连接器
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

## Features

- **GitHub Event Reception** — 接收 GitHub Webhook 事件推送
- **Signature Verification** — HMAC-SHA256 签名验证确保安全性
- **Event Processing** — 支持 issues、pull requests、评论、发布事件
- **Message Notifications** — 通过 C4 通信桥发送格式化通知
- **Hot Config Reload** — 配置更改即时生效，无需重启

## Installation

```bash
zylos add github-webhook
```

Or manually install:

```bash
cd ~/zylos/.claude/skills
git clone https://github.com/zylos-ai/zylos-github-webhook.git github-webhook
cd github-webhook && npm install
```

## Configuration

Edit `~/zylos/components/github-webhook/config.json`:

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
    "issues": {
      "enabled": true,
      "actions": ["opened", "closed", "reopened"]
    },
    "pull_request": {
      "enabled": true,
      "actions": ["opened", "closed", "merged"]
    },
    "issue_comment": {
      "enabled": true,
      "actions": ["created"]
    },
    "release": {
      "enabled": true,
      "actions": ["published"]
    }
  },
  "logging": {
    "level": "info"
  }
}
```

### GitHub Webhook Setup

1. Add webhook in GitHub repository settings
2. Payload URL: `https://your-domain.com:3461/webhook`
3. Content type: `application/json`
4. Secret: Same as `webhookSecret` in config
5. Events: Select desired event types

## Usage

### Start Service

```bash
pm2 start ecosystem.config.cjs
```

### Stop Service

```bash
pm2 stop zylos-github-webhook
```

### View Logs

```bash
pm2 logs zylos-github-webhook
```

### Restart Service

```bash
pm2 restart zylos-github-webhook
```

## Test Message Sending

### Via C4 Communication Bridge

```bash
cat <<'EOF' | node ~/zylos/.claude/skills/comm-bridge/scripts/c4-send.js "github-webhook" ""
测试消息
EOF
```

### Direct Send (for testing)

```bash
node ~/zylos/.claude/skills/github-webhook/scripts/send.js "test-endpoint" "测试消息"
```

## Supported Events

| Event Type | Supported Actions |
|------------|-------------------|
| **issues** | opened、closed、reopened |
| **pull_request** | opened、closed、merged、ready_for_review |
| **issue_comment** | created |
| **release** | published |

## Project Structure

```
zylos-github-webhook/
├── src/
│   ├── index.js              # Entry point (startup/shutdown lifecycle)
│   └── lib/                  # Core logic modules
├── scripts/
│   └── send.js               # Outbound message processor
├── hooks/
│   ├── configure.js          # Configuration hook
│   ├── post-install.js       # Post-install setup
│   ├── pre-upgrade.js        # Pre-upgrade backup
│   └── post-upgrade.js      # Post-upgrade config migration
├── SKILL.md                  # Component specification
├── ecosystem.config.cjs      # PM2 service configuration
├── package.json              # Dependencies
└── README.md                 # This document
```

## Tech Stack

- **Runtime:** Node.js 20+
- **HTTP Framework:** Fastify
- **Webhook Verification:** @octokit/webhooks
- **Process Management:** PM2

## Security

- HMAC-SHA256 signature verification
- Constant-time comparison prevents timing attacks
- X-GitHub-Delivery ID deduplication prevents replay attacks
- Fast acknowledge + async processing pattern

## Built by Coco

Zylos is the open-source core of [Coco](https://coco.xyz/) — an AI employee platform.

## License

[MIT](./LICENSE)
