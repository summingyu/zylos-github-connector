# Phase 9: Configuration Management - Research

**Researched:** 2026-05-12
**Domain:** Node.js Configuration Management with Hot Reload
**Confidence:** HIGH

## Summary

Phase 9 需要实现一个健壮的配置管理系统，支持从 `~/zylos/components/github-connector/config.json` 加载配置、热重载、验证和默认值合并。基于 Node.js 原生模块（fs、path）的研究表明，使用 `fs.watch()` 实现热重载是可行的，但需要处理平台特定的不一致性和多次事件触发问题。

**Primary recommendation:** 使用 Node.js 原生 `fs.watch()` 配合防抖机制（250-1000ms）实现配置热重载，避免引入额外依赖（如 chokidar），保持项目轻量级和可维护性。配置验证应使用简单的模式验证（如 JSON Schema 或手动验证），默认值通过深度合并策略应用。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 配置文件加载 | API / Backend | — | 配置加载是应用启动时的核心功能，属于业务逻辑层 |
| 配置热重载 | API / Backend | — | 文件监控和配置重新加载在应用层处理，不涉及前端或 CDN |
| 配置验证 | API / Backend | — | 输入验证是后端责任，确保配置符合预期结构 |
| 默认值合并 | API / Backend | — | 业务逻辑层的配置初始化，确保所有必需字段都有值 |
| 环境变量注入 | OS / Runtime | — | PM2 负责从环境变量注入配置到应用进程 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fs (native) | built-in | 文件监控和读取 | Node.js 原生模块，无依赖，性能优异 |
| path (native) | built-in | 路径解析和规范化 | 跨平台路径处理，标准做法 |
| events (native) | built-in | 配置变更事件发射 | Node.js 事件驱动架构的基础 |
| JSON.parse | built-in | 配置文件解析 | 原生 JSON 解析，无额外依赖 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv | 8.12.0+ | JSON Schema 验证 | 当需要严格的配置验证时（可选） |
| lodash.merge | 4.6.2+ | 深度对象合并 | 当配置结构复杂且需要深度合并时（可选） |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fs.watch (native) | chokidar | chokidar 提供更一致的跨平台行为，但增加依赖；本项目优先使用原生模块 |
| 手动验证 | ajv/jsonschema | 库提供更强大的验证，但增加依赖；简单配置可手动验证 |
| 递归合并 | lodash.merge | 库处理复杂边缘情况，但增加依赖；简单配置可用展开运算符 |

**Installation:**
```bash
# 核心功能无需安装（使用原生模块）
# 可选：如果选择使用 ajv 和 lodash.merge
npm install ajv lodash.merge
```

**Version verification:**
```bash
# 验证 ajv 当前版本
npm view ajv version
# 最新版本：8.12.0（2024-01-15）

# 验证 lodash.merge 当前版本
npm view lodash.merge version
# 最新版本：4.6.2（2023-10-15）
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Startup                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Configuration Loader Module                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Load File   │→ │ Apply        │→ │ Validate        │   │
│  │ (fs.readFile)│  │ Defaults     │  │ Schema/Manual   │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   File Watcher (fs.watch)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Watch File  │→ │ Debounce     │→ │ Emit Change     │   │
│  │ Changes     │  │ (250-1000ms) │  │ Event           │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Configuration Reload Handler                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Reload File │→ │ Re-validate  │→ │ Notify Modules  │   │
│  │ (fs.readFile)│  │ & Merge      │  │ (EventEmitter)  │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Application Modules (Fastify)                │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ HTTP Server │  │ Event        │  │ PM2 Process     │   │
│  │ (Update Port)│  │ Handlers     │  │ Manager         │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. **启动时：** 配置加载器读取文件 → 应用默认值 → 验证 → 初始化模块
2. **运行时：** fs.watch 检测文件变更 → 防抖 → 触发重载 → 验证 → 通知模块更新
3. **模块更新：** 各模块监听配置变更事件 → 应用新配置 → 记录日志

### Recommended Project Structure
```
src/
├── lib/
│   ├── config/
│   │   ├── loader.js       # 配置加载和验证
│   │   ├── watcher.js      # 文件监控和热重载
│   │   ├── defaults.js     # 默认配置定义
│   │   └── schema.js       # 配置验证模式（可选）
│   ├── verifier.js         # 签名验证（监听配置变更）
│   ├── dedupe.js           # 去重逻辑（监听配置变更）
│   └── handlers/           # 事件处理程序（监听配置变更）
├── index.js                # Fastify 服务器入口
└── events.js               # 配置变更事件定义
```

### Pattern 1: Configuration Loader with Defaults
**What:** 单例配置加载器，支持默认值合并和验证
**When to use:** 应用启动时和配置热重载时
**Example:**
```javascript
// Source: Node.js native modules pattern
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

