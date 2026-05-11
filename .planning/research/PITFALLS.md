# 陷阱研究：GitHub Webhook 组件

**研究日期：** 2025-05-11

## 执行摘要

构建 webhook 接收器有记录详尽的失败模式。**关键陷阱**是：原始体转换破坏 HMAC、通过字符串比较泄漏时序攻击、重放攻击、阻塞处理程序导致重试、以及重启时丢失内存去重。本文档记录了这些陷阱及其警告迹象、预防策略和阶段映射。

## 关键陷阱

### 1. 原始体转换破坏 HMAC

**问题：**
JSON 解析器、中间件和代理可能在签名验证前转换请求体（空格、Unicode 转义序列、编码），导致即使合法 webhook 的 HMAC 也不匹配。

**警告迹象：**
- 签名验证随机失败
- 在开发环境工作但在生产环境失败
- Express/Fastify/bare http 之间行为不同

**预防：**
- 在任何解析之前捕获原始字节
- 使用框架特定的原始体捕获：
  - Express：`express.raw({ type: 'application/json' })`
  - Fastify：带有 `parseAs: 'buffer'` 的内容类型解析器
  - Bare：直接将流读入 Buffer
- 对原始 Buffer 验证签名，而非解析的 JSON

**避免：**
```javascript
// ❌ 错误 - 对解析的 JSON 验证
const payload = JSON.parse(req.body);
const signature = computeHmac(payload);

// ✓ 正确 - 对原始字节验证
const signature = computeHmac(req.rawBody);
```

**应对阶段：** 阶段 1（核心 webhook 设置）

---

### 2. 通过字符串比较泄漏时序攻击

**问题：**
对签名使用 `===` 或 `Buffer.compare()` 进行比较会泄漏可通过利用逐步猜测正确签名的时序信息。

**警告迹象：**
- 任何使用 `===`、`==` 或 `.equals()` 进行签名比较的代码
- 自定义比较逻辑

**预防：**
- 始终使用 `crypto.timingSafeEqual()` 进行签名比较
- 确保比较前缓冲区长度相同
- 比较完整签名包括 `sha256=` 前缀

**避免：**
```javascript
// ❌ 错误 - 时序泄漏
if (computedSig === receivedSig) { /* ... */ }

// ❌ 错误 - 时序泄漏
if (computedSig.toString() === receivedSig) { /* ... */ }

// ✓ 正确 - 常量时间比较
const a = Buffer.from(computedSig);
const b = Buffer.from(receivedSig);
if (a.length === b.length && crypto.timingSafeEqual(a, b)) { /* ... */ }
```

**应对阶段：** 阶段 1（签名验证）

---

### 3. 通过捕获签名重放攻击

**问题：**
攻击者可以捕获有效的 webhook 负载及其签名，稍后重新发送，导致重复处理（例如双重收费、重复状态转换）。

**警告迹象：**
- 没有跟踪已处理的事件 ID
- 同一事件被多次处理
- 日志中显示"奇怪"的重复动作

**预防：**
- 提取 `X-GitHub-Delivery` 头（每次传递唯一）
- 在持久化存储中存储已处理的传递 ID
- 处理前检查重复
- 可选验证时间戳（拒绝超过 5-10 分钟的事件）

**v1 方法：**
- 内存 Set 存储已处理的传递 ID
- 通过 GitHub 重试在重启后存活
- 对于单实例部署可接受

**v2+ 增强：**
- Redis/DynamoDB 用于持久化去重
- TTL 与 GitHub 重试窗口对齐（天数）

**应对阶段：** 阶段 1（基本内存），阶段 2+（持久化存储如需要）

---

### 4. 阻塞处理程序导致重试

**问题：**
在 webhook 处理程序中同步执行长时间工作会导致 GitHub 超时（约 10s）并重试，导致重复处理和潜在重试风暴。

**警告迹象：**
- 高处理延迟（每个请求 > 5s）
- GitHub 传递同一事件多次
- 日志显示超时错误

**预防：**
- **确认优先模式：** 验证 → 去重 → 入队 → 回复 202
- 确认后异步执行工作
- 使用队列（BullMQ、SQS、Redis 列表）进行后台处理

**避免：**
```javascript
// ❌ 错误 - 阻塞处理程序
app.post('/webhook', (req, res) => {
  verifySignature(req);
  const message = formatMessage(req.body);
  sendToCommBridge(message); // <-- 阻塞！
  doSlowDatabaseWork();       // <-- 阻塞！
  res.status(200).send();
});

// ✓ 正确 - 确认优先
app.post('/webhook', async (req, res) => {
  verifySignature(req);
  if (isDuplicate(req)) return res.status(200).send('duplicate');
  await enqueueWork(req.body);  // <-- 快速！
  res.status(202).send('accepted');
});
// 工作程序异步处理队列
```

**应对阶段：** 阶段 1（确认优先模式）

---

### 5. 重启时丢失内存去重

**问题：**
使用内存存储传递 ID 意味着重启时所有去重状态丢失，导致 GitHub 重试的事件被再次处理。

**警告迹象：**
- 部署/重启后重复处理
- 周一（周末部署后）重复率更高

**预防：**
- **v1 可接受：** 如果 GitHub 重试窗口短，内存可以
- **v2+ 必需：** 持久化存储（Redis、DynamoDB、SQLite）
- 在去重键上设置 TTL（24 小时以覆盖重试窗口）

