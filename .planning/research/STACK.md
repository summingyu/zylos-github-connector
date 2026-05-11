# 技术栈研究：Zylos GitHub Webhook 连接器

**研究日期：** 2025-05-11

## 执行摘要

对于 Zylos 生态系统中的 GitHub Webhook 接收组件，我们推荐 **Fastify** 配合 **原始体捕获中间件**用于 HTTP 服务器，结合 **@octokit/webhooks** 进行签名验证。这提供了性能、安全性和开发体验的最佳平衡。

## 核心技术栈

| 组件 | 推荐 | 版本 | 理由 |
|------|----------------|---------|-----------|
| **运行时** | Node.js | LTS (20.x+) | Zylos 生态系统标准；async/await；crypto API |
| **HTTP 框架** | Fastify | Latest | 高吞吐量；内置验证；插件生态系统 |
| **Webhook 验证** | @octokit/webhooks | Latest | 官方 Octokit；TypeScript 类型；经过测试的中间件 |
| **体解析器** | fastify-raw-body | Latest | HMAC 验证所需的原始字节 |
| **日志** | Pino | Latest | Fastify 默认；结构化 JSON 日志 |
| **配置管理** | 自定义（按模板） | - | 热重载文件监视器（模板模式） |
| **进程管理器** | PM2 | Latest | Zylos 组件规范要求 |

## 详细推荐

### 1. HTTP 服务器框架：Fastify

**为什么选择 Fastify 而非 Express：**

- **性能：** 基准测试中吞吐量比 Express 高约 4-5 倍（46,664 req/s vs 9,433 req/s）
- **内置功能：** JSON schema 验证、Pino 日志、速率限制插件
- **插件生态系统：** fastify-raw-body、fastify-helmet、fastify-rate-limit
- **TypeScript 支持：** 如以后需要，提供一流支持

**原始体捕获（HMAC 关键）：**

Fastify 默认不暴露原始体。必须使用以下方式之一：

```javascript
// 选项 A：带有 parseAs: 'buffer' 的内容类型解析器
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' },
  (req, body, done) => {
    req.rawBody = body;
    done(null, JSON.parse(body));
  }
);

// 选项 B：fastify-raw-body 插件
import fastifyRawBody from 'fastify-raw-body';
fastify.register(fastifyRawBody);
```

**置信度：** 高 — Fastify 经过生产验证，Zylos 组件可以使用任何框架。

### 2. Webhook 签名验证：@octokit/webhooks

**为什么选择官方库：**

- 经过测试的验证逻辑（原始字节的 HMAC-SHA256）
- Node.js 中间件（`createNodeMiddleware`）
- 包含 TypeScript 类型
- 处理边缘情况（常量时间比较、缓冲区长度）

**替代方案：** 使用 `crypto.createHmac()` 和 `crypto.timingSafeEqual()` 进行手动验证

**置信度：** 高 — 这是 GitHub 的官方库。

### 3. 日志：Pino

**为什么选择 Pino：**

- Fastify 默认记录器
- 结构化 JSON 输出
- 低开销
- 易于与日志聚合器集成

**置信度：** 高 — 与 Fastify 生态系统一致。

### 4. 进程管理：PM2

**Zylos 规范要求：**

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'zylos-github-webhook',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
};
```

**置信度：** 必需 — zylos-component-template 中指定。

## 依赖项

### 生产依赖

```json
{
  "fastify": "^5.x",
  "@octokit/webhooks": "^15.x",
  "fastify-raw-body": "^5.x",
  "pino": "^9.x",
  "dotenv": "^16.x"
}
```

### 开发依赖

```json
{
  "pm2": "^5.x",
  "nodemon": "^4.x"
}
```

## 不使用的技术

| 技术 | 原因 |
|------|------|
| **Express** | 较高开销；手动原始体捕获容易出错 |
| **Bare Node http** | 需要更多自定义代码；无内置验证/日志 |
| **自定义 HMAC** | 验证是安全关键的；使用经过测试的库 |
| **内存去重** | 重启时丢失；使用持久化存储（v1 可选） |

## 安全头

使用 `fastify-helmet` 获取 OWASP 推荐头：

```javascript
import helmet from '@fastify/helmet';
fastify.register(helmet, {
  contentSecurityPolicy: false // API 服务器，可以禁用 CSP
});
```

## 部署考虑

- **端口：** 可配置（默认 3461，类似于 zylos-telegram 的 3460）
- **TLS：** 用户管理（独立端口模式）
- **负载大小限制：** 在 Fastify 中配置（GitHub 上限为 25MB）
- **超时：** Fastify 默认应该可以；GitHub 期望约 10s 响应

## 兼容性矩阵

| 组件 | Zylos 模板 | zylos-telegram | 本组件 |
|-----------|----------------|----------------|----------------|
| Node.js | ✓ | ✓ | ✓ |
| Fastify | - | - | ✓ |
| PM2 | ✓ | ✓ | ✓ |
| 配置热重载 | ✓ | ✓ | ✓ |
| C4 通信桥 | ✓ | ✓ | ✓ |

## 演进

- **v1：** 核心 webhook 接收和转发
- **v2+：** 考虑添加持久化去重存储（Redis）、事件过滤、自定义模板

---

**最后更新：** 2025-05-11 初始研究后
