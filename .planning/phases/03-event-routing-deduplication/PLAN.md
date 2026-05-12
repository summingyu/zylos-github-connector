# Phase 3 Plan: Event Routing and Deduplication

**Project:** Zylos GitHub Webhook Connector
**Phase:** 3 — Event Routing and Deduplication
**Date:** 2026-05-12
**Status:** Ready to Execute

---

## Phase Goal

实现事件类型解析、路由分发和传递去重功能，确保每个 GitHub webhook 事件被正确路由到相应的处理程序，并防止重复处理。

---

## Success Criteria

1. ✓ X-GitHub-Event 头确定事件类型
2. ✓ X-GitHub-Delivery 头被跟踪用于去重
3. ✓ 重复传递 ID 返回 200 而不重新处理
4. ✓ 事件路由到相应的处理程序函数
5. ✓ 验证后解析请求负载为 JSON

---

## Requirements Coverage

| Requirement | Source | Coverage |
|-------------|--------|----------|
| EVENT-01 | 组件从 X-GitHub-Event 头解析事件类型 | ✓ Plans 1, 4 |
| EVENT-02 | 组件根据事件类型将事件路由到相应的处理程序 | ✓ Plan 4 |
| EVENT-03 | 组件跟踪已处理的 X-GitHub-Delivery ID 以防止重复处理 | ✓ Plan 2 |
| EVENT-04 | 组件对重复的传递 ID 返回 200 状态（确认但跳过处理） | ✓ Plan 3 |

---

## Execution Plans

### Plan 1: 创建事件类型解析器

**Dependencies:** None

**Files:**
- `src/lib/event-parser.js` (新建)

**Tasks:**

1. 创建事件类型常量
   - 定义支持的 GitHub 事件类型（push, issues, pull_request, issue_comment, release 等）
   - 导出事件类型枚举

2. 实现事件头提取函数
   - `getEventType(headers)` - 提取 X-GitHub-Event 头
   - `getDeliveryId(headers)` - 提取 X-GitHub-Delivery 头
   - 处理缺少头的情况

3. 实现事件类型验证
   - `isValidEventType(eventType)` - 检查事件类型是否支持
   - 返回支持的类型列表

4. 添加 JSDoc 文档
   - 函数参数和返回值说明
   - 支持的事件类型列表

**Acceptance:**
- `src/lib/event-parser.js` 文件存在
- 事件类型提取函数可用
- 支持的事件类型已定义

---

### Plan 2: 实现去重存储

**Dependencies:** None

**Files:**
- `src/lib/dedupe.js` (新建)

**Tasks:**

1. 创建内存去重存储
   - 使用 JavaScript Set 跟踪已处理的 delivery ID
   - 导出 `seenDeliveries` Set

2. 实现去重检查函数
   - `hasDeliveryBeenSeen(deliveryId)` - 检查 delivery ID 是否已处理
   - `markDeliveryAsSeen(deliveryId)` - 标记 delivery ID 为已处理
   - 线程安全考虑（单线程 Node.js 环境）

3. 添加清理机制（可选）
   - 实现 TTL 清理旧条目（防止内存泄漏）
   - 或使用定期清理（LRU 策略）

4. 添加统计函数
   - `getDedupeStats()` - 返回去重统计信息

5. JSDoc 文档
   - 函数使用说明
   - 内存考虑和限制

**Acceptance:**
- `src/lib/dedupe.js` 文件存在
- 去重检查函数可用
- 内存 Set 正确实现

---

### Plan 3: 集成去重到 Webhook 路由

**Dependencies:** Plans 1, 2 完成

**Files:**
- `src/index.js` (修改)

**Tasks:**

1. 导入去重模块
   - 在签名验证成功后添加去重检查
   - 导入 `hasDeliveryBeenSeen` 和 `markDeliveryAsSeen`

2. 实现去重流程
   - 检查 delivery ID 是否已处理
   - 如果已处理，返回 200 并记录日志
   - 如果未处理，标记为已处理并继续

3. 添加去重日志
   - 记录重复检测事件
   - 包含事件类型和 delivery ID
   - 记录去重统计信息

4. 实现代码
   ```javascript
   // 签名验证成功后
   if (hasDeliveryBeenSeen(deliveryId)) {
     app.log.info({
       msg: 'Duplicate delivery ID, skipping processing',
       event: eventType,
       delivery: deliveryId
     });
     return reply.code(200).send({ message: 'Duplicate, already processed' });
   }

   // 标记为已处理
   markDeliveryAsSeen(deliveryId);
   ```

**Acceptance:**
- 重复 delivery ID 返回 200
- 新 delivery ID 继续处理
- 去重日志正确记录

---

### Plan 4: 创建事件路由器

**Dependencies:** Plans 1, 2, 3 完成

**Files:**
- `src/lib/router.js` (新建)
- `src/lib/handlers/` (新建目录)
- `src/lib/handlers/index.js` (新建)

**Tasks:**

1. 创建事件路由器框架
   - `createEventRouter()` - 创建路由器实例
   - 注册处理程序的函数
   - 按事件类型分派的路由逻辑

2. 实现处理程序注册系统
   - `registerHandler(eventType, handler)` - 注册处理程序
   - 支持通配符处理程序（`*` 用于未支持的事件）
   - 验证处理程序函数签名

3. 实现路由分发逻辑
   - `routeEvent(eventType, payload)` - 路由事件到处理程序
   - 处理未注册事件类型
   - 错误处理和日志记录

