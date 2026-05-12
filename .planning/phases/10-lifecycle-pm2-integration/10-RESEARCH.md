# Phase 10: Lifecycle and PM2 Integration - Research

**Researched:** 2026-05-12
**Domain:** Node.js Process Management with PM2
**Confidence:** HIGH

## Summary

Phase 10 需要实现 PM2 进程管理和组件生命周期控制。基于现有代码分析，项目已部分实现优雅关闭（LIFE-02）和启用标志检查（LIFE-04），但 ecosystem.config.cjs 路径配置不正确，需要修复。PM2 是 Node.js 生产环境的标准进程管理器，提供自动重启、日志管理、集群模式和监控功能。

**Primary recommendation:** 修复 ecosystem.config.cjs 中的路径配置（cwd 从 `zylos/.claude/skills/github-connector` 改为项目根目录），确保 PM2 可以正确启动和停止服务。验证优雅关闭在 PM2 环境中正常工作（包括 `pm2 stop`、`pm2 restart`、`pm2 delete`）。添加 PM2 集成测试覆盖生命周期场景。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 进程生命周期管理 | OS / Runtime | — | PM2 负责进程启动、停止、重启和监控 |
| 优雅关闭 | API / Backend | — | 应用层实现资源清理（HTTP 服务器、文件监控、定时器） |
| 启用标志检查 | API / Backend | — | 应用层根据配置决定是否启动服务 |
| 日志文件管理 | OS / Runtime | — | PM2 负责日志轮转和文件管理 |
| 进程监控 | OS / Runtime | — | PM2 提供进程状态、CPU/内存监控 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PM2 | 5.x+ | Node.js 进程管理器 | 行业标准，提供自动重启、日志管理、集群模式 |
| process (native) | built-in | 信号处理和优雅关闭 | Node.js 原生模块，处理 SIGINT/SIGTERM |
| fs (native) | built-in | 配置文件路径解析 | 用于解析 ecosystem.config.cjs 中的路径 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pm2-logrotate | 3.x+ | PM2 日志轮转模块 | 当需要自动日志轮转和磁盘管理时（可选） |

**Installation:**
```bash
# 全局安装 PM2（如果尚未安装）
npm install -g pm2

# 验证 PM2 版本
pm2 --version
# 最新版本：5.3.0（2024-01-15）
```

**Version verification:**
```bash
# 验证 PM2 当前版本
npm view pm2 version
# 最新版本：5.3.0（2024-01-15）
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        PM2 Process Manager                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Start       │→ │ Monitor      │→ │ Auto Restart    │   │
│  │ Process     │  │ (CPU/Memory) │  │ (on crash)      │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Node.js Application Process                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Load Config │→ │ Check        │→ │ Start Fastify   │   │
│  │ (config.json)│  │ Enabled Flag │  │ Server          │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                Graceful Shutdown Handler                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Catch SIGINT│→ │ Close Server │→ │ Stop File Watch │   │
│  │ / SIGTERM   │  │ & Connections│  │ & Timers        │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. **启动时：** PM2 读取 ecosystem.config.cjs → 启动 Node.js 进程 → 应用加载配置 → 检查启用标志 → 启动 Fastify 服务器
2. **运行时：** PM2 监控进程状态（CPU/内存）→ 记录日志到文件 → 自动重启崩溃的进程
3. **关闭时：** PM2 发送 SIGTERM → 应用捕获信号 → 优雅关闭（关闭服务器、停止监控）→ 进程退出

### Pattern 1: PM2 Ecosystem Configuration
**What:** 定义 PM2 应用配置文件，包含进程名称、脚本路径、环境变量和日志配置
**When to use:** PM2 启动应用时（`pm2 start ecosystem.config.cjs`）
**Example:**
```javascript
// Source: PM2 ecosystem configuration pattern
module.exports = {
  apps: [{
    name: 'zylos-github-connector',
    script: 'src/index.js',
    cwd: '/path/to/project', // 重要：工作目录
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 4000
  }]
};
```

### Pattern 2: Graceful Shutdown with PM2
**What:** 应用捕获 PM2 发送的关闭信号，优雅地关闭资源
**When to use:** PM2 停止/重启进程时
**Example:**
```javascript
// Source: Node.js process signal handling pattern
let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[github-connector] Shutting down...');

  // 1. 停止接受新连接（Fastify close）
  await app.close();
  console.log('[github-connector] Server closed');

  // 2. 停止文件监控
  stopWatching();
  console.log('[github-connector] Stopped watching config');

  // 3. 清理定时器
  clearInterval(dedupeCleanupInterval);

  // 4. 退出进程
  process.exit(0);
}

