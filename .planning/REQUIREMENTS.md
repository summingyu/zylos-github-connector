# Requirements: Zylos GitHub Webhook Connector

**Defined:** 2025-05-11
**Core Value:** AI Agents stay informed about GitHub repository activity in real-time without polling.

## v1 Requirements

### Webhook Reception

- [ ] **WEBH-01**: HTTP server receives GitHub Webhook POST requests on configurable port
- [ ] **WEBH-02**: Component preserves raw request bytes before any parsing for signature verification
- [ ] **WEBH-03**: Server responds with 2xx status within GitHub's timeout window (~10 seconds)
- [ ] **WEBH-04**: Component applies security headers (HSTS, X-Frame-Options, nosniff) via helmet middleware

### Security

- [ ] **SECU-01**: Component verifies X-Hub-Signature-256 header using HMAC-SHA256 over raw request body
- [ ] **SECU-02**: Signature comparison uses crypto.timingSafeEqual() to prevent timing attacks
- [ ] **SECU-03**: Webhook secret is stored securely in config.json (not hardcoded)
- [ ] **SECU-04**: Component returns 401 status for invalid signature attempts
- [ ] **SECU-05**: Logs do not contain webhook secrets or full request bodies

### Event Processing

- [ ] **EVENT-01**: Component parses event type from X-GitHub-Event header
- [ ] **EVENT-02**: Component routes events to appropriate handlers based on event type
- [ ] **EVENT-03**: Component tracks processed X-GitHub-Delivery IDs to prevent duplicate processing
- [ ] **EVENT-04**: Component returns 200 status for duplicate delivery IDs (ack but skip processing)

### Event Type Support

- [ ] **ISSUE-01**: Component processes issues events (opened, closed, reopened actions)
- [ ] **ISSUE-02**: Issue notifications include issue title, author, action, and URL
- [ ] **PR-01**: Component processes pull_request events (opened, closed, merged, ready_for_review actions)
- [ ] **PR-02**: PR notifications include PR title, author, action, merge status, and URL
- [ ] **COMM-01**: Component processes issue_comment events (created action)
- [ ] **COMM-02**: Comment notifications include comment author, issue/PR context, and body preview
- [ ] **REL-01**: Component processes release events (published action)
- [ ] **REL-02**: Release notifications include release tag, name, author, and assets

### Message Formatting

- [ ] **FMT-01**: Component formats event data into human-readable notification messages
- [ ] **FMT-02**: Messages include clickable URLs to the relevant GitHub resource
- [ ] **FMT-03**: Messages clearly indicate the action that occurred (opened, closed, merged, etc.)

### Notification Delivery

- [ ] **SEND-01**: Component delivers notifications via C4 comm-bridge
- [ ] **SEND-02**: Component supports configurable notification endpoint
- [ ] **SEND-03**: Component logs success/failure of notification delivery attempts

### Configuration

- [ ] **CONF-01**: Component loads configuration from ~/zylos/components/github-webhook/config.json
- [ ] **CONF-02**: Component supports hot-reload of configuration changes via file watcher
- [ ] **CONF-03**: Configurable webhook secret for signature verification
- [ ] **CONF-04**: Configurable server port (default: 3461)
- [ ] **CONF-05**: Configurable log level (info, debug, error)

### Component Lifecycle

- [ ] **LIFE-01**: Component can be started and stopped via PM2
- [ ] **LIFE-02**: Component implements graceful shutdown on SIGINT/SIGTERM signals
- [ ] **LIFE-03**: ecosystem.config.cjs defines PM2 service configuration
- [ ] **LIFE-04**: Component respects enabled flag in config (exit if disabled)

### Component Metadata

- [ ] **META-01**: SKILL.md includes component metadata (name, version, type, description, config)
- [ ] **META-02**: SKILL.md type is set to "communication"
- [ ] **META-03**: SKILL.md declares dependency on comm-bridge
- [ ] **META-04**: SKILL.md config section defines required webhook secret parameter

### Documentation