**权衡：**
| 方法 | 优点 | 缺点 | 阶段 |
|----------|------|------|-------|
| 内存 Set | 零依赖 | 重启时丢失 | v1 |
| Redis | 快速、持久 | 额外服务 | v2+ |
| SQLite | 无外部依赖 | 比 Redis 慢 | v2+ |
| DynamoDB | 无服务器 | 成本、延迟 | v2+ |

**应对阶段：** 阶段 1（内存可以），阶段 2+（如需要持久化）

---

## 重要陷阱

### 6. 缺少安全头

**问题：**
没有安全头，端点容易受到点击劫持、MIME 嗅探和其他基于浏览器的攻击（如果暴露给 web）。

**警告迹象：**
- 缺少 Helmet 或等效中间件
- 没有 HSTS、X-Frame-Options、X-Content-Type-Options

**预防：**
- 对 Express 使用 `@fastify/helmet` 或 `helmet`
- 配置 CSP（纯 API 可以禁用）
- 启用 HSTS、X-Frame-Options、nosniff

**应对阶段：** 阶段 1

---

### 7. 记录敏感数据

**问题：**
记录 webhook secret、完整负载或认证令牌会将凭据暴露到日志文件中。

**警告迹象：**
- 日志文件中有 secret
- 记录完整请求体
- 记录认证头

**预防：**
- 永不记录 webhook secret
- 只记录安全元数据（事件类型、传递 ID、仓库）
- 在日志中编辑敏感头
- 使用字段级控制的结构化日志

**记录内容：**
- ✓ 事件类型、动作、仓库
- ✓ X-GitHub-Delivery ID
- ✓ 验证成功/失败
- ✓ 处理时间戳、延迟
- ✗ Webhook secret
- ✗ 完整请求体
- ✗ 认证头

**应对阶段：** 阶段 1

---

### 8. 负载大小溢出

**问题：**
GitHub 负载最多可达 25MB。无界体解析可能导致内存耗尽或崩溃。

**警告迹象：**
- 负载下 OOM 终止
- 大负载处理缓慢
- 高内存使用

**预防：**
- 在 Fastify/Express 中设置体大小限制
- 使用 413 拒绝超过阈值的负载
- 考虑对非常大的负载进行流式处理

```javascript
// Fastify 体限制
fastify.addContentTypeParser('application/json', {
  bodyLimit: 10 * 1024 * 1024 // 10MB
}, { parseAs: 'buffer' }, handler);
```

**应对阶段：** 阶段 1

---

## 次要陷阱

### 9. 错误的事件类型解析

**问题：**
依赖负载内容而不是 `X-GitHub-Event` 头来确定事件类型可能导致事件路由错误。

**预防：**
- 始终从 `X-GitHub-Event` 头读取事件类型
- 在已知事件类型后解析负载
- 验证事件类型在支持列表中

**应对阶段：** 阶段 1

---

### 10. 缺少优雅关闭

**问题：**
突然关闭会丢弃进行中的 webhook 并可能导致丢失事件或状态损坏。

**预防：**
- 处理 SIGINT/SIGTERM
- 优雅关闭服务器（停止接受新连接）
- 等待进行中的处理程序完成（带超时）
- 刷新日志并关闭连接

**应对阶段：** 阶段 1（模板提供模式）

---

## 陷阱检测检查清单

在代码审查和测试期间使用此检查清单：

- [ ] 在任何解析前捕获原始体
- [ ] 签名使用 `crypto.timingSafeEqual()`
- [ ] X-GitHub-Delivery 跟踪用于去重
- [ ] 处理程序快速返回 2xx（< 10s）
- [ ] 请求处理程序中没有阻塞工作
- [ ] 配置安全头（Helmet）
- [ ] 日志中没有 secret
- [ ] 配置了体大小限制
- [ ] 事件类型从头获取，而非负载
- [ ] 实现了优雅关闭

## 测试陷阱

### 单元测试
- 使用有效/无效签名测试签名验证
- 测试常量时间相等性（边缘情况：不同长度）
- 测试去重（重复检测）

### 集成测试
- 发送真实 GitHub webhook（使用 smee.io 或 ngrok）
- 使用大负载（> 1MB）测试
- 测试超时场景（慢速下游）
- 测试重启场景（重复检测）

### 安全测试
- 尝试重放攻击（重新发送捕获的 webhook）
- 尝试伪造（无效签名）
- 测试时序攻击抵抗性（统计分析）

## 阶段映射

| 陷阱 | 阶段 | 优先级 |
|--------|-------|----------|
| 原始体转换 | 1 | 关键 |
| 时序攻击 | 1 | 关键 |
| 重放攻击 | 1（基本）/ 2+（持久化） | 关键 |
| 阻塞处理程序 | 1 | 关键 |
| 内存去重丢失 | 1（可以）/ 2+（如需要修复） | 重要 |
| 安全头 | 1 | 重要 |
| 记录敏感数据 | 1 | 重要 |
| 负载溢出 | 1 | 重要 |
| 事件类型解析 | 1 | 次要 |
| 优雅关闭 | 1 | 次要 |

---

**最后更新：** 2025-05-11 初始研究后
