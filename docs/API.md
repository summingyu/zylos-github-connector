<!-- generated-by: gsd-doc-writer -->
# API 文档

本文档描述 Zylos GitHub Webhook 连接器的 HTTP API 端点、请求格式、响应状态码以及签名验证流程。

## 目录

- [端点概览](#端点概览)
- [认证方式](#认证方式)
- [Webhook 端点](#webhook-端点)
- [健康检查端点](#健康检查端点)
- [请求格式](#请求格式)
- [响应格式](#响应格式)
- [错误码](#错误码)
- [签名验证流程](#签名验证流程)

## 端点概览

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/webhook` | 接收 GitHub webhook 事件 | HMAC-SHA256 签名 |
| GET | `/health` | 健康检查 | 无 |

## 认证方式

本服务使用 HMAC-SHA256 签名进行身份验证，确保请求来自 GitHub 且未被篡改。

### 签名头

所有 `/webhook` 请求必须包含 `X-Hub-Signature-256` 头：

```
X-Hub-Signature-256: sha256=<hash>
```

其中 `<hash>` 是使用 webhook secret 计算的 HMAC-SHA256 值（64 位十六进制字符串）。

### Webhook Secret 配置

Webhook secret 通过以下方式配置（优先级从高到低）：

1. 环境变量 `GITHUB_WEBHOOK_SECRET`
2. 配置文件 `~/zylos/components/github-connector/config.json` 中的 `webhookSecret` 字段

**安全提醒：** 切勿在代码中硬编码 webhook secret，切勿在日志中记录完整签名或 secret 值。

## Webhook 端点

### POST /webhook

接收并验证 GitHub webhook 事件。

#### 请求头

| 头名 | 必需 | 描述 |
|------|------|------|
| `Content-Type` | 是 | 必须为 `application/json` |
| `X-Hub-Signature-256` | 是 | HMAC-SHA256 签名 |
| `X-GitHub-Event` | 是 | 事件类型（如 `push`、`pull_request`） |
| `X-GitHub-Delivery` | 否 | GitHub 的唯一投递 ID |

#### 请求体

标准的 GitHub webhook 事件负载（JSON 格式）。负载结构取决于事件类型。

示例（push 事件）：

```json
{
  "ref": "refs/heads/main",
  "repository": {
    "id": 123456789,
    "name": "example-repo",
    "full_name": "user/example-repo",
    "owner": {
      "login": "user"
    }
  },
  "pusher": {
    "name": "username"
  },
  "commits": [
    {
      "id": "abc123",
      "message": "Commit message",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### 响应

**成功响应 (202 Accepted)**

```json
{
  "message": "Webhook accepted"
}
```

**失败响应 (401 Unauthorized)**

```json
{
  "error": "Invalid signature"
}
```

**配置错误 (500 Internal Server Error)**

```json
{
  "error": "Server configuration error",
  "message": "Webhook secret not configured"
}
```

#### 状态码

| 状态码 | 描述 |
|--------|------|
| 202 | Webhook 已接收并验证成功 |
| 401 | 签名验证失败 |
| 500 | 服务器配置错误（如未配置 webhook secret） |

## 健康检查端点

### GET /health

检查服务运行状态。

#### 请求头

无需特殊请求头。

#### 响应

**成功响应 (200 OK)**

```json
{
  "status": "ok",
  "service": "github-webhook",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 请求格式

### Content-Type

所有 `/webhook` 请求必须使用 `Content-Type: application/json`。

### 最大负载大小

默认最大负载大小为 10MB。可通过配置文件中的 `maxPayloadSize` 字段调整。

支持的单位：`b`、`kb`、`mb`、`gb`（不区分大小写）。

示例配置：

```json
{
  "maxPayloadSize": "10mb"
}
```

## 响应格式

所有响应均使用 JSON 格式。

成功响应包含相关数据或确认消息，错误响应包含 `error` 字段和可选的 `message` 字段。

## 错误码

| HTTP 状态码 | 错误类型 | 描述 | 解决方案 |
|-------------|----------|------|----------|
| 401 | `Invalid signature` | 签名验证失败 | 检查 webhook secret 是否正确配置 |
| 500 | `Server configuration error` | 服务器配置错误 | 确保 `webhookSecret` 已配置 |
| 500 | `Verification error` | 签名验证过程异常 | 检查日志以获取详细错误信息 |

## 签名验证流程

### 验证步骤

1. **提取原始请求体**

   服务器在解析 JSON 之前保留原始字节流用于签名验证。

2. **计算预期签名**

   使用 webhook secret 和原始请求体计算 HMAC-SHA256：

   ```javascript
   import crypto from 'crypto';

   const signature = 'sha256=' + crypto.createHmac('sha256', secret)
     .update(rawBody)
     .digest('hex');
   ```

3. **比较签名**

   使用常量时间比较（`crypto.timingSafeEqual`）防止时序攻击：

   ```javascript
   const expected = Buffer.from(expectedSignature);
   const received = Buffer.from(receivedSignature);

   if (expected.length === received.length &&
       crypto.timingSafeEqual(expected, received)) {
     // 签名有效
   }
   ```

### 安全注意事项

- ✅ **始终**验证原始字节的 HMAC，而非解析后的 JSON
- ✅ **始终**使用 `crypto.timingSafeEqual` 进行签名比较
- ✅ **始终**在处理业务逻辑之前验证签名
- ❌ **切勿**使用普通字符串相等（`===`）比较签名
- ❌ **切勿**在日志中记录 webhook secret 或完整请求体
- ❌ **切勿**在代码中硬编码 webhook secret

### 签名计算示例

使用 Node.js 计算签名：

```javascript
import crypto from 'crypto';

function computeSignature(payload, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// 使用示例
const payload = JSON.stringify({ ref: 'refs/heads/main' });
const secret = 'your-webhook-secret';
const signature = computeSignature(payload, secret);
```

使用 curl 测试：

```bash
# 计算签名
PAYLOAD='{"ref":"refs/heads/main"}'
SECRET="your-webhook-secret"
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

# 发送请求
curl -X POST http://localhost:3461/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -H "X-GitHub-Event: push" \
  -d "$PAYLOAD"
```

## 测试 API

项目提供了集成测试脚本用于测试 webhook 端点：

```bash
# 设置环境变量
export SERVER_URL=http://localhost:3461/webhook
export SECRET=your-webhook-secret

# 运行测试
node scripts/test-webhook.js
```

测试脚本覆盖以下场景：

- ✅ 有效签名（多种事件类型）
- ❌ 无效签名（错误 secret、篡改负载）
- ❌ 格式错误（缺少签名、错误格式）
- 🧪 边界情况（空负载、大负载、Unicode 字符）
- 🔒 HTTP 方法验证

## 相关文档

- [README.md](../README.md) - 项目概述和快速开始
- [GETTING-STARTED.md](GETTING-STARTED.md) - 安装和配置指南
- [CONFIGURATION.md](CONFIGURATION.md) - 配置选项详情
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南
