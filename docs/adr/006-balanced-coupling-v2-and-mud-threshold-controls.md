# ADR-006: Balanced Coupling V2 Model and Big Ball of Mud Threshold Controls

**Status**: Proposed
**Date**: 2026-02-10
**Deciders**: Alan
**Technical Story**: Improve coupling/risk accuracy for real-world architectures, align scoring to Khononov's balancing formula, and give teams explicit control over mud-alert thresholds and node-level scoring.

## Context

Current coupling visualization provides useful directional feedback, but has hard limits:

- Big Ball of Mud alert is hardcoded (`averageRisk >= 8.0`) in UI.
- Risk scoring relies mostly on static defaults and coarse graph counts.
- Node type defaults are useful priors, but not sufficient proxies for architecture-specific behavior.
- Edge metadata and team ownership signals are available but not fully leveraged by risk scoring.
- Teams need controllable, auditable scoring and threshold policy to use this as a communication source of truth.

The target model should align with Vlad Khononov's balancing coupling principle:

`BALANCE = (STRENGTH ⊕ DISTANCE) ∨ ¬VOLATILITY`

## Decision

Adopt a versioned `Balanced Coupling V2` model with explicit formula-driven scoring, user-overridable node scores, and settings-driven alert thresholds.

### Formula Semantics

Use normalized numeric dimensions:

- `STRENGTH` in `[1..10]` (integration knowledge sharing; higher = tighter coupling)
- `DISTANCE` in `[1..10]` (deployment/organizational/communication distance)
- `VOLATILITY` in `[1..10]` (expected change rate / churn pressure)

Derived values:

- `xorBalance = 10 - abs(STRENGTH - DISTANCE)`  // balanced when S and D are close
- `notVolatility = 11 - VOLATILITY`             // lower volatility increases balance
- `balance = max(xorBalance, notVolatility)`    // logical OR approximation
- `systemicRisk = 11 - balance`                 // inverse risk scale, clamped to `[1..10]`

### Scoring Policy

1. **Type defaults are priors, not absolutes**.
2. Final `STRENGTH / DISTANCE / VOLATILITY` are computed from:
   - Type defaults (C4 + DDD)
   - Topology signals (fan-in/fan-out, instability, cycle pressure)
   - Edge operational metadata (communication style, volume, latency, protocol)
   - Organizational signals (`teamOwnership`, cross-team boundary pressure)
   - User-provided node-level overrides
3. Score provenance must be explicit per node: `auto`, `hybrid`, `manual`.

### User Controls

1. Add node-level scoring controls in Properties:
   - `couplingScoreMode: auto | hybrid | manual`
   - `strength`, `distance`, `volatility` manual values (bounded 1..10)
   - `integrationType` and `subdomainType` override support
2. Add global setting:
   - `bigBallOfMudAlertThreshold: number` (range `5.0..9.5`, step `0.1`, default `8.0`)

## Architecture and Data Model

### Node Data Additions

Extend node data with score provenance and overrides:

- `couplingScoreMode?: "auto" | "hybrid" | "manual"`
- `couplingOverrides?: Partial<{ strength: number; distance: number; volatility: number; integrationType: IntegrationType; subdomainType: SubdomainType }>`

### Settings Additions

Extend `AppSettings` contract:

- `bigBallOfMudAlertThreshold: number`

Persist through existing settings runtime/machine pipeline and apply immediately in chart warning logic.

### Explainability Contract

Add per-node score explanation payload:

- input dimensions (`strength`, `distance`, `volatility`)
- formula outputs (`xorBalance`, `notVolatility`, `balance`, `systemicRisk`)
- top contributors and provenance (`auto/hybrid/manual`)

This is required for trust, debugging, and architecture reviews.

## Detailed Implementation Plan

### Phase 1: Model V2 Core (Formula + Versioning)

1. Introduce `BalancedCouplingModelVersion` (`v1`, `v2`) and default to `v2` behind an internal selector.
2. Refactor `balancedCoupling.ts` into composable pure steps:
   - resolve inputs
   - compute `STRENGTH`, `DISTANCE`, `VOLATILITY`
   - apply formula
   - build explanation payload
3. Keep final risk tiering compatible with existing chart semantics.

### Phase 2: Accuracy Improvements (Topology + Real-world Signals)

1. Topology signals:
   - weighted fan-in/fan-out
   - instability
   - cycle/SCC penalty
2. Operational signals from edge metadata:
   - communication style weighting
   - request volume and latency pressure
   - protocol class defaults when metadata is sparse
3. Organizational signals:
   - missing ownership penalty
   - cross-team intrusive dependency pressure

### Phase 3: Node-level Override Controls

1. Extend `NodeData` schema/types with scoring mode and overrides.
2. Add controls to `PropertiesPanel` for mode + numeric overrides.
3. Add reset action: "Use Recommended Defaults".
4. Persist and render provenance in tooltip/details.

### Phase 4: Settings-driven Mud Threshold

1. Add `bigBallOfMudAlertThreshold` to:
   - `settings.types.ts` schema/defaults/keys
   - settings runtime validation and persistence
   - settings machine state + patch flow
2. Add UI control in Settings (`Save & Sync` section).
3. Pass threshold into `BalancedMudChart` and replace hardcoded `8.0` warning check.

### Phase 5: Documentation and ADR Linking

1. Add `docs/architecture/balanced-coupling-model.md`:
   - formula definition
   - operator semantics and numeric mapping
   - examples for C4 and DDD scenarios
   - guidance for `auto/hybrid/manual` usage
2. Link documentation from this ADR and relevant code comments.

### Phase 6: Verification, Calibration, Rollout

1. Unit tests:
   - formula correctness and monotonicity
   - override precedence (`manual > hybrid > auto`)
   - threshold validation and persistence
2. Scenario fixtures:
   - modular baseline
   - service mesh with clear contracts
   - high-risk mud topology
3. Performance gate:
   - no perceptible UI lag regression under typical board sizes
4. Rollout:
   - compare v1 vs v2 outputs on fixture packs
   - tune weights only with documented rationale

## Acceptance Criteria

1. Coupling scores explicitly follow `BALANCE = (STRENGTH ⊕ DISTANCE) ∨ ¬VOLATILITY`.
2. Users can set node-level scores and provenance (`auto/hybrid/manual`) without breaking defaults.
3. Big Ball of Mud alert threshold is user-configurable via global settings and applied live.
4. Risk output is explainable and test-covered.
5. No save/sync regression from added settings or node metadata.

## Non-goals

1. Replacing current visualization primitives.
2. Introducing external telemetry dependency as a release blocker.
3. Perfectly modeling every architecture style in one release.

## Consequences

### Positive

- Formula-aligned scoring model with explicit semantics.
- Higher real-world accuracy through topology, operational, and ownership signals.
- Team-controllable thresholds and node-level override capability.
- Better trust via explainability and provenance.

### Negative

- Increased model complexity and calibration overhead.
- Additional UI surface area in Properties and Settings.
- More tests and fixtures needed to avoid regressions.

### Neutral

- Existing defaults remain valid as priors.
- Model versioning enables gradual migration and comparison.
