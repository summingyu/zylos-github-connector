# Phase 1 Context: HTTP Server Foundation

**Project:** Zylos GitHub Webhook Connector
**Phase:** 1 — HTTP Server Foundation
**Date:** 2025-05-11
**Status:** Ready to Plan

---

## Domain

建立带有原始体捕获和安全头的 Fastify HTTP 服务器。此阶段提供接收 GitHub webhook 事件的基础设施，为后续的签名验证、事件路由和处理做准备。

---

## Canonical Refs

- `.planning/ROADMAP.md` — Phase definition and success criteria
- `.planning/REQUIREMENTS.md` — Requirements WEBH-01、WEBH-02、WEBH-04
- `DESIGN.md` — Architecture design and tech stack decisions
- `CLAUDE.md` — Raw body capture and signature verification implementation notes

---

## Code Context

**Existing:**

- `src/index.js` — Main entry point framework with graceful shutdown
- `src/lib/config.js` — Configuration loader with hot reload
- `package.json` — Project metadata (no dependencies)
- `ecosystem.config.cjs` — PM2 configuration

**Patterns:**

- Configuration management: `~/zylos/components/github-webhook/config.json`
- Log prefix: `[github-webhook]`
- Data directory: `~/zylos/components/github-webhook/`

---

## Decisions

### Server Configuration

| Decision | Value | Rationale |
|----------|-------|-----------|
| Health Check Endpoint | `GET /health` returns 200 and basic status | For PM2 health check and monitoring |
| Request Timeout | 120 seconds | Ample processing time, beyond GitHub retry window |
| Body Size Limit | 10MB | GitHub webhook payload limit, handles large events |

### Security Middleware

| Decision | Value | Rationale |
|----------|-------|-----------|
| Helmet Config | Default configuration | Apply all recommended security headers, no customization needed |

### Error Handling

| Decision | Value | Rationale |
|----------|-------|-----------|
| Startup Failure | Exit and let PM2 restart | Production best practice, auto-recovery |
| Runtime Error | Log and graceful shutdown | Prevent error state propagation, preserve logs for debugging |

### Logging Strategy

| Decision | Value | Rationale |
|----------|-------|-----------|
| Request Log Content | Method、path、status code、duration + GitHub headers (X-GitHub-*) | Sufficient debugging info, avoids noise |
| Startup Log Content | Server address、port、full config (excluding secret) | Detailed startup status, aids troubleshooting |

---

## Locked from Prior Decisions

- **Framework:** Fastify (from DESIGN.md)
- **Raw Body Capture:** Must capture raw bytes before any parsing (from CLAUDE.md)
- **Security:** Helmet middleware (from ROADMAP.md)
- **Logging:** Pino (from DESIGN.md)
- **Process Management:** PM2 (from ecosystem.config.cjs)

---

## Implementation Notes

### Raw Body Capture (Critical)

必须在进行任何解析之前捕获原始字节，为阶段 2 的 HMAC 签名验证做准备：

```javascript
// Fastify raw body capture
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' },
  (req, body, done) => {
    req.rawBody = body;  // Preserve for HMAC
    done(null, JSON.parse(body));
  }
);
```

### Graceful Shutdown

服务器应正确处理 SIGINT/SIGTERM 并关闭连接：

```javascript
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

### Configuration Port

从配置文件加载端口，默认 3461：

```javascript
const config = getConfig();
const port = config.port || 3461;
```

---

## Success Criteria (from ROADMAP.md)

1. Fastify server listens on configurable port
2. Raw request body preserved as Buffer before parsing
3. Security headers applied (Helmet)
4. Webhook route accepts POST requests
5. Server can start and stop gracefully

---

## Next Steps

```bash
# Create detailed plan
/gsd-plan-phase 1
```

---

**Last Updated:** 2025-05-11 after discussion
