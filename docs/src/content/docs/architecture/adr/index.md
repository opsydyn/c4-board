---
title: "Architecture Decision Records (ADRs)"
---

# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Tauri Astro Template project.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows this structure:

- **Status**: Proposed | Accepted | Superseded | Deprecated
- **Date**: YYYY-MM-DD
- **Context**: What is the issue motivating this decision?
- **Decision**: What is the change being proposed?
- **Consequences**: What becomes easier or harder as a result?

## Index

| ADR                                              | Title                                                             | Status   | Date       |
| ------------------------------------------------ | ----------------------------------------------------------------- | -------- | ---------- |
| [ADR-001](./001-postee-workspace-refactor.md)    | PosteeWorkspace Component Refactor to Functional Core Pattern    | Proposed | 2025-12-30 |
| [ADR-002](./002-postee-actor-model-refactor.md)  | Postee Actor Model Refactor (XState 5 Best Practices)            | Proposed | 2025-12-30 |
| [ADR-003](./003-mcp-integration-architecture.md) | MCP Integration Architecture (Model Context Protocol Support)    | Proposed | 2025-12-31 |
| [ADR-004](./004-sqlite-pool-architecture.md)     | SQLite Pool Architecture — Bypassing Plugin for Runtime Queries  | Accepted | 2026-02-07 |
| [ADR-005](./005-global-settings-wiring-plan.md)  | Global Settings Architecture and Wiring Plan                     | Proposed | 2026-02-09 |
| [ADR-006](./006-balanced-coupling-v2-and-mud-threshold-controls.md) | Balanced Coupling V2 Model and Big Ball of Mud Threshold Controls | Proposed | 2026-02-10 |
| [ADR-007](./007-azure-graph-sync.md)             | Azure Resource Graph Sync for Dynamic C4 Infrastructure Diagrams | Proposed | 2026-02-12 |
| [ADR-008](./008-rig-agent-platform-orchestration.md) | Rig Agent Platform Orchestration for OPY Net                 | Proposed | 2026-02-15 |
| [ADR-009](./009-varlock-environment-governance.md) | Adopt Varlock for Environment Governance                    | Accepted | 2026-07-23 |
| [ADR-010](./010-http-response-integrity.md)      | HTTP Response Integrity — Never Discard a Response on Body Decode Failure | Accepted | 2026-07-24 |
| [ADR-011](./011-postee-single-pane-workspace.md) | Postee Single-Pane Workspace Layout                              | Accepted | 2026-07-25 |
| [ADR-012](./012-opy-in-postee.md)                | OPY in Postee — Agent-Assisted Request Authoring                 | Accepted | 2026-07-25 |
| [ADR-013](./013-desktop-auto-update.md)          | Desktop Auto-Update via Signed GitHub Releases                   | Proposed | 2026-07-25 |
| [ADR-014](./014-mermaid-c4-export-and-preview.md) | Mermaid C4 Export and Rendered Preview                           | Proposed | 2026-07-26 |

## Contributing

When making significant architectural changes:

1. Create a new ADR using the next sequential number
2. Use the format: `NNN-title-in-kebab-case.md`
3. Fill out all sections with context and reasoning
4. Update this README index
5. Link the ADR in relevant code comments or documentation
