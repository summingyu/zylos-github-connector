# Claude 开发指南：Zylos GitHub Webhook 连接器

本项目使用 GSD（Get Shit Done）工作流框架。参见 `.planning/` 了解项目上下文、需求和路线图。

## 项目概述

**组件：** Zylos AI Agent 平台的 GitHub Webhook 连接器
**类型：** 通信组件（单向：GitHub → Zylos）
**技术栈：** Node.js、Fastify、@octokit/webhooks、PM2

## 当前状态

**阶段：** 1 — HTTP 服务器基础
**状态：** 准备执行

## 关键架构决策

1. **单向流：** 接收 GitHub webhook，通过 C4 通信桥转发（无 GitHub API 写操作）
2. **独立端口：** 直接暴露（非 Caddy 反向代理）
3. **确认优先模式：** 验证 → 去重 → 回复 202 → 异步处理
4. **内存去重：** X-GitHub-Delivery 跟踪（v1 可接受）

## 组件结构（计划）

```
src/
├── index.js          # Fastify 服务器、优雅关闭
├── lib/
│   ├── config.js     # 带热重载的配置加载器
│   ├── verifier.js   # HMAC-SHA256 签名验证
│   ├── dedupe.js     # X-GitHub-Delivery 跟踪
│   ├── handlers/     # 按类型的事件处理程序
│   └── formatters/   # 消息格式化函数
scripts/
└── send.js           # 测试接口（绕过 C4）
SKILL.md              # 组件元数据
ecosystem.config.cjs  # PM2 配置
```

## 工作流集成

### 规划

```bash
/gsd-discuss-phase 1    # 规划前收集上下文
/gsd-plan-phase 1       # 创建详细计划
```

### 执行

```bash
/gsd-execute-phase 1    # 执行阶段中的所有计划
```

### 验证

```bash
/gsd-verify-work       # 验证阶段完成
/gsd-code-review       # 阶段后代码审查
```

## 关键实现说明

### 原始体捕获（关键）

**必须在进行任何解析之前捕获原始字节：**

```javascript
// Fastify 原始体捕获
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' },
  (req, body, done) => {
    req.rawBody = body;  // 保留用于 HMAC
    done(null, JSON.parse(body));
  }
);
```

### 签名验证（安全关键）

**始终使用常量时间比较：**

```javascript
import crypto from 'crypto';

const expected = 'sha256=' + crypto.createHmac('sha256', secret)
  .update(rawBody).digest('hex');
const a = Buffer.from(expected);
const b = Buffer.from(receivedSig);
if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
  // 有效
}
```

### 确认优先模式

**快速返回 202，异步处理：**

```javascript
// 处理程序流程
verifySignature(req);
if (isDuplicate(req)) return reply.code(200).send('duplicate');
await enqueueWork(req.body);  // 快速！
reply.code(202).send('accepted');  // 确认！
// 工作程序异步处理
```

## 组件依赖

- **comm-bridge**：消息传递必需
- **zylos-component-template**：基础结构和模式
- **zylos-telegram**：通信组件参考

## 配置位置

配置文件：`~/zylos/components/github-connector/config.json`

```json
{
  "enabled": true,
  "port": 3461,
  "webhookSecret": "github-connector-secret",
  "commBridge": {
    "enabled": true,
    "defaultEndpoint": "default"
  },
  "logging": {
    "level": "info"
  }
}
```

## 测试方法

- 单元测试：签名验证、事件解析、去重
- 集成测试：使用 smee.io 或 ngrok 进行真实的 GitHub webhook
- 安全测试：重放攻击、无效签名

## 文档

- SKILL.md：组件元数据（Zylos CLI 自动发现）
- README.md：安装、配置、GitHub webhook 设置
- DESIGN.md：架构和设计决策（如需要则创建）

## 常见任务

### 阶段完成后

```bash
/gsd-verify-work       # 验证需求满足
/gsd-code-review       # 审查代码质量
/gsd-complete-phase    # 标记阶段完成
```

### 项目管理

```bash
/gsd-progress          # 检查整体进度
/gsd-stats             # 显示项目统计
```

## 安全提醒

- **切勿记录 webhook secret** 或完整请求体
- **切勿使用字符串相等**（`===`）进行签名比较
- **始终验证原始字节的 HMAC**，而非解析的 JSON
- **始终快速返回 2xx** 以避免 GitHub 重试
- **始终跟踪 X-GitHub-Delivery** 以防止重复

## 获取帮助

```bash
/gsd-help              # 显示可用的 GSD 命令
```

---

*此文件由 GSD 工作流自动生成。通过 `/gsd-new-project` 或 `/gsd-config` 更新。*
