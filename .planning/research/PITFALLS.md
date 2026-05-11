# Pitfalls Research: GitHub Webhook Components

**Research Date:** 2025-05-11

## Executive Summary

Building webhook receivers has well-documented failure modes. The **critical pitfalls** are: raw-body transformation breaking HMAC, timing-attack leaks via string comparison, replay attacks, blocking handlers causing retries, and in-memory deduplication lost on restart. This document catalogs these pitfalls with warning signs, prevention strategies, and phase mappings.

## Critical Pitfalls

### 1. Raw Body Transformation Breaking HMAC

**The Problem:**
JSON parsers, middleware, and proxies can transform the request body (whitespace, Unicode escape sequences, encoding) before signature verification, causing HMAC mismatches even for legitimate webhooks.

**Warning Signs:**
- Signature verification fails randomly
- Works in dev but fails in production
- Different behavior between Express/Fastify/bare http

**Prevention:**
- Capture raw bytes BEFORE any parsing
- Use framework-specific raw-body capture:
  - Express: `express.raw({ type: 'application/json' })`
  - Fastify: Content-type parser with `parseAs: 'buffer'`
  - Bare: Read stream directly into Buffer
- Verify signature over raw Buffer, not parsed JSON

**What to Avoid:**
```javascript
// ❌ WRONG - verifying over parsed JSON
const payload = JSON.parse(req.body);
const signature = computeHmac(payload);

// ✓ CORRECT - verify over raw bytes
const signature = computeHmac(req.rawBody);
```

**Phase to Address:** Phase 1 (core webhook setup)

---

### 2. Timing Attack Leaks via String Comparison

**The Problem:**
Using `===` or `Buffer.compare()` for signature comparison leaks timing information that can be exploited to gradually guess the correct signature.

**Warning Signs:**
- Any code using `===`, `==`, or `.equals()` for signature comparison
- Custom comparison logic

**Prevention:**
- ALWAYS use `crypto.timingSafeEqual()` for signature comparison
- Ensure buffers are same length before comparison
- Compare full signature including `sha256=` prefix

**What to Avoid:**
```javascript
// ❌ WRONG - timing leak
if (computedSig === receivedSig) { /* ... */ }

// ❌ WRONG - timing leak
if (computedSig.toString() === receivedSig) { /* ... */ }

// ✓ CORRECT - constant-time comparison
const a = Buffer.from(computedSig);
const b = Buffer.from(receivedSig);
if (a.length === b.length && crypto.timingSafeEqual(a, b)) { /* ... */ }
```

**Phase to Address:** Phase 1 (signature verification)

---

### 3. Replay Attacks via Captured Signatures

**The Problem:**
Attackers can capture a valid webhook payload with its signature and re-send it later, causing duplicate processing (e.g., double charges, duplicate state transitions).

**Warning Signs:**
- No tracking of processed event IDs
- Same event being processed multiple times
- "Weird" duplicate actions in logs

**Prevention:**
- Extract `X-GitHub-Delivery` header (unique per delivery)
- Store processed delivery IDs in persistent store
- Check for duplicates before processing
- Optionally validate timestamp (reject events > 5-10 minutes old)

**v1 Approach:**
- In-memory Set of processed delivery IDs
- Survives restarts by GitHub retrying
- Acceptable for single-instance deployment

**v2+ Enhancement:**
- Redis/DynamoDB for persistent deduplication
- TTL aligned with GitHub retry window (days)

**Phase to Address:** Phase 1 (basic in-memory), Phase 2+ (persistent store)

---

### 4. Blocking Handlers Causing Retries

**The Problem:**
Performing long-running work synchronously in the webhook handler causes GitHub to timeout (~10s) and retry, leading to duplicate processing and potential retry storms.

**Warning Signs:**
- High processing latency (>5s per request)
- GitHub delivering same event multiple times
- Logs showing timeout errors

**Prevention:**
- **Ack-first pattern:** Verify → Dedupe → Enqueue → Reply 202
- Perform work asynchronously after acknowledgment
- Use queues (BullMQ, SQS, Redis lists) for background processing

**What to Avoid:**
```javascript
// ❌ WRONG - blocking handler
app.post('/webhook', (req, res) => {
  verifySignature(req);
  const message = formatMessage(req.body);
  sendToCommBridge(message); // <-- blocks!
  doSlowDatabaseWork();       // <-- blocks!
  res.status(200).send();
});

// ✓ CORRECT - ack-first
app.post('/webhook', async (req, res) => {
  verifySignature(req);
  if (isDuplicate(req)) return res.status(200).send('duplicate');
  await enqueueWork(req.body);  // <-- fast!
  res.status(202).send('accepted');
});
// Worker processes queue asynchronously
```

**Phase to Address:** Phase 1 (ack-first pattern)

---

### 5. In-Memory Deduplication Lost on Restart

**The Problem:**
Using in-memory storage for delivery IDs means all deduplication state is lost on restart, causing GitHub's retried events to be processed again.

**Warning Signs:**
- Duplicate processing after deployments/restarts
- Higher duplicate rate on Mondays (after weekend deploys)

