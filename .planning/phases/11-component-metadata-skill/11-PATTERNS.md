# Phase 11: Component Metadata (SKILL.md) - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 1
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `SKILL.md` | 元数据文档 | 静态配置 | `docs/reference/zylos-telegram/SKILL.md` | exact |
| `SKILL.md` | 元数据文档 | 静态配置 | `zylos-component-template/template/SKILL.md` | template |

## Pattern Assignments

### `SKILL.md` (元数据文档，静态配置)

**Analog 1:** `docs/reference/zylos-telegram/SKILL.md` (完整通信组件参考实现)

**Dependencies 声明模式** (lines 41-43):
```yaml
dependencies:
  - comm-bridge
  - voice-asr
```

**Description 字段触发模式描述** (lines 4-12):
```yaml
description: >-
  Telegram Bot communication channel (long polling mode, works behind firewalls).
  Use when: (1) replying to Telegram messages (DM or group @mentions),
  (2) sending proactive messages or media (images, files) to Telegram users or groups,
  (3) managing DM access control (dmPolicy: open/allowlist/owner, dmAllowFrom list),
  (4) managing group access control (groupPolicy, per-group allowFrom, smart/mention modes),
  (5) configuring the bot (admin CLI, proxy settings),
  (6) troubleshooting Telegram bot connection or polling issues.
  Config at ~/zylos/components/telegram/config.json. Service: pm2 zylos-telegram.
```

**Config.required 声明模式** (lines 36-39):
```yaml
config:
  required:
    - name: TELEGRAM_BOT_TOKEN
      description: Telegram Bot Token (从 @BotFather 获取)
      sensitive: true
```

**通信组件依赖文档模式** (line 50):
```markdown
Depends on: comm-bridge (C4 message routing).
```

---

**Analog 2:** `zylos-component-template/template/SKILL.md` (标准模板)

**Dependencies 字段位置** (line 52):
```yaml
dependencies: []  # 在 config 部分、upgrade 部分之后，--- 分隔符之前
```

**Description 模板模式** (lines 4-6):
```yaml
description: >
  {{COMPONENT_DESCRIPTION}}. Use when ...
  (Include trigger patterns: what user requests should activate this component)
```

**Frontmatter 字段顺序** (lines 2-52):
```yaml
---
name: {{COMPONENT_NAME}}
version: 0.1.0
description: >
  {{COMPONENT_DESCRIPTION}}. Use when ...
  (Include trigger patterns: what user requests should activate this component)
type: {{COMPONENT_TYPE}}  # communication | capability | utility

lifecycle:
  npm: true
  service:
    type: pm2
    name: zylos-{{COMPONENT_NAME}}
    entry: src/index.js
  data_dir: ~/zylos/components/{{COMPONENT_NAME}}
  hooks:
    configure: hooks/configure.js
    post-install: hooks/post-install.js
    pre-upgrade: hooks/pre-upgrade.js
    post-upgrade: hooks/post-upgrade.js
  preserve:
    - config.json
    - data/

upgrade:
  repo: zylos-ai/zylos-{{COMPONENT_NAME}}
  branch: main

config:
  required:
    # Values are collected by zylos and passed to lifecycle.hooks.configure as stdin JSON.
    # The configure hook decides how to store them in config.json.
    # - name: {{COMPONENT_NAME_UPPER}}_API_KEY
    #   description: API key for {{COMPONENT_NAME}}
    #   sensitive: true
  optional:
    # - name: {{COMPONENT_NAME_UPPER}}_DEBUG
    #   description: Enable debug mode
    #   default: "false"

dependencies: []
---
```

---

### 当前 `SKILL.md` 分析

**现有结构评估:**
- ✅ 包含基本 frontmatter (name, version, description, type)
- ✅ 包含 lifecycle 配置
- ✅ 包含 upgrade 配置
- ✅ 包含 config 部分 (required 和 optional)
- ✅ 包含组件使用文档

**缺失项:**
- ❌ `dependencies` 字段完全缺失

**需要改进:**
- ⚠️ description 字段可以更明确地列出触发模式（参考 telegram 的编号列表风格）
- ⚠️ 文档正文可以添加 "Depends on: comm-bridge (C4 message routing)" 说明

---

## Shared Patterns

### 1. Dependencies 声明模式
**Source:** `docs/reference/zylos-telegram/SKILL.md` lines 41-43
**Apply to:** 所有通信组件

```yaml
dependencies:
  - comm-bridge
```

**关键特征:**
- 位置：在 config 部分、--- 分隔符之前
- 格式：YAML 列表，每行一个依赖
- 内容：依赖组件的 name 字段值（如 comm-bridge、voice-asr）

---

### 2. Description 触发模式描述模式
**Source:** `docs/reference/zylos-telegram/SKILL.md` lines 4-12
**Apply to:** 所有组件的 description 字段

**模式结构:**
1. **一句话概述**：组件功能和关键特性
2. **编号使用场景列表**：`(1) ... (2) ... (3) ...` 格式
3. **配置位置说明**：`Config at ~/zylos/components/...`
4. **服务管理提示**：`Service: pm2 <service-name>`