4. 创建占位处理程序
   - 为 Phase 4 准备占位函数
   - 返回 "未实现" 消息
   - 记录未实现的事件类型

**Acceptance:**
- `src/lib/router.js` 文件存在
- 事件路由器可以分派事件
- 处理程序注册系统可用

---

### Plan 5: 集成路由器到 Webhook 处理流程

**Dependencies:** Plan 4 完成

**Files:**
- `src/index.js` (修改)

**Tasks:**

1. 导入路由器模块
   - 初始化事件路由器
   - 注册占位处理程序

2. 解析 JSON 负载
   - 验证后解析 `request.body` 为 JSON
   - 处理解析错误
   - 记录负载结构（debug 模式）

3. 调用路由器
   - 传递事件类型和负载
   - 捕获处理程序错误
   - 返回适当的响应

4. 实现代码
   ```javascript
   // 去重检查后
   let payload;
   try {
     payload = request.body; // 已被 Fastify 解析
   } catch (err) {
     app.log.error({
       msg: 'Failed to parse webhook payload',
       event: eventType,
       delivery: deliveryId,
       error: err.message
     });
     return reply.code(400).send({ error: 'Invalid JSON payload' });
   }

   // 路由事件
   try {
     const result = await routeEvent(eventType, payload);
     return reply.code(202).send({
       message: 'Event processed',
       event: eventType,
       delivery: deliveryId
     });
   } catch (err) {
     app.log.error({
       msg: 'Handler error',
       event: eventType,
       delivery: deliveryId,
       error: err.message
     });
     return reply.code(500).send({ error: 'Handler error' });
   }
   ```

**Acceptance:**
- 事件被正确路由
- 处理程序错误被捕获
- 响应状态码正确

---

### Plan 6: 添加路由日志和测试

**Dependencies:** Plan 5 完成

**Files:**
- `src/index.js` (修改)
- `src/lib/__tests__/router.test.js` (新建)
- `src/lib/__tests__/dedupe.test.js` (新建)

**Tasks:**

1. 增强路由日志
   - 记录事件路由决策
   - 记录处理程序执行时间
   - 记录处理程序返回值

2. 创建去重测试
   - 测试重复检测
   - 测试标记和检查函数
   - 测试内存限制

3. 创建路由器测试
   - 测试处理程序注册
   - 测试事件路由
   - 测试错误处理

4. 更新集成测试
   - 添加事件类型测试用例
   - 添加去重测试用例
   - 验证端到端流程

**Acceptance:**
- 路由日志完整
- 去重测试通过
- 路由器测试通过
- 集成测试验证成功

---

## Dependencies and Order

```
Plan 1 (事件解析器) ──┐
                     ├──→ Plan 3 (集成去重) ──┐
Plan 2 (去重存储) ────┘                       │
                                             ├──→ Plan 5 (集成路由器) ──→ Plan 6 (测试)
Plan 4 (事件路由器) ──────────────────────────┘
```

**建议执行顺序：** Plan 1 → Plan 2 → Plan 3 → Plan 4 → Plan 5 → Plan 6

**并行化机会：**
- Plan 1 和 Plan 2 可以并行（独立的模块）
- Plan 6 必须等待 Plans 1-5 完成

---

## Configuration Impact

本阶段不需要新的配置选项。去重限制（如 Set 大小）可以在未来版本中添加配置。

---

## Testing Approach

### 单元测试

```bash
# 运行新测试
npm test -- src/lib/__tests__/event-parser.test.js
npm test -- src/lib/__tests__/dedupe.test.js
npm test -- src/lib/__tests__/router.test.js
```

### 集成测试

1. 启动服务器
2. 发送相同 delivery ID 的多个请求
3. 验证第一个返回 202，后续返回 200
4. 发送不同事件类型
5. 验证路由到正确的处理程序

### 验证点

- [ ] 事件类型正确解析
- [ ] 重复 delivery ID 被检测
- [ ] 重复请求返回 200
- [ ] 新请求被正确路由
- [ ] 路由日志正确记录
- [ ] 单元测试通过
- [ ] 集成测试通过

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| 内存 Set 无限增长 | 在未来版本中实现 TTL 或 LRU 清理 |
| 事件类型不支持 | 通配符处理程序捕获未支持事件 |
| 路由器错误影响整个服务 | 错误隔离，每个处理程序 try-catch |
| 并发竞争条件 | Node.js 单线程模型无此问题 |

---

## Security Considerations

1. **去重安全性**
   - Delivery ID 来自 GitHub，可信
   - 不使用用户生成的内容作为去重键

2. **事件解析**
   - 验证事件类型在白名单中
   - 拒绝无效的事件类型

3. **路由隔离**
   - 处理程序错误不应影响服务稳定性
   - 超时保护（未来版本）

---

## Completion Checklist

- [ ] 所有 6 个计划完成
- [ ] 所有成功标准满足
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试验证
- [ ] 代码审查完成
- [ ] 代码提交到 Git
- [ ] 准备进入 Phase 4（事件处理程序）

---

## Next Phase Preview

**Phase 4: Issues Event Handler**
- 处理 issues 事件（opened、closed、reopened）
- 格式化 issue 通知
- 提取 issue 数据（标题、作者、动作、URL）

---

**Last Updated:** 2026-05-12
**Status:** Ready for Execution
