<!-- generated-by: gsd-doc-writer -->
# 测试指南

本文档描述 Zylos GitHub Connector 的测试策略、运行方法和编写指南。

## 测试概述

项目包含 **27 个单元测试**，覆盖签名验证模块的所有核心功能。测试使用 Node.js 内置的测试运行器（`node:test`），无需额外依赖。

### 测试覆盖范围

- **签名计算（HMAC-SHA256）**：验证签名的正确性和一致性
- **签名验证**：有效签名、无效签名、格式错误、边界情况
- **签名提取**：请求头解析和格式验证
- **安全性测试**：时序攻击防护、重放攻击防护
- **边界情况**：大负载、Unicode 字符、特殊字符

## 运行测试

### 全部测试

运行完整的测试套件：

```bash
npm test
```

### 监听模式

在开发过程中运行监听模式，文件变化时自动重新运行：

```bash
npm run test:watch
```

### 单个测试文件

运行特定的测试文件：

```bash
node --test src/lib/__tests__/verifier.test.js
```

## 集成测试

项目提供了一个完整的集成测试脚本 `scripts/test-webhook.js`，用于测试真实的 HTTP webhook 请求。

### 运行集成测试

**步骤 1：启动服务器**

```bash
npm start
```

服务器将在 `http://localhost:3461` 启动。

**步骤 2：运行集成测试**

在新终端中运行：

```bash
npm run test:webhook
```

### 自定义集成测试配置

可以通过环境变量自定义集成测试：

```bash
# 自定义服务器 URL
SERVER_URL=http://localhost:3461/webhook npm run test:webhook

# 自定义 webhook secret
SECRET=my-custom-secret npm run test:webhook

# 同时设置多个变量
SERVER_URL=http://localhost:8080/hook SECRET=test-secret npm run test:webhook
```

### 集成测试覆盖范围

集成测试包含 **27 个测试用例**，分为 5 个测试组：

1. **有效签名测试**（5 个测试）
   - 基本 PUSH 事件
   - 不同事件类型（pull_request、issues、ping）

2. **无效签名测试**（3 个测试）
   - 随机签名值
   - 使用错误 secret
   - 篡改的负载

3. **格式错误测试**（4 个测试）
   - 缺少签名头
   - 空签名头
   - 缺少 sha256= 前缀
   - 长度不正确的签名

4. **边界情况测试**（3 个测试）
   - 空负载
   - 大负载（100KB+）
   - Unicode 字符

5. **HTTP 方法测试**（2 个测试）
   - GET 请求（应返回 404）
   - PUT 请求（应返回 404）

## 手动测试

### 使用 curl 发送测试请求

**基本测试（有效签名）：**

```bash
# 生成签名（需要先安装依赖或使用在线工具）
# 这里假设 secret 是 'test-webhook-secret'

PAYLOAD='{"action":"test","repository":{"name":"test-repo"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "test-webhook-secret" | awk '{print "sha256="$2}')

curl -X POST http://localhost:3461/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-manual-123" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$PAYLOAD"
```

**测试无效签名：**

```bash
curl -X POST http://localhost:3461/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-invalid-123" \
  -H "X-Hub-Signature-256: sha256=invalid000000000000000000000000000000000000000000000000000000000000" \
  -d '{"test":"data"}'
```

**测试缺少签名头：**

```bash
curl -X POST http://localhost:3461/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"test":"data"}'
```

### 使用 ngrok 或 smee.io 进行真实 GitHub webhook 测试

**使用 ngrok：**

```bash
# 安装 ngrok
brew install ngrok

# 启动 ngrok 隧道
ngrok http 3461

# 在 GitHub 仓库设置中配置 webhook URL
# URL: https://xxxx-xx-xx-xx-xx.ngrok.io/webhook
# Secret: test-webhook-secret
```

**使用 smee.io：**

```bash
# 访问 https://smee.io/new 获取频道
# 设置转发
smee client https://smee.io/xxxx http://localhost:3461/webhook
```

## 编写新测试

### 测试文件命名规范

