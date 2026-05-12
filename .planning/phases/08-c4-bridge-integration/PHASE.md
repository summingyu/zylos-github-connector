# Phase 8: C4 Communication Bridge Integration

**Status:** Ready for execution
**Created:** 2026-05-12
**Mode:** mvp

---

## Phase Goal

通过 C4 通信桥将格式化的 GitHub webhook 通知转发给 Claude，实现事件处理与通信基础设施的集成。

---

## Success Criteria

1. 消息通过 C4 通信桥发送
2. 通知端点可配置（支持仓库名称格式）
3. 记录传递成功/失败
4. 与测试消息集成工作

---

## Requirements Coverage

- **SEND-01:** 组件通过 C4 通信桥传递通知
- **SEND-02:** 组件支持可配置的通知端点
- **SEND-03:** 组件记录通知传递尝试的成功/失败

---

## Execution Plan

详见 [PLAN.md](./PLAN.md)

---

## Phase Dependencies

**Prerequisites:**
- Phase 1-7 已完成
- C4 通信桥脚本已安装（`~/zylos/.claude/skills/comm-bridge/scripts/c4-receive.js`）

**Dependent Phases:**
- Phase 9: Configuration Management
- Phase 10: Lifecycle and PM2 Integration

---

## Key Decisions

- 创建 `src/lib/comm-bridge.js` 包装器模块集中 C4 调用
- 使用仓库名称（user/repo）作为端点，channel 固定为 "github"
- 实现短暂重试机制（1-2 次，500ms 间隔）
- 3 秒超时后转为 fire-and-forget，不阻塞 webhook 响应

详见 [08-CONTEXT.md](./08-CONTEXT.md)

---

*Last updated: 2026-05-12*
