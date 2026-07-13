# Client-Server Inference Evaluation Design

**Status**: Approved design

**Date**: 2026-07-13

## Goal

Measure Client-Server semantic-role inference against a deterministic gold
corpus and determine whether any confidence threshold is precise enough to
expose role evidence to OPY/Rig. The evaluation must prefer withholding
evidence over presenting an incorrect confident role.

## Product Decision

Slice 42 uses an offline, hand-authored gold corpus. Correction frequency is
the proportion of threshold-eligible gold assignments where the inferred role
differs from the expected role. Runtime correction telemetry, persistence, and
privacy policy are outside this slice.

The exposure posture is precision-first:

- coverage is measured but not optimized;
- a qualifying threshold has zero overconfident errors in the corpus;
- a qualifying threshold has at least 98 percent overall precision; and
- an individual role needs at least three correct exposed examples before the
  evaluator can recommend exposing that role to OPY/Rig.

If no candidate qualifies, the result is `insufficient-evidence`. The
evaluator must not select a least-bad threshold.

## Scope

### Included

- A typed, in-repository Client-Server gold corpus.
- Pattern-neutral semantic-role evaluation metrics.
- Client-Server threshold evaluation using the classifier's existing emitted
  confidence levels as candidates.
- Exact overall, role, source, confidence-band, and case-category breakdowns.
- Deterministic evaluation tests, metric properties, and roadmap
  reconciliation with the measured result.

### Excluded

- Changes to Client-Server classifier rules, confidence values, or evidence.
- Runtime correction telemetry or new persistence tables.
- OPY drawer changes, Rig tools, prompt changes, or role-evidence exposure.
- External JSON/JSONL corpus formats or a standalone CLI.
- Model-generated gold labels.
- Layout geometry, visual baselines, and native capture work.

## Architecture

### Gold Corpus

Create a focused Client-Server corpus module under `src/core/effects`. Each
case has:

- a stable case ID;
- one category;
- clone-isolated nodes and edges;
- one expected Client-Server role for every top-level node;
- an optional rationale for intentionally ambiguous evidence; and
- a `thresholdEligible` flag.

Threshold-eligible cases must not provide an inferred `data.layoutRole` hint.
Explicit-role control cases use `thresholdEligible: false`; they verify
classifier precedence but never improve inference metrics or threshold
selection.

The initial corpus covers:

1. canonical typed Client-Server paths;
2. label-only inference for every role;
3. grounded topology inference into domain and persistence targets;
4. ambiguous generic nodes expected to remain `unclassified`;
5. misleading labels where stronger node-type evidence must win;
6. missing-tier graphs;
7. external-dependency directionality and multiple-caller graphs; and
8. explicit-role controls.

The threshold-eligible corpus must contain at least three gold examples for
each role that could be recommended for exposure.

### Evaluation Engine

Create a pattern-neutral pure evaluator under `src/core/effects`. It consumes
validated cases plus classifier assignments and returns a typed immutable
result. It does not import Client-Server classifier internals.

The evaluator computes:

- total and eligible assignment counts;
- correct, incorrect, and fallback assignment counts;
- correction frequency;
- exposure precision and coverage for every candidate threshold;
- fallback rate;
- overconfident error count;
- breakdowns by expected role, predicted role, assignment source,
  confidence band, and case category; and
- a precision-first threshold recommendation.

Candidate thresholds are the distinct confidence values emitted by eligible
non-`unclassified` assignments, sorted from lowest to highest. The evaluator
does not invent intermediate decimal thresholds.

### Threshold Recommendation

For each candidate threshold, an assignment is exposed when:

- its role is not `unclassified`; and
- its confidence is greater than or equal to the candidate threshold.

A candidate qualifies only when all of these are true:

1. it exposes at least one assignment;
2. it has zero incorrect exposed assignments;
3. its overall precision is at least `0.98`; and
4. every recommended role has at least three correct exposed examples.

Because zero incorrect exposures implies precision `1`, the explicit 98
percent requirement remains in the result contract as the product floor and
makes future relaxation visible rather than implicit.

The selected threshold is the lowest qualifying candidate, maximizing safe
coverage without compromising precision. The recommendation lists only roles
that satisfy the three-correct-example support floor. Roles below that floor
remain withheld even when their observed assignments are correct.

