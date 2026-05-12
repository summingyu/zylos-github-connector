# Phase 8: C4 Communication Bridge Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 08-c4-bridge-integration
**Areas discussed:** C4 调用位置, 错误处理策略, 端点配置格式, 同步/异步处理

---

## C4 调用位置

| Option | Description | Selected |
|--------|-------------|----------|
| 主服务器集中调用 | 在 src/index.js 的路由处理之后统一调用。所有消息通过同一个点发送，便于日志记录和错误处理。当前已有 router.js 返回 handled 结果。 | |
| 处理程序内分散调用 | 在每个事件处理程序（handlers/issues.js、handlers/pull-request.js 等）内部调用。每个处理程序负责自己的发送逻辑，更模块化但代码重复。 | |
| 通过模块包装器 | 创建 src/lib/comm-bridge.js 包装器模块，处理程序返回格式化消息，主服务器调用包装器发送。集中逻辑 + 清晰的职责分离。 | ✓ |

**User's choice:** 通过模块包装器
**Notes:** 用户选择了模块化方案，结合了集中调用和职责分离的优点。

---

## 错误处理策略

| Option | Description | Selected |
|--------|-------------|----------|
| 记录并继续 | 记录错误日志但不影响 webhook 响应。GitHub 收到 202 确认，不会重试。适合非关键通知，但可能丢失消息。 | |
| 记录并返回 500 | 返回 500 错误给 GitHub，触发 GitHub 重试机制。确保消息最终送达，但可能导致重复处理（需要去重）。 | |
| 记录 + 重试 + 继续 | 失败后短暂重试 1-2 次，最终失败时记录错误并返回 202。平衡可靠性和性能。 | ✓ |

**User's choice:** 记录 + 重试 + 继续
**Notes:** 用户选择在可靠性和性能之间取得平衡，通过短暂重试提高成功率。

---

## 端点配置格式

| Option | Description | Selected |
|--------|-------------|----------|
| 仓库名称 (user/repo) | 例如 'summingyu/zylos-github-connector'。直接对应 GitHub 仓库，便于理解，适合单仓库部署。 | ✓ |
| 完整仓库 URL | 例如 'github.com/user/repo'。更明确的标识，但与 C4 标准模式可能不太一致。 | |
| 自定义端点 ID | 从 config.json 读取自定义端点值（如 'github-notifications'）。更灵活，支持非标准部署场景。 | |

**User's choice:** 仓库名称 (user/repo)
**Notes:** 用户选择了最直观的格式，直接使用 GitHub 仓库全名。

---

## 同步/异步处理

| Option | Description | Selected |
|--------|-------------|----------|
| 同步等待 | 等待 C4 调用完成后再返回 202。简单可靠，但 C4 延迟会影响 GitHub webhook 超时（10秒）。 | |
| 异步 Fire-and-forget | 立即返回 202，C4 调用在后台进行。不影响 GitHub 超时，但无法向 GitHub 报告 C4 错误。 | |
| 带超时的同步 | 同步等待但设置 3-5 秒超时。超时后转为异步并记录警告。平衡响应速度和可靠性。 | ✓ |

**User's choice:** 带超时的同步
**Notes:** 用户选择在响应速度和可靠性之间取得平衡，3秒超时防止阻塞 webhook 响应。

---

## Claude's Discretion

无 - 用户对所有关键领域都提供了明确决策，没有使用"你决定"选项。

## Deferred Ideas

无 - 讨论保持在阶段范围内，没有提出范围外的新功能想法。

---

*Phase: 08-c4-bridge-integration*
*Discussion log: 2026-05-12*
