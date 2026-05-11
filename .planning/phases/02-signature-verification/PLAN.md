# Phase 2 Plan: Signature Verification

**Project:** Zylos GitHub Webhook Connector
**Phase:** 2 — Signature Verification
**Date:** 2025-05-11
**Status:** Ready to Execute

---

## Phase Goal

实现安全的 HMAC-SHA256 webhook 签名验证，确保所有传入的 GitHub webhook 请求都是合法且未被篡改的。

---

## Success Criteria

1. ✓ 提取并验证 X-Hub-Signature-256 头
2. ✓ HMAC 计算基于原始请求体（req.rawBody）
3. ✓ 常量时间比较防止时序攻击
4. ✓ 无效签名返回 401 状态
5. ✓ 合法的 GitHub webhook 验证成功

---

## Requirements Coverage

| Requirement | Source | Coverage |
|-------------|--------|----------|
| SECU-01 | 组件使用 HMAC-SHA256 验证原始请求体的 X-Hub-Signature-256 头 | ✓ Plans 1, 4 |
| SECU-02 | 签名比较使用 crypto.timingSafeEqual() 防止时序攻击 | ✓ Plan 3 |
| SECU-03 | Webhook secret 安全存储在 config.json 中（不硬编码） | ✓ Plan 2 |
| SECU-04 | 组件对无效签名尝试返回 401 状态 | ✓ Plan 4 |
| SECU-05 | 日志不包含 webhook secret 或完整请求体 | ✓ Plan 5 |
| WEBH-03 | 服务器在 GitHub 超时窗口内（约 10 秒）响应 2xx 状态 | ✓ Plan 4 |

---

## Execution Plans

### Plan 1: 创建签名验证模块

**Dependencies:** None

**Files:**
- `src/lib/verifier.js` (新建)

**Tasks:**

1. 创建验证器模块框架
   - 导入 Node.js crypto 模块
   - 导出 `verifySignature` 函数
   - 函数签名：`verifySignature(rawBody, signature, secret)`

2. 实现 HMAC-SHA256 计算函数
   - 创建 `computeHmac(rawBody, secret)` 辅助函数
   - 使用 `crypto.createHmac('sha256', secret)`
   - 返回带有 `sha256=` 前缀的签名

3. 实现签名提取和解析
   - 验证签名格式（必须以 `sha256=` 开头）
   - 提取十六进制签名部分
   - 处理缺少签名头的情况

4. 添加文档注释
   - JSDoc 注释说明函数用途
   - 参数和返回值说明
   - 安全注意事项

**Acceptance:**
- `src/lib/verifier.js` 文件存在
- `verifySignature` 函数导出
- 代码有适当的文档注释

---

### Plan 2: 从配置加载 Webhook Secret

**Dependencies:** None

**Files:**
- `src/lib/config.js` (修改)
- `.planning/config.json` (修改)

**Tasks:**

1. 更新配置架构
   - 在 `DEFAULT_CONFIG` 中添加 `webhookSecret` 字段
   - 设置默认值为空字符串（强制配置）

2. 添加 secret 验证
   - 在 `loadConfig()` 中验证 `webhookSecret` 存在
   - 如果缺少，记录警告并使用占位符（开发模式）
   - 生产环境应拒绝启动

3. 更新配置示例
   - 在 `.planning/config.json` 中添加 `webhookSecret` 占位符
   - 添加注释说明这是 GitHub webhook secret

4. 添加环境变量支持（可选）
   - 支持通过 `GITHUB_WEBHOOK_SECRET` 环境变量覆盖
   - 环境变量优先级高于配置文件

**Acceptance:**
- `webhookSecret` 可在配置中设置
- 配置验证逻辑存在
- 配置示例包含 secret 字段

---

### Plan 3: 实现常量时间签名比较

**Dependencies:** Plan 1 完成

**Files:**
- `src/lib/verifier.js` (修改)

**Tasks:**

1. 实现常量时间比较函数
   - 使用 `crypto.timingSafeEqual()`
   - 处理不同长度的情况（必须先检查长度）
   - 将字符串转换为 Buffer 进行比较

2. 实现完整的签名验证逻辑
   - 计算期望的 HMAC 签名
   - 比较接收的签名与期望的签名
   - 返回布尔值表示验证结果

3. 添加边缘情况处理
   - 空签名
   - 签名长度不匹配
   - 无效的十六进制字符
   - 缺少签名头

