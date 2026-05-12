<!-- generated-by: gsd-doc-writer -->
# 测试指南

本文档描述 Zylos GitHub Connector 的测试策略、运行方法和编写指南。

## 测试概述

项目包含 **519 个单元测试和集成测试**，覆盖 webhook 处理流程的所有核心功能。测试使用 Node.js 内置的测试运行器（`node:test`），无需额外依赖。

### 测试覆盖范围

- **签名验证**（27 个测试）：HMAC-SHA256 计算、签名验证、安全性测试、边界情况
- **事件解析**（22 个测试）：GitHub 事件解析、类型识别、数据提取
- **去重模块**（20 个测试）：X-GitHub-Delivery 跟踪、重复检测、TTL 清理
- **C4 通信桥**（15 个测试）：消息发送、重试机制、错误处理
- **路由器**（18 个测试）：HTTP 路由、健康检查、错误响应
- **事件处理器**（90+ 个测试）：
  - Pull Request 处理器（35 个测试）
  - Issues 处理器（28 个测试）
  - Release 处理器（22 个测试）
  - Comment 处理器（15 个测试）
- **消息格式化**（85 个测试）：各类型事件的格式化输出
- **集成测试**（242 个测试）：端到端的事件处理流程

## 运行测试

### 全部测试

运行完整的测试套件：

```bash
npm test
```

**预期输出：**

```
# tests 519
# suites 124
# pass 519
# fail 0
# skipped 0
# duration_ms ~4500
```

### 监听模式

在开发过程中运行监听模式，文件变化时自动重新运行：

```bash
npm run test:watch
```

### 单个测试文件

运行特定的测试文件：

```bash
# 签名验证测试
node --test src/lib/__tests__/verifier.test.js

# 路由器测试
node --test src/lib/__tests__/router.test.js

# 集成测试
node --test src/lib/__tests__/integration.test.js
```

### 按模块运行测试

运行特定模块的所有测试：

```bash
# 所有去重相关测试
node --test src/lib/__tests__/dedupe*.test.js

# 所有 Pull Request 相关测试
node --test src/lib/__tests__/pull-request*.test.js

# 所有 Issues 相关测试
node --test src/lib/__tests__/issues*.test.js
```

## 集成测试

项目包含完整的集成测试套件，测试真实的 HTTP webhook 请求处理流程。

### HTTP 集成测试

测试 Fastify 服务器的请求处理、响应格式和错误处理。

```bash
node --test src/lib/__tests__/integration.test.js
```

**覆盖范围：**

- ✅ 有效签名的 PUSH 事件（返回 202）
- ✅ 无效签名的请求（返回 401）
- ✅ 缺少签名头的请求（返回 401）
- ✅ 缺少必需头的请求（返回 400）
- ✅ 健康检查端点（返回 200）
- ✅ 不存在的路由（返回 404）

### 事件处理器集成测试

测试各类型事件的端到端处理流程：

```bash
# Pull Request 事件集成测试
node --test src/lib/__tests__/pull-request-integration.test.js

# Issues 事件集成测试
node --test src/lib/__tests__/issues-integration.test.js

# Release 事件集成测试
node --test src/lib/__tests__/release-integration.test.js

# 去重模块集成测试
node --test src/lib/__tests__/dedupe-integration.test.js
```

**覆盖场景：**

- 事件接收 → 解析 → 验证 → 去重 → 处理 → 格式化 → 发送
- C4 通信桥集成
- 错误处理和日志记录

## PM2 集成测试

项目包含 PM2 进程管理的完整集成测试脚本 `scripts/pm2-test.sh`。

### 运行 PM2 集成测试

**前提条件：**

1. 安装 PM2：
   ```bash
   npm install -g pm2
   ```

2. 确保端口 3461 未被占用

**运行测试：**

```bash
bash scripts/pm2-test.sh
```

**测试场景：**

1. **启动测试**（test_start）
   - PM2 进程启动
   - 进程状态检查（应为 `online`）
   - 日志文件创建（`logs/error.log`, `logs/out.log`）
   - HTTP 健康检查端点响应

2. **停止测试**（test_stop）
   - PM2 进程停止
   - 进程状态检查（应为 `stopped`）
   - 优雅关闭日志验证
   - 资源清理日志验证（定时器清理）

