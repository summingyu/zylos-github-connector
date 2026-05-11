# Research Summary: Zylos GitHub Webhook Connector

**Research Date:** 2025-05-11
**Status:** Complete

## Key Findings

### Stack Recommendations

| Decision | Recommendation | Confidence |
|----------|----------------|------------|
| **HTTP Framework** | Fastify (latest) | High |
| **Verification** | @octokit/webhooks library | High |
| **Raw Body** | fastify-raw-body plugin | High |
| **Logging** | Pino (Fastify default) | High |
| **Process Mgmt** | PM2 (Zylos requirement) | Required |

**Why Fastify:** ~4-5x higher throughput than Express, built-in validation, plugin ecosystem, aligns with Zylos performance goals.

### Table Stakes Features (Must Have)

1. **Security:** HMAC-SHA256 signature verification, constant-time comparison, TLS support
2. **Reliability:** Raw body preservation, ack-first pattern, X-GitHub-Delivery deduplication
3. **Event Support:** issues, pull_request, issue_comment, release events
4. **Integration:** C4 comm-bridge message delivery
5. **Operations:** PM2 management, config hot-reload, structured logging

### Differentiators (v2+)

- Event filtering (by label, author, action)
- Custom message templates
- Multi-repository configuration
- Persistent deduplication store (Redis)
- Webhook management UI

### Watch Out For

| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| **Raw body transformation** | Signature mismatch | Capture raw bytes before parsing |
| **Timing attacks** | Secret leak via timing | Use crypto.timingSafeEqual() |
| **Replay attacks** | Duplicate processing | Track X-GitHub-Delivery IDs |
| **Blocking handlers** | Timeouts, retries | Ack-first + async processing |
| **Memory dedup loss** | Duplicates after restart | Persistent store (v2+) |

## Architecture Highlights

**Flow:** GitHub → HTTPS POST → Fastify → Signature Verify → Dedupe Check → Event Routing → Format → C4 Comm-Bridge → User Channel

**Key Design Decisions:**
- **One-way flow:** No GitHub API write operations in v1
- **Ack-first:** Return 202 quickly, process asynchronously
- **Standalone port:** Direct exposure, not Caddy reverse proxy
- **In-memory dedup:** Acceptable for v1 single-instance

## Technical Constraints

- Must preserve raw request bytes for HMAC verification
- Must respond within GitHub's ~10s timeout
- Must handle payloads up to 25MB (set limits)
- Must integrate with C4 comm-bridge for delivery

## Recommended v1 Scope

**Core:**
- Fastify HTTP server with raw-body capture
- @octokit/webhooks signature verification
- In-memory X-GitHub-Delivery deduplication
- Event handlers for issues, PRs, comments, releases
- C4 comm-bridge integration
- PM2 ecosystem configuration
- Basic logging and error handling

**Explicitly Out of Scope:**
- Bidirectional GitHub API interaction
- Persistent deduplication store
- Event filtering
- Custom templates
- Management UI

## Evidence Quality

- **Stack Research:** Based on 2025 framework benchmarks and GitHub official docs
- **Features Research:** Synthesized from webhook platform best practices
- **Architecture:** Derived from zylos-telegram and template patterns
- **Pitfalls:** Curated from security research and production incidents

---

**Next Steps:** Define requirements (REQUIREMENTS.md) based on research findings.