**Prevention:**
- **v1 acceptable:** In-memory is okay if GitHub retry window is short
- **v2+ required:** Persistent store (Redis, DynamoDB, SQLite)
- Set TTL on dedup keys (24 hours to cover retry window)

**Trade-offs:**
| Approach | Pros | Cons | Phase |
|----------|------|------|-------|
| In-memory Set | Zero dependencies | Lost on restart | v1 |
| Redis | Fast, persistent | Additional service | v2+ |
| SQLite | No external dep | Slower than Redis | v2+ |
| DynamoDB | Serverless | Cost, latency | v2+ |

**Phase to Address:** Phase 1 (in-memory OK), Phase 2+ (persistent if needed)

---

## Important Pitfalls

### 6. Missing Security Headers

**The Problem:**
Without security headers, the endpoint is vulnerable to clickjacking, MIME sniffing, and other browser-based attacks (if exposed to web).

**Warning Signs:**
- Missing Helmet or equivalent middleware
- No HSTS, X-Frame-Options, X-Content-Type-Options

**Prevention:**
- Use `@fastify/helmet` or `helmet` for Express
- Configure CSP (can disable for pure API)
- Enable HSTS, X-Frame-Options, nosniff

**Phase to Address:** Phase 1

---

### 7. Logging Sensitive Data

**The Problem:**
Logging webhook secrets, full payloads, or authentication tokens exposes credentials in log files.

**Warning Signs:**
- Secrets in log files
- Full request bodies logged
- Authentication headers logged

**Prevention:**
- Never log webhook secret
- Log only safe metadata (event type, delivery ID, repo)
- Redact sensitive headers in logs
- Use structured logging with field-level control

**What to Log:**
- ✓ Event type, action, repository
- ✓ X-GitHub-Delivery ID
- ✓ Verification success/failure
- ✓ Processing timestamp, latency
- ✗ Webhook secret
- ✗ Full request body
- ✗ Authentication headers

**Phase to Address:** Phase 1

---

### 8. Payload Size Overflow

**The Problem:**
GitHub payloads can be up to 25MB. Unbounded body parsing can cause memory exhaustion or crashes.

**Warning Signs:**
- OOM kills under load
- Slow processing for large payloads
- High memory usage

**Prevention:**
- Set body size limit in Fastify/Express
- Reject payloads over threshold with 413
- Consider streaming for very large payloads

```javascript
// Fastify body limit
fastify.addContentTypeParser('application/json', {
  bodyLimit: 10 * 1024 * 1024 // 10MB
}, { parseAs: 'buffer' }, handler);
```

**Phase to Address:** Phase 1

---

## Minor Pitfalls

### 9. Incorrect Event Type Parsing

**The Problem:**
Relying on payload content instead of the `X-GitHub-Event` header for event type determination can lead to misrouted events.

**Prevention:**
- Always read `X-GitHub-Event` header for event type
- Parse payload only after event type is known
- Validate event type is in supported list

**Phase to Address:** Phase 1

---

### 10. Missing Graceful Shutdown

**The Problem:**
Abrupt shutdown drops in-flight webhooks and can cause lost events or corrupted state.

**Prevention:**
- Handle SIGINT/SIGTERM
- Close server gracefully (stop accepting new connections)
- Wait for in-flight handlers to complete (with timeout)
- Flush logs and close connections

**Phase to Address:** Phase 1 (template provides pattern)

---

## Pitfall Detection Checklist

Use this checklist during code review and testing:

- [ ] Raw body captured BEFORE any parsing
- [ ] Signature uses `crypto.timingSafeEqual()`
- [ ] X-GitHub-Delivery tracked for deduplication
- [ ] Handler returns 2xx quickly (< 10s)
- [ ] No blocking work in request handler
- [ ] Security headers (Helmet) configured
- [ ] No secrets in logs
- [ ] Body size limit configured
- [ ] Event type from header, not payload
- [ ] Graceful shutdown implemented

## Testing for Pitfalls

### Unit Tests
- Test signature verification with valid/invalid signatures
- Test timing-safe equality (edge cases: different lengths)
- Test deduplication (duplicate detection)

### Integration Tests
- Send real GitHub webhooks (use smee.io or ngrok)
- Test with large payloads (> 1MB)
- Test timeout scenarios (slow downstream)
- Test restart scenarios (duplicate detection)

### Security Tests
- Attempt replay attacks (resend captured webhook)
- Attempt forgery (invalid signature)
- Test timing attack resistance (statistical analysis)

## Phase Mapping

| Pitfall | Phase | Priority |
|--------|-------|----------|
| Raw body transformation | 1 | Critical |
| Timing attacks | 1 | Critical |
| Replay attacks | 1 (basic) / 2+ (persistent) | Critical |
| Blocking handlers | 1 | Critical |
| In-memory dedup loss | 1 (OK) / 2+ (fix if needed) | Important |
| Security headers | 1 | Important |
| Logging sensitive data | 1 | Important |
| Payload overflow | 1 | Important |
| Event type parsing | 1 | Minor |
| Graceful shutdown | 1 | Minor |

---

**Last Updated:** 2025-05-11 after initial research
