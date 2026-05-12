# Phase 8: C4 Communication Bridge Integration - Execution Plan

**Phase:** 08-c4-bridge-integration
**Created:** 2026-05-12
**Mode:** mvp
**Status:** Ready for execution

---
requirements:
  - "SEND-01"
  - "SEND-02"
  - "SEND-03"
depends_on: []
wave: 1
must_haves:
  truths:
    - "消息通过 C4 通信桥发送到 Claude"
    - "通知端点使用仓库名称格式（user/repo）配置"
    - "传递成功/失败被记录到日志"
    - "测试消息能够通过 C4 集成工作"
    - "C4 调用不阻塞 webhook 202 响应"
  artifacts:
    - path: "src/lib/comm-bridge.js"
      provides: "C4 通信桥包装器模块"
      min_lines: 80
    - path: "src/index.js"
      provides: "集成 C4 调用的主服务器"
      modifies: true
    - path: "src/lib/__tests__/comm-bridge.test.js"
      provides: "comm-bridge 模块单元测试"
      min_lines: 50
  key_links:
    - from: "src/index.js"
      to: "src/lib/comm-bridge.js"
      via: "import sendWithRetry and call after routeEvent"
    - from: "src/lib/comm-bridge.js"
      to: "~/zylos/.claude/skills/comm-bridge/scripts/c4-receive.js"
      via: "child_process.exec with shell-escaped parameters"
    - from: "src/lib/router.js"
      to: "src/index.js"
      via: "routeEvent returns result.message for C4 delivery"

---

## Phase Goal

通过 C4 通信桥将格式化的 GitHub webhook 通知转发给 Claude，实现事件处理与通信基础设施的集成。

---

## Success Criteria

1. 消息通过 C4 通信桥发送
2. 通知端点可配置（支持仓库名称格式）
3. 记录传递成功/失败
4. 与测试消息集成工作

---

## Requirements Coverage

| Requirement | Plan Reference | Status |
|-------------|----------------|--------|
| SEND-01 | Task 1-5 | Pending |
| SEND-02 | Task 2-3 | Pending |
| SEND-03 | Task 4-5 | Pending |

---

## Implementation Decisions

### C4 调用架构
- **D-01:** 创建 `src/lib/comm-bridge.js` 包装器模块，集中 C4 调用逻辑
- **D-02:** 主服务器（src/index.js）在路由处理后调用包装器
- **D-03:** 包装器导出 `sendToC4(channel, endpoint, message)` 函数

### 错误处理策略
- **D-04:** 失败时记录错误日志，包含错误详情和上下文
- **D-05:** 实现短暂重试机制（1-2 次，间隔 500ms）
- **D-06:** 最终失败后返回 202 给 GitHub（不影响 webhook 确认）

### C4 端点配置
- **D-07:** 端点值使用仓库名称格式（如 "summingyu/zylos-github-connector"）
- **D-08:** channel 参数固定为 "github"
- **D-09:** 端点值从 webhook payload 中提取（repository.full_name）

### 同步/异步处理
- **D-10:** 默认同步等待 C4 调用完成，设置 3 秒超时
- **D-11:** 超时后记录警告，转为 fire-and-forget（不等待结果）
- **D-12:** 不阻塞 webhook 202 响应（确认优先模式）

---

## Execution Tasks

### Task 1: 创建 C4 通信桥包装器模块

**File:** `src/lib/comm-bridge.js`

**Acceptance Criteria:**
- [ ] 导出 `sendToC4(channel, endpoint, message, timeout)` 函数
- [ ] 使用 child_process.exec 调用 C4 脚本
- [ ] 正确的命令格式：`--channel "github" --endpoint "user/repo" --json --content "message"`
- [ ] 实现消息内容的 shell 转义（单引号转义为 `'\''`）
- [ ] 返回 Promise<{ok: boolean, error?: string}>