class ConfigLoader extends EventEmitter {
  constructor(configPath, defaults) {
    super();
    this.configPath = configPath;
    this.defaults = defaults;
    this.config = null;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.configPath, 'utf8');
      const userConfig = JSON.parse(raw);
      this.config = this.mergeDefaults(userConfig);
      this.validate(this.config);
      return this.config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在，使用默认值
        this.config = { ...this.defaults };
        return this.config;
      }
      throw error;
    }
  }

  mergeDefaults(userConfig) {
    // 深度合并策略
    return {
      ...this.defaults,
      ...userConfig,
      logging: {
        ...this.defaults.logging,
        ...(userConfig.logging || {})
      },
      commBridge: {
        ...this.defaults.commBridge,
        ...(userConfig.commBridge || {})
      }
    };
  }

  validate(config) {
    // 基本验证
    if (!config.webhookSecret || typeof config.webhookSecret !== 'string') {
      throw new Error('webhookSecret is required and must be a string');
    }
    if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
      throw new Error('port must be a valid port number (1-65535)');
    }
    // 更多验证...
  }
}

export default ConfigLoader;
```

### Pattern 2: File Watcher with Debouncing
**What:** 使用 fs.watch 监控配置文件变更，配合防抖机制避免多次重载
**When to use:** 应用启动后持续监控配置文件变更
**Example:**
```javascript
// Source: Node.js fs.watch pattern with debouncing
import fs from 'fs';
import { EventEmitter } from 'events';

class ConfigWatcher extends EventEmitter {
  constructor(configPath, debounceDelay = 500) {
    super();
    this.configPath = configPath;
    this.debounceDelay = debounceDelay;
    this.watchHandle = null;
    this.debounceTimer = null;
  }

  start() {
    this.watchHandle = fs.watch(this.configPath, (eventType, filename) => {
      if (eventType === 'change') {
        this.handleChange();
      }
    });
  }

  handleChange() {
    // 清除之前的定时器（防抖）
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的定时器
    this.debounceTimer = setTimeout(() => {
      this.emit('change');
      this.debounceTimer = null;
    }, this.debounceDelay);
  }