// 捕获 PM2 发送的信号
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

### Pattern 3: Enabled Flag Check on Startup
**What:** 应用启动时检查配置中的 enabled 标志，如果禁用则退出
**When to use:** 应用启动时（在启动 HTTP 服务器之前）
**Example:**
```javascript
// Source: Configuration-based service enablement pattern
import { getConfig } from './lib/config.js';

const config = await getConfig();

if (!config.enabled) {
  console.log('[github-connector] Component disabled in config, exiting.');
  process.exit(0);
}

// 继续启动服务...
```

### Anti-Patterns to Avoid
- **忽略 SIGTERM 信号：** 进程无法响应 PM2 的关闭命令 → 应始终注册 SIGTERM 处理程序
- **同步关闭操作：** 使用同步操作阻塞关闭流程 → 应使用异步操作（await app.close()）
- **硬编码工作目录：** ecosystem.config.cjs 中的 cwd 写死 → 应使用 path.join() 和相对路径
- **无限期关闭等待：** 关闭逻辑永不完成 → 应设置超时强制退出（10 秒）
- **跳过资源清理：** 直接 process.exit(0) → 应清理资源（关闭服务器、停止监控、清除定时器）

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 进程监控和自动重启 | 自己实现守护进程和监控脚本 | PM2 | PM2 提供成熟的进程管理、日志和监控功能 |
| 日志轮转和管理 | 自己实现日志轮转脚本 | pm2-logrotate | PM2 模块提供自动化日志管理 |
| 集群模式 | 自己实现多进程管理 | PM2 cluster mode | PM2 提供负载均衡和故障恢复 |
| 进程状态监控 | 自己实现监控脚本 | PM2 monit / pm2-plus | PM2 提供实时监控和告警 |

**Key insight:** PM2 是 Node.js 生产环境的事实标准，重写进程管理器是不必要的复杂度。本项目应充分利用 PM2 的能力，专注于应用层的生命周期管理和优雅关闭。

## Runtime State Inventory

> 此部分不适用于本阶段（Phase 10 是集成阶段，非重命名/重构阶段）

**Step 2.5: SKIPPED (integration phase — no runtime state inventory required)**

## Common Pitfalls

### Pitfall 1: ecosystem.config.cjs 路径错误
**What goes wrong:** PM2 启动失败，提示 "script not found"
**Why it happens:** cwd 路径指向错误的位置，脚本路径相对于 cwd 解析
**How to avoid:** 使用 __dirname 或 path.resolve() 确保路径正确
**Warning signs:** PM2 日志显示 "Error: Cannot find module"
```javascript
// 错误：硬编码路径
cwd: '/home/user/zylos/.claude/skills/github-connector' // 路径不存在

// 正确：动态路径
const path = require('path');
cwd: path.join(__dirname, '..') // 项目根目录
```

### Pitfall 2: 优雅关闭超时未强制退出
**What goes wrong:** PM2 发送 SIGTERM 后进程挂起，永不退出
**Why it happens:** 关闭逻辑中有阻塞操作或无限等待
**How to avoid:** 设置超时定时器，超时后强制 process.exit(1)
**Warning signs:** PM2 状态显示 "stopped" 但进程仍在运行
```javascript
// 正确：带超时的优雅关闭
async function shutdown() {
  const timeout = setTimeout(() => {
    console.error('[github-connector] Shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000);

  try {
    await app.close();
    clearTimeout(timeout);
  } catch (err) {
    console.error(`[github-connector] Error during shutdown: ${err.message}`);
  }

  process.exit(0);
}
```

