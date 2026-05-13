---
slug: fix-issue-1
description: 修复 GitHub Issue #1 的 3 个阻塞部署问题
created: 2026-05-14
---

# 修复 GitHub Issue #1

## 问题描述

基于 zylos-component-template 规范和实际运行验证，发现以下 3 个阻塞部署的问题：

### 1. ecosystem.config.cjs 路径错误

**严重度：** 部署阻塞

**现状：**
```javascript
cwd: path.join(__dirname)
error_file: path.join(__dirname, 'logs/error.log')
out_file: path.join(__dirname, 'logs/out.log')
```

**模板规范要求：**
```javascript
const os = require('os');
cwd: path.join(os.homedir(), 'zylos/.claude/skills/github-connector')
error_file: path.join(os.homedir(), 'zylos/components/github-connector/logs/error.log')
out_file: path.join(os.homedir(), 'zylos/components/github-connector/logs/out.log')
```

**影响：** zylos 的 code/data 分离设计要求代码目录（skills/）和数据目录（components/）分开。当前写法将日志写入代码目录，组件升级时日志会被覆盖丢失。

### 2. configure hook key mapping 不一致

**严重度：** 部署阻塞

**问题：**
- `hooks/configure.js` 第 50-54 行的 `configKeyFromRequiredName` 将 `GITHUB_WEBHOOK_SECRET` 映射为 `secret`
- 但 `src/lib/config.js` 第 20 行读取的字段是 `webhookSecret` —— 键名不匹配
- `GITHUB_WEBHOOK_PORT` 映射为 `port`（键名正确），但值为 string `"4567"`，而 `src/lib/config.js` 第 73 行要求 `typeof config.port !== 'number'` —— 类型不匹配

**结果：** `loadConfig()` 因 `"port must be a number"` 报错，回退到 DEFAULT_CONFIG。

### 3. tests/ 目录下 29 个测试因硬编码本机路径全部失败

**严重度：** 中

**失败原因：** 测试动态生成 mock 文件中硬编码了绝对路径：
```javascript
import * as originalModule from '/Users/summingyu/work/zylos-github-connector/src/lib/config.js';
```

## 执行计划

### Fix 1: ecosystem.config.cjs 路径修复

1. 引入 `os` 模块
2. 修改 `cwd` 指向 `~/zylos/.claude/skills/github-connector`
3. 修改日志文件路径指向 `~/zylos/components/github-connector/logs/`

### Fix 2: configure hook key mapping 修复

1. 修改 `configKeyFromRequiredName` 函数，将 `GITHUB_WEBHOOK_SECRET` 映射为 `webhookSecret`
2. 添加类型转换：对 `port` 配置项使用 `parseInt(value, 10)`

### Fix 3: tests/ 目录移除硬编码路径

1. 搜索 `tests/` 目录下所有硬编码的绝对路径
2. 替换为相对路径或使用 `import.meta.url` 动态解析
3. 验证所有测试通过

## 验证标准

1. `ecosystem.config.cjs` 路径符合组件规范
2. `configure` hook 正确写入 `webhookSecret` 和数字类型 `port`
3. `tests/` 目录所有测试在不同机器上都能通过
4. 运行 `npm test` 确保无回归
