# Stack Research: Zylos GitHub Webhook Connector

**Research Date:** 2025-05-11

## Executive Summary

For a GitHub Webhook receiver component in the Zylos ecosystem, we recommend **Fastify** with **raw-body capture middleware** for the HTTP server, combined with **@octokit/webhooks** for signature verification. This provides the best balance of performance, security, and developer experience.

## Core Technology Stack

| Component | Recommendation | Version | Rationale |
|-----------|----------------|---------|-----------|
| **Runtime** | Node.js | LTS (20.x+) | Zylos ecosystem standard; async/await; crypto API |
| **HTTP Framework** | Fastify | Latest | High throughput; built-in validation; plugin ecosystem |
| **Webhook Verification** | @octokit/webhooks | Latest | Official Octokit; TypeScript types; tested middleware |
| **Body Parser** | fastify-raw-body | Latest | Required for HMAC verification over raw bytes |
| **Logging** | Pino | Latest | Fastify default; structured JSON logging |
| **Config Management** | Custom (per template) | - | Hot-reload via file watcher (template pattern) |
| **Process Manager** | PM2 | Latest | Required by Zylos component spec |

## Detailed Recommendations

### 1. HTTP Server Framework: Fastify

**Why Fastify over Express:**

- **Performance:** ~4-5x higher throughput in benchmarks (46,664 req/s vs 9,433 req/s for Express)
- **Built-in features:** JSON schema validation, Pino logging, rate limiting plugins
- **Plugin ecosystem:** fastify-raw-body, fastify-helmet, fastify-rate-limit
- **TypeScript support:** First-class if needed later

**Raw Body Capture (Critical for HMAC):**

Fastify does not expose raw body by default. Must use one of:

```javascript
// Option A: Content-type parser with parseAs: 'buffer'
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' },
  (req, body, done) => {
    req.rawBody = body;
    done(null, JSON.parse(body));
  }
);

// Option B: fastify-raw-body plugin
import fastifyRawBody from 'fastify-raw-body';
fastify.register(fastifyRawBody);
```

**Confidence:** High — Fastify is production-proven and Zylos components can use any framework.

### 2. Webhook Signature Verification: @octokit/webhooks

**Why official library:**

- Tested verification logic (HMAC-SHA256 over raw bytes)
- Middleware for Node.js (`createNodeMiddleware`)
- TypeScript types included
- Handles edge cases (timing-safe comparison, buffer lengths)

**Alternative:** Manual verification with `crypto.createHmac()` and `crypto.timingSafeEqual()`

**Confidence:** High — This is the official GitHub library.

### 3. Logging: Pino

**Why Pino:**

- Fastify default logger
- Structured JSON output
- Low overhead
- Easy integration with log aggregators

**Confidence:** High — Aligns with Fastify ecosystem.

### 4. Process Management: PM2

**Required by Zylos spec:**

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'zylos-github-webhook',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
};
```

**Confidence:** Required — Specified in zylos-component-template.

## Dependencies

### Production Dependencies

```json
{
  "fastify": "^5.x",
  "@octokit/webhooks": "^15.x",
  "fastify-raw-body": "^5.x",
  "pino": "^9.x",
  "dotenv": "^16.x"
}
```

### Dev Dependencies

```json
{
  "pm2": "^5.x",
  "nodemon": "^4.x"
}
```

## What NOT To Use

| Technology | Why Not |
|------------|---------|
| **Express** | Higher overhead; manual raw-body capture error-prone |
| **Bare Node http** | More custom code required; no built-in validation/logging |
| **Custom HMAC** | Verification is security-critical; use tested library |
| **In-memory dedupe** | Lost on restart; use persistent store (optional for v1) |

## Security Headers

Use `fastify-helmet` for OWASP-recommended headers:

```javascript
import helmet from '@fastify/helmet';
fastify.register(helmet, {
  contentSecurityPolicy: false // API server, can disable CSP
});
```

## Deployment Considerations

- **Port:** Configurable (default 3461, similar to zylos-telegram's 3460)
- **TLS:** Let user manage (standalone port mode)
- **Payload Size Limit:** Configure in Fastify (GitHub caps at 25MB)
- **Timeout:** Fastify default should be fine; GitHub expects ~10s response

## Compatibility Matrix

| Component | Zylos Template | zylos-telegram | This Component |
|-----------|----------------|----------------|----------------|
| Node.js | ✓ | ✓ | ✓ |
| Fastify | - | - | ✓ |
| PM2 | ✓ | ✓ | ✓ |
| Config hot-reload | ✓ | ✓ | ✓ |
| C4 comm-bridge | ✓ | ✓ | ✓ |

## Evolution

- **v1:** Core webhook reception and forwarding
- **v2+:** Consider adding persistent idempotency store (Redis), event filtering, custom templates

---

**Last Updated:** 2025-05-11 after initial research
