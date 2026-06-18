---
title: "Balanced Coupling Model (User Guide)"
---

# Balanced Coupling Model (User Guide)

## Purpose

The C4 board computes coupling risk so teams can discuss architecture tradeoffs with shared, auditable inputs.

This model is designed to answer:

1. Where is architecture pressure accumulating?
2. Which relationships are driving risk?
3. Are ownership boundaries reducing or increasing volatility?

## Formula

The board applies the Khononov-inspired balance formula per node:

`BALANCE = max(XOR(STRENGTH, DISTANCE), NOT(VOLATILITY))`

Derived values:

1. `xorBalance = 10 - abs(STRENGTH - DISTANCE)`
2. `notVolatility = 11 - VOLATILITY`
3. `balance = max(xorBalance, notVolatility)`
4. `systemicRisk = 11 - balance`

All dimensions are clamped to `1..10`.

## Inputs

Each node score is built from these signals:

1. Node profile defaults (`couplingProfile`, type priors)
2. Topology pressure (fan-in/fan-out, cycles, instability)
3. Operational pressure (edge protocol/style/volume/latency)
4. Organizational pressure (ownership gaps, cross-team intrusive dependencies)
5. Optional user overrides (hybrid/manual modes)

## Score Modes

1. `auto`: fully derived from model signals
2. `hybrid`: derived model plus explicit numeric overrides
3. `manual`: explicit values from user input (derived pressures suppressed)

The chart explainability panel shows:

1. Active mode and strategy
2. Formula input dimensions and outputs
3. Contributor breakdown by pressure source
4. Override keys when present

## Provenance

Each node includes score provenance:

1. Mode (`auto/hybrid/manual`)
2. Strategy (`auto-derived`, `hybrid-override`, `manual-curated`)
3. Override keys in effect
4. Whether topology/operational/organizational signals were applied

Use provenance to validate why two nodes with similar topology can still have different risk.

## Interpretation Guidance

1. High `risk` with high organizational contributor:
   Investigate ownership clarity and cross-team intrusive dependencies.
2. High `risk` with high operational contributor:
   Check synchronous links, heavy request volume, and high-latency paths.
3. High `risk` with low contributor diversity:
   A single dominant pressure source may be the fastest remediation path.

## Governance Recommendations

1. Treat `unknown ownership` as a governance defect, not just missing metadata.
2. Prefer `auto` for default decision support.
3. Use `hybrid` for justified local calibration.
4. Reserve `manual` for reviewed exceptions and record rationale in node description.
5. Revisit overrides during architecture reviews to avoid stale manual scoring.

