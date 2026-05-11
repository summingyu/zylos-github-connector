# 测试文档

## 概述

本项目的测试分为两类：

1. **单元测试** - 测试单个模块的功能
2. **集成测试** - 测试完整的 webhook 端到端流程

## 运行测试

### 单元测试

单元测试使用 Node.js 内置的 test runner（Node.js 20+）。

```bash
# 运行所有单元测试
npm test

# 以监视模式运行（自动重新运行）
npm run test:watch
```

### 集成测试

集成测试需要服务器正在运行。

1. 启动服务器：
```bash
npm start
```

2. 在另一个终端运行集成测试：
```bash
npm run test:webhook
```

3. 自定义服务器 URL 和 secret：
```bash
SERVER_URL=http://localhost:3461/webhook SECRET=my-secret npm run test:webhook
```

## 测试覆盖

### 单元测试 (src/lib/__tests__/verifier.test.js)

- ✅ HMAC 计算（Buffer 和字符串输入）
- ✅ 有效签名验证
- ✅ 无效签名拒绝
- ✅ 格式错误处理（缺少前缀、长度错误）
- ✅ 常量时间相等性验证
- ✅ 边界情况（大负载、Unicode、特殊字符）
- ✅ 安全性（防止时序攻击）

总计：27 个测试用例

### 集成测试 (scripts/test-webhook.js)

- ✅ 有效签名测试（多种事件类型）
- ✅ 无效签名测试（随机值、错误 secret、篡改负载）
- ✅ 格式错误测试（缺少头、空值、格式错误）
- ✅ 边界情况测试（空负载、大负载、Unicode）
- ✅ HTTP 方法测试（GET、PUT）

总计：15+ 个测试场景

## 测试工具

### 测试辅助函数

测试辅助函数位于 `scripts/lib/test-helpers.js`，包括：

- `generateTestPayload()` - 生成测试 webhook 负载
- `computeSignature()` - 计算 HMAC-SHA256 签名
- `generateDeliveryId()` - 生成唯一 delivery ID
- `sendRequest()` - 发送 HTTP 请求
- `sendTestWebhook()` - 发送测试 webhook
- `TestResults` - 测试结果汇总类

### 在其他脚本中使用测试工具

```javascript
import {
  generateTestPayload,
  computeSignature,
  sendTestWebhook
} from './scripts/lib/test-helpers.js';

// 发送测试请求
const result = await sendTestWebhook({
  url: 'http://localhost:3461/webhook',
  secret: 'my-secret',
  eventType: 'push'
});
```

## 手动测试

### 使用 curl

```bash
# 计算签名
SECRET="your-webhook-secret"
PAYLOAD='{"action":"test","repository":{"name":"test-repo"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

# 发送请求
curl -X POST http://localhost:3461/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -d "$PAYLOAD"
```

### 使用 GitHub Webhook 测试

1. 在 GitHub 仓库设置中配置 webhook
2. 设置 secret
3. 触发相应事件（push、PR 等）

## 持续集成

单元测试应该在每个 CI/CD 流程中运行：

```yaml
# .github/workflows/test.yml 示例
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-node@v3
    with:
      node-version: '20'
  - run: npm test
```

## 添加新测试

### 添加单元测试

在 `src/lib/__tests__/` 目录下创建 `.test.js` 文件：

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('My Module', () => {
  it('should do something', () => {
    // 测试代码
  });
});
```

### 添加集成测试

在 `scripts/test-webhook.js` 中添加新的测试组或使用 `sendTestWebhook()` 创建新的测试脚本。

## 故障排除

### 测试失败

如果单元测试失败：

1. 检查 Node.js 版本（需要 20+）
2. 运行 `npm install` 确保依赖正确
3. 查看详细错误信息

如果集成测试失败：

1. 确保服务器正在运行
2. 检查 `SECRET` 环境变量是否与服务器配置匹配
3. 检查 `SERVER_URL` 是否正确

### 常见问题

**Q: 测试报告 "Cannot find module"**
A: 确保使用 ESM 模块语法（`import`/`export`）和 `.js` 扩展名。

**Q: 集成测试超时**
A: 检查服务器是否正在运行，URL 是否正确。

**Q: 签名验证总是失败**
A: 确保：
- secret 与服务器配置完全匹配
- 使用 `X-Hub-Signature-256` 头（不是 `X-Hub-Signature`）
- 签名包含 `sha256=` 前缀
- 请求体在签名后没有被修改