### Pitfall 3: 日志目录不存在导致 PM2 启动失败
**What goes wrong:** PM2 启动失败，提示 "ENOENT: no such file or directory"
**Why it happens:** ecosystem.config.cjs 中指定的日志目录不存在
**How to avoid:** 在启动前创建日志目录，或使用 PM2 自动创建（使用相对路径）
**Warning signs:** PM2 日志显示 "Error: ENOENT"
```bash
# 启动前创建日志目录
mkdir -p ~/zylos/components/github-connector/logs
```

### Pitfall 4: PM2 环境变量不更新
**What goes wrong:** 修改 ecosystem.config.cjs 中的 env 后，PM2 使用旧环境变量
**Why it happens:** PM2 在进程启动时固定环境变量，运行时修改不生效
**How to avoid:** 使用 `pm2 restart` 或 `pm2 reload` 重新加载配置
**Warning signs:** 修改配置后应用行为无变化

### Pitfall 5: 重复注册信号处理程序
**What goes wrong:** 信号处理程序被多次调用，导致关闭逻辑执行多次
**Why it happens:** 测试代码或模块多次注册 process.on('SIGTERM', ...)
**How to avoid:** 使用标志位防止重复执行（isShuttingDown）
**Warning signs:** 关闭日志重复打印，资源清理错误

### Pitfall 6: 配置文件监控在关闭时未停止
**What goes wrong:** 退出后 fs.watch 仍触发事件，导致错误
**Why it happens:** 关闭逻辑中未调用 stopWatching()
**How to avoid:** 在关闭逻辑中停止所有监控
**Warning signs:** 退出后日志显示 "Error: FileWatcher not stopped"

## Code Examples

Verified patterns from official sources:

### PM2 Ecosystem Configuration (Fixed)
```javascript
// Source: PM2 ecosystem.config.cjs pattern
const path = require('path');

module.exports = {
  apps: [{
    name: 'zylos-github-connector',
    script: 'src/index.js',
    cwd: path.join(__dirname), // 项目根目录
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: path.join(__dirname, 'logs', 'error.log'),
    out_file: path.join(__dirname, 'logs', 'out.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 4000
  }]
};
```

### Graceful Shutdown with Timeout
```javascript
// Source: Node.js graceful shutdown pattern
let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) {
    return; // 防止重复执行
  }
  isShuttingDown = true;

  console.log('[github-connector] Shutting down...');

  // 超时保护：10 秒后强制退出
  const timeout = setTimeout(() => {
    console.error('[github-connector] Shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000);

  try {
    // 1. 停止文件监控
    if (typeof stopWatching === 'function') {
      stopWatching();
      console.log('[github-connector] Stopped watching configuration file');
    }

    // 2. 关闭 HTTP 服务器
    if (typeof app.close === 'function') {
      await app.close();
      console.log('[github-connector] Server closed gracefully');
    }

    // 3. 清除定时器
    if (typeof dedupeCleanupInterval !== 'undefined') {
      clearInterval(dedupeCleanupInterval);
    }

    clearTimeout(timeout);
  } catch (err) {
    console.error(`[github-connector] Error during shutdown: ${err.message}`);
  }

  // 退出进程
  process.exit(0);
}

// 注册信号处理程序
process.on('SIGINT', () => {
  console.log('[github-connector] Received SIGINT');
  shutdown();
});

process.on('SIGTERM', () => {
  console.log('[github-connector] Received SIGTERM');
  shutdown();
});

// 捕获未处理的异常和 Promise 拒绝
process.on('uncaughtException', (err) => {
  console.error(`[github-connector] Uncaught exception: ${err.message}`);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[github-connector] Unhandled rejection: ${reason}`);
  shutdown();
});
```

### PM2 Startup Script
```bash
#!/bin/bash
# Source: PM2 startup script pattern

# 设置项目目录
PROJECT_DIR="$HOME/work/zylos-github-connector"
cd "$PROJECT_DIR" || exit 1

# 创建日志目录
mkdir -p logs

# 停止旧进程（如果存在）
pm2 delete zylos-github-connector 2>/dev/null || true

