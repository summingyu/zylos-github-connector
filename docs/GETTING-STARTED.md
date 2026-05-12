<!-- generated-by: gsd-doc-writer -->
# Getting Started

欢迎使用 Zylos GitHub Connector！本指南将帮助您快速设置和运行 GitHub Webhook 连接器。

## Prerequisites

在开始之前，请确保您的系统已安装以下软件：

- **Node.js** >= 20.0.0（必需）
- **npm** >= 9.0.0（随 Node.js 自动安装）
- **PM2** >= 5.0.0（进程管理器，用于生产环境运行）

### 验证安装

运行以下命令验证您的环境：

```bash
node --version  # 应该显示 v20.0.0 或更高版本
npm --version   # 应该显示 9.0.0 或更高版本
pm2 --version   # 应该显示 5.0.0 或更高版本
```

如果 PM2 未安装，请运行：

```bash
npm install -g pm2
```

## Installation

### 1. 克隆仓库

```bash
git clone https://github.com/zylos-ai/zylos-github-connector.git
cd zylos-github-connector
```

### 2. 安装依赖

```bash
npm install
```

这将安装所有必需的依赖项，包括 Fastify HTTP 框架和安全头中间件。

### 3. 创建配置文件

创建配置目录和配置文件：

```bash
mkdir -p ~/zylos/components/github-connector
cp config.example.json ~/zylos/components/github-connector/config.json
```

## Configuration

编辑配置文件 `~/zylos/components/github-connector/config.json`：

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

### 配置说明

- **enabled**: 设置为 `true` 启用连接器
- **port**: HTTP 服务器监听端口（默认 3461）
- **webhookSecret**: GitHub webhook 密钥（必需）
- **commBridge.enabled**: 启用 C4 通信桥集成
- **logging.level**: 日志级别（debug、info、warn、error）

**重要**: `webhookSecret` 必须与您在 GitHub 仓库设置中配置的 webhook secret 完全一致。

## First Run

### 开发模式启动

在开发环境中，您可以直接运行：

```bash
npm start
```

您应该看到类似的输出：

```
[github-connector] Starting...
[github-connector] Data directory: /Users/yourname/zylos/components/github-connector
[github-connector] Config loaded, enabled: true
[github-connector] Server listening on http://0.0.0.0:3461
[github-connector] Max payload size: 10485760
[github-connector] Ready to receive GitHub webhooks
```

### 生产模式启动（使用 PM2）

在生产环境中，使用 PM2 启动服务：

```bash
pm2 start ecosystem.config.cjs
```

验证服务状态：

```bash
pm2 status
pm2 logs zylos-github-connector
```

## Verification

### 健康检查

测试服务器是否正在运行：

```bash
curl http://localhost:3461/health
```

预期响应：

```json
{
  "status": "ok",
  "service": "github-connector",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 测试 Webhook 签名验证

使用集成的测试脚本验证 webhook 签名验证功能：

```bash
SERVER_URL=http://localhost:3461/webhook SECRET=test-webhook-secret npm run test:webhook
```

这将运行全面的测试套件，包括：
- 有效签名测试
- 无效签名测试
- 格式错误测试
- 边界情况测试

### 配置 GitHub Webhook

1. 进入您的 GitHub 仓库设置
2. 导航到 **Settings** → **Webhooks** → **Add webhook**
3. 配置以下设置：
   - **Payload URL**: `http://your-server-ip:3461/webhook`
   - **Content type**: `application/json`
   - **Secret**: 与配置文件中的 `webhookSecret` 相同
   - **Events**: 选择您想要监听的事件（如 Push、Pull Request、Issues 等）

4. 点击 **Add webhook**

5. 在 webhook 详情页面，点击 "Recent Deliveries" 旁边的 "..." 并选择 "Redelivery" 来测试连接

## Common Setup Issues

### 1. "Webhook secret not configured" 错误

**问题**: 服务器返回 500 错误，提示 webhook secret 未配置。

**解决方案**:
- 确保 `~/zylos/components/github-connector/config.json` 中的 `webhookSecret` 字段已设置
- 或者设置环境变量：`export GITHUB_WEBHOOK_SECRET="your-secret"`
- 重启服务使配置生效

### 2. 端口已被占用

**问题**: 启动失败，提示端口 3461 已被占用。

**解决方案**:
- 检查端口占用：`lsof -i :3461`
- 终止占用端口的进程：`kill -9 <PID>`
- 或在配置文件中更改端口号

### 3. "Invalid signature" 错误

**问题**: GitHub webhook 返回 401 错误。

**解决方案**:
- 确保 GitHub 仓库设置的 Secret 与配置文件中的 `webhookSecret` 完全一致
- 检查 Secret 值前后没有多余的空格
- 确认 Content Type 设置为 `application/json`（非 `application/x-www-form-urlencoded`）

### 4. PM2 进程不保持运行状态

**问题**: PM2 启动进程后立即退出。

**解决方案**:
- 检查 PM2 日志：`pm2 logs zylos-github-connector --lines 50`
- 确认配置文件路径正确：`~/zylos/components/github-connector/config.json`
- 验证 `enabled: true` 在配置中设置

### 5. 权限错误

**问题**: 无法创建配置目录或写入日志文件。

**解决方案**:
```bash
# 创建必要的目录
mkdir -p ~/zylos/components/github-connector/logs
mkdir -p ~/zylos/.claude/skills/github-connector

# 设置适当的权限
chmod -R 755 ~/zylos/components/github-connector
```

## Next Steps

现在您已经成功设置了 Zylos GitHub Connector，以下是一些推荐的后续步骤：

- 📖 阅读 [DEVELOPMENT.md](DEVELOPMENT.md) 了解开发环境配置
- 🧪 查看 [TESTING.md](TESTING.md) 学习如何运行测试
- 🔧 参考 [CONFIGURATION.md](CONFIGURATION.md) 了解高级配置选项
- 🏗️ 阅读 [ARCHITECTURE.md](ARCHITECTURE.md) 了解系统架构设计

## Troubleshooting

如果问题仍未解决，请：

1. 检查日志文件：
   - 开发模式：控制台输出
   - PM2 模式：`pm2 logs zylos-github-connector`

2. 启用调试日志：
   ```json
   {
     "logging": {
       "level": "debug"
     }
   }
   ```

3. 查看测试脚本输出以获取详细错误信息

4. 访问 [GitHub Issues](https://github.com/zylos-ai/zylos-github-connector/issues) 报告问题或查找解决方案

祝您使用愉快！🚀