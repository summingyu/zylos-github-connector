# Features Research: GitHub Webhook Components

**Research Date:** 2025-05-11

## Executive Summary

Based on analysis of GitHub webhook handlers and communication platforms, the **table stakes** features for a production webhook receiver are: signature verification, raw-body preservation, quick acknowledgment with async processing, and basic deduplication. **Differentiators** include advanced filtering, custom templates, replay prevention, and observability integration.

## Feature Categories

### 1. Webhook Reception (Table Stakes)

| Feature | Description | Priority |
|---------|-------------|----------|
| **HTTP Server** | Listen on configurable port for POST requests | Required |
| **Signature Verification** | HMAC-SHA256 over X-Hub-Signature-256 | Required |
| **Raw Body Capture** | Preserve exact bytes before parsing | Required |
| **Event Type Parsing** | Parse GitHub event types from headers | Required |
| **CORS Handling** | Support cross-origin requests if needed | Required |

### 2. Security (Table Stakes)

| Feature | Description | Priority |
|---------|-------------|----------|
| **HMAC Verification** | Constant-time comparison using timingSafeEqual | Required |
| **Secret Storage** | Environment variable or secure store | Required |
| **TLS Support** | HTTPS endpoint | Required |
| **Rate Limiting** | Basic per-IP or per-source limiting | Recommended |
| **Security Headers** | Helmet middleware (HSTS, X-Frame-Options, etc.) | Recommended |

### 3. Event Processing (Table Stakes)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Quick Acknowledgment** | Return 2xx within ~10s (GitHub timeout) | Required |
| **Async Processing** | Queue events for background processing | Required |
| **Event Routing** | Route to handlers based on event type | Required |
| **Payload Parsing** | Extract relevant fields from JSON payload | Required |
| **Error Handling** | Graceful handling of malformed payloads | Required |

### 4. Notification Delivery (Table Stakes)

| Feature | Description | Priority |
|---------|-------------|----------|
| **C4 Comm-Bridge Integration** | Route messages via comm-bridge | Required |
| **Message Formatting** | Human-readable event summaries | Required |
| **Endpoint Specification** | Support different notification endpoints | Required |
| **Delivery Status** | Log success/failure of notification delivery | Required |

### 5. Event Type Support (Table Stakes for v1)

| Event Type | Actions | Notification Content |
|------------|---------|---------------------|
| **issues** | opened, closed, reopened, edited, deleted | Issue title, author, URL, action |
| **pull_request** | opened, closed, merged, ready_for_review | PR title, author, URL, action, merge status |
| **issue_comment** | created, edited, deleted | Comment author, issue/PR context, body preview |
| **release** | published | Release tag, name, author, assets |

### 6. Configuration (Table Stakes)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Webhook Secret** | GitHub webhook secret for signature verification | Required |
| **Server Port** | Configurable listening port | Required |
| **Comm-Bridge Endpoint** | Target for notification delivery | Required |
| **Enabled Events** | Which event types to process | Recommended |
| **Log Level** | Configurable logging verbosity | Recommended |

### 7. Idempotency & Reliability (Recommended)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Delivery ID Tracking** | Track X-GitHub-Delivery to prevent duplicates | Recommended |
| **Timestamp Validation** | Reject events older than 5-10 minutes | Recommended |
| **Retry Logic** | Retry failed notification delivery | Recommended |
| **Dead-Letter Queue** | Store permanently failed events | Optional |

### 8. Advanced Features (Differentiators - v2+)

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Event Filtering** | Filter by label, author, branch, action | Medium |
| **Custom Message Templates** | User-defined notification formats | Medium |
| **Multi-Repository Support** | Handle events from multiple repos | Medium |
| **Payload Transformation** | Custom JavaScript transformation functions | High |
| **Rich Notifications** | Support formatting, tables, code blocks | High |
| **Webhook Management UI** | View received events, delivery status | High |
| **Persistent Event Store** | Store all events for historical analysis | High |

### 9. Observability (Recommended)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Structured Logging** | JSON logs with request metadata | Recommended |
| **Metrics** | Request count, verification failures, delivery latency | Recommended |
| **Health Check** | /health endpoint for monitoring | Recommended |
| **Request Tracing** | Correlate webhook -> notification delivery | Optional |

## Anti-Features (What NOT to Build)

| Feature | Reason |
|---------|--------|
| **Bidirectional GitHub API** | Out of scope for v1; stated one-way flow |
| **Real-time Streaming** | GitHub uses webhook push model, not SSE/WebSocket |
| **Historical Event Sync** | Not part of webhook contract; use GitHub API |
| **Complex UI** | Notification-focused; management UI is v2+ |
| **Multiple Auth Methods** | Only webhook secret needed for v1 |

## Feature Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Server + Raw Body                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Signature Verification                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Deduplication (Delivery ID Check)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Message Formatting                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 C4 Comm-Bridge Delivery                      │
└─────────────────────────────────────────────────────────────┘
```

## Complexity Estimates

| Feature | Implementation Complexity | Testing Complexity |
|---------|-------------------------|---------------------|
| HTTP Server + Raw Body | Low | Low |
| Signature Verification | Low (with library) | Medium (security) |
| Event Type Routing | Low | Low |
| Message Formatting | Medium | Medium |
| C4 Integration | Low | Medium |
| Deduplication | Medium | Medium |
| Event Filtering | Medium | High |
| Custom Templates | High | High |

## v1 Scope Definition

**Table Stakes for v1:**
- HTTP server with raw body capture
- HMAC-SHA256 signature verification
- Event routing for issues, pull_request, issue_comment, release
- C4 comm-bridge message delivery
- Configurable webhook secret, port, log level
- Basic error handling and logging
- PM2 process management
- SKILL.md, config.json, ecosystem.config.cjs

**v2 Candidates (differentiators):**
- Persistent deduplication store
- Event filtering (by label, author, action)
- Custom message templates
- Multi-repository configuration

---

**Last Updated:** 2025-05-11 after initial research
