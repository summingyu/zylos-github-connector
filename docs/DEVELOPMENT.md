<!-- generated-by: gsd-doc-writer -->
# 开发指南

本文档介绍如何设置开发环境、构建项目以及遵循代码规范。

## 本地开发设置

### 前置要求

- **Node.js** >= 20.0.0
- **npm**（随 Node.js 安装）

### 安装步骤

1. 克隆仓库：
```bash
git clone https://github.com/zylos-ai/zylos-github-connector.git
cd zylos-github-connector
```

2. 安装依赖：
```bash
npm install
```

3. 创建配置文件（如果需要本地测试）：
```bash
# 配置文件位于 ~/zylos/components/github-connector/config.json
# 参考 CLAUDE.md 中的配置示例
```

### 开发模式运行

```bash
npm start
```

服务器将在配置的端口（默认 3461）上启动。

## 构建命令

| 命令 | 描述 |
|------|------|
| `npm start` | 启动 Fastify 服务器 |
| `npm test` | 运行所有测试 |
| `npm run test:watch` | 以监视模式运行测试（自动重新运行） |
| `npm run test:webhook` | 运行 webhook 集成测试脚本 |

## 代码风格

### JavaScript/Node.js 规范

本项目使用 **ES 模块**（`"type": "module"`）和现代 JavaScript 特性。

### 代码质量工具

当前项目未配置 ESLint 或 Prettier。建议在开发过程中：

- 使用一致的缩进（2 空格）
- 使用单引号字符串
- 遵循现有的代码模式
- 保持函数简洁和模块化

### 关键编码规范

1. **安全优先**
   - 始终使用 `crypto.timingSafeEqual()` 进行签名比较
   - 切勿记录敏感信息（webhook secret、完整请求体）
   - 验证原始字节，而非解析后的 JSON

2. **异步处理**
   - 遵循"确认优先"模式：快速返回 202，异步处理工作
   - 使用 `async/await` 处理异步操作

3. **错误处理**
   - 始终捕获并记录错误
   - 对 webhook 请求返回适当的 HTTP 状态码
   - 失败时快速返回 2xx 以避免 GitHub 重试

## 分支约定

当前项目未明确记录分支命名约定。建议：

- `main` - 主分支，稳定版本
- `feat/*` - 新功能
- `fix/*` - bug 修复
- `refactor/*` - 代码重构

## PR 流程

当前项目未配置 PR 模板。建议提交 PR 时：

1. 确保所有测试通过：`npm test`
2. 遵循现有代码风格
3. 在 PR 描述中说明变更内容和原因
4. 关联相关 issue（如适用）
5. 确保提交信息清晰描述变更

## 调试方法

### 本地测试 Webhook

#### 方法 1：使用测试脚本

```bash
npm run test:webhook
```

这将运行 `scripts/test-webhook.js`，发送模拟 webhook 请求到本地服务器。

#### 方法 2：使用 smee.io 或 ngrok

1. 启动隧道服务：
```bash
# 使用 smee.io（推荐用于开发）
smee -u <smee-url> -t http://localhost:3461/webhook

# 或使用 ngrok
ngrok http 3461
```

2. 在 GitHub 仓库设置中配置 webhook URL

3. 触发事件并观察日志

### 日志查看

服务器使用 Pino 日志记录器。开发环境下，日志输出到控制台。

生产环境使用 PM2 管理日志：

```bash
# 查看实时日志
pm2 logs zylos-github-connector

# 查看错误日志
pm2 logs zylos-github-connector --err

# 清除日志
pm2 flush
```

### PM2 管理

```bash
# 启动应用
pm2 start ecosystem.config.cjs

# 停止应用
pm2 stop zylos-github-connector

# 重启应用
pm2 restart zylos-github-connector

# 监控
pm2 monit
```

### 单元测试调试

Node.js 内置测试运行器支持调试：

```bash
# 运行特定测试文件
node --test src/lib/__tests__/config.test.js

# 使用监视模式（自动重新运行）
npm run test:watch
```

## 常见开发任务

### 添加新的事件处理程序

1. 在 `src/lib/handlers/` 创建新文件
2. 导出处理函数
3. 在 `src/index.js` 中注册处理程序
4. 添加单元测试到 `src/lib/__tests__/`

### 修改配置

编辑 `~/zylos/components/github-connector/config.json`。服务器支持配置热重载。

### 测试安全功能

使用 `scripts/test-webhook.js` 测试：

- 无效签名
- 重放攻击
- 格式错误的请求体
- 缺失必需头

## 相关文档

- [CLAUDE.md](../CLAUDE.md) - GSD 工作流和项目架构
- [README.md](../README.md) - 安装和基本使用
- [GETTING-STARTED.md](GETTING-STARTED.md) - 新用户入门指南
- [TESTING.md](TESTING.md) - 测试框架和编写测试
