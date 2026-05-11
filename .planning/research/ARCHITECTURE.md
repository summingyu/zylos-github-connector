# Architecture Research: Zylos GitHub Webhook Connector

**Research Date:** 2025-05-11

## Executive Summary

The GitHub Webhook Connector follows the Zylos communication component pattern with a **unidirectional flow**: GitHub → HTTP Server → Signature Verification → Event Routing → Message Formatting → C4 Comm-Bridge. The architecture emphasizes **security-first design** (HMAC verification), **fast acknowledgment** (async processing), and **modular event handlers**.

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        GitHub Server                              │
│  ┌────────────┐                                                   │
│  │   Event    │                                                   │
│  │  Triggered │                                                   │
│  └─────┬──────┘                                                   │
└────────┼──────────────────────────────────────────────────────────┘
         │
         │ HTTPS POST (HMAC-SHA256 signed)
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                   zylos-github-webhook                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  1. HTTP Server (Fastify)                                  │  │
│  │     - Raw body capture (Buffer)                            │  │
│  │     - Configurable port (default 3461)                     │  │
│  │     - Helmet security headers                              │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  2. Signature Verification                                  │  │
│  │     - Extract X-Hub-Signature-256 header                   │  │
│  │     - Compute HMAC-SHA256 over raw body                    │  │
│  │     - Constant-time comparison (timingSafeEqual)           │  │
│  │     - Return 401 on mismatch                                │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  3. Deduplication Check                                     │  │
│  │     - Extract X-GitHub-Delivery header                     │  │
│  │     - Check if delivery ID processed (in-memory set)       │  │
│  │     - Return 200 if duplicate                              │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  4. Event Type Parsing                                      │  │
│  │     - Extract X-GitHub-Event header                        │  │
│  │     - Parse JSON payload                                   │  │
│  │     - Route to handler based on event type                 │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│         ┌───────────────┼───────────────┐                        │
│         ▼               ▼               ▼                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                    │
│  │  issues  │    │   pull_  │    │  issue_  │    ┌────────┐     │
│  │ handler  │    │ request  │    │ comment  │    │ release │     │
│  │          │    │ handler  │    │ handler  │    │ handler │     │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬───┘     │
│       │               │               │               │          │
│       └───────────────┴───────────────┴───────────────┘          │
│                         │                                        │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  5. Message Formatting                                      │  │
│  │     - Extract relevant fields (title, author, action)       │  │
│  │     - Format human-readable message                        │  │
│  │     - Include URL for context                              │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  6. C4 Comm-Bridge Delivery                                 │  │
│  │     - Execute comm-bridge send.js                          │  │
│  │     - Pass formatted message                               │  │
│  │     - Endpoint determined by config                        │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                   C4 Comm-Bridge                                 │
│  ┌────────────┐                                                   │
│  │  Route to  │                                                   │
│  │  Channel   │                                                   │
│  └────────────┘                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Module Boundaries

### src/index.js (Entry Point)

- Initialize Fastify server
- Register middleware (raw-body, helmet)
- Register webhook route
- Graceful shutdown handler
- Config hot-reload watcher

**Dependencies:** `src/lib/config.js`, `src/lib/webhook.js`

### src/lib/webhook.js (Webhook Handler)

- Signature verification logic
- Deduplication check
- Event type routing
- Acknowledgment response

**Dependencies:** `src/lib/handlers/*.js`, `src/lib/formatters/*.js`

### src/lib/handlers/ (Event Handlers)

| File | Event Type | Responsibility |
|------|-----------|----------------|
| `issues.js` | issues | Extract issue data, determine action |
| `pull-request.js` | pull_request | Extract PR data, merge status |
| `issue-comment.js` | issue_comment | Extract comment, context (issue/PR) |
| `release.js` | release | Extract release info, assets |

**Dependencies:** `src/lib/formatters/*.js`

### src/lib/formatters/ (Message Formatters)

| File | Output | Responsibility |
|------|--------|----------------|
| `issues.js` | String | Human-readable issue notification |
| `pull-request.js` | String | Human-readable PR notification |
| `issue-comment.js` | String | Human-readable comment notification |
| `release.js` | String | Human-readable release notification |

### src/lib/config.js (Configuration)

- Load config from `~/zylos/components/github-webhook/config.json`
- Hot-reload via file watcher
- Default config values

### scripts/send.js (Test Interface)

- Direct message sending for testing
- Bypass C4 comm-bridge
- Used for development/debugging

## Data Flow

### Request Flow