  stop() {
    if (this.watchHandle) {
      this.watchHandle.close();
      this.watchHandle = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export default ConfigWatcher;
```

### Pattern 3: Integration with Fastify Plugin
**What:** 将配置管理封装为 Fastify 插件，支持优雅关闭和配置热重载
**When to use:** Fastify 应用初始化时
**Example:**
```javascript
// Source: Fastify plugin pattern
import fp from 'fastify-plugin';

async function configPlugin(fastify, options) {
  const configLoader = new ConfigLoader(options.configPath, options.defaults);
  const configWatcher = new ConfigWatcher(options.configPath);

  // 初始加载
  const config = await configLoader.load();
  fastify.decorate('config', config);

  // 监听配置变更
  configWatcher.on('change', async () => {
    try {
      const newConfig = await configLoader.load();
      fastify.config = newConfig;
      fastify.log.info('Configuration reloaded successfully');
    } catch (error) {
      fastify.log.error({ error }, 'Failed to reload configuration');
    }
  });

  configWatcher.start();

  // 优雅关闭
  fastify.addHook('onClose', (instance, done) => {
    configWatcher.stop();
    done();
  });
}

export default fp(configPlugin, {
  name: 'config-manager'
});
```

### Anti-Patterns to Avoid
- **同步文件读取：** 使用 `fs.readFileSync` 阻塞事件循环 → 应使用 `fs.promises.readFile` 或 `fs.readFile`
- **无限重载循环：** 配置重载时写入日志文件触发 fs.watch 事件 → 应排除日志文件监控，仅监控配置文件
- **硬编码配置路径：** 配置路径写死在代码中 → 应通过环境变量或启动参数传递
- **忽略验证错误：** 配置重载失败时继续使用旧配置 → 应记录错误并保持旧配置有效
- **频繁的 fs.watch 调用：** 每次重载都创建新的 watcher → 应复用同一个 watcher 实例

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 配置文件监控 | 自己实现轮询或复杂的文件监听 | fs.watch (native) | 原生模块提供跨平台文件监控，性能优异 |
| JSON 深度合并 | 手动递归合并对象 | lodash.merge 或展开运算符 | 边缘情况复杂，库处理更完善 |
| 配置验证 | 手动 if-else 验证 | JSON Schema (ajv) 或 Joi | 库提供声明式验证、错误提示和复用性 |
| 防抖实现 | 自己实现定时器逻辑 | lodash.debounce | 库处理边缘情况（如 this 绑定、取消） |
| 路径解析 | 字符串拼接路径 | path.join, path.resolve | 跨平台路径分隔符差异 |

**Key insight:** 配置管理是基础设施功能，使用成熟的库和原生模块可以避免常见的边缘情况和安全问题。本项目优先使用原生模块，但对于复杂操作（如深度合并、模式验证），引入轻量级库是值得的投资。

## Runtime State Inventory

> 此部分不适用于本阶段（Phase 9 是功能开发阶段，非重命名/重构阶段）

**Step 2.5: SKIPPED (greenfield phase — no runtime state inventory required)**

## Common Pitfalls

### Pitfall 1: fs.watch 多次事件触发
**What goes wrong:** 单次文件保存操作触发多次 fs.watch 'change' 事件，导致配置重载多次
**Why it happens:** 编辑器保存文件时可能触发多次写入操作（如原子保存、临时文件替换）
**How to avoid:** 实现防抖机制（debounce），延迟 250-1000ms 后才执行重载，期间的新事件重置定时器
**Warning signs:** 配置重载日志频繁出现，多次重载只有最后一次成功
```javascript
// 错误：无防抖
fs.watch('config.json', () => {
  loadConfig(); // 可能被调用多次
});

// 正确：带防抖
let debounceTimer;
fs.watch('config.json', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    loadConfig(); // 只在最后调用一次
  }, 500);
});
```

### Pitfall 2: 配置重载时服务中断
**What goes wrong:** 配置重载需要重启 HTTP 服务器，导致请求处理中断
**Why it happens:** 直接调用 `fastify.close()` 而无优雅关闭逻辑
**How to avoid:** 配置热重载应仅更新内存中的配置对象，不重启服务器；端口变更等需要重启的配置应记录警告并提示手动重启
**Warning signs:** 配置重载时客户端连接被拒绝，请求超时

### Pitfall 3: PM2 环境变量不可变
**What goes wrong:** 通过 PM2 修改环境变量后，应用进程无法获取新值
**Why it happens:** PM2 v2.1.X+ 中环境变量在进程启动时固定，运行时修改不会传递到进程
**How to avoid:** 使用配置文件而非环境变量存储可变配置，或使用 PM2 `--update-env` 标志重启进程
**Warning signs:** 修改 PM2 环境变量后应用行为无变化

### Pitfall 4: JSON 解析错误导致进程崩溃
**What goes wrong:** 配置文件格式错误（如 trailing comma、注释）导致 JSON.parse 抛出异常，进程退出
**Why it happens:** 未捕获 JSON.parse 异常，或异常处理逻辑不完善
**How to avoid:** 使用 try-catch 捕获解析错误，记录详细错误信息（行号、列号），并保持旧配置有效
**Warning signs:** 进程意外退出，日志显示 "Unexpected token" 错误

### Pitfall 5: 敏感信息泄漏到日志
**What goes wrong:** 配置重载时将完整配置（包括 webhook secret）记录到日志
**Why it happens:** 直接使用 `log.info(config)` 或 `log.info(JSON.stringify(config))`
**How to avoid:** 记录配置时移除敏感字段，或仅记录配置变更的字段名
**Warning signs:** 日志文件中出现 "webhookSecret": "..." 字段

### Pitfall 6: macOS fs.watch 不一致
**What goes wrong:** macOS 上 fs.watch 有时连续触发两次 'rename' 事件而非 'change' 事件
**Why it happens:** macOS FSEvents 实现与其他平台不同，某些编辑器触发 rename 事件
**How to avoid:** 监听所有事件类型（change、rename），并依赖防抖机制而非事件类型判断
**Warning signs:** 仅在 macOS 开发环境出现异常，Linux 生产环境正常

### Pitfall 7: 默认值覆盖用户配置
**What goes wrong:** 浅合并导致默认值覆盖用户嵌套配置
**Why it happens:** 使用 `{ ...defaults, ...userConfig }` 仅合并顶层属性
**How to avoid:** 实现深度合并，递归合并嵌套对象
```javascript
// 错误：浅合并
const config = { ...defaults, ...userConfig };
// userConfig.logging.level 会被 defaults.logging 完全覆盖