- [ ] **DOC-01**: README.md includes installation instructions
- [ ] **DOC-02**: README.md includes configuration instructions (port, secret, endpoints)
- [ ] **DOC-03**: README.md includes GitHub Webhook setup instructions (URL configuration)

### Testing

- [ ] **TEST-01**: Component includes test for signature verification (valid and invalid signatures)
- [ ] **TEST-02**: Component includes test for event type parsing
- [ ] **TEST-03**: Component includes test for delivery ID deduplication

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Reliability

- **RELIA-01**: Persistent deduplication store (Redis) for delivery ID tracking across restarts
- **RELIA-02**: Retry logic for failed notification delivery with exponential backoff
- **RELIA-03**: Dead-letter queue for permanently failed events

### Advanced Features

- **FEAT-01**: Event filtering by label, author, branch, or action
- **FEAT-02**: Custom message templates for user-defined notification formats
- **FEAT-03**: Multi-repository configuration support
- **FEAT-04**: Payload transformation via user-provided JavaScript functions

### Observability

- **OBS-01**: Structured JSON logging with request metadata
- **OBS-02**: Metrics for request count, verification failures, delivery latency
- **OBS-03**: Health check endpoint (/health) for monitoring

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bidirectional GitHub API interaction | One-way notification flow only (stated requirement) |
| Real-time streaming (SSE/WebSocket) | GitHub uses webhook push model, not streaming |
| Historical event sync | Not part of webhook contract; use GitHub API separately |
| Webhook management UI | Notification-focused component; UI is v2+ |
| Multiple auth methods | Webhook secret is sufficient for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WEBH-01 | Phase 1 | Pending |
| WEBH-02 | Phase 1 | Pending |
| WEBH-03 | Phase 1 | Pending |
| WEBH-04 | Phase 1 | Pending |
| SECU-01 | Phase 1 | Pending |
| SECU-02 | Phase 1 | Pending |
| SECU-03 | Phase 1 | Pending |
| SECU-04 | Phase 1 | Pending |
| SECU-05 | Phase 1 | Pending |
| EVENT-01 | Phase 1 | Pending |
| EVENT-02 | Phase 1 | Pending |
| EVENT-03 | Phase 1 | Pending |
| EVENT-04 | Phase 1 | Pending |
| ISSUE-01 | Phase 2 | Pending |
| ISSUE-02 | Phase 2 | Pending |
| PR-01 | Phase 2 | Pending |
| PR-02 | Phase 2 | Pending |
| COMM-01 | Phase 2 | Pending |
| COMM-02 | Phase 2 | Pending |
| REL-01 | Phase 2 | Pending |
| REL-02 | Phase 2 | Pending |
| FMT-01 | Phase 2 | Pending |
| FMT-02 | Phase 2 | Pending |
| FMT-03 | Phase 2 | Pending |
| SEND-01 | Phase 2 | Pending |
| SEND-02 | Phase 2 | Pending |
| SEND-03 | Phase 2 | Pending |
| CONF-01 | Phase 3 | Pending |
| CONF-02 | Phase 3 | Pending |
| CONF-03 | Phase 3 | Pending |
| CONF-04 | Phase 3 | Pending |
| CONF-05 | Phase 3 | Pending |
| LIFE-01 | Phase 3 | Pending |
| LIFE-02 | Phase 3 | Pending |
| LIFE-03 | Phase 3 | Pending |
| LIFE-04 | Phase 3 | Pending |
| META-01 | Phase 4 | Pending |
| META-02 | Phase 4 | Pending |
| META-03 | Phase 4 | Pending |
| META-04 | Phase 4 | Pending |
| DOC-01 | Phase 4 | Pending |
| DOC-02 | Phase 4 | Pending |
| DOC-03 | Phase 4 | Pending |
| TEST-01 | Phase 4 | Pending |
| TEST-02 | Phase 4 | Pending |
| TEST-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---
*Requirements defined: 2025-05-11*
*Last updated: 2025-05-11 after initial definition*
