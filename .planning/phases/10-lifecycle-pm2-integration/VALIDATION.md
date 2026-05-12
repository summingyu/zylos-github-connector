# Phase 10 Validation: Lifecycle and PM2 Integration

**Phase:** 10 - Lifecycle and PM2 Integration
**Status:** Ready for Execution
**Last Updated:** 2026-05-12

## Goal-Backward Validation Checklist

### Success Criteria Mapping

| Criterion | Requirement | Validation Method | Status |
|-----------|-------------|-------------------|--------|
| PM2 can start and stop service | LIFE-01 | Integration test + manual PM2 commands | ⏳ Pending |
| Graceful shutdown cleans resources | LIFE-02 | Code review + shutdown logs | ⏳ Pending |
| ecosystem.config.cjs defines PM2 service | LIFE-03 | File existence + syntax check | ⏳ Pending |
| Component exits when disabled in config | LIFE-04 | Unit test + config test | ⏳ Pending |

### Artifact Validation

#### Required Artifacts

1. **ecosystem.config.cjs**
   - [ ] Uses `path.join(__dirname)` for cwd
   - [ ] Script path points to `src/index.js`
   - [ ] Log paths use relative paths
   - [ ] All required fields present (name, script, cwd)

2. **src/index.js**
   - [ ] SIGINT signal handler registered
   - [ ] SIGTERM signal handler registered
   - [ ] shutdown() function cleans all resources
   - [ ] Timeout protection (10 seconds) present

3. **tests/integration/lifecycle.test.js**
   - [ ] At least 10 test cases
   - [ ] Tests for PM2 start/stop/restart/delete
   - [ ] Tests for graceful shutdown
   - [ ] Tests for disabled flag exit

4. **scripts/pm2-test.sh**
   - [ ] Executable permissions
   - [ ] Tests for start/stop/restart/disabled
   - [ ] Cleanup function
   - [ ] Color-coded output

### Test Coverage Matrix

| Test Type | Test Cases | File | Status |
|-----------|-----------|------|--------|
| PM2 Start | 3+ | lifecycle.test.js | ⏳ Pending |
| PM2 Stop | 2+ | lifecycle.test.js | ⏳ Pending |
| PM2 Restart | 2+ | lifecycle.test.js | ⏳ Pending |
| PM2 Delete | 1+ | lifecycle.test.js | ⏳ Pending |
| Graceful Shutdown | 2+ | lifecycle.test.js | ⏳ Pending |
| Disabled Flag | 1+ | lifecycle.test.js | ⏳ Pending |
| **Total** | **11+** | | |

### Verification Commands

```bash
# 1. PM2 Configuration Check
cat ecosystem.config.cjs | grep -q "path.join(__dirname)" && echo "✓ cwd uses dynamic path" || echo "✗ cwd check failed"

# 2. Signal Handlers Check
grep -q "process.on('SIGINT'" src/index.js && echo "✓ SIGINT handler present" || echo "✗ SIGINT handler missing"
grep -q "process.on('SIGTERM'" src/index.js && echo "✓ SIGTERM handler present" || echo "✗ SIGTERM handler missing"

# 3. PM2 Start Test
pm2 delete zylos-github-connector 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 list | grep zylos-github-connector | grep -q "online" && echo "✓ PM2 start successful" || echo "✗ PM2 start failed"

# 4. PM2 Stop Test
pm2 stop zylos-github-connector
pm2 list | grep zylos-github-connector | grep -q "stopped" && echo "✓ PM2 stop successful" || echo "✗ PM2 stop failed"

# 5. PM2 Restart Test
pm2 restart zylos-github-connector
pm2 list | grep zylos-github-connector | grep -q "online" && echo "✓ PM2 restart successful" || echo "✗ PM2 restart failed"

# 6. Cleanup
pm2 delete zylos-github-connector

# 7. Run Integration Tests
npm test -- --grep "PM2"

# 8. Run Test Script
bash scripts/pm2-test.sh
```

### Threat Model Validation

| Threat ID | Category | Mitigation Implemented |
|-----------|----------|----------------------|
| T-10-01 | DoS (Log Growth) | ⏳ Documented in script, pm2-logrotate optional |
| T-10-02 | Info Disclosure (Log Permissions) | ⏳ Verify log dir 0700, files 0600 |
| T-10-03 | Privilege Escalation (PM2 Permissions) | ⏳ Verify running as non-root |

### Exit Criteria

Phase 10 is complete when:

- [x] RESEARCH.md created and reviewed
- [x] PLAN.md created and verified
- [ ] ecosystem.config.cjs path fixed
- [ ] All integration tests passing (11+ tests)
- [ ] PM2 test script working
- [ ] Manual PM2 commands verified (start/stop/restart/delete)
- [ ] Graceful shutdown logs verified
- [ ] Disabled flag exit verified
- [ ] SUMMARY.md created

### Pre-Execution Checklist

**Environment:**
- [ ] PM2 installed globally (`pm2 --version`)
- [ ] Node.js version >= 20.0.0
- [ ] Log directory exists or can be created

**Dependencies:**
- [ ] Phase 9 completed (Configuration Management)
- [ ] src/index.js exists and is working
- [ ] config.json exists with valid structure

**Risks:**
- [ ] PM2 not installed → Install with `npm install -g pm2`
- [ ] Log directory permissions → Fix with `chmod 700 ~/zylos/components/github-connector/logs`

---

## Nyquist Validation Gaps

This section will be updated during execution to track any gaps between planned validation and actual implementation.

| Gap ID | Description | Discovered | Resolved |
|--------|-------------|------------|----------|
| None | No gaps identified yet | - | - |

---

**Validation Status:** ⏳ **PENDING EXECUTION**

**Next Step:** Execute Phase 10 with `/gsd-execute-phase 10`
