# Phase 1 Plan: HTTP Server Foundation

**Project:** Zylos GitHub Webhook Connector
**Phase:** 1 — HTTP Server Foundation
**Date:** 2025-05-11
**Status:** Ready to Execute

---

## Phase Goal

建立带有原始体捕获和安全头的 Fastify HTTP 服务器，为 GitHub webhook 接收提供可靠的基础设施。

---

## Success Criteria

1. ✓ Fastify 服务器监听可配置端口
2. ✓ 原始请求体在解析前保留为 Buffer
3. ✓ 应用安全头（Helmet）
4. ✓ Webhook 路由接受 POST 请求
5. ✓ 服务器可以优雅地启动和停止

---

## Requirements Coverage

| Requirement | Source | Coverage |
|-------------|--------|----------|
| WEBH-01 | HTTP 服务器在可配置端口上接收 GitHub Webhook POST 请求 | ✓ Plans 1, 4 |
| WEBH-02 | 组件在任何解析之前保留原始请求字节用于签名验证 | ✓ Plan 2 |
| WEBH-04 | 组件通过 helmet 中间件应用安全头 | ✓ Plan 3 |
| LIFE-02 | 组件在 SIGINT/SIGTERM 信号上实现优雅关闭 | ✓ Plan 5 |

---

## Execution Plans

### Plan 1: 初始化项目结构和 Fastify 服务器

**Dependencies:** None

**Files:**
- `src/index.js` (新建/修改)
- `package.json` (修改)

**Tasks:**

1. 安装 Fastify 核心依赖
   - 运行：`npm install fastify`
   - 运行：`npm install -D pino-pretty`（开发依赖，用于日志美化）

2. 创建基础服务器框架
   - 导入 fastify 模块
   - 创建 fastify 实例，配置 logger（使用 Pino）
   - 定义启动函数 `async function start()`
   - 添加服务器监听，使用配置中的端口（默认 3461）
   - 添加启动日志：`[github-connector] Server listening on http://[host]:[port]`

3. 配置日志选项
   - 使用 Pino logger，级别从配置读取（默认 'info'）
   - 配置日志格式包含时间戳和级别
   - 开发环境使用 pino-pretty 美化输出

4. 添加基本错误处理
   - 捕获启动错误，记录并退出进程（让 PM2 重启）
   - 添加未捕获异常处理器

**Acceptance:**
- 运行 `node src/index.js` 服务器启动并监听端口 3461
- 日志显示启动信息
- 访问 http://localhost:3461 返回 404（Fastify 默认）
- 按 Ctrl+C 服务器停止

---

### Plan 2: 实现原始请求体捕获（关键安全要求）

**Dependencies:** Plan 1 完成

**Files:**
- `src/index.js` (修改)

**Tasks:**

1. 安装 fastify-raw-body 插件
   - 运行：`npm install fastify-raw-body`

2. 注册原始体内容类型解析器
   - 在路由注册前添加内容类型解析器
   - 配置 `parseAs: 'buffer'` 选项
   - 实现：
     ```javascript
     fastify.addContentTypeParser('application/json', { parseAs: 'buffer' },
       (req, body, done) => {
         req.rawBody = body;  // 保留用于 HMAC 验证
         done(null, JSON.parse(body));
       }
     );
     ```

3. 添加请求体大小限制
   - 配置 bodyLimit 选项为 10MB（GitHub webhook 限制）
   - 添加配置选项 `maxPayloadSize`

4. 记录原始体捕获调试信息
   - 在开发日志模式下记录原始体大小

**Acceptance:**
- 发送 JSON POST 请求，请求体被正确解析
- `req.rawBody` 包含原始 Buffer
- 超过 10MB 的请求返回 413 Payload Too Large

---

### Plan 3: 配置安全头（Helmet 中间件）

**Dependencies:** Plan 1 完成

**Files:**
- `src/index.js` (修改)

**Tasks:**

1. 安装 Fastify Helmet 插件
   - 运行：`npm install @fastify/helmet`

2. 注册 Helmet 中间件
   - 使用默认配置（推荐设置）
   - 在路由注册前注册：
     ```javascript
     fastify.register(helmet);
     ```

3. 验证安全头
   - 测试响应包含以下头：
     - Strict-Transport-Security
     - X-Frame-Options
     - X-Content-Type-Options
     - Referrer-Policy

