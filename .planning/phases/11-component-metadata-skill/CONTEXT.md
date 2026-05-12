# Phase 11 Context: Component Metadata (SKILL.md)

**Phase:** 11 — Component Metadata (SKILL.md)
**Mode:** mvp
**Created:** 2026-05-12

---

## Phase Goal

完成包含组件元数据和配置架构的 SKILL.md 文件，使其符合 Zylos 组件标准。

## Success Criteria

1. SKILL.md 包含所有必需字段（name、version、type、description）
2. type 设置为 "communication"
3. 声明对 comm-bridge 的依赖
4. config 部分定义 webhook secret 参数

## Requirements Coverage

- META-01: SKILL.md 包含组件元数据（name、version、type、description）
- META-02: SKILL.md type 设置为 "communication"
- META-03: SKILL.md 声明对 comm-bridge 的依赖
- META-04: SKILL.md config 部分定义必需的 webhook secret 参数

## Current State

**Existing SKILL.md:** 已存在于项目根目录
- 包含基本 frontmatter（name、version、description、type）
- 包含 lifecycle 配置
- 包含 upgrade 配置
- 包含 config 部分（required 和 optional）
- 包含基本的组件使用文档

**Gaps:**
- `dependencies` 字段缺失（需要添加 comm-bridge）
- description 可以改进以包含更清晰的触发模式

## Reference Implementations

1. **zylos-telegram** (docs/reference/zylos-telegram/SKILL.md)
   - 完整的 communication 组件示例
   - 包含 dependencies 声明
   - 包含详细的触发模式描述

2. **zylos-component-template** (docs/reference/zylos-component-template/template/SKILL.md)
   - 标准 SKILL.md 模板结构
   - 展示所有必需字段

## Key Decisions

1. **保留现有结构：** 当前 SKILL.md 已经相当完整，只需小改动
2. **添加 dependencies：** 声明对 comm-bridge 的依赖
3. **优化 description：** 改进描述以包含更清晰的触发模式

## Integration Points

- **SKILL.md** 是 Zylos CLI 自动发现组件的入口
- **comm-bridge** 依赖声明确保 Zylos 知道此组件需要通信桥
- **config.required** 告诉 Zylos 需要从用户收集哪些值

## Testing Strategy

- 验证 SKILL.md YAML frontmatter 语法正确
- 确认所有必需字段非空
- 验证 dependencies 声明格式

## Related Files

- `/Users/summingyu/work/zylos-github-connector/SKILL.md` — 目标文件
- `/Users/summingyu/work/zylos-github-connector/docs/reference/zylos-telegram/SKILL.md` — 参考实现
- `/Users/summingyu/work/zylos-github-connector/docs/reference/zylos-component-template/template/SKILL.md` — 模板