**Implementation Details:**
```javascript
import { exec } from 'child_process';
import path from 'path';

const C4_RECEIVE = path.join(process.env.HOME,
  'zylos/.claude/skills/comm-bridge/scripts/c4-receive.js');

export async function sendToC4(channel, endpoint, message, timeout = 3000) {
  // Shell 转义
  const safeContent = message.replace(/'/g, "'\\''");
  const cmd = `node "${C4_RECEIVE}" --channel "${channel}" --endpoint "${endpoint}" --json --content '${safeContent}'`;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, error: 'timeout' });
    }, timeout);

    exec(cmd, { encoding: 'utf8' }, (error, stdout) => {
      clearTimeout(timer);

      if (!error) {
        try {
          const response = JSON.parse(stdout.trim());
          resolve({ ok: response.ok === true });
        } catch {
          resolve({ ok: false, error: 'parse_error' });
        }
        return;
      }

      // 尝试从错误输出中解析 JSON 响应
      try {
        const response = JSON.parse(error.stdout || stdout);
        if (response.ok === false) {
          resolve({ ok: false, error: response.error?.message || 'unknown_error' });
          return;
        }
      } catch {}

      resolve({ ok: false, error: error.message });
    });
  });
}
```

**Dependencies:** None

**Estimated Effort:** 2 hours

---

### Task 2: 实现带重试机制的发送函数

**File:** `src/lib/comm-bridge.js`

**Acceptance Criteria:**
- [ ] 在 sendToC4 函数中实现重试逻辑
- [ ] 重试次数：1-2 次
- [ ] 重试间隔：500ms
- [ ] 每次重试前记录日志

**Implementation Details:**
```javascript
async function sendWithRetry(channel, endpoint, message, maxRetries = 2) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.warn(`[github-connector] C4 send retry ${attempt}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const result = await sendToC4(channel, endpoint, message);

    if (result.ok) {
      return result;
    }

    lastError = result.error;
  }

  return { ok: false, error: lastError };
}
```

**Dependencies:** Task 1

**Estimated Effort:** 1 hour

---

### Task 3: 集成 C4 调用到主服务器

**File:** `src/index.js`

**Acceptance Criteria:**
- [ ] 导入 comm-bridge 模块
- [ ] 在路由处理后提取 result.message
- [ ] 从 payload.repository.full_name 提取端点
- [ ] 调用 C4 发送函数（带超时）
- [ ] 不阻塞 202 响应

**Implementation Details:**
```javascript
import { sendWithRetry } from './lib/comm-bridge.js';

// 在 webhook 路由处理函数中
const routed = await routeEvent(eventType, payload);

if (routed.handled && routed.result?.message) {
  const { message } = routed.result;
  const repo = payload.repository?.full_name || config.commBridge?.defaultEndpoint || 'unknown';

  // 验证消息格式
  if (typeof message !== 'string' || message.length === 0) {
    console.warn(`[github-connector] Invalid message format for ${eventType}`);
  } else {
    // 发送到 C4（带超时，不阻塞响应）
    sendWithRetry('github', repo, message)
      .then(result => {
        if (result.ok) {
          console.log(`[github-connector] Sent to C4: ${message.substring(0, 50)}...`);
        } else {
          console.error(`[github-connector] C4 send failed: ${result.error}`);
        }
      })
      .catch(err => {
        console.error(`[github-connector] C4 send error: ${err.message}`);
      });
  }
} else if (routed.handled && !routed.result?.message) {
  console.warn(`[github-connector] No message in router result for ${eventType}`);
}

// 立即返回 202 确认（不受 C4 结果影响）
reply.code(202).send('accepted');
```

**Dependencies:** Task 2

**Estimated Effort:** 1.5 hours

---

### Task 4: 实现日志记录

**Files:** `src/lib/comm-bridge.js`, `src/index.js`

**Acceptance Criteria:**
- [ ] 成功发送时记录 info 级别日志
- [ ] 失败时记录 error 级别日志
- [ ] 日志包含端点、消息摘要、错误详情
- [ ] 不记录敏感信息（webhook secret）

**Implementation Details:**
```javascript
// 成功日志
console.log(`[github-connector] ✓ Sent to C4 [${endpoint}]: ${message.substring(0, 60)}...`);

