# Zylos GitHub Webhook Connector

## Project Overview

这是一个 Zylos AI Agent 平台的组件，用于接收 GitHub Webhook 事件并通过平台的通信通道转发格式化的通知。该组件运行一个 HTTP 服务器来接收 GitHub 事件负载，验证 webhook 签名，将事件格式化为可读消息，并通过 C4 通信桥传递。

## Core Value

AI Agent 实时了解 GitHub 仓库活动，无需轮询。

## Requirements

### Verified

（尚未 — 发布后验证）

### Active

- [ ] HTTP 服务器接收 GitHub Webhook 事件
- [ ] HMAC SHA-256 签名验证确保安全
- [ ] 处理事件：issues（opened/closed）、pull_request（opened/merged/closed）、issue_comment（created）、release（published）
- [ ] 将事件格式化为可读的通知消息
- [ ] 通过 C4 通信桥发送通知
- [ ] config.json 管理 webhook secret、端口、通知目标
- [ ] PM2 进程管理（ecosystem.config.cjs）
- [ ] 基本测试（事件解析、签名验证）
- [ ] README 包含安装和配置说明
- [ ] SKILL.md 包含完整元数据（name、version、type、description、config）

### Out of Scope

- 双向 GitHub 交互（评论、创建 issue）—— 仅单向通知流
- 实时流式事件 —— 仅标准 Webhook 传递
- 历史事件同步 —— 仅转发部署后的新事件

## Background

此组件作为"通信"类型组件扩展 Zylos AI Agent 平台，类似于 zylos-telegram 但数据流向不同：不是轮询外部 API，而是接收来自 GitHub 的传入 Webhook 推送。

组件必须集成：
- **zylos-component-template**：提供基础结构、配置热重载、优雅关闭、PM2 集成
- **zylos-telegram**：通信组件的参考实现，特别是 SKILL.md 结构、配置加载模式和 C4 通信桥集成

技术约束：
- 必须使用 C4 通信桥发送消息（而非直接 Telegram/其他通道）
- 在独立端口上运行（非 Caddy 反向代理）
- 组件配置存储于 `~/zylos/components/github-webhook/config.json`
- 数据目录位于 `~/zylos/components/github-webhook/`

## Constraints

- **平台**：必须遵循 Zylos 组件架构模式
- **通信**：必须使用 C4 通信桥发送消息
- **部署**：独立端口，GitHub 必须可访问（公网 URL 或 GitHub 可到达）
- **安全**：Webhook 签名验证必需（HMAC SHA-256）
- **兼容性**：Node.js，PM2 管理服务

## Key Decisions

| Decision | Rationale | Result |
|----------|-----------|---------|
| 单向通知流 | 初始实现更简单，足以满足监控用例 | — 待定 |
| C4 通信桥集成 | 遵循平台模式，启用路由到任何配置的通道 | — 待定 |
| 独立端口部署 | 对于没有 Caddy 的用户更灵活，调试更简单 | — 待定 |
| 初始事件集 | 覆盖最常见的仓库活动，不会过于复杂 | — 待定 |

## Evolution

本文档在阶段转换和里程碑边界时演进。

**每次阶段转换后**（通过 `/gsd-transition`）：
1. 需求无效？→ 移至"范围外"并说明原因
2. 需求已验证？→ 移至"已验证"并注明阶段
3. 新需求出现？→ 添加到"活跃"
4. 需记录决策？→ 添加到"关键决策"
5. "项目概述"仍然准确？→ 如有变化则更新

**每次里程碑后**（通过 `/gsd-complete-milestone`）：
1. 审查所有部分
2. 核心价值检查 —— 仍然正确的优先级？
3. 审计范围外 —— 理由仍然有效？
4. 用当前状态更新背景
