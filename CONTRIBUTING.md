<!-- generated-by: gsd-doc-writer -->
# 贡献指南

感谢你有兴趣为 zylos-github-connector 做出贡献！本文档将帮助你了解如何参与项目开发。

---

## 开发环境搭建

在开始贡献之前，请确保你的本地开发环境已正确配置。

### 前置要求

- **Node.js:** >= 20.0.0（项目使用 ES Modules）
- **PM2:** 进程管理器（用于运行服务）
- **Git:** 用于版本控制

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/zylos-ai/zylos-github-connector.git
cd zylos-github-connector

# 2. 安装依赖
npm install

# 3. 运行测试验证环境
npm test
```

### 本地开发

```bash
# 启动开发服务器（使用 PM2）
pm2 start ecosystem.config.cjs

# 查看日志
pm2 logs zylos-github-connector

# 停止服务
pm2 stop zylos-github-connector
```

详细的设置说明请参考 [GETTING-STARTED.md](docs/GETTING-STARTED.md) 和 [DEVELOPMENT.md](docs/DEVELOPMENT.md)。

---

## 代码规范

### 代码风格

本项目遵循以下编码标准：

- **模块系统:** 使用 ES Modules（`import`/`export`）
- **文件扩展名:** 使用 `.js` 扩展名（`"type": "module"` 已在 package.json 中配置）
- **代码格式:** 使用 Node.js 内置 test runner，无外部 linting 工具配置
- **日志记录:** 使用 Pino 日志库（与 Fastify 集成）

### 测试要求

- **测试框架:** Node.js 内置 test runner（`node --test`）
- **测试位置:** 所有测试文件放在 `src/lib/__tests__/` 目录
- **命名约定:** 测试文件使用 `*.test.js` 命名
- **覆盖率:** 项目拥有 519+ 个测试，确保新代码包含相应测试

运行测试：

```bash
# 运行所有测试
npm test

# 监听模式（开发时使用）
npm run test:watch

# 测试 webhook 端点
npm run test:webhook
```

---

## 提交 Pull Request

### 分支约定

- **主分支:** `main` — 生产代码
- **功能分支:** 建议使用描述性名称，如 `feat/new-event-handler`、`fix/signature-verification`
- **修复分支:** 使用 `fix/` 前缀，如 `fix/dedupe-bug`

### 提交规范

遵循清晰的提交信息格式：

```bash
# 功能添加
git commit -m "feat: 添加新的事件处理程序"

# 错误修复
git commit -m "fix: 修复签名验证时序攻击问题"

# 文档更新
git commit -m "docs: 更新配置说明"

# 测试改进
git commit -m "test: 添加去重逻辑的边界测试"
```

### PR 流程

1. **Fork 仓库** 并创建功能分支
2. **编写代码** 并添加相应的测试
3. **运行测试** 确保所有测试通过
4. **提交更改** 并推送到你的 fork
5. **创建 Pull Request** 到主仓库

### PR 审查要点

提交 PR 时，请确保：

- ✓ 所有测试通过（`npm test`）
- ✓ 新功能包含相应的测试用例
- ✓ 代码遵循项目的模块化结构
- ✓ 安全关键代码（如签名验证）使用常量时间比较
- ✓ Raw body 在任何 JSON 解析之前被捕获
- ✓ 配置更改包含相应的验证逻辑

---

## 报告问题

### Bug 报告

在 [Issues](https://github.com/zylos-ai/zylos-github-connector/issues) 中报告 bug 时，请提供：

1. **环境信息:**
   - Node.js 版本
   - 操作系统
   - PM2 版本

2. **复现步骤:**
   - 触发 bug 的具体步骤
   - GitHub webhook 配置
   - 相关日志输出

3. **预期行为 vs 实际行为**

4. **可能的解决方案**（如果你有想法）

### 功能请求

提出新功能时，请说明：

1. **功能描述** 和使用场景
2. **为什么需要** 这个功能
3. **建议的实现方式**（如果你了解）

---

## 开发资源

### 项目文档

- [README.md](README.md) — 项目概述和快速开始
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 系统架构和组件设计
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — 配置选项详解
- [SKILL.md](SKILL.md) — 组件元数据规范

### 关键实现说明

- **原始体捕获:** 必须在解析前捕获原始字节用于 HMAC 验证
- **签名验证:** 始终使用 `crypto.timingSafeEqual()` 进行常量时间比较
- **确认优先模式:** 快速返回 202，异步处理 webhook
- **去重机制:** 基于 `X-GitHub-Delivery` ID 的内存去重

### 测试策略

- 单元测试覆盖核心逻辑（验证、解析、格式化）
- 集成测试验证事件处理流程
- 安全测试防止重放攻击和签名伪造

---

## 安全注意事项

在处理 webhook 相关代码时，请务必注意：

- ⚠️ **切勿记录** webhook secret 或完整请求体
- ⚠️ **切勿使用** 字符串相等（`===`）进行签名比较
- ⚠️ **始终验证** 原始字节的 HMAC，而非解析后的 JSON
- ⚠️ **始终快速返回** 2xx 状态码以避免 GitHub 重试
- ⚠️ **始终跟踪** X-GitHub-Delivery ID 以防止重复处理

---

## 获取帮助

如果你在贡献过程中遇到问题：

- **Discord:** https://discord.gg/GS2J39EGff
- **X (Twitter):** https://x.com/ZylosAI
- **Issues:** https://github.com/zylos-ai/zylos-github-connector/issues

---

感谢你的贡献！🎉

---

*本文档由 GSD 工作流自动生成*
