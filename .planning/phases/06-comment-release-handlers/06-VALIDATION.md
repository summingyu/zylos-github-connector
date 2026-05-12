---
phase: 6
slug: comment-release-handlers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (20+) |
| **Config file** | package.json (test scripts) |
| **Quick run command** | `npm test -- <test-file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <new-test-file>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | COMM-01 | Validate payload structure, reject malformed input | unit | `npm test -- src/lib/__tests__/comment-handler.test.js` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | COMM-02 | Escape HTML entities in comment body | unit | `npm test -- src/lib/__tests__/comment-handler.test.js` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | COMM-02 | Truncate comment body to 200 chars | unit | `npm test -- src/lib/__tests__/comment-handler.test.js` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | REL-01 | Validate payload structure, reject malformed input | unit | `npm test -- src/lib/__tests__/release-handler.test.js` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | REL-02 | Handle missing/empty assets array | unit | `npm test -- src/lib/__tests__/release-handler.test.js` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | COMM-01, REL-01 | End-to-end event routing and processing | integration | `npm test -- src/lib/__tests__/comment-integration.test.js` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | COMM-01, REL-01 | End-to-end event routing and processing | integration | `npm test -- src/lib/__tests__/release-integration.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/comment-handler.test.js` — stubs for COMM-01, COMM-02
- [ ] `src/lib/__tests__/comment-integration.test.js` — integration tests
- [ ] `src/lib/__tests__/release-handler.test.js` — stubs for REL-01, REL-02
- [ ] `src/lib/__tests__/release-integration.test.js` — integration tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verify comment body truncation is appropriate length | COMM-02 | Requires human judgment on readability | Review sample messages in test output |
| Verify release asset count display is clear | REL-02 | Subjective UX assessment | Review sample messages in test output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
