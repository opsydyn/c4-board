---
title: "Team Topology Review Playbook"
---

# Team Topology Review Playbook

## Objective

Run consistent architecture reviews using ownership lens + coupling explainability.

## Preconditions

1. Team ownership values are populated for critical nodes.
2. Coupling chart is visible in the right panel.
3. Mud threshold is configured for your risk appetite.

## Review Workflow

1. Open Ownership Lens and set `Team Filter` to `ALL TEAMS`.
2. Toggle `CROSS-TEAM EDGES` to isolate inter-team dependencies.
3. Toggle `UNKNOWN OWNERSHIP` to identify metadata gaps.
4. Select a high-risk node from the chart.
5. Inspect explainability:
   `STRENGTH`, `DISTANCE`, `VOLATILITY`, formula output, and top contributors.
6. Confirm provenance mode (`auto`, `hybrid`, `manual`) before deciding remediation.
7. Record agreed action in node notes/description.

## Decision Rules

1. Unknown ownership on production-critical paths: assign owner immediately.
2. Cross-team intrusive dependency with high volatility contribution:
   prioritize contract boundary hardening.
3. Manual mode without clear rationale:
   downgrade to `hybrid` or `auto` and re-evaluate.
4. Repeated high operational contributor:
   investigate communication style/protocol and workload characteristics.

## Remediation Patterns

1. Ownership clarity:
   assign team, validate on-call and escalation path.
2. Boundary stabilization:
   move intrusive links toward contract-based interfaces.
3. Volatility containment:
   decouple high-change modules from high-dependency hubs.
4. Override hygiene:
   keep only overrides that are reviewed and justified.

## Release/PR Checklist

1. Ownership Lens reviewed with `ALL TEAMS` + `CROSS-TEAM EDGES`.
2. Unknown ownership count is zero for new critical nodes.
3. High-risk nodes have explainability reviewed and action recorded.
4. Any `manual` score mode usage includes rationale.
5. Diagram saved and synced after review.