**Acceptance:**
- 任何 HTTP 响应包含安全头
- 使用 curl 或浏览器开发者工具验证头存在

---

### Plan 4: 定义 Webhook 路由和健康检查

**Dependencies:** Plans 1, 2, 3 完成

**Files:**
- `src/index.js` (修改)
- `src/lib/routes.js` (新建)

**Tasks:**

1. 创建健康检查路由
   - 路由：`GET /health`
   - 处理程序返回：`{ status: 'ok', service: 'github-connector' }`
   - 状态码：200

2. 创建 Webhook 接收路由
   - 路由：`POST /webhook`
   - 处理程序返回：`{ message: 'Webhook received (not yet verified)' }`
   - 状态码：202（已接受）
   - 记录请求：方法、路径、GitHub 头（X-GitHub-Event、X-GitHub-Delivery）

3. 添加路由日志中间件
   - 记录每个请求的方法、路径、状态码、处理时间
   - 使用 Fastify 的 onRequest 和 onResponse 钩子

4. 创建路由模块（可选）
   - 将路由定义分离到 `src/lib/routes.js`
   - 保持主入口文件整洁

**Acceptance:**
- GET /health 返回 200 和 JSON 状态
- POST /webhook 返回 202
- Webhook 请求被记录到日志

---

### Plan 5: 实现优雅关闭和生命周期管理

**Dependencies:** Plan 1 完成

**Files:**
- `src/index.js` (修改)

**Tasks:**

1. 实现优雅关闭函数
   - 创建 `async function close()` 函数
   - 调用 `fastify.close()` 关闭服务器
   - 记录关闭日志

2. 注册信号处理器
   - 监听 SIGINT（Ctrl+C）
   - 监听 SIGTERM（PM2 停止）
   - 调用关闭函数，然后退出进程（0）

3. 添加超时保护
   - 如果关闭超过 10 秒，强制退出
   - 防止挂起进程

4. 记录关闭事件
   - 记录接收到的信号
   - 记录连接关闭状态

**Acceptance:**
- 按 Ctrl+C 服务器优雅关闭
- 日志显示关闭消息
- PM2 停止命令正常工作

---

## Dependencies and Order

```
Plan 1 (项目结构和服务器)
    ├──→ Plan 2 (原始体捕获)
    ├──→ Plan 3 (安全头)
    ├──→ Plan 4 (路由)
    └──→ Plan 5 (优雅关闭)
```

**建议执行顺序：** Plan 1 → Plan 2 → Plan 3 → Plan 4 → Plan 5

---

## Configuration Impact

需要添加的配置选项（`config.json`）：

```json
{
  "port": 3461,
  "maxPayloadSize": "10mb",
  "logging": {
    "level": "info",
    "pretty": true
  }
}
```

---

## Testing Approach

### 手动测试

1. 启动服务器：`node src/index.js`
2. 健康检查：`curl http://localhost:3461/health`
3. Webhook 测试：
   ```bash
   curl -X POST http://localhost:3461/webhook \
     -H "Content-Type: application/json" \
     -H "X-GitHub-Event: push" \
     -H "X-GitHub-Delivery: 12345" \
     -d '{"test": true}'
   ```
4. 安全头验证：`curl -I http://localhost:3461/health`
5. 优雅关闭：按 Ctrl+C

### 验证点

- [ ] 服务器启动无错误
- [ ] 日志包含启动信息
- [ ] /health 返回 200
- [ ] /webhook 返回 202
- [ ] 安全头存在
- [ ] 优雅关闭工作正常
- [ ] Ctrl+C 清理并退出

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| 端口冲突 | 配置默认端口 3461，允许配置覆盖 |
| 原始体未正确保留 | 添加单元测试验证 rawBody 存在 |
| 安全头配置问题 | 使用 Helmet 默认配置，已验证 |
| 优雅关闭超时 | 添加 10 秒强制退出保护 |

---

## Completion Checklist

- [ ] 所有 5 个计划完成
- [ ] 所有成功标准满足
- [ ] 手动测试通过
- [ ] 代码提交到 Git
- [ ] 准备进入 Phase 2（签名验证）

---

## Next Phase Preview

**Phase 2: Signature Verification**
- 实现 HMAC-SHA256 webhook 签名验证
- 使用 crypto.timingSafeEqual 防止时序攻击
- 集成到 /webhook 路由

---

**Last Updated:** 2025-05-11
**Status:** Ready for Execution