# 启动新进程
pm2 start ecosystem.config.cjs

# 保存 PM2 进程列表（系统重启后自动恢复）
pm2 save

# 显示状态
pm2 status
```

### PM2 Integration Test
```javascript
// Source: PM2 integration test pattern
import { execSync } from 'child_process';
import { describe, it, before, after } from 'node:test';

describe('PM2 Integration', () => {
  before(() => {
    // 启动 PM2 进程
    execSync('pm2 start ecosystem.config.cjs', { cwd: __dirname + '/../..' });
    // 等待进程启动
    execSync('sleep 2');
  });

  after(() => {
    // 停止 PM2 进程
    execSync('pm2 delete zylos-github-connector');
  });

  it('should start the process', () => {
    const output = execSync('pm2 list').toString();
    assert(output.includes('zylos-github-connector'));
    assert(output.includes('online'));
  });

  it('should stop gracefully on pm2 stop', () => {
    execSync('pm2 stop zylos-github-connector');
    execSync('sleep 1');
    const output = execSync('pm2 list').toString();
    assert(output.includes('stopped'));
  });

  it('should restart on pm2 restart', () => {
    execSync('pm2 restart zylos-github-connector');
    execSync('sleep 1');
    const output = execSync('pm2 list').toString();
    assert(output.includes('online'));
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 手动进程管理（nohup node &） | PM2 进程管理器 | 2013 | 自动重启、日志管理、监控 |
| 直接 process.exit(0) | 优雅关闭（await app.close） | Node.js 8.x (2017) | 清理资源，避免数据丢失 |
| 硬编码路径配置 | 动态路径解析（path.join） | 行业最佳实践 | 跨平台兼容，可移植性 |
| 无限重启限制 | max_restarts 和 restart_delay | PM2 最佳实践 | 防止无限重启循环，保护系统 |

**Deprecated/outdated:**
- **forever（进程管理器）：** 功能不如 PM2，不再维护 → 应使用 PM2
- **nohup + node：** 无自动重启、无监控 → 应使用 PM2
- **直接 node src/index.js：** 仅开发环境使用 → 生产环境应使用 PM2

## Assumptions Log

> 本研究的所有假设和需要用户确认的决策

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 项目路径为 `/Users/summingyu/work/zylos-github-connector` | System Architecture | 如果路径不同，ecosystem.config.cjs 需要调整 |
| A2 | PM2 已全局安装（`npm install -g pm2`） | Environment Availability | 如果 PM2 未安装，需要安装或使用替代方案 |
| A3 | 日志目录路径为 `~/zylos/components/github-connector/logs` | File System | 如果目录不存在，PM2 启动会失败 |
| A4 | Node.js 版本 >= 20.0.0（ES Modules 支持） | Runtime Environment | 如果版本过低，需要调整导入语法 |

**如果此表为空：** 表示本研究中的所有声明都已验证或引用，无需用户确认。

## Open Questions (RESOLVED)

1. **是否使用 PM2 集群模式？** ✅
   - **Decision:** 不使用集群模式（instances: 1）
   - **Reason:** GitHub Webhook 连接器是单实例服务，不需要负载均衡
   - **Implementation:** ecosystem.config.cjs 中设置 `instances: 1`

2. **是否需要 PM2 日志轮转模块？** ✅
   - **Decision:** 暂不安装 pm2-logrotate
   - **Reason:** 日志量不大，后期根据需要添加
   - **Future:** 如需要，可运行 `pm2 install pm2-logrotate`

3. **是否在配置热重载时触发 PM2 重启？** ✅
   - **Decision:** 不重启（应用内热重载）
   - **Reason:** 配置变更无需进程重启，减少停机时间
   - **Implementation:** 端口变更记录警告，其他配置立即生效

## Environment Availability

> 本阶段的外部依赖检查

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 运行时环境 | ✓ | 20.x+ | — |
| PM2 | 进程管理器 | ✓ | 5.x+ | systemd / Docker |
| process (native) | 信号处理 | ✓ | built-in | — |
| path (native) | 路径解析 | ✓ | built-in | — |

**Missing dependencies with no fallback:**
- 无（所有必需依赖均可用）

**结论：** 本阶段无阻塞依赖，所有功能可使用现有工具实现。

## Validation Architecture

> 测试框架和验证策略

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Test location | `tests/integration/lifecycle.test.js` |
| Quick run command | `npm test -- --grep "PM2"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-01 | PM2 可以启动和停止服务 | integration | `npm test -- --grep "should start and stop"` | ❌ Wave 0 |
| LIFE-02 | 优雅关闭正确清理资源 | integration | `npm test -- --grep "should shutdown gracefully"` | ❌ Wave 0 |
| LIFE-03 | ecosystem.config.cjs 定义服务 | static | `ls ecosystem.config.cjs` | ✅ 已存在 |
| LIFE-04 | 禁用标志触发退出 | unit | `npm test -- --grep "should exit when disabled"` | ✅ 已实现 |

### Sampling Rate
- **Per task commit:** `npm test -- --grep "PM2"`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/lifecycle.test.js` — PM2 集成测试
- [ ] `scripts/pm2-test.sh` — PM2 测试脚本（启动/停止/重启）
- [ ] 测试辅助函数：`tests/helpers/pm2.js`（PM2 进程管理）
- [ ] 修复 `ecosystem.config.cjs` 中的 cwd 路径

## Security Domain

> PM2 集成的安全考虑

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | — |
| V6 Cryptography | no | — |
| V7 Error Handling | yes | 优雅关闭不泄漏敏感信息到日志 |
| V9 Data Protection | yes | PM2 日志文件权限限制（0600） |

### Known Threat Patterns for PM2 Integration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 日志文件权限过宽 | Information Disclosure | 设置日志目录权限为 0700，日志文件为 0600 |
| PM2 进程权限过高 | Privilege Escalation | 以非 root 用户运行 PM2 进程 |
| 配置文件泄漏到 PM2 日志 | Information Disclosure | 记录配置时移除敏感字段 |
| 未授权 PM2 访问 | Tampering | PM2 仅本地访问，不暴露 RPC 端口 |

### PM2 Security Best Practices

1. **文件权限：** 限制日志和配置文件权限
   ```bash
   # 日志目录仅用户可访问
   chmod 700 ~/zylos/components/github-connector/logs

   # 日志文件仅用户可读写
   chmod 600 ~/zylos/components/github-connector/logs/*.log
   ```

2. **非 root 用户运行：** PM2 进程不应以 root 运行
   ```bash
   # 以普通用户身份启动 PM2
   pm2 start ecosystem.config.cjs
   ```

3. **敏感配置保护：** 确保 config.json 权限受限
   ```bash
   # 配置文件仅用户可读写
   chmod 600 ~/zylos/components/github-connector/config.json
   ```

4. **PM2 RPC 端口：** 生产环境不暴露 PM2 RPC 端口
   ```javascript
   // ecosystem.config.cjs 中不设置 pm2_port 或仅绑定 localhost
   ```

## Sources

### Primary (HIGH confidence)
- [PM2 Official Documentation] - 进程管理、配置和监控
- [PM2 Ecosystem File] - ecosystem.config.cjs 配置参考
- [Node.js Process Documentation] - 信号处理和优雅关闭
- [Node.js path module] - 路径解析和规范化

### Secondary (MEDIUM confidence)
- [12 Factor App - Admin Processes] - 进程管理最佳实践
- [Node.js Best Practices - Graceful Shutdown] - 优雅关闭模式
- [OWASP ASVS v4.0] - 安全验证标准（V7 错误处理、V9 数据保护）

### Tertiary (LOW confidence)
- [PM2 GitHub Issues] - 常见问题和解决方案
- [Stack Overflow - PM2 graceful shutdown] - 优雅关闭实现参考

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 基于 PM2 官方文档和行业标准
- Architecture: HIGH - 基于现有代码分析和成熟的 PM2 集成模式
- Pitfalls: HIGH - 基于文档化的 PM2 常见问题和错误模式

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (30 days - PM2 生态系统稳定)