1. **Receive HTTP POST** → Fastify captures raw body as Buffer
2. **Verify Signature** → HMAC-SHA256 comparison, return 401 if invalid
3. **Check Dedupe** → Look up X-GitHub-Delivery, return 200 if duplicate
4. **Parse Event** → Extract event type from header, parse JSON
5. **Route to Handler** → Call appropriate handler based on event type
6. **Format Message** → Handler formats human-readable message
7. **Send Notification** → Execute C4 comm-bridge send command
8. **Acknowledge** → Return 202 (accepted) to GitHub

### Error Handling Flow

| Error Type | Response | Action |
|------------|----------|--------|
| Invalid signature | 401 | Log attempt, abort |
| Duplicate event | 200 | Log duplicate, skip processing |
| Parse error | 400 | Log error, return generic message |
| Send failure | 202 (already acked) | Log error, optionally retry |
| Server error | 500 | Log error, GitHub may retry |

## Component Boundaries & Interfaces

### External Interfaces

| Interface | Direction | Protocol | Format |
|-----------|-----------|----------|--------|
| **Webhook Input** | In | HTTPS POST | JSON (HMAC signed) |
| **C4 Comm-Bridge** | Out | Process spawn | Stdin JSON |
| **Config** | Read/Write | File watch | JSON |

### Internal Interfaces

| Module | Interface | Data Type |
|-------|-----------|-----------|
| `index.js` → `webhook.js` | Middleware function | (req, reply) |
| `webhook.js` → `handlers/*` | Handler function | (payload) → String |
| `handlers/*` → `formatters/*` | Formatter function | (event data) → String |

## Build Order & Dependencies

```
Phase 1: Foundation
  ├── src/lib/config.js (no deps)
  ├── src/lib/verifier.js (crypto only)
  └── src/lib/deduplication.js (in-memory)

Phase 2: Core
  ├── src/lib/formatters/*.js (no external deps)
  ├── src/lib/handlers/*.js (depend on formatters)
  └── src/lib/webhook.js (orchestrate all)

Phase 3: Integration
  ├── src/index.js (Fastify setup)
  ├── scripts/send.js (test interface)
  └── ecosystem.config.cjs (PM2 config)
```

## Configuration Schema

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
      "actions": ["opened", "closed", "merged", "ready_for_review"]
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

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User's Server                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PM2 Process Manager                                   │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  zylos-github-webhook (Node.js)                 │  │  │
│  │  │  Listening: localhost:3461                      │  │  │
│  │  │  Config: ~/zylos/components/github-webhook/     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Port 3461 exposed to internet (firewall configured)         │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │
                          │ HTTPS
                          │
┌─────────────────────────┴─────────────────────────────────────┐
│                   GitHub Webhook Service                       │
│  Configured URL: https://user-domain.com:3461/webhook         │
└───────────────────────────────────────────────────────────────┘
```

## Security Architecture

### Threat Model & Mitigations

| Threat | Mitigation |
|--------|------------|
| **Forged webhooks** | HMAC-SHA256 signature verification |
| **Replay attacks** | X-GitHub-Delivery deduplication |
| **Timing attacks** | Constant-time comparison (timingSafeEqual) |
| **Secret exposure** | Environment variables, no logging |
| **Large payloads** | Size limits, quick acknowledgment |
| **Rate limiting** | Fastify rate-limit plugin |

### Defense in Depth

1. **Layer 1:** HTTPS (TLS encryption)
2. **Layer 2:** HMAC signature verification
3. **Layer 3:** Delivery ID deduplication
4. **Layer 4:** Rate limiting (optional)
5. **Layer 5:** Security headers (Helmet)

## Scalability Considerations

| Aspect | v1 Approach | v2+ Enhancement |
|--------|-------------|-----------------|
| **Horizontal scaling** | Single instance | Multiple instances with shared dedup store |
| **Deduplication** | In-memory Set | Redis/DynamoDB |
| **Queue depth** | Async processing | Persistent queue (BullMQ/SQS) |
| **Monitoring** | File logs | Structured logs + metrics |

## Observability

### Logging Strategy

- **Entry point:** Each request with X-GitHub-Delivery ID
- **Verification:** Signature success/failure
- **Processing:** Event type, handler called
- **Delivery:** C4 comm-bridge success/failure
- **Errors:** Full error context (no secrets)

### Key Metrics

- Webhook received count
- Verification failure rate
- Duplicate event rate
- Event type distribution
- Processing latency (ack time)
- C4 delivery success rate

---

**Last Updated:** 2025-05-11 after initial research
