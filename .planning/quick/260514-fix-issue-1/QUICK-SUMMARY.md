---
phase: quick
plan: fix-issue-1
subsystem: deployment
tags: [pm2, configuration, testing, path-resolution]

# Dependency graph
requires:
  - phase: "1"
    provides: ["HTTP server基础", "配置系统"]
provides:
  - PM2 ecosystem 配置符合组件规范
  - Configure hook 正确的键映射和类型转换
  - 跨机器兼容的测试路径解析
affects: ["deployment", "configuration", "testing"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["动态路径解析", "配置键映射", "类型转换"]

key-files:
  created: []
  modified:
    - ecosystem.config.cjs
    - hooks/configure.js
    - tests/unit/config/config-watcher.test.js
    - tests/integration/config/hot-reload.test.js

key-decisions:
  - "使用 os.homedir() 替代 __dirname 实现 code/data 分离"
  - "GITHUB_WEBHOOK_SECRET 映射为 webhookSecret（而非 secret）"
  - "Port 配置项添加 parseInt() 类型转换"
  - "测试中使用 getProjectRoot() 动态解析路径"

patterns-established:
  - "PM2 配置模式：代码目录（skills/）与数据目录（components/）分离"
  - "Configure hook 模式：环境变量到配置键的映射和类型转换"
  - "测试路径模式：动态解析项目根目录，确保跨机器兼容性"

requirements-completed: []

# Metrics
duration: 1min
completed: 2026-05-13
---

# Quick Plan: 修复 GitHub Issue #1

**PM2 配置路径规范修复、configure hook 键映射修正、测试硬编码路径移除**

## Performance

- **Duration:** ~1 minute
- **Started:** 2026-05-13T20:19:51Z
- **Completed:** 2026-05-13T20:20:54Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- 修复 ecosystem.config.cjs 路径符合 zylos 组件规范（code/data 分离）
- 修复 configure hook 的 GITHUB_WEBHOOK_SECRET → webhookSecret 映射
- 修复 configure hook 的 port 类型转换（string → number）
- 移除 tests/ 目录中所有硬编码绝对路径，实现跨机器兼容

## Task Commits

Each task was committed atomically:

1. **Task 1: ecosystem.config.cjs 路径修复** - `2b9f11a` (fix)
2. **Task 2: configure hook key mapping 修复** - `5ed16df` (fix)
3. **Task 3: tests/ 目录移除硬编码路径** - `865f51b` (fix)

## Files Created/Modified

- `ecosystem.config.cjs` - 引入 os 模块，修复 cwd 和日志路径
- `hooks/configure.js` - 修复键映射和添加类型转换函数
- `tests/unit/config/config-watcher.test.js` - 添加 getProjectRoot()，移除硬编码路径
- `tests/integration/config/hot-reload.test.js` - 添加 getProjectRoot()，移除硬编码路径

## Decisions Made

1. **PM2 路径规范** - 遵循 zylos-component-template，代码目录（skills/）和数据目录（components/）必须分离，防止组件升级时数据丢失
2. **配置键命名** - `GITHUB_WEBHOOK_SECRET` 应映射为 `webhookSecret` 而非 `secret`，与 src/lib/config.js 读取字段一致
3. **类型转换** - Port 配置从环境变量读取为 string，必须在 configure hook 转换为 number
4. **测试路径解析** - 使用 `getProjectRoot()` 动态解析项目根目录，确保测试在不同机器上都能运行

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all fixes applied successfully and verified with tests.

## Verification

- **Fix 1:** ecosystem.config.cjs 路径符合组件规范（引入 os 模块，正确的 cwd 和日志路径）
- **Fix 2:** configure hook 正确映射 GITHUB_WEBHOOK_SECRET → webhookSecret，port 类型正确转换
- **Fix 3:** 所有 519 个测试通过，无硬编码路径残留

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 所有 3 个阻塞部署问题已修复
- 组件可以正常部署和运行
- 测试套件在所有环境中都能通过

---
*Phase: quick*
*Completed: 2026-05-13*