4. 实现代码
   ```javascript
   import crypto from 'crypto';

   export function verifySignature(rawBody, receivedSignature, secret) {
     if (!receivedSignature || !receivedSignature.startsWith('sha256=')) {
       return false;
     }

     const expectedSignature = 'sha256=' +
       crypto.createHmac('sha256', secret)
         .update(rawBody)
         .digest('hex');

     const a = Buffer.from(expectedSignature);
     const b = Buffer.from(receivedSignature);

     if (a.length !== b.length) {
       return false;
     }

     return crypto.timingSafeEqual(a, b);
   }
   ```

**Acceptance:**
- 使用 `crypto.timingSafeEqual()` 进行比较
- 先检查长度再比较
- 正确处理边缘情况

---

### Plan 4: 集成签名验证到 Webhook 路由

**Dependencies:** Plans 1, 2, 3 完成

**Files:**
- `src/index.js` (修改)

**Tasks:**

1. 在 webhook 路由中导入验证器
   - 导入 `verifySignature` 和 `getConfig`
   - 获取 `webhookSecret` 配置

2. 在路由处理程序开始时验证签名
   - 提取 `X-Hub-Signature-256` 头
   - 获取 `req.rawBody`（Phase 1 已设置）
   - 调用 `verifySignature()`

3. 处理验证失败
   - 返回 401 Unauthorized 状态码
   - 记录安全警告（不包含 secret）
   - 返回通用错误消息

4. 处理验证成功
   - 继续处理 webhook（目前只返回 202）
   - 记录成功验证（不带敏感数据）

5. 实现
   ```javascript
   app.post('/webhook', async (request, reply) => {
     const signature = request.headers['x-hub-signature-256'];
     const config = getConfig();

     // 验证签名
     if (!verifySignature(request.rawBody, signature, config.webhookSecret)) {
       app.log.warn({
         msg: 'Invalid webhook signature',
         event: request.headers['x-github-event'],
         delivery: request.headers['x-github-delivery']
       });
       return reply.code(401).send({ error: 'Invalid signature' });
     }

     // 签名验证成功，继续处理
     app.log.info({
       msg: 'Webhook verified',
       event: request.headers['x-github-event'],
       delivery: request.headers['x-github-delivery']
     });

     return reply.code(202).send({ message: 'Webhook accepted' });
   });
   ```

**Acceptance:**
- 无效签名返回 401
- 有效签名返回 202
- 签名验证在处理前执行
- 日志不包含敏感数据

---

### Plan 5: 添加验证日志和错误处理

**Dependencies:** Plan 4 完成

**Files:**
- `src/index.js` (修改)
- `src/lib/verifier.js` (修改)

**Tasks:**

1. 增强日志记录
   - 记录验证成功/失败事件
   - 包含事件类型和传递 ID
   - 不记录 webhook secret 或完整请求体
   - 记录签名存在性（present/missing）

2. 添加调试信息（开发模式）
   - 在日志级别为 'debug' 时记录签名验证详情
   - 记录签名长度（非内容）
   - 记录原始体大小

3. 错误处理
   - 捕获签名验证中的异常
   - 防止配置错误导致崩溃
   - 对缺少 secret 提供友好错误消息

4. 安全日志实践
   - 只记录必要的元数据
   - 避免记录敏感头信息
   - 使用结构化日志格式

**Acceptance:**
- 验证成功/失败被记录
- 日志不包含敏感数据
- 错误被优雅处理

---

### Plan 6: 创建签名验证测试

**Dependencies:** Plans 1-5 完成

**Files:**
- `src/lib/__tests__/verifier.test.js` (新建)
- `scripts/test-webhook.js` (新建)

**Testing Framework:**
- **推荐：** Node.js 内置 test runner (Node.js 20+) 或 Vitest
- **原因：** 与项目的 ESM 模块系统兼容
- **安装：** `npm install -D vitest` (如选择 Vitest)

**Tasks:**

1. 创建单元测试
   - 测试有效签名验证
   - 测试无效签名验证
   - 测试缺少签名头
   - 测试错误格式的签名
   - 测试空请求体
   - 测试常量时间相等性

2. 创建集成测试脚本
   - 使用真实 GitHub webhook 格式
   - 测试有效签名（使用测试 secret）
   - 测试无效签名
   - 测试缺少签名头

