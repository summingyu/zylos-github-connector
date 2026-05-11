# Roadmap: Zylos GitHub Webhook Connector

**Created:** 2025-05-11
**Mode:** Fine-grained (8-12 phases with 5-10 plans each)
**Project Mode:** MVP (vertical slices)

## Overview

**12 phases** | **43 requirements** | **100% coverage** ✓

This roadmap builds the GitHub Webhook Connector as a Zylos communication component. Each phase delivers a vertical slice of working functionality, progressing from core webhook infrastructure through event handling to configuration, lifecycle, and documentation.

---

## Phase 1: HTTP Server Foundation

**Goal:** Establish Fastify HTTP server with raw body capture and security headers.

**Mode:** mvp

**Success Criteria:**
1. Fastify server listens on configurable port
2. Raw request body is preserved as Buffer before parsing
3. Security headers (Helmet) are applied
4. Webhook route accepts POST requests
5. Server can be started and stopped gracefully

**Requirements:** WEBH-01, WEBH-02, WEBH-04

**Plans:**
- Initialize Fastify server with configurable port from config
- Register fastify-raw-body middleware to preserve request bytes
- Configure Helmet middleware for security headers
- Define POST /webhook route that accepts requests
- Implement graceful shutdown handler (SIGINT/SIGTERM)
- Add basic request logging with Pino

---

## Phase 2: Signature Verification

**Goal:** Implement secure HMAC-SHA256 webhook signature verification.

**Mode:** mvp

**Success Criteria:**
1. X-Hub-Signature-256 header is extracted and validated
2. HMAC is computed over raw request body
3. Constant-time comparison prevents timing attacks
4. Invalid signatures return 401 status
5. Verification succeeds for legitimate GitHub webhooks

**Requirements:** SECU-01, SECU-02, SECU-04, SECU-05, WEBH-03

**Plans:**
- Extract X-Hub-Signature-256 header from incoming request
- Compute HMAC-SHA256 over raw body using webhook secret
- Implement constant-time comparison with crypto.timingSafeEqual
- Return 401 for signature mismatch with generic error message
- Ensure webhook secret is loaded from config (not hardcoded)
- Add verification success/failure logging (without secrets)
- Test with valid and invalid signatures

---

## Phase 3: Event Routing & Deduplication

**Goal:** Parse event types, route to handlers, and prevent duplicate processing.

**Mode:** mvp

**Success Criteria:**
1. X-GitHub-Event header determines event type
2. X-GitHub-Delivery header is tracked for deduplication
3. Duplicate delivery IDs return 200 without reprocessing
4. Events are routed to appropriate handler functions
5. Request payload is parsed as JSON after verification

**Requirements:** EVENT-01, EVENT-02, EVENT-03, EVENT-04

**Plans:**
- Extract X-GitHub-Event header to determine event type
- Extract X-GitHub-Delivery header for deduplication
- Implement in-memory Set to track processed delivery IDs
- Check delivery ID and return 200 if duplicate
- Parse request payload as JSON after verification
- Create router that dispatches to handler functions by event type
- Add logging for event type and routing decisions

---

## Phase 4: Issues Event Handler

**Goal:** Handle issues events (opened, closed, reopened) with formatted notifications.

**Mode:** mvp

**Success Criteria:**
1. Issues events are received and parsed
2. Issue notifications include title, author, action, URL
3. Actions are filtered (opened, closed, reopened)
4. Handler returns formatted message string

**Requirements:** ISSUE-01, ISSUE-02, FMT-01, FMT-03

**Plans:**
- Create issues event handler function
- Extract issue data from payload (title, author, action, URL)
- Filter for supported actions (opened, closed, reopened)
- Format human-readable message with issue details
- Include clickable URL to the issue
- Test with sample issue event payloads

---

## Phase 5: Pull Request Event Handler

**Goal:** Handle pull_request events (opened, closed, merged, ready_for_review) with formatted notifications.

**Mode:** mvp

**Success Criteria:**
1. Pull request events are received and parsed
2. PR notifications include title, author, action, merge status, URL
3. Actions are filtered (opened, closed, merged, ready_for_review)
4. Merge status is correctly identified

**Requirements:** PR-01, PR-02, FMT-01, FMT-03

**Plans:**
- Create pull_request event handler function
- Extract PR data from payload (title, author, action, merged status, URL)
- Filter for supported actions (opened, closed, merged, ready_for_review)
- Format human-readable message with PR details and merge status
- Include clickable URL to the pull request
- Test with sample PR event payloads (including merged state)

---

## Phase 6: Comment & Release Event Handlers

**Goal:** Handle issue_comment and release events with formatted notifications.

**Mode:** mvp

**Success Criteria:**
1. Comment events are received and parsed with issue/PR context
2. Release events are received and parsed with assets
3. Comment notifications include author, context, body preview
4. Release notifications include tag, name, author, assets

**Requirements:** COMM-01, COMM-02, REL-01, REL-02, FMT-01

**Plans:**
- Create issue_comment event handler function
- Extract comment data (author, body, issue/PR context)
- Format comment notification with context preview
- Create release event handler function
- Extract release data (tag, name, author, assets)
- Format release notification with asset information
- Test with sample comment and release event payloads

---

## Phase 7: Message Formatting Module

**Goal:** Centralize message formatting logic with consistent structure and URL handling.

**Mode:** mvp