3. **重启测试**（test_restart）
   - PM2 进程重启
   - 进程状态检查（应为 `online`）
   - 重启后 HTTP 端点响应

4. **禁用配置测试**（test_disabled）
   - 配置文件中 `enabled: false`
   - 进程应自动退出
   - 配置恢复后重启

5. **清理**（cleanup）
   - 删除 PM2 进程
   - 删除临时配置备份

**预期输出：**

```
===================================
   PM2 Integration Test Suite
===================================

➜ Testing PM2 start...
✓ PM2 started successfully (status: online)
✓ Log files created
✓ Health endpoint responding

➜ Testing PM2 stop...
✓ PM2 stopped successfully (status: stopped)
✓ Graceful shutdown logs found
✓ Resource cleanup logs found

➜ Testing PM2 restart...
✓ PM2 restarted successfully (status: online)
✓ Health endpoint responding after restart

➜ Testing disabled configuration...
✓ Process exited when disabled (status: stopped)

➜ Cleaning up...
✓ Cleanup complete

===================================
   All tests passed!
===================================
```

### PM2 测试故障排查

**端口占用：**

```bash
# 查找占用端口的进程
lsof -i :3461

# 终止进程
kill -9 <PID>
```

**PM2 进程已存在：**

```bash
# 停止并删除现有进程
pm2 stop zylos-github-connector
pm2 delete zylos-github-connector
```

**日志文件问题：**

```bash
# 创建日志目录
mkdir -p logs

# 检查日志权限
ls -la logs/
```

## 手动测试

### 使用 curl 发送测试请求

**基本测试（有效签名）：**

```bash
# 生成签名
PAYLOAD='{"action":"test","repository":{"name":"test-repo"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "test-webhook-secret" | awk '{print "sha256="$2}')

# 发送请求
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

**测试健康检查：**

```bash
curl http://localhost:3461/health
# 预期输出：{"status":"ok"}
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
{module-name}.test.js           # 单元测试
{module-name}-integration.test.js  # 集成测试
```

例如：
- `verifier.test.js`（签名验证单元测试）
- `verifier-integration.test.js`（签名验证集成测试）
- `pull-request-handler.test.js`（PR 处理器单元测试）

### 测试模板

使用 Node.js 内置测试运行器的标准模板：

```javascript
import { describe, it, mock } from 'node:test';
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

### 集成测试模板

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { buildServer } from '../../index.js';

describe('模块集成测试', () => {
  let server;

  before(async () => {
    server = buildServer();
    await server.ready();
  });

  after(async () => {
    await server.close();
  });

  it('应该处理完整的请求流程', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': '...'
      },
      body: { /* payload */ }
    });

    assert.strictEqual(response.statusCode, 202);
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

3. **使用 mock 隔离依赖**
   ```javascript
   import { mock } from 'node:test';

   it('应该调用 C4 通信桥', () => {
     const mockSend = mock.method(commBridge, 'sendToC4', () => ({ success: true }));

     // 执行测试

     assert.strictEqual(mockSend.mock.calls.length, 1);
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

6. **清理测试状态**
   ```javascript
   import { beforeEach, afterEach } from 'node:test';

   beforeEach(() => {
     // 设置测试环境
   });

   afterEach(() => {
     // 清理测试环境
   });
   ```

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

    strategy:
      matrix:
        node-version: [20.x, 22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: Run PM2 integration tests
        run: |
          npm install -g pm2
          bash scripts/pm2-test.sh
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

单元测试不需要启动服务器。如果需要运行集成测试：

```bash
# 启动服务器
npm start

# 在另一个终端运行测试
npm run test:watch
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

### PM2 测试失败

**错误：** `pm2: command not found`

**原因：** PM2 未安装

**解决：**

```bash
npm install -g pm2
```

**错误：** `Log files not found`

**原因：** 日志目录不存在

**解决：**

```bash
mkdir -p logs
```

## 下一步

- 查看开发指南：[DEVELOPMENT.md](DEVELOPMENT.md)
- 了解项目架构：[ARCHITECTURE.md](ARCHITECTURE.md)
- 返回主文档：[README.md](README.md)