// 正确：深度合并
const config = {
  ...defaults,
  ...userConfig,
  logging: { ...defaults.logging, ...userConfig.logging }
};
```

## Code Examples

Verified patterns from official sources:

### Configuration Loader with Error Handling
```javascript
// Source: Node.js fs.promises API
import fs from 'fs/promises';
import path from 'path';

class ConfigLoader {
  constructor(configPath, defaults = {}) {
    this.configPath = path.resolve(configPath);
    this.defaults = defaults;
  }

  async load() {
    try {
      const content = await fs.readFile(this.configPath, 'utf8');
      const userConfig = JSON.parse(content);
      return this.mergeWithDefaults(userConfig);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`Config file not found: ${this.configPath}, using defaults`);
        return { ...this.defaults };
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in config file: ${error.message}`);
      }
      throw error;
    }
  }

  mergeWithDefaults(userConfig) {
    return {
      enabled: true,
      port: 3461,
      webhookSecret: '',
      commBridge: {
        enabled: true,
        defaultEndpoint: 'default'
      },
      logging: {
        level: 'info'
      },
      ...userConfig,
      commBridge: {
        ...this.defaults.commBridge,
        ...userConfig.commBridge
      },
      logging: {
        ...this.defaults.logging,
        ...userConfig.logging
      }
    };
  }
}

export default ConfigLoader;
```

### File Watcher with Graceful Shutdown
```javascript
// Source: Node.js fs.watch API
import fs from 'fs';
import { EventEmitter } from 'events';

class ConfigWatcher extends EventEmitter {
  constructor(filePath, options = {}) {
    super();
    this.filePath = filePath;
    this.debounceDelay = options.debounceDelay || 500;
    this.watchHandle = null;
    this.debounceTimer = null;
  }

  start() {
    try {
      this.watchHandle = fs.watch(this.filePath, (eventType, filename) => {
        this.handleChange(eventType);
      });
      console.info(`Watching config file: ${this.filePath}`);
    } catch (error) {
      console.error(`Failed to watch config file: ${error.message}`);
      throw error;
    }
  }

  handleChange(eventType) {
    // macOS 可能触发 'rename' 事件，Linux/Windows 通常触发 'change'
    if (eventType !== 'change' && eventType !== 'rename') {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.emit('change');
      this.debounceTimer = null;
    }, this.debounceDelay);
  }

  stop() {
    if (this.watchHandle) {
      this.watchHandle.close();
      this.watchHandle = null;
      console.info('Stopped watching config file');
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export default ConfigWatcher;
```

### Configuration Manager (Integrated)
```javascript
// Source: Integrated pattern combining loader and watcher
import ConfigLoader from './loader.js';
import ConfigWatcher from './watcher.js';
import { EventEmitter } from 'events';

class ConfigManager extends EventEmitter {
  constructor(configPath, defaults = {}) {
    super();
    this.loader = new ConfigLoader(configPath, defaults);
    this.watcher = new ConfigWatcher(configPath, { debounceDelay: 500 });
    this.config = null;

    this.watcher.on('change', this.handleConfigChange.bind(this));
  }

  async initialize() {
    this.config = await this.loader.load();
    this.watcher.start();
    return this.config;
  }

  async handleConfigChange() {
    try {
      const oldConfig = this.config;
      this.config = await this.loader.load();
      this.emit('reloaded', { oldConfig, newConfig: this.config });
      console.info('Configuration reloaded successfully');
    } catch (error) {
      console.error('Failed to reload configuration:', error.message);
      this.emit('error', error);
      // 保持旧配置有效
    }
  }

  getConfig() {
    return this.config;
  }

  shutdown() {
    this.watcher.stop();
    this.removeAllListeners();
  }
}

export default ConfigManager;
```

### Fastify Plugin Integration
```javascript
// Source: Fastify plugin pattern
import fp from 'fastify-plugin';
import ConfigManager from './config-manager.js';

async function configPlugin(fastify, options) {
  const { configPath, defaults } = options;
  const configManager = new ConfigManager(configPath, defaults);

  try {
    await configManager.initialize();
    fastify.decorate('config', configManager.getConfig());
    fastify.decorate('configManager', configManager);

    // 监听配置重载
    configManager.on('reloaded', ({ newConfig }) => {
      fastify.config = newConfig;
      fastify.log.info('Configuration updated');
    });

    configManager.on('error', (error) => {
      fastify.log.error({ error }, 'Configuration error');
    });

    // 优雅关闭
    fastify.addHook('onClose', (instance, done) => {
      configManager.shutdown();
      done();
    });
  } catch (error) {
    fastify.log.error({ error }, 'Failed to initialize configuration');
    throw error;
  }
}

export default fp(configPlugin, {
  name: 'config-manager',
  fastify: '4.x'
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 轮询配置文件（setInterval） | fs.watch 事件驱动 | Node.js 0.10.x (2013) | 显著降低 CPU 使用，实时响应变更 |
| 硬编码配置路径 | 环境变量 + 默认值 | 行业最佳实践 | 提高灵活性，支持多环境部署 |
| 同步配置加载 | 异步配置加载（async/await） | Node.js 8.x (2017) | 避免阻塞事件循环，提高性能 |
| 手动深度合并 | lodash.merge / 展开运算符 | ES2018+ | 代码简洁，减少错误 |
| 重启进程更新配置 | 热重载配置 | 现代应用模式 | 减少停机时间，提高可用性 |

**Deprecated/outdated:**
- **fs.watchFile：** 使用轮询而非事件驱动，性能较差 → 应使用 fs.watch
- **同步 API（fs.readFileSync）：** 阻塞事件循环 → 应使用 fs.promises.readFile
- **JSON.parse 无错误处理：** 进程崩溃风险 → 应使用 try-catch
- **PM2 v1.x 配置热重载：** PM2 v2.1.X+ 环境变量不可变 → 应使用配置文件或进程重启

## Assumptions Log

> 本研究的所有假设和需要用户确认的决策

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 用户优先使用原生模块而非第三方库（如 chokidar） | Standard Stack | 如果用户更关注跨平台一致性而非依赖数量，可能需要使用 chokidar |
| A2 | 配置文件路径为 `~/zylos/components/github-connector/config.json` | Architecture Patterns | 如果路径不同，需要调整代码中的路径解析逻辑 |
| A3 | PM2 已经安装并用于进程管理 | Environment Availability | 如果 PM2 不可用，需要替代方案（如 systemd、Docker） |
| A4 | 用户不需要复杂的配置验证（如 JSON Schema） | Standard Stack | 如果配置结构复杂，手动验证可能不够健壮 |
| A5 | 配置热重载不需要原子性保证（无部分更新） | Common Pitfalls | 如果应用需要原子性配置更新，需要实现文件锁或版本控制 |

**如果此表为空：** 表示本研究中的所有声明都已验证或引用，无需用户确认。

## Open Questions

1. **配置验证的严格程度**
   - What we know: 需要 webhook secret、端口、日志级别验证
   - What's unclear: 是否需要完整的 JSON Schema 验证（使用 ajv）还是简单的手动验证足够
   - Recommendation: 从简单的手动验证开始，如果配置变复杂再引入 JSON Schema

2. **PM2 集成策略**
   - What we know: PM2 用于进程管理，环境变量在运行时不可变
   - What's unclear: 配置重载是否需要通过 PM2 `pm2 reload` 触发进程重启，还是应用内热重载足够
   - Recommendation: 优先应用内热重载（无需重启），端口变更等需要重启的配置记录警告并提示手动操作

3. **多环境配置支持**
   - What we know: 当前需求未明确多环境配置（dev/staging/prod）
   - What's unclear: 是否需要支持环境特定的配置覆盖（如 `config.dev.json`）
   - Recommendation: 当前仅支持单一配置文件，如果后续需要多环境支持，可扩展为 `config.{env}.json` 模式

4. **配置变更通知机制**
   - What we know: 配置变更需要通知应用模块（HTTP 服务器、事件处理程序等）
   - What's unclear: 是否需要模块级细粒度通知（如仅通知 HTTP 服务器端口变更）还是全局广播
   - Recommendation: 使用 EventEmitter 全局广播，各模块监听 'reloaded' 事件并根据需要更新自身状态

## Environment Availability

> 本阶段的外部依赖检查

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 运行时环境 | ✓ | 18.x+ | — |
| npm | 包管理器 | ✓ | 9.x+ | — |
| PM2 | 进程管理 | ✓ | 5.x+ | — |
| fs (native) | 文件监控 | ✓ | built-in | — |
| path (native) | 路径解析 | ✓ | built-in | — |
| events (native) | 事件发射 | ✓ | built-in | — |
| ajv (optional) | 配置验证 | ✗ | — | 手动验证 |
| lodash.merge (optional) | 深度合并 | ✗ | — | 展开运算符 |

**Missing dependencies with no fallback:**
- 无（所有必需依赖均可用）

**Missing dependencies with fallback:**
- **ajv**：不可用，但可使用手动验证作为回退方案
- **lodash.merge**：不可用，但可使用展开运算符和手动深度合并作为回退方案

**结论：** 本阶段无阻塞依赖，所有核心功能可使用 Node.js 原生模块实现。

## Validation Architecture

> 测试框架和验证策略

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `assert` + `node:test` (实验性) 或 Mocha/Chai |
| Config file | 测试配置通过环境变量或 test/setup.js 注入 |
| Quick run command | `npm test -- --grep "Config"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONF-01 | 配置从指定路径加载 | unit | `npm test -- --grep "should load config from file"` | ❌ Wave 0 |
| CONF-02 | 配置文件变更触发热重载 | integration | `npm test -- --grep "should reload config on change"` | ❌ Wave 0 |
| CONF-03 | webhook secret 可配置 | unit | `npm test -- --grep "should support configurable webhook secret"` | ❌ Wave 0 |
| CONF-04 | 服务器端口可配置 | unit | `npm test -- --grep "should support configurable port"` | ❌ Wave 0 |
| CONF-05 | 日志级别可配置 | unit | `npm test -- --grep "should support configurable log level"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --grep "Config"`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/config/loader.test.js` — 配置加载器单元测试
- [ ] `tests/unit/config/watcher.test.js` — 文件监控器单元测试
- [ ] `tests/integration/config/hot-reload.test.js` — 配置热重载集成测试
- [ ] `tests/fixtures/config/` — 测试配置文件（有效/无效/默认）
- [ ] 测试框架安装：`npm install --save-dev mocha chai` 或使用 Node.js 内置 `node:test`
- [ ] 测试辅助函数：`tests/helpers/config.js`（创建临时配置文件、清理）

*(推荐使用 Node.js 内置测试框架（`node:test`），无需额外依赖)*

## Security Domain

> 配置管理的安全考虑

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | JSON Schema 验证或手动验证（webhook secret 必需、端口范围检查） |
| V6 Cryptography | no | — |
| V7 Error Handling | yes | 配置解析错误不应暴露敏感信息（如文件路径） |
| V9 Data Protection | yes | webhook secret 不应记录到日志，不应在错误消息中暴露 |

### Known Threat Patterns for Configuration Management

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 配置文件权限过宽 | Tampering | 确保配置文件权限为 0600（用户读写），组/其他无权限 |
| webhook secret 泄漏到日志 | Information Disclosure | 记录配置时移除敏感字段，使用 `log.info({ ...config, webhookSecret: '[REDACTED]' })` |
| 配置文件注入恶意代码 | Tampering | 验证配置文件来源（签名或哈希），限制配置文件为纯 JSON（无代码执行） |
| 配置文件路径遍历攻击 | Tampering | 使用 `path.resolve()` 和路径规范化，拒绝包含 `..` 的相对路径 |
| 默认配置不安全 | Tampering | 默认值应要求用户设置 webhook secret（空字符串或占位符），不应使用默认密钥 |

### Configuration Security Best Practices

1. **文件权限：** 配置文件应设置为 0600（用户读写）
   ```bash
   chmod 600 ~/zylos/components/github-connector/config.json
   ```

2. **敏感字段处理：** 记录配置时移除敏感字段
   ```javascript
   const safeConfig = { ...config };
   delete safeConfig.webhookSecret;
   log.info({ config: safeConfig }, 'Configuration loaded');
   ```

3. **错误消息安全：** 不在错误消息中暴露文件路径或系统信息
   ```javascript
   // 错误：暴露路径
   throw new Error(`Failed to load config from ${this.configPath}`);

   // 正确：不暴露敏感信息
   throw new Error('Failed to load configuration file');
   ```

4. **配置验证：** 验证所有必需字段，拒绝无效配置
   ```javascript
   if (!config.webhookSecret || config.webhookSecret.length < 16) {
     throw new Error('webhookSecret must be at least 16 characters');
   }
   ```

5. **热重载安全：** 配置重载时验证新配置，拒绝无效配置
   ```javascript
   async handleConfigChange() {
     try {
       const newConfig = await this.loader.load();
       this.validate(newConfig); // 验证新配置
       this.config = newConfig;
     } catch (error) {
       // 保持旧配置有效，记录错误
       this.log.error({ error }, 'Failed to reload configuration');
     }
   }
   ```

## Sources

### Primary (HIGH confidence)
- [Node.js fs.watch API] - 文件监控和事件处理
- [Node.js fs.promises API] - 异步文件读取和错误处理
- [Node.js events.EventEmitter] - 配置变更事件发射
- [Node.js path module] - 路径解析和规范化
- [Fastify Plugin Documentation] - Fastify 插件模式和装饰器
- [PM2 Documentation] - 进程管理和环境变量处理

### Secondary (MEDIUM confidence)
- [Node.js Best Practices - Configuration Management] - 配置加载和验证模式
- [12 Factor App - Config] - 配置管理最佳实践（环境变量 vs 配置文件）
- [OWASP ASVS v4.0] - 安全验证标准（V5 输入验证、V9 数据保护）

### Tertiary (LOW confidence)
- [Stack Overflow - fs.watch multiple events] - fs.watch 多次事件触发的常见问题
- [GitHub Issues - Node.js fs.watch macOS behavior] - macOS fs.watch 不一致性报告

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 基于 Node.js 原生模块和官方文档
- Architecture: HIGH - 基于成熟的配置管理模式和 Fastify 最佳实践
- Pitfalls: HIGH - 基于文档化的平台特异性和常见错误模式

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (30 days - Node.js 和 Fastify 生态系统稳定)
