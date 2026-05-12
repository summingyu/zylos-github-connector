# Phase 8: C4 Communication Bridge Integration - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

---

## Phase Boundary

通过 C4 通信桥将格式化的 GitHub webhook 通知转发给 Claude。这是集成阶段，连接现有的事件处理和消息格式化与 C4 通信基础设施。不添加新功能，仅实现通信桥梁接。

---

## Implementation Decisions

### C4 调用架构
- **D-01:** 创建 `src/lib/comm-bridge.js` 包装器模块，集中 C4 调用逻辑
- **D-02:** 主服务器（src/index.js）在路由处理后调用包装器，而非在各个处理程序内分散调用
- **D-03:** 包装器导出 `sendToC4(channel, endpoint, message)` 函数，返回 Promise<{ok, error?}>

### 错误处理策略
- **D-04:** 失败时记录错误日志，包含错误详情和上下文
- **D-05:** 实现短暂重试机制（1-2 次，间隔 500ms）
- **D-06:** 最终失败后返回 202 给 GitHub（不影响 webhook 确认），不返回 500

### C4 端点配置
- **D-07:** 端点值使用仓库名称格式（如 "summingyu/zylos-github-connector"）
- **D-08:** channel 参数固定为 "github"
- **D-09:** 端点值从 webhook payload 中提取（repository.full_name）

### 同步/异步处理
- **D-10:** 默认同步等待 C4 调用完成，设置 3 秒超时
- **D-11:** 超时后记录警告，转为 fire-and-forget（不等待结果）
- **D-12:** 不阻塞 webhook 202 响应（确认优先模式）

### 实现细节
- **D-13:** 使用 child_process.exec 调用 `~/zylos/.claude/skills/comm-bridge/scripts/c4-receive.js`
- **D-14:** 使用 --json 标志获取结构化响应
- **D-15:** 消息内容需要 shell 转义（单引号转义为 `'\''`）

### Claude's Discretion
无 - 用户对所有关键领域都提供了明确决策。

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 8 目标、成功标准和计划列表

### Requirements
- `.planning/REQUIREMENTS.md` — SEND-01（通过 C4 传递）、SEND-02（可配置端点）、SEND-03（记录成功/失败）

### C4 Communication Bridge
- `~/zylos/.claude/skills/comm-bridge/scripts/c4-receive.js` — C4 接收接口脚本（命令格式、参数、响应格式）
- `.planning/docs/reference/zylos-component-template/references/communication.md` — 通信组件标准模式和最佳实践
- `.planning/docs/reference/zylos-telegram/scripts/send.js` — 参考：实际 C4 调用示例（虽然方向相反）

### Architecture & Patterns
- `CLAUDE.md` — 实现说明和安全提醒
- `.planning/STATE.md` — 项目状态和已完成阶段

### Existing Code (Integration Points)
- `src/index.js` — 主服务器入口，需要集成 C4 调用
- `src/lib/router.js` — 事件路由系统，返回处理结果供 C4 发送
- `src/lib/handlers/index.js` — 事件处理程序导出（不修改，仅消费返回的消息）
- `src/lib/formatters/index.js` — 消息格式化模块（Phase 7），生成发送内容

### Prior Phase Context
- `.planning/phases/07-message-formatting-module/07-CONTEXT.md` — Phase 7 格式化模块决策

---

## Existing Code Insights

### Reusable Assets
- **router.js**: `routeEvent()` 函数已实现，返回 `{handled, eventType, result}` 结构，result 包含 `{processed, message, event, data}`
- **formatters/**: Phase 7 创建的格式化模块，生成标准化的消息字符串
- **config.js**: 配置加载器，可扩展以支持 C4 相关配置

### Established Patterns
- **确认优先模式**: webhook 路由已实现快速 202 响应，C4 调用不应阻塞此响应
- **错误日志模式**: 使用 `console.error()` 和 `console.warn()` 记录错误，保持与现有代码一致
- **ESM 模块导入**: 所有代码使用 `import/export`，保持一致性

### Integration Points
- **主服务器**: `src/index.js` 中的 webhook 路由处理逻辑是 C4 调用的集成点
- **路由结果**: `router.routeEvent()` 返回的 `result.message` 是发送到 C4 的内容
- **配置读取**: 从 `config.commBridge.defaultEndpoint` 读取默认端点（如果配置）

---

## Specific Ideas

### comm-bridge.js 模块结构
```javascript
// src/lib/comm-bridge.js
import { exec } from 'child_process';
import path from 'path';

const C4_RECEIVE = path.join(process.env.HOME,
  'zylos/.claude/skills/comm-bridge/scripts/c4-receive.js');

/**
 * Send message to C4 communication bridge
 * @param {string} channel - Channel name (e.g., "github")
 * @param {string} endpoint - Endpoint ID (e.g., "user/repo")
 * @param {string} message - Formatted message content
 * @param {number} timeout - Timeout in milliseconds (default: 3000)
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function sendToC4(channel, endpoint, message, timeout = 3000) {
  // Implementation with:
  // - Shell escaping for message content
  // - Retry logic (1-2 attempts)
  // - Timeout handling
  // - JSON response parsing
}
```

### 主服务器集成模式
```javascript
// src/index.js - webhook route handler
import { sendToC4 } from './lib/comm-bridge.js';

// 在路由处理后
const routed = await routeEvent(eventType, payload);
if (routed.handled && routed.result?.message) {
  const { message } = routed.result;
  const repo = payload.repository?.full_name || 'unknown';

  // 发送到 C4（带超时和错误处理）
  const result = await sendToC4('github', repo, message, 3000);
  if (!result.ok) {
    console.error(`[github-connector] C4 send failed: ${result.error}`);
  }
}

// 返回 202 确认（不受 C4 结果影响）
reply.code(202).send('accepted');
```

### C4 命令格式
```bash
node ~/zylos/.claude/skills/comm-bridge/scripts/c4-receive.js \
  --channel "github" \
  --endpoint "summingyu/zylos-github-connector" \
  --json \
  --content "🔓 Issue Opened by @alice..."
```

### 响应格式
- 成功: `{"ok": true, "action": "queued", "id": "..."}`
- 失败: `{"ok": false, "error": {"code": "...", "message": "..."}}`

---

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 08-c4-bridge-integration*
*Context gathered: 2026-05-12*