When no candidate qualifies, return:

```ts
{
  status: "insufficient-evidence",
  reason: string,
  candidates: ReadonlyArray<ThresholdEvaluation>
}
```

No exception, `NaN`, or fallback threshold represents this expected outcome.

## Metric Definitions

Metrics use threshold-eligible assignments unless a field explicitly names
control cases.

### Correction Frequency

```text
incorrect assignments / eligible assignments
```

An incorrect `unclassified` fallback counts as a correction. A gold
`unclassified` prediction is correct and does not count as a correction.

### Precision

```text
correct exposed assignments / exposed assignments
```

When no assignment is exposed, precision is `null`, not `1` or `NaN`.

### Coverage

```text
exposed assignments / eligible assignments
```

Coverage is diagnostic. It cannot make an unsafe threshold qualify.

### Fallback Rate

```text
predicted unclassified assignments / eligible assignments
```

### Overconfident Errors

An overconfident error is an incorrect exposed assignment at the candidate
threshold. A qualifying threshold requires zero.

## Validation And Errors

Corpus validation runs before classification. Invalid corpus data returns a
typed validation failure containing the case ID and exact problem.

Reject:

- duplicate case IDs;
- duplicate node IDs within a case;
- missing expected roles for top-level nodes;
- expected roles for unknown or child-only nodes;
- roles not allowed for Client-Server;
- threshold-eligible nodes carrying `data.layoutRole`;
- edges that reference unknown nodes; and
- a corpus with no threshold-eligible assignments.

Evaluation rejects classifier output with duplicate assignments, assignments
for unknown nodes, missing assignments, or a pattern other than
`client-server`.

Metrics with zero denominators use `null` for ratios that have no mathematical
value and `0` for count-based rates over a validated non-empty eligible
corpus. Results never contain non-finite numbers.

## Determinism And Isolation

- Corpus access returns fresh nodes, data objects, style objects, and edges.
- Evaluation never mutates cases or classifier assignments.
- Case order, node order, edge order, and assignment order do not change the
  aggregate result.
- Breakdowns use stable lexical ordering for keys and records.
- Repeated evaluation of unchanged input returns deeply equal results.

## Test Strategy

### Metric Unit Tests

Use a small synthetic classification set to drive RED/GREEN tests for:

- correction frequency;
- nullable precision with zero exposure;
- precision and coverage at multiple thresholds;
- fallback rate;
- role/source/category breakdowns;
- lowest safe threshold selection; and
- `insufficient-evidence` when every candidate has an error.

### Corpus Validation Tests

Cover every rejected corpus condition and assert that the failure names the
case and invalid contract. Verify clone isolation by mutating one retrieved
copy and comparing a fresh copy.

### Client-Server Evaluation Contract

Run `inferClientServerRoles` over every gold case and assert an exact metric
snapshot: counts, correction frequency, fallback rate, candidate thresholds,
per-role support, and recommendation status. This snapshot measures current
behavior; it must not silently tune the classifier to pass a desired product
outcome.

### Metamorphic And Property Coverage

- Shuffle cases, nodes, edges, and assignments and require the same result.
- Use property tests for metric bounds, finite numeric output, partition
  totals, and zero-denominator behavior.
- Preserve existing Client-Server classifier and layout-strategy suites.

## Delivery And Roadmap

The Slice 42 delivery record includes:

- corpus size and category coverage;
- exact correction frequency and fallback rate;
- the evaluated candidate thresholds;
- per-role support and precision;
- the selected threshold and roles, or an explicit insufficient-evidence
  outcome; and
- the next action justified by the measured result.

If a safe threshold exists, the next slice may design OPY/Rig evidence
exposure using only the qualified roles. If no threshold exists, the next
slice targets the measured classifier gaps before any exposure work.

## Release Gates

Run:

- focused metric, corpus, classifier, and Client-Server strategy tests;
- the full Vitest suite;
- ESLint and C4 orchestration guard lint;
- Astro check/build;
- Knip;
- Starlight check/build;
- Rust tests; and
- Clippy with warnings denied.

No runtime UI, persistence, migration, or native screenshot should change in
this slice.