**Success Criteria:**
1. All notifications use consistent message format
2. URLs are included and clickable
3. Actions are clearly indicated in messages
4. Formatters are modular and reusable

**Requirements:** FMT-01, FMT-02, FMT-03

**Plans:**
- Create base formatter with consistent message structure
- Implement URL helper for clickable GitHub links
- Implement action label formatter (opened/closed/merged/etc.)
- Refactor handlers to use centralized formatters
- Ensure all messages follow the same format pattern
- Test formatting for all event types

---

## Phase 8: C4 Comm-Bridge Integration

**Goal:** Deliver formatted notifications via C4 comm-bridge.

**Mode:** mvp

**Success Criteria:**
1. Messages are sent through C4 comm-bridge
2. Notification endpoint is configurable
3. Delivery success/failure is logged
4. Integration works with test messages

**Requirements:** SEND-01, SEND-02, SEND-03

**Plans:**
- Integrate C4 comm-bridge send script execution
- Pass formatted message to comm-bridge
- Support configurable notification endpoint from config
- Log delivery success/failure
- Handle comm-bridge errors gracefully
- Test end-to-end message delivery

---

## Phase 9: Configuration Management

**Goal:** Implement configuration loading with hot-reload and defaults.

**Mode:** mvp

**Success Criteria:**
1. Config is loaded from ~/zylos/components/github-webhook/config.json
2. Config changes are hot-reloaded via file watcher
3. Default values are applied for missing config
4. Webhook secret, port, and log level are configurable

**Requirements:** CONF-01, CONF-02, CONF-03, CONF-04, CONF-05

**Plans:**
- Create config loader function with file path constants
- Define default configuration schema
- Implement file watcher for hot-reload
- Load and merge user config with defaults
- Add config validation for required fields
- Log config reload events

---

## Phase 10: Lifecycle & PM2 Integration

**Goal:** Implement PM2 process management with graceful shutdown and enabled flag.

**Mode:** mvp

**Success Criteria:**
1. Component starts and stops via PM2
2. Graceful shutdown closes connections properly
3. ecosystem.config.cjs defines PM2 service
4. Component exits if disabled in config

**Requirements:** LIFE-01, LIFE-02, LIFE-03, LIFE-04

**Plans:**
- Create ecosystem.config.cjs for PM2
- Implement enabled flag check in startup
- Add graceful shutdown for active connections
- Configure PM2 restart and memory limits
- Test PM2 start, restart, stop operations
- Verify component exits when disabled

---

## Phase 11: Component Metadata (SKILL.md)

**Goal:** Complete SKILL.md with component metadata and configuration schema.

**Mode:** mvp

**Success Criteria:**
1. SKILL.md includes all required fields (name, version, type, description)
2. Type is set to "communication"
3. Dependency on comm-bridge is declared
4. Config section defines webhook secret parameter

**Requirements:** META-01, META-02, META-03, META-04

**Plans:**
- Create SKILL.md with component metadata frontmatter
- Set component name (github-webhook) and version (0.1.0)
- Write description with trigger patterns
- Set type to "communication"
- Declare comm-bridge dependency
- Define config schema with webhook secret (required, sensitive)

---

## Phase 12: Documentation & Testing

**Goal:** Complete README with installation/config instructions and add basic tests.

**Mode:** mvp

**Success Criteria:**
1. README includes installation instructions
2. README includes configuration instructions
3. README includes GitHub Webhook setup instructions
4. Tests cover signature verification, event parsing, deduplication

**Requirements:** DOC-01, DOC-02, DOC-03, TEST-01, TEST-02, TEST-03

**Plans:**
- Write README with project description and overview
- Document installation steps (npm install, PM2 setup)
- Document configuration (port, secret, endpoints)
- Document GitHub Webhook setup (URL, secret configuration)
- Create test for signature verification (valid/invalid)
- Create test for event type parsing
- Create test for delivery ID deduplication

---

## Phase Dependencies

```
Phase 1 (HTTP Server)
    ↓
Phase 2 (Signature Verification)
    ↓
Phase 3 (Event Routing)
    ↓
    ├──→ Phase 4 (Issues) ──────────┐
    ├──→ Phase 5 (PRs) ─────────────┤
    ├──→ Phase 6 (Comments/Release) ─┤
    │                                 ↓
    │                         Phase 7 (Formatting)
    │                                 ↓
    └────────────────────────→ Phase 8 (Comm-Bridge)
                                      ↓
                               Phase 9 (Config)
                                      ↓
                               Phase 10 (Lifecycle)
                                      ↓
                               Phase 11 (Metadata)
                                      ↓
                               Phase 12 (Docs/Tests)
```

---

## Milestone Definition

**Milestone 1: Core Infrastructure (Phases 1-3)**
- Working HTTP server with signature verification
- Event routing and deduplication
- Can receive and validate GitHub webhooks

**Milestone 2: Event Handling (Phases 4-7)**
- All event types processed (issues, PRs, comments, releases)
- Formatted notification messages
- End-to-end event flow working

**Milestone 3: Integration (Phases 8-10)**
- C4 comm-bridge delivery
- Configuration management
- PM2 lifecycle management

**Milestone 4: Production Ready (Phases 11-12)**
- Complete metadata and documentation
- Basic test coverage
- Ready for installation and use

---

**Last Updated:** 2025-05-11