**GitHub Connector 的建议 description:**
```yaml
description: >-
  GitHub Webhook connector for Zylos AI Agent platform (单向：GitHub → Zylos，通过 webhook 接收事件).
  Use when: (1) receiving GitHub webhook events (issues, pull requests, comments, releases),
  (2) sending notifications to configured communication endpoints,
  (3) configuring webhook secret and server port,
  (4) troubleshooting webhook signature verification or event delivery.
  Config at ~/zylos/components/github-connector/config.json. Service: pm2 zylos-github-connector.
```

---

### 3. Config.required 敏感参数声明模式
**Source:** `docs/reference/zylos-telegram/SKILL.md` lines 36-39
**Apply to:** 所有需要敏感配置的组件

```yaml
config:
  required:
    - name: WEBHOOK_SECRET
      description: GitHub Webhook 密钥（用于验证 HMAC-SHA256 签名）
      sensitive: true
```

**关键特征:**
- `name`: 大写下划线格式（对应环境变量命名）
- `description`: 清晰说明用途和来源
- `sensitive: true`: 标记敏感字段（Zylos 会特殊处理）

---

### 4. Frontmatter 字段顺序
**Source:** `zylos-component-template/template/SKILL.md` lines 2-52
**Apply to:** 所有组件的 SKILL.md

**标准顺序:**
1. `name` — 组件名称
2. `version` — 语义化版本
3. `description` — 多行触发模式描述
4. `type` — 组件类型（communication | capability | utility）
5. `lifecycle` — 生命周期配置
6. `upgrade` — 升级配置
7. `config` — 配置架构（required + optional）
8. `dependencies` — 依赖列表
9. `---` — YAML 分隔符
10. [文档正文]

---

## Pattern Application to Phase 11

### 建议的 SKILL.md 更改

**1. 添加 dependencies 字段**（在 line 52，config 部分之后，--- 分隔符之前）:
```yaml
dependencies:
  - comm-bridge
```

**2. 改进 description 字段**（替换 lines 4-6）:
```yaml
description: >-
  GitHub Webhook connector for Zylos AI Agent platform (单向：GitHub → Zylos，通过 webhook 接收事件).
  Use when: (1) receiving GitHub webhook events (issues, pull requests, comments, releases),
  (2) sending notifications to configured communication endpoints,
  (3) configuring webhook secret and server port,
  (4) troubleshooting webhook signature verification or event delivery.
  Config at ~/zylos/components/github-connector/config.json. Service: pm2 zylos-github-connector.
```

**3. 在文档正文添加依赖说明**（在 line 57 之后）:
```markdown
Depends on: comm-bridge (C4 message routing).
```

---

## No Analog Found

无。所有需要的模式都可以从参考实现中提取。

---

## Metadata

**Analog search scope:**
- `/Users/summingyu/work/zylos-github-connector/SKILL.md` (当前实现)
- `/Users/summingyu/work/zylos-github-connector/docs/reference/zylos-telegram/SKILL.md` (完整通信组件参考)
- `/Users/summingyu/work/zylos-component-template/template/SKILL.md` (标准模板)
- `/Users/summingyu/work/zylos-core/skills/comm-bridge/SKILL.md` (通信桥参考)
- `/Users/summingyu/work/zylos-core/skills/activity-monitor/SKILL.md` (服务组件参考)
- `/Users/summingyu/work/zylos-core/skills/web-console/SKILL.md` (Web 组件参考)
- `/Users/summingyu/work/zylos-core/skills/shell/SKILL.md` (通道组件参考)
- `/Users/summingyu/work/zylos-core/skills/http/SKILL.md` (HTTP 组件参考)

**Files scanned:** 8
**Pattern extraction date:** 2026-05-12

---

## Quality Notes

1. **Concrete, not abstract:** 所有模式引用都包含具体文件路径和行号
2. **Accurate classification:** SKILL.md 是元数据文档，静态配置类型
3. **Best analog selected:** zylos-telegram 是最接近的参考实现（同为通信组件，声明 comm-bridge 依赖）
4. **Actionable for planner:** 提供了具体的代码片段和行号，可直接用于 plan actions

---

## Implementation Notes for Planner

**优先级排序:**
1. **HIGH**: 添加 dependencies 字段（必需，满足 META-03）
2. **MEDIUM**: 改进 description 字段（改进，使触发模式更清晰）
3. **LOW**: 添加文档正文依赖说明（文档增强，非必需）

**验证方法:**
```bash
# 验证 YAML 语法
ruby -ryaml -e "puts YAML.load_file('SKILL.md').inspect"

# 验证 dependencies 字段存在
grep -A 2 "^dependencies:" SKILL.md

# 验证 description 包含触发模式
grep "Use when:" SKILL.md
```

**风险提示:**
- YAML frontmatter 对缩进敏感，必须保持 2 空格缩进
- description 使用 `>-` 折叠标量，换行会被替换为空格
- dependencies 必须在 --- 分隔符之前
