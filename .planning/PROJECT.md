# Zylos GitHub Webhook Connector

## What This Is

A Zylos AI Agent component that receives GitHub Webhook events and forwards formatted notifications through the platform's communication channels. The component runs an HTTP server to accept GitHub event payloads, verifies webhook signatures, formats events into readable messages, and delivers them via the C4 comm-bridge.

## Core Value

AI Agents stay informed about GitHub repository activity in real-time without polling.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] HTTP server receives GitHub Webhook events
- [ ] HMAC SHA-256 signature verification for security
- [ ] Process events: issues (opened/closed), pull_request (opened/merged/closed), issue_comment (created), release (published)
- [ ] Format events into readable notification messages
- [ ] Send notifications via C4 comm-bridge
- [ ] Config.json manages webhook secret, port, notification targets
- [ ] PM2 process management (ecosystem.config.cjs)
- [ ] Basic tests (event parsing, signature verification)
- [ ] README with installation and configuration instructions
- [ ] SKILL.md with complete metadata (name, version, type, description, config)

### Out of Scope

- Bidirectional GitHub interaction (commenting, creating issues) — one-way notification flow only
- Real-time streaming events — standard Webhook delivery only
- Historical event syncing — only forwards new events after deployment

## Context

This component extends the Zylos AI Agent platform as a "communication" type component, similar to zylos-telegram but with a different data flow: instead of long-polling an external API, it receives incoming Webhook pushes from GitHub.

The component must integrate with:
- **zylos-component-template**: Provides the base structure, config hot-reload, graceful shutdown, PM2 integration
- **zylos-telegram**: Reference implementation for communication components, particularly the SKILL.md structure, config loading patterns, and C4 comm-bridge integration

Technical constraints:
- Must use C4 comm-bridge for message delivery (not direct Telegram/other channels)
- Must run on standalone port (not Caddy reverse proxy)
- Component config stored at `~/zylos/components/github-webhook/config.json`
- Data directory at `~/zylos/components/github-webhook/`

## Constraints

- **Platform**: Must follow Zylos component architecture patterns
- **Communication**: Must use C4 comm-bridge for outbound messages
- **Deployment**: Standalone port, must be reachable from GitHub (public URL or GitHub can reach)
- **Security**: Webhook signature verification required (HMAC SHA-256)
- **Compatibility**: Node.js, PM2 managed service

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| One-way notification flow | Simpler initial implementation, sufficient for monitoring use case | — Pending |
| C4 comm-bridge integration | Follows platform pattern, enables routing to any configured channel | — Pending |
| Standalone port deployment | More flexible for users without Caddy, simpler debugging | — Pending |
| Initial event set | Covers most common repository activities without overwhelming complexity | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