// 失败日志
console.error(`[github-connector] ✗ C4 send failed [${endpoint}]: ${error}`);

// 重试日志
console.warn(`[github-connector] Retrying C4 send (${attempt}/${maxRetries})...`);
```

**Dependencies:** Task 3

**Estimated Effort:** 0.5 hours

---

### Task 5: 端到端测试

**Test Method:** 手动测试 + 单元测试

**Acceptance Criteria:**
- [ ] 创建单元测试覆盖 comm-bridge 模块
- [ ] 测试成功发送场景
- [ ] 测试失败重试场景
- [ ] 测试超时场景
- [ ] 使用 scripts/send.js 进行集成测试
- [ ] 验证消息到达 C4 并可被 Claude 接收

**Test Cases:**
1. **成功发送：** 模拟 C4 返回 `{ok: true}`
2. **C4 拒绝：** 模拟 C4 返回 `{ok: false, error: {...}}`
3. **超时：** C4 脚本响应超过 3 秒
4. **shell 转义：** 消息包含特殊字符（单引号、双引号、$ 等）
5. **端点回退：** payload.repository.full_name 不存在时使用默认端点

**Implementation Details:**
```javascript
// tests/comm-bridge.test.js
import { sendToC4, sendWithRetry } from '../src/lib/comm-bridge.js';
import { exec } from 'child_process';

// Mock exec
vi.mock('child_process');
```

**Dependencies:** Task 4

**Estimated Effort:** 2 hours

---

## Verification Plan

### Goal-Backward Verification

**Phase Goal:** 通过 C4 通信桥将格式化的 GitHub webhook 通知转发给 Claude

| Success Criterion | Verification Method | Task Reference |
|-------------------|---------------------|----------------|
| 消息通过 C4 通信桥发送 | 端到端测试验证消息到达 C4 | Task 1-5 |
| 通知端点可配置 | 测试仓库名称端点，验证从 payload 提取 | Task 3 |
| 记录传递成功/失败 | 检查日志输出包含成功/失败记录 | Task 4 |
| 与测试消息集成工作 | 使用 scripts/send.js 测试真实 C4 调用 | Task 5 |

### Integration Points Validation

- **Router → Comm Bridge:** router.routeEvent() 返回的 result.message 被正确传递
- **Payload → Endpoint:** repository.full_name 正确提取作为端点
- **Server → C4:** 202 响应不受 C4 调用影响
- **Error Handling:** C4 失败不导致服务器崩溃或 webhook 重试

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| C4 脚本不存在或路径错误 | 无法发送消息 | 验证脚本存在性，提供清晰的错误消息 |
| C4 响应延迟 | GitHub webhook 超时 | 3 秒超时后转为 fire-and-forget |
| 消息内容包含特殊字符 | shell 命令解析错误 | 正确的 shell 转义 |
| 并发 webhooks | C4 过载 | C4 脚本内置队列机制，无需额外处理 |

---

## Rollback Plan

如果实现导致问题：
1. 回滚 src/index.js 中的 C4 集成
2. 移除 comm-bridge.js 模块
3. 恢复 webhook 路由的纯日志行为
4. 验证服务器正常运行

---

## Post-Completion Checklist

- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 日志输出符合预期
- [ ] 代码符合项目规范（ESM、注释、错误处理）
- [ ] 更新 STATE.md 标记阶段完成
- [ ] 准备阶段 9（配置管理）的上下文收集

---

*Phase: 08-c4-bridge-integration*
*Plan created: 2026-05-12*
*Total Estimated Effort: 7 hours*