3. 测试工具函数
   - 创建生成测试签名的辅助函数
   - 创建测试 webhook 负载生成器

4. 手动测试脚本
   - 创建 `scripts/test-webhook.js` 发送测试请求
   - 支持命令行参数：URL、secret、负载
   - 输出测试结果

**Acceptance:**
- 单元测试覆盖所有签名验证场景
- 集成测试验证端到端流程
- 可以使用测试脚本手动验证

---

## Dependencies and Order

```
Plan 1 (验证器模块) ──→ Plan 3 (常量时间比较)
                         ↓
Plan 2 (配置 secret) ───→ Plan 4 (集成到路由)
                         ↓
                   Plan 5 (日志和错误处理)
                         ↓
                   Plan 6 (测试)
```

**建议执行顺序：** Plan 1 → Plan 3 → Plan 2 → Plan 4 → Plan 5 → Plan 6

**并行化机会：**
- Plan 1 和 Plan 2 可以并行（独立的模块）
- Plan 6 必须等待 Plans 1-5 完成

---

## Configuration Impact

### config.json 添加

```json
{
  "enabled": true,
  "port": 3461,
  "webhookSecret": "your-webhook-secret-here",
  "commBridge": {
    "enabled": true,
    "defaultEndpoint": "default"
  },
  "logging": {
    "level": "info"
  }
}
```

### 环境变量

```bash
# 可选：通过环境变量设置 webhook secret
export GITHUB_WEBHOOK_SECRET="your-webhook-secret-here"
```

---

## Testing Approach

### 单元测试

```bash
# 运行验证器测试
npm test -- src/lib/__tests__/verifier.test.js
```

### 集成测试

1. 启动服务器：`node src/index.js`
2. 运行测试脚本：
   ```bash
   node scripts/test-webhook.js \
     --url http://localhost:3461/webhook \
     --secret test-secret \
     --event push
   ```

3. 测试场景：
   - 有效签名 → 应返回 202
   - 无效签名 → 应返回 401
   - 缺少签名 → 应返回 401
   - 错误格式签名 → 应返回 401

### 手动测试

使用 curl 生成和测试 webhook：

```bash
# 生成签名
SECRET="test-secret"
PAYLOAD='{"test": true}'
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

# 发送请求
curl -X POST http://localhost:3461/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: 12345" \
  -d "$PAYLOAD"
```

### 验证点

- [ ] 有效签名返回 202
- [ ] 无效签名返回 401
- [ ] 缺少签名返回 401
- [ ] 日志不包含 secret
- [ ] 使用常量时间比较
- [ ] 单元测试通过
- [ ] 集成测试通过

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| 签名验证失败阻止合法 webhook | 详细的日志记录帮助调试；测试工具生成有效签名 |
| 时序攻击漏洞 | 使用 crypto.timingSafeEqual()；代码审查确保正确使用 |
| Secret 泄漏到日志 | 审查所有日志语句；使用结构化日志过滤敏感字段 |
| 配置错误导致拒绝服务 | 启动时验证配置；提供清晰的错误消息 |
| 原始体未正确保留 | 单元测试验证 rawBody 存在；集成测试验证完整流程 |

---

## Security Considerations

1. **时序攻击防护**
   - 必须使用 `crypto.timingSafeEqual()`
   - 不得使用 `===` 或 `==` 进行签名比较
   - 比较前检查长度

2. **Secret 管理**
   - Secret 必须存储在配置文件中，不硬编码
   - 日志不得包含 secret
   - 考虑支持环境变量覆盖

3. **错误消息**
   - 验证失败返回通用错误消息
   - 不暴露关于 secret 的详细信息
   - 记录足够的安全审计信息

4. **性能考虑**
   - 签名验证在请求处理的最开始
   - 快速失败（无效签名立即返回）
   - 不阻塞其他请求

---

## Completion Checklist

- [ ] 所有 6 个计划完成
- [ ] 所有成功标准满足
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试验证
- [ ] 代码审查完成
- [ ] 代码提交到 Git
- [ ] 准备进入 Phase 3（事件路由和去重）

---

## Next Phase Preview

**Phase 3: Event Routing and Deduplication**
- 解析 X-GitHub-Event 头确定事件类型
- 跟踪 X-GitHub-Delivery ID 防止重复处理
- 实现内存去重存储
- 创建事件路由器按类型分派到处理程序

---

**Last Updated:** 2025-05-11
**Status:** Ready for Execution
