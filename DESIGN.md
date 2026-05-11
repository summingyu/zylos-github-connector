# zylos-github-webhook Design Document

**Version:** v1.0.0
**Date:** 2025-05-11
**Repository:** https://github.com/zylos-ai/zylos-github-webhook
**Status:** Draft

---

## 1. Overview

### 1.1 Purpose

为 Zylos AI Agent 平台创建一个 GitHub Webhook 连接器组件，接收 GitHub 事件并转换为格式化的通知消息。

### 1.2 Scope

- **Inbound:** GitHub Webhook 事件（HTTPS POST）
- **Outbound:** 通过 C4 通信桥发送通知
- **Supported Events:** issues、pull_request、issue_comment、release
- **Verification:** HMAC-SHA256 签名验证

### 1.3 Non-Goals

- 双向 GitHub API 交互（仅单向通知）
- 实时流式传输（SSE/WebSocket）
- 历史事件同步

## 2. Architecture

### 2.1 Component Structure

```
zylos-github-webhook/
  src/
    index.js          — Entry point (startup/shutdown lifecycle)
    lib/
      config.js         — Configuration loader (hot reload)
      verifier.js       — HMAC-SHA256 signature verification
      dedupe.js         — X-GitHub-Delivery deduplication
      handlers/         — Event handlers
        issues.js       — Issue events
        pull-request.js  — PR events
        issue-comment.js — Comment events
        release.js      — Release events
      formatters/       — Message formatters
  scripts/
    send.js           — Outbound message processor (C4 interface)
  hooks/
    configure.js       — Configuration hook
    post-install.js     — Post-install setup
    pre-upgrade.js      — Pre-upgrade backup
    post-upgrade.js    — Post-upgrade config migration
  SKILL.md              — Component specification
  ecosystem.config.cjs  — PM2 service configuration
```

### 2.2 Data Flow

```
GitHub → Webhook POST → Fastify Server
                           ↓
                       Signature Verification (HMAC-SHA256)
                           ↓
                       Deduplication Check (X-GitHub-Delivery)
                           ↓
                       Event Type Routing
                           ↓
                  ┌────────┬────────┬────────┐
                  ↓        ↓        ↓        ↓
            issues  pull_r  issue_  release
            handler  equest  comment handler
                  ↓        ↓        ↓        ↓
              Message Formatter
                  ↓
              C4 Communication Bridge
                  ↓
              Notify User
```

## 3. Configuration

### 3.1 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| None | - | All configuration managed via config.json |

### 3.2 Configuration File

Located at `~/zylos/components/github-webhook/config.json`:

```json
{
  "enabled": true,
  "port": 3461,
  "webhookSecret": "github-webhook-secret",
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

## 4. Zylos Integration

### 4.1 Lifecycle

- **Startup:** Invoked via PM2 through `ecosystem.config.cjs`
- **Shutdown:** Graceful shutdown on SIGTERM

### 4.2 Message Flow

**Inbound** (from GitHub):
1. GitHub triggers event
2. Sends HTTPS POST to component
3. Verifies HMAC-SHA256 signature
4. Checks X-GitHub-Delivery ID
5. Routes to event handler

**Outbound** (to user):
1. Format message
2. Send via C4 Communication Bridge
3. Deliver to configured communication channel

## 5. Security

### 5.1 Signature Verification

- Use HMAC-SHA256 algorithm
- Constant-time comparison (`crypto.timingSafeEqual()`)
- Verify raw request body (not parsed JSON)

### 5.2 Deduplication

- Track X-GitHub-Delivery header
- In-memory Set stores processed IDs
- Duplicate events return 200 but skip processing

### 5.3 Error Handling

- Invalid signature: 401 Unauthorized
- Processing errors: Log and continue (don't crash service)
- Config reload: Use defaults on hot reload failure

## 6. Future Improvements

- **v2+:** Persistent deduplication (Redis)
- **v2+:** Event filtering (by tags, author)
- **v2+:** Custom message templates
- **v2+:** Multi-repository support

---

**Document Version:** v1.0.0
**Last Updated:** 2025-05-11