测试文件应放在 `src/lib/__tests__/` 目录下，命名模式为：

```
{module-name}.test.js
```

例如：
- `verifier.test.js`（签名验证模块）
- `dedupe.test.js`（去重模块）
- `config.test.js`（配置模块）

### 测试模板

使用 Node.js 内置测试运行器的标准模板：

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { functionToTest } from '../module.js';

describe('模块名称', () => {

  it('应该做什么事', () => {
    const result = functionToTest(input);
    assert.strictEqual(result, expected);
  });

  it('应该处理错误情况', () => {
    assert.throws(() => {
      functionToTest(invalidInput);
    }, /Expected error message/);
  });
});
```

### 测试最佳实践

1. **使用描述性的测试名称**
   - ✅ `应该验证有效的签名`
   - ❌ `test1`

2. **一个测试只验证一件事**
   - ✅ 每个测试只测试一个函数或一个代码路径
   - ❌ 一个测试测试多个不相关的功能

3. **使用 beforeEach 设置共享状态**
   ```javascript
   import { beforeEach } from 'node:test';

   beforeEach(() => {
     // 设置测试环境
   });
   ```

4. **测试边界情况**
   - 空输入
   - null/undefined
   - 大输入
   - 特殊字符

5. **避免依赖外部服务**
   - 使用 mock 而不是真实的 HTTP 请求
   - 使用固定数据而不是随机数据

## 测试覆盖率说明

当前项目使用 Node.js 内置测试运行器，**没有配置覆盖率工具**。

### 查看测试运行

运行测试时会看到类似输出：

```
▶ verifier.test.js
  ✔ 签名验证模块 (verifier.js) (27.102ms)
  ✔ computeHmac() (6.123ms)
  ✔ verifySignature() (12.456ms)
  ✔ extractSignature() (4.789ms)
  ✔ 安全性测试 (2.345ms)
  ✔ 边界情况 (1.234ms)
ℹ tests 27
ℹ pass 27
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 123.456
```

### 添加覆盖率工具（可选）

如果需要覆盖率报告，可以添加 `c8`（Node.js 内置覆盖率工具）：

```bash
npm install --save-dev c8
```

更新 `package.json`：

```json
{
  "scripts": {
    "test": "c8 node --test src/lib/__tests__/**/*.test.js",
    "test:report": "c8 --reporter=html --reporter=text node --test src/lib/__tests__/**/*.test.js"
  }
}
```

生成覆盖率报告：

```bash
npm run test:report
```

报告将生成在 `coverage/index.html`。

## CI 集成

当前项目**没有配置 CI/CD 流程**。如果需要添加 GitHub Actions 工作流，可以在 `.github/workflows/test.yml` 中添加：

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
```

## 故障排查

### 测试失败：模块未找到

**错误：** `Error [ERR_MODULE_NOT_FOUND]: Cannot find package`

**原因：** 依赖未安装或路径错误

**解决：**

```bash
npm install
```

### 集成测试失败：连接被拒绝

**错误：** `ECONNREFUSED` 或 `connect ECONNREFUSED`

**原因：** 服务器未启动

**解决：**

```bash
# 启动服务器
npm start

# 在另一个终端运行测试
npm run test:webhook
```

### 签名验证失败

**错误：** 预期 202，实际 401

**原因：** Secret 不匹配

**解决：**

检查服务器的配置文件中的 `webhookSecret` 是否与测试中使用的 `SECRET` 环境变量一致。

### 端口已被占用

**错误：** `EADDRINUSE: address already in use :::3461`

**原因：** 端口 3461 已被其他进程使用

**解决：**

```bash
# 查找占用端口的进程
lsof -i :3461

# 终止进程
kill -9 <PID>

# 或使用不同端口
PORT=3462 npm start
```

## 下一步

- 查看开发指南：[DEVELOPMENT.md](DEVELOPMENT.md)
- 了解项目架构：[ARCHITECTURE.md](ARCHITECTURE.md)
- 返回主文档：[README.md](README.md)
