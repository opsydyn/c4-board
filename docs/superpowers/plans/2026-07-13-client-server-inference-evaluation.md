# Client-Server Inference Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic Client-Server gold corpus and pattern-neutral evaluator that measures current semantic-role inference and selects the lowest precision-safe OPY/Rig evidence threshold.

**Architecture:** Keep the generic metric engine independent of React Flow graphs and Client-Server classifier rules by feeding it flattened gold assignments plus existing `ArchitectureRoleClassification` values. A Client-Server adapter owns graph validation, clone-isolated corpus access, classifier invocation, and conversion into the generic engine. Both layers return typed discriminated unions for validation and insufficient-evidence outcomes; expected evaluation failure never throws.

**Tech Stack:** TypeScript, Effect 3 Schema/FastCheck, Vitest, React Flow `Node`/`Edge` types, Astro/Starlight, Bun.

## Global Constraints

- Do not change Client-Server classifier rules, confidence values, evidence strings, or layout geometry.
- Keep the corpus offline, hand-authored, typed, and in-repository; do not add JSON/JSONL loading, a CLI, persistence, telemetry, prompts, Rig tools, or OPY UI.
- Threshold-eligible cases must not carry inferred `data.layoutRole`; explicit-role controls must set `thresholdEligible: false`.
- Candidate thresholds are only distinct emitted confidence values from eligible non-`unclassified` assignments, sorted ascending.
- A candidate must expose at least one assignment, have zero exposed errors, meet `0.98` overall precision, and recommend at least one role with three or more correct exposed examples.
- Select the lowest qualifying threshold; return `insufficient-evidence` when none qualifies.
- Ratios with a zero denominator are `null`; results must never contain `NaN` or infinite numbers.
- Evaluation and corpus access must be clone-isolated, mutation-free, order-invariant, and lexically ordered.
- Follow TDD for every production change and commit each independently reviewable task.

---

## File Map

- Create `src/core/effects/architecture-role-evaluation.ts`: pattern-neutral input validation, metrics, breakdowns, threshold candidates, and recommendation.
- Create `src/core/effects/architecture-role-evaluation.property.test.ts`: Effect/FastCheck properties for bounds, partitions, finite output, and ordering invariance.
- Create `test/core/effects/architecture-role-evaluation.test.ts`: focused RED/GREEN examples for metrics, validation, and recommendation behavior.
- Create `src/core/effects/client-server-role-evals.ts`: Client-Server corpus types, immutable source data, validation, and clone-on-access API.
- Create `test/core/effects/client-server-role-evals.test.ts`: every corpus validation failure plus clone isolation and coverage contract.
- Create `src/core/effects/client-server-role-evaluation.ts`: validate, classify, flatten, and invoke the generic evaluator.
- Create `test/core/effects/client-server-role-evaluation.test.ts`: exact current-classifier metric contract and metamorphic ordering tests.
- Modify `docs/src/content/docs/overview/intelligent-layout-roadmap.md`: close Slice 42 with measured corpus and threshold results.

---

### Task 1: Pattern-Neutral Evaluation Engine

**Files:**
- Create: `src/core/effects/architecture-role-evaluation.ts`
- Create: `test/core/effects/architecture-role-evaluation.test.ts`

**Interfaces:**
- Consumes: `ArchitecturePattern`, `ArchitectureSemanticRole`, `ArchitectureRoleAssignment`, and `ArchitectureRoleClassification` from `@/core/effects/architecture-role-classification`.
- Produces: `evaluateArchitectureRoles(input: ArchitectureRoleEvaluationInput): ArchitectureRoleEvaluationResult`.
- Produces: immutable metric types `ArchitectureRoleEvaluation`, `ThresholdEvaluation`, `ThresholdRecommendation`, `EvaluationBreakdown`, and `ArchitectureRoleEvaluationValidationError`.

- [ ] **Step 1: Write the failing metric and nullable-ratio tests**

Create `test/core/effects/architecture-role-evaluation.test.ts` with a helper that builds valid `client-server` assignments, then assert the exact aggregate contract:

```ts
import {
  evaluateArchitectureRoles,
  type ArchitectureRoleEvaluationInput,
} from "@/core/effects/architecture-role-evaluation";
import type { ArchitectureRoleAssignment } from "@/core/effects/architecture-role-classification";
import { describe, expect, it } from "vitest";

const assignment = (
  nodeId: string,
  role: ArchitectureRoleAssignment["role"],
  confidence: number,
  source: ArchitectureRoleAssignment["source"],
): ArchitectureRoleAssignment => ({
  nodeId,
  pattern: "client-server",
  role,
  confidence,
  source,
  evidence: [`${source}:${role}`],
});

const input = (): ArchitectureRoleEvaluationInput => ({
  pattern: "client-server",
  goldAssignments: [
    { caseId: "case-a", category: "canonical", nodeId: "client-a", expectedRole: "client", thresholdEligible: true },
    { caseId: "case-a", category: "canonical", nodeId: "service-a", expectedRole: "service", thresholdEligible: true },
    { caseId: "case-b", category: "ambiguous", nodeId: "unknown-b", expectedRole: "unclassified", thresholdEligible: true },
    { caseId: "control", category: "explicit-control", nodeId: "domain-control", expectedRole: "domain", thresholdEligible: false },
  ],
  classifications: [
    {
      caseId: "case-a",
      classification: {
        pattern: "client-server",
        assignments: [
          assignment("client-a", "client", 0.9, "node-type"),
          assignment("service-a", "domain", 0.85, "label"),
        ],
        diagnostics: [],
      },
    },
    {
      caseId: "case-b",
      classification: {
        pattern: "client-server",
        assignments: [assignment("unknown-b", "unclassified", 0.25, "fallback")],
        diagnostics: [],
      },
    },
    {
      caseId: "control",
      classification: {
        pattern: "client-server",
        assignments: [assignment("domain-control", "domain", 1, "explicit")],
        diagnostics: [],
      },
    },
  ],
  policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
});

describe("architecture role evaluation", () => {
  it("computes eligible metrics without allowing controls to improve them", () => {
    const result = evaluateArchitectureRoles(input());
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.evaluation).toMatchObject({
      totalAssignmentCount: 4,
      eligibleAssignmentCount: 3,
      controlAssignmentCount: 1,
      correctAssignmentCount: 2,
      incorrectAssignmentCount: 1,
      fallbackAssignmentCount: 1,
      correctionFrequency: 1 / 3,
      fallbackRate: 1 / 3,
    });
    expect(result.evaluation.recommendation).toMatchObject({
      status: "insufficient-evidence",
    });
  });

  it("uses null precision for a role with no exposed assignments", () => {
    const result = evaluateArchitectureRoles(input());
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const highest = result.evaluation.candidates.at(-1)!;
    expect(highest.threshold).toBe(0.9);
    expect(highest.roleSupport.find(({ role }) => role === "service")).toMatchObject({
      exposedCount: 0,
      precision: null,
      recommended: false,
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `bun run test:run -- test/core/effects/architecture-role-evaluation.test.ts`

Expected: FAIL because `@/core/effects/architecture-role-evaluation` does not exist.

- [ ] **Step 3: Implement the public contracts and deterministic evaluator**

Create `src/core/effects/architecture-role-evaluation.ts` with these exact public contracts:

```ts
import {
  getRolesForPattern,
  type ArchitecturePattern,
  type ArchitectureRoleClassification,
  type ArchitectureSemanticRole,
} from "./architecture-role-classification";

export interface ArchitectureRoleGoldAssignment {
  readonly caseId: string;
  readonly category: string;
  readonly nodeId: string;
  readonly expectedRole: ArchitectureSemanticRole;
  readonly thresholdEligible: boolean;
}

export interface ArchitectureRoleEvaluationInput {
  readonly pattern: ArchitecturePattern;
  readonly goldAssignments: ReadonlyArray<ArchitectureRoleGoldAssignment>;
  readonly classifications: ReadonlyArray<{
    readonly caseId: string;
    readonly classification: ArchitectureRoleClassification;
  }>;
  readonly policy: {
    readonly minimumPrecision: number;
    readonly minimumCorrectPerRole: number;
  };
}

export type EvaluationBreakdownDimension =
  | "expected-role"
  | "predicted-role"
  | "source"
  | "confidence-band"
  | "category";

export interface EvaluationBreakdown {
  readonly key: string;
  readonly total: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly fallback: number;
}

export interface ThresholdRoleSupport {
  readonly role: ArchitectureSemanticRole;
  readonly exposedCount: number;
  readonly correctExposedCount: number;
  readonly incorrectExposedCount: number;
  readonly precision: number | null;
  readonly recommended: boolean;
}

export interface ThresholdEvaluation {
  readonly threshold: number;
  readonly exposedCount: number;
  readonly correctExposedCount: number;
  readonly incorrectExposedCount: number;
  readonly precision: number | null;
  readonly coverage: number;
  readonly overconfidentErrorCount: number;
  readonly roleSupport: ReadonlyArray<ThresholdRoleSupport>;
  readonly recommendedRoles: ReadonlyArray<ArchitectureSemanticRole>;
  readonly qualifies: boolean;
}

export type ThresholdRecommendation =
  | {
    readonly status: "selected";
    readonly threshold: number;
    readonly roles: ReadonlyArray<ArchitectureSemanticRole>;
  }
  | {
    readonly status: "insufficient-evidence";
    readonly reason: string;
  };

export interface ArchitectureRoleEvaluation {
  readonly pattern: ArchitecturePattern;
  readonly totalAssignmentCount: number;
  readonly eligibleAssignmentCount: number;
  readonly controlAssignmentCount: number;
  readonly correctAssignmentCount: number;
  readonly incorrectAssignmentCount: number;
  readonly fallbackAssignmentCount: number;
  readonly correctionFrequency: number;
  readonly fallbackRate: number;
  readonly breakdowns: Readonly<Record<EvaluationBreakdownDimension, ReadonlyArray<EvaluationBreakdown>>>;
  readonly candidates: ReadonlyArray<ThresholdEvaluation>;
  readonly recommendation: ThresholdRecommendation;
}

export interface ArchitectureRoleEvaluationValidationError {
  readonly _tag: "ArchitectureRoleEvaluationValidationError";
  readonly caseId: string | null;
  readonly problem:
    | "duplicate-gold-assignment"
    | "duplicate-classification-case"
    | "unknown-assignment"
    | "duplicate-assignment"
    | "missing-assignment"
    | "pattern-mismatch"
    | "no-threshold-eligible-assignments"
    | "invalid-policy";
  readonly message: string;
}

export type ArchitectureRoleEvaluationResult =
  | { readonly status: "success"; readonly evaluation: ArchitectureRoleEvaluation }
  | { readonly status: "validation-failure"; readonly error: ArchitectureRoleEvaluationValidationError };
```

Implement evaluation with indexed `caseId + "\u0000" + nodeId` keys. Validate duplicate/missing/unknown assignments and pattern mismatch before metrics. Use these helpers to guarantee finite values and stable output:

```ts
const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

const confidenceBand = (confidence: number): string => {
  if (confidence < 0.5) return "0.00-0.49";
  if (confidence < 0.65) return "0.50-0.64";
  if (confidence < 0.8) return "0.65-0.79";
  if (confidence < 0.9) return "0.80-0.89";
  return "0.90-1.00";
};

const sortedUnique = (values: ReadonlyArray<number>): number[] =>
  [...new Set(values)].sort((left, right) => left - right);
```

For each eligible gold/classifier pair, derive `correct`, `fallback`, and the five breakdown keys. Sort every breakdown and role-support array with `localeCompare`. Derive candidates only from non-`unclassified` eligible predictions. Build role support for every non-`unclassified` role returned by `getRolesForPattern(pattern)` so an unexposed role has `precision: null`. A threshold qualifies only when `exposedCount > 0`, `incorrectExposedCount === 0`, `precision !== null && precision >= minimumPrecision`, and `recommendedRoles.length > 0`. Select `candidates.find(({ qualifies }) => qualifies)`; otherwise return `insufficient-evidence` with reason `No emitted confidence threshold satisfies the precision and role-support policy.`

- [ ] **Step 4: Add validation and lowest-safe-threshold tests**

Extend `test/core/effects/architecture-role-evaluation.test.ts` with table-driven validation for duplicate, unknown, missing, and wrong-pattern classifier output. Add a six-assignment safe-threshold case where three clients at `0.9` are correct, two services at `0.8` are correct, and one service at `0.8` is wrong:

```ts
it("selects the lowest threshold with zero errors and supported roles", () => {
  const goldAssignments = ["client-1", "client-2", "client-3", "service-1", "service-2", "service-3"]
    .map((nodeId) => ({
      caseId: "threshold",
      category: "threshold",
      nodeId,
      expectedRole: nodeId.startsWith("client") ? "client" as const : "service" as const,
      thresholdEligible: true,
    }));
  const classifications = [{
    caseId: "threshold",
    classification: {
      pattern: "client-server" as const,
      assignments: [
        assignment("client-1", "client", 0.9, "node-type"),
        assignment("client-2", "client", 0.9, "node-type"),
        assignment("client-3", "client", 0.9, "node-type"),
        assignment("service-1", "service", 0.8, "label"),
        assignment("service-2", "service", 0.8, "label"),
        assignment("service-3", "domain", 0.8, "label"),
      ],
      diagnostics: [],
    },
  }];

  const result = evaluateArchitectureRoles({
    pattern: "client-server",
    goldAssignments,
    classifications,
    policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
  });

  expect(result).toMatchObject({
    status: "success",
    evaluation: {
      candidates: [
        { threshold: 0.8, exposedCount: 6, incorrectExposedCount: 1, qualifies: false },
        { threshold: 0.9, exposedCount: 3, incorrectExposedCount: 0, recommendedRoles: ["client"], qualifies: true },
      ],
      recommendation: { status: "selected", threshold: 0.9, roles: ["client"] },
    },
  });
});
```

Also assert invalid policy values, no eligible assignments, and an `insufficient-evidence` result when every emitted candidate exposes an error.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `bun run test:run -- test/core/effects/architecture-role-evaluation.test.ts`

Expected: PASS with all architecture-role evaluation unit tests green.

- [ ] **Step 6: Lint the task files**

Run: `bunx eslint src/core/effects/architecture-role-evaluation.ts test/core/effects/architecture-role-evaluation.test.ts`

Expected: exit 0 with no diagnostics.

- [ ] **Step 7: Commit the generic engine**

```bash
git add src/core/effects/architecture-role-evaluation.ts test/core/effects/architecture-role-evaluation.test.ts
git commit -m "feat: add semantic role evaluation engine"
```

---

### Task 2: Evaluation Properties

**Files:**
- Create: `src/core/effects/architecture-role-evaluation.property.test.ts`

**Interfaces:**
- Consumes: `evaluateArchitectureRoles(input: ArchitectureRoleEvaluationInput): ArchitectureRoleEvaluationResult` from Task 1.
- Produces: property coverage for aggregate bounds, partition totals, finite ratios, candidate ordering, and input-order invariance.

- [ ] **Step 1: Write the property tests**

Create `src/core/effects/architecture-role-evaluation.property.test.ts` using `effect/FastCheck`, matching the existing colocated property-test convention:

```ts
import * as FastCheck from "effect/FastCheck";
import { describe, expect, it } from "vitest";
import {
  evaluateArchitectureRoles,
  type ArchitectureRoleEvaluationInput,
} from "./architecture-role-evaluation";
import type { ArchitectureRoleAssignment } from "./architecture-role-classification";

const role = FastCheck.constantFrom(
  "client" as const,
  "service" as const,
  "domain" as const,
  "persistence" as const,
  "external-dependency" as const,
  "unclassified" as const,
);

const cases = FastCheck.array(
  FastCheck.record({ expectedRole: role, predictedRole: role, confidence: FastCheck.integer({ min: 0, max: 100 }) }),
  { minLength: 1, maxLength: 40 },
).map((rows): ArchitectureRoleEvaluationInput => ({
  pattern: "client-server",
  goldAssignments: rows.map(({ expectedRole }, index) => ({
    caseId: `case-${index}`,
    category: index % 2 === 0 ? "even" : "odd",
    nodeId: `node-${index}`,
    expectedRole,
    thresholdEligible: true,
  })),
  classifications: rows.map(({ predictedRole, confidence }, index) => ({
    caseId: `case-${index}`,
    classification: {
      pattern: "client-server",
      assignments: [{
        nodeId: `node-${index}`,
        pattern: "client-server",
        role: predictedRole,
        confidence: confidence / 100,
        source: predictedRole === "unclassified" ? "fallback" : "label",
        evidence: ["generated"],
      } satisfies ArchitectureRoleAssignment],
      diagnostics: [],
    },
  })),
  policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
}));

describe("architecture role evaluation properties", () => {
  it("keeps counts partitioned, ratios bounded, and thresholds sorted", () => {
    FastCheck.assert(FastCheck.property(cases, (input) => {
      const result = evaluateArchitectureRoles(input);
      expect(result.status).toBe("success");
      if (result.status !== "success") return;
      const evaluation = result.evaluation;
      expect(evaluation.correctAssignmentCount + evaluation.incorrectAssignmentCount)
        .toBe(evaluation.eligibleAssignmentCount);
      expect(evaluation.correctionFrequency).toBeGreaterThanOrEqual(0);
      expect(evaluation.correctionFrequency).toBeLessThanOrEqual(1);
      expect(evaluation.fallbackRate).toBeGreaterThanOrEqual(0);
      expect(evaluation.fallbackRate).toBeLessThanOrEqual(1);
      expect(evaluation.candidates.map(({ threshold }) => threshold))
        .toEqual([...evaluation.candidates.map(({ threshold }) => threshold)].sort((a, b) => a - b));
      for (const candidate of evaluation.candidates) {
        expect(candidate.precision === null || Number.isFinite(candidate.precision)).toBe(true);
        expect(Number.isFinite(candidate.coverage)).toBe(true);
        expect(candidate.correctExposedCount + candidate.incorrectExposedCount).toBe(candidate.exposedCount);
      }
    }), { numRuns: 100 });
  });

  it("is invariant to case, gold, and classification order", () => {
    FastCheck.assert(FastCheck.property(cases, (input) => {
      const forward = evaluateArchitectureRoles(input);
      const reversed = evaluateArchitectureRoles({
        ...input,
        goldAssignments: [...input.goldAssignments].reverse(),
        classifications: [...input.classifications].reverse().map(({ caseId, classification }) => ({
          caseId,
          classification: { ...classification, assignments: [...classification.assignments].reverse() },
        })),
      });
      expect(reversed).toEqual(forward);
    }), { numRuns: 100 });
  });
});
```

- [ ] **Step 2: Run the property test and fix only evaluator defects**

Run: `bun run test:run -- src/core/effects/architecture-role-evaluation.property.test.ts`

Expected: PASS for 100 runs per property. If RED, modify only `src/core/effects/architecture-role-evaluation.ts`; do not weaken generated inputs or assertions.

- [ ] **Step 3: Run unit and property tests together**

Run: `bun run test:run -- test/core/effects/architecture-role-evaluation.test.ts src/core/effects/architecture-role-evaluation.property.test.ts`

Expected: PASS.

- [ ] **Step 4: Lint and commit the properties**

Run: `bunx eslint src/core/effects/architecture-role-evaluation.property.test.ts src/core/effects/architecture-role-evaluation.ts`

Expected: exit 0.

```bash
git add src/core/effects/architecture-role-evaluation.ts src/core/effects/architecture-role-evaluation.property.test.ts
git commit -m "test: harden semantic role evaluation properties"
```

---

### Task 3: Client-Server Gold Corpus And Validation

**Files:**
- Create: `src/core/effects/client-server-role-evals.ts`
- Create: `test/core/effects/client-server-role-evals.test.ts`

**Interfaces:**
- Consumes: React Flow `Node`/`Edge`, `ArchitectureSemanticRole`, and `isRoleAllowedForPattern`.
- Produces: `getClientServerRoleEvalCases(): ClientServerRoleEvalCase[]` returning deep-cloned graphs.
- Produces: `validateClientServerRoleEvalCases(cases): ClientServerRoleEvalCorpusValidationResult`.

- [ ] **Step 1: Write corpus validation and isolation tests**

Create `test/core/effects/client-server-role-evals.test.ts`. Assert the shipped corpus has eight categories, 35 total nodes, 33 eligible nodes, at least three eligible expected examples for each exposable role, and no eligible `layoutRole`. Assert clone isolation by mutating node data, node style, positions, and edge labels in one retrieved copy and comparing a fresh copy to an untouched baseline.

Use table-driven mutations to assert these exact `problem` values and case IDs:

```ts
const invalidCases = [
  ["duplicate-case-id", "duplicate-case-id"],
  ["duplicate-node-id", "duplicate-node-id"],
  ["missing-top-level-expected-role", "missing-expected-role"],
  ["unknown-expected-node", "unknown-expected-node"],
  ["child-only-expected-node", "child-only-expected-node"],
  ["disallowed-role", "disallowed-role"],
  ["eligible-explicit-role", "threshold-eligible-explicit-role"],
  ["unknown-edge-source", "unknown-edge-endpoint"],
  ["unknown-edge-target", "unknown-edge-endpoint"],
  ["no-eligible-assignments", "no-threshold-eligible-assignments"],
] as const;
```

Each mutation must start from `getClientServerRoleEvalCases()` and change one contract only. Expect `{ status: "validation-failure", error: { caseId, problem } }` rather than a throw.

- [ ] **Step 2: Run corpus tests and verify RED**

Run: `bun run test:run -- test/core/effects/client-server-role-evals.test.ts`

Expected: FAIL because `client-server-role-evals.ts` does not exist.

- [ ] **Step 3: Implement corpus types, validator, and clone-on-access**

Create `src/core/effects/client-server-role-evals.ts` with these contracts:

```ts
import type { Edge, Node } from "@xyflow/react";
import type { ArchitectureSemanticRole } from "./architecture-role-classification";

export type ClientServerRoleEvalCategory =
  | "canonical-typed-path"
  | "label-only"
  | "grounded-topology"
  | "ambiguous-generic"
  | "misleading-label"
  | "missing-tier"
  | "external-directionality"
  | "explicit-role-control";

export interface ClientServerRoleEvalCase {
  readonly id: string;
  readonly category: ClientServerRoleEvalCategory;
  readonly nodes: ReadonlyArray<Node>;
  readonly edges: ReadonlyArray<Edge>;
  readonly expectedRoles: Readonly<Record<string, ArchitectureSemanticRole>>;
  readonly thresholdEligible: boolean;
  readonly rationale?: string;
}

export interface ClientServerRoleEvalCorpusValidationError {
  readonly _tag: "ClientServerRoleEvalCorpusValidationError";
  readonly caseId: string | null;
  readonly problem:
    | "duplicate-case-id"
    | "duplicate-node-id"
    | "missing-expected-role"
    | "unknown-expected-node"
    | "child-only-expected-node"
    | "disallowed-role"
    | "threshold-eligible-explicit-role"
    | "unknown-edge-endpoint"
    | "no-threshold-eligible-assignments";
  readonly message: string;
}

export type ClientServerRoleEvalCorpusValidationResult =
  | { readonly status: "valid" }
  | { readonly status: "validation-failure"; readonly error: ClientServerRoleEvalCorpusValidationError };

export const getClientServerRoleEvalCases = (): ClientServerRoleEvalCase[] =>
  structuredClone(CLIENT_SERVER_ROLE_EVAL_CASES);
```

Represent every node with `position: { x: 0, y: 0 }`, a fresh `data` object, and `style: { width: 180, height: 80 }`. Use the following exact case blueprint; IDs in each node list are also the keys of `expectedRoles` in the same order:

| Case ID | Category | Eligible | Node ID / type / label / expected role | Edges |
|---|---|---:|---|---|
| `canonical-typed` | `canonical-typed-path` | yes | `typed-client` / `person` / `Customer` / client; `typed-service` / `applicationService` / `Checkout Application` / service; `typed-domain` / `aggregate` / `Order Aggregate` / domain; `typed-store` / `repository` / `Order Repository` / persistence; `typed-external` / `externalSystem` / `Payment Provider` / external-dependency; `typed-worker` / `component` / `Worker` / unclassified | request, command, data, and provider edges in path order |
| `label-only` | `label-only` | yes | `label-client` / `component` / `Web Browser` / client; `label-service` / `component` / `Orders API` / service; `label-domain` / `component` / `Business Rules` / domain; `label-store` / `component` / `Orders Database` / persistence; `label-external` / `component` / `Payment Provider` / external-dependency | none |
| `grounded-topology` | `grounded-topology` | yes | `topology-client` / `component` / `Portal` / client; `topology-client-target` / `applicationService` / `Entry Application` / service; `topology-service` / `component` / `Coordinator` / service; `topology-service-target` / `aggregate` / `Target Aggregate` / domain; `topology-domain-source` / `applicationService` / `Domain Application` / service; `topology-domain` / `component` / `Rules Engine` / domain; `topology-domain-store` / `repository` / `Domain Repository` / persistence; `topology-persistence-source` / `aggregate` / `Ledger Aggregate` / domain; `topology-persistence` / `component` / `Ledger Store` / persistence | `topology-client calls topology-client-target`; `topology-service calls topology-service-target`; `topology-domain-source command topology-domain`; `topology-domain reads topology-domain-store`; `topology-persistence-source stores topology-persistence` |
| `ambiguous-generic` | `ambiguous-generic` | yes | `generic-a` / `component` / `Worker` / unclassified; `generic-b` / `container` / `Coordinator` / unclassified; `generic-c` / `system` / `Platform` / unclassified | none |
| `misleading-labels` | `misleading-label` | yes | `misleading-client` / `person` / `Orders Database` / client; `misleading-domain` / `aggregate` / `Public API` / domain; `misleading-store` / `repository` / `Browser Client` / persistence | none |
| `missing-tier` | `missing-tier` | yes | `missing-client` / `person` / `Operator` / client; `missing-store` / `repository` / `Archive` / persistence; `missing-external` / `externalSystem` / `Archive Provider` / external-dependency | client reads store; store calls provider |
| `external-directionality` | `external-directionality` | yes | `direction-client` / `component` / `Partner Caller` / client; `direction-service` / `applicationService` / `Partner Application` / service; `direction-external-a` / `externalSystem` / `Identity Provider` / external-dependency; `direction-external-b` / `externalSystem` / `Tax Provider` / external-dependency | client calls service; service calls both externals; client also calls identity provider |
| `explicit-controls` | `explicit-role-control` | no | `explicit-domain` / `component` / `Worker` / domain with `data.layoutRole: "domain"`; `mismatch-client` / `person` / `Operator` / client with `data.layoutRole: "publisher"` | none |

The blueprint has 35 total nodes and 33 eligible nodes. The threshold-eligible expected role totals are client 6, service 6, domain 6, persistence 6, external-dependency 5, and unclassified 4. The statically typed topology anchors are gold assignments too; they prevent hidden fixtures from escaping evaluation.

Validation must treat a node as top-level when `node.parentId` is absent. Require exactly one expected role for every top-level node and none for child nodes. Validate edge endpoints against all node IDs. Use `isRoleAllowedForPattern("client-server", role)`. Return the first failure in lexical case/node/edge order so invalid-input results are deterministic.

- [ ] **Step 4: Run the corpus contract GREEN**

Assert the blueprint’s exact `35` total and `33` eligible nodes, and assert the expected-role totals `{ client: 6, domain: 6, "external-dependency": 5, persistence: 6, service: 6, unclassified: 4 }`.

Run: `bun run test:run -- test/core/effects/client-server-role-evals.test.ts`

Expected: PASS, including all ten validation failures and clone-isolation coverage.

- [ ] **Step 5: Lint and commit the corpus**

Run: `bunx eslint src/core/effects/client-server-role-evals.ts test/core/effects/client-server-role-evals.test.ts`

Expected: exit 0.

```bash
git add src/core/effects/client-server-role-evals.ts test/core/effects/client-server-role-evals.test.ts
git commit -m "test: add client-server role gold corpus"
```

---

### Task 4: Client-Server Evaluation Adapter And Exact Measurement

**Files:**
- Create: `src/core/effects/client-server-role-evaluation.ts`
- Create: `test/core/effects/client-server-role-evaluation.test.ts`

**Interfaces:**
- Consumes: `getClientServerRoleEvalCases`, `validateClientServerRoleEvalCases`, `inferClientServerRoles`, and `evaluateArchitectureRoles`.
- Produces: `runClientServerRoleEvaluation(cases?: ReadonlyArray<ClientServerRoleEvalCase>): ClientServerRoleEvaluationRunResult`.

- [ ] **Step 1: Write the adapter contract test**

Create `test/core/effects/client-server-role-evaluation.test.ts` and assert this exact measurement from the blueprint. Because the topology anchor nodes are included, the eligible confidence distribution is `.25: 5`, `.65: 3`, `.7: 2`, `.8: 4`, `.85: 8`, `.9: 11`, totaling 33. The current classifier misses `label-external` (expected external, fallback) and `topology-domain` (expected domain, inferred service at `0.65` because outbound persistence coordination wins before domain bridging), so the exact top-level contract is:

```ts
import { inferClientServerRoles } from "@/core/effects/architecture-role-classification";
import {
  runClientServerRoleEvaluation,
  runClientServerRoleEvaluationFromClassifications,
} from "@/core/effects/client-server-role-evaluation";
import { getClientServerRoleEvalCases } from "@/core/effects/client-server-role-evals";
import { describe, expect, it } from "vitest";

describe("Client-Server role evaluation", () => {
  it("freezes current classifier quality and the lowest safe evidence threshold", () => {
    const result = runClientServerRoleEvaluation();
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.evaluation).toMatchObject({
      pattern: "client-server",
      totalAssignmentCount: 35,
      eligibleAssignmentCount: 33,
      controlAssignmentCount: 2,
      correctAssignmentCount: 31,
      incorrectAssignmentCount: 2,
      fallbackAssignmentCount: 5,
      correctionFrequency: 2 / 33,
      fallbackRate: 5 / 33,
      candidates: [
        { threshold: 0.65, exposedCount: 28, correctExposedCount: 27, incorrectExposedCount: 1, precision: 27 / 28, coverage: 28 / 33, qualifies: false },
        { threshold: 0.7, exposedCount: 25, correctExposedCount: 25, incorrectExposedCount: 0, precision: 1, coverage: 25 / 33, qualifies: true },
        { threshold: 0.8, exposedCount: 23, correctExposedCount: 23, incorrectExposedCount: 0, precision: 1, coverage: 23 / 33, qualifies: true },
        { threshold: 0.85, exposedCount: 19, correctExposedCount: 19, incorrectExposedCount: 0, precision: 1, coverage: 19 / 33, qualifies: true },
        { threshold: 0.9, exposedCount: 11, correctExposedCount: 11, incorrectExposedCount: 0, precision: 1, coverage: 11 / 33, qualifies: true },
      ],
      recommendation: {
        status: "selected",
        threshold: 0.7,
        roles: ["client", "domain", "external-dependency", "persistence", "service"],
      },
    });
  });
});
```

Also assert exact eligible breakdown records:

```ts
expect(result.evaluation.breakdowns["expected-role"]).toEqual([
  { key: "client", total: 6, correct: 6, incorrect: 0, fallback: 0 },
  { key: "domain", total: 6, correct: 5, incorrect: 1, fallback: 0 },
  { key: "external-dependency", total: 5, correct: 4, incorrect: 1, fallback: 1 },
  { key: "persistence", total: 6, correct: 6, incorrect: 0, fallback: 0 },
  { key: "service", total: 6, correct: 6, incorrect: 0, fallback: 0 },
  { key: "unclassified", total: 4, correct: 4, incorrect: 0, fallback: 4 },
]);
expect(result.evaluation.breakdowns["predicted-role"]).toEqual([
  { key: "client", total: 6, correct: 6, incorrect: 0, fallback: 0 },
  { key: "domain", total: 5, correct: 5, incorrect: 0, fallback: 0 },
  { key: "external-dependency", total: 4, correct: 4, incorrect: 0, fallback: 0 },
  { key: "persistence", total: 6, correct: 6, incorrect: 0, fallback: 0 },
  { key: "service", total: 7, correct: 6, incorrect: 1, fallback: 0 },
  { key: "unclassified", total: 5, correct: 4, incorrect: 1, fallback: 5 },
]);
expect(result.evaluation.breakdowns.source).toEqual([
  { key: "fallback", total: 5, correct: 4, incorrect: 1, fallback: 5 },
  { key: "label", total: 4, correct: 4, incorrect: 0, fallback: 0 },
  { key: "node-type", total: 19, correct: 19, incorrect: 0, fallback: 0 },
  { key: "topology", total: 5, correct: 4, incorrect: 1, fallback: 0 },
]);
expect(result.evaluation.breakdowns["confidence-band"]).toEqual([
  { key: "0.00-0.49", total: 5, correct: 4, incorrect: 1, fallback: 5 },
  { key: "0.65-0.79", total: 5, correct: 4, incorrect: 1, fallback: 0 },
  { key: "0.80-0.89", total: 12, correct: 12, incorrect: 0, fallback: 0 },
  { key: "0.90-1.00", total: 11, correct: 11, incorrect: 0, fallback: 0 },
]);
expect(result.evaluation.breakdowns.category).toEqual([
  { key: "ambiguous-generic", total: 3, correct: 3, incorrect: 0, fallback: 3 },
  { key: "canonical-typed-path", total: 6, correct: 6, incorrect: 0, fallback: 1 },
  { key: "external-directionality", total: 4, correct: 4, incorrect: 0, fallback: 0 },
  { key: "grounded-topology", total: 9, correct: 8, incorrect: 1, fallback: 0 },
  { key: "label-only", total: 5, correct: 4, incorrect: 1, fallback: 1 },
  { key: "misleading-label", total: 3, correct: 3, incorrect: 0, fallback: 0 },
  { key: "missing-tier", total: 3, correct: 3, incorrect: 0, fallback: 0 },
]);
expect(result.evaluation.candidates[1]?.roleSupport).toEqual([
  { role: "client", exposedCount: 6, correctExposedCount: 6, incorrectExposedCount: 0, precision: 1, recommended: true },
  { role: "domain", exposedCount: 5, correctExposedCount: 5, incorrectExposedCount: 0, precision: 1, recommended: true },
  { role: "external-dependency", exposedCount: 4, correctExposedCount: 4, incorrectExposedCount: 0, precision: 1, recommended: true },
  { role: "persistence", exposedCount: 5, correctExposedCount: 5, incorrectExposedCount: 0, precision: 1, recommended: true },
  { role: "service", exposedCount: 5, correctExposedCount: 5, incorrectExposedCount: 0, precision: 1, recommended: true },
]);
```

- [ ] **Step 2: Run adapter tests and verify RED**

Run: `bun run test:run -- test/core/effects/client-server-role-evaluation.test.ts`

Expected: FAIL because `client-server-role-evaluation.ts` does not exist.

- [ ] **Step 3: Implement the validate-classify-evaluate adapter**

Create `src/core/effects/client-server-role-evaluation.ts`:

```ts
import { inferClientServerRoles } from "./architecture-role-classification";
import {
  evaluateArchitectureRoles,
  type ArchitectureRoleEvaluation,
  type ArchitectureRoleEvaluationValidationError,
} from "./architecture-role-evaluation";
import {
  getClientServerRoleEvalCases,
  validateClientServerRoleEvalCases,
  type ClientServerRoleEvalCase,
  type ClientServerRoleEvalCorpusValidationError,
} from "./client-server-role-evals";

export type ClientServerRoleEvaluationRunResult =
  | { readonly status: "success"; readonly evaluation: ArchitectureRoleEvaluation }
  | {
    readonly status: "validation-failure";
    readonly error: ClientServerRoleEvalCorpusValidationError | ArchitectureRoleEvaluationValidationError;
  };

export const runClientServerRoleEvaluationFromClassifications = (
  cases: ReadonlyArray<ClientServerRoleEvalCase>,
  classify: typeof inferClientServerRoles,
): ClientServerRoleEvaluationRunResult => {
  const validation = validateClientServerRoleEvalCases(cases);
  if (validation.status === "validation-failure") return validation;

  const result = evaluateArchitectureRoles({
    pattern: "client-server",
    goldAssignments: cases.flatMap((evalCase) =>
      Object.entries(evalCase.expectedRoles).map(([nodeId, expectedRole]) => ({
        caseId: evalCase.id,
        category: evalCase.category,
        nodeId,
        expectedRole,
        thresholdEligible: evalCase.thresholdEligible,
      }))
    ),
    classifications: cases.map((evalCase) => ({
      caseId: evalCase.id,
      classification: classify(evalCase.nodes, evalCase.edges),
    })),
    policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
  });

  return result.status === "validation-failure"
    ? result
    : { status: "success", evaluation: result.evaluation };
};

export const runClientServerRoleEvaluation = (
  cases: ReadonlyArray<ClientServerRoleEvalCase> = getClientServerRoleEvalCases(),
): ClientServerRoleEvaluationRunResult =>
  runClientServerRoleEvaluationFromClassifications(cases, inferClientServerRoles);
```

Do not catch classifier exceptions or alter assignments. Corpus validation is the only pre-classification branch; generic output validation remains the post-classification branch.

- [ ] **Step 4: Add metamorphic and validation-forwarding tests**

Extend the adapter test to reverse cases, nodes, edges, `expectedRoles` entry order, and classifier assignment order independently. Use `runClientServerRoleEvaluationFromClassifications` with this classifier wrapper and assert deep equality with the baseline:

```ts
const reverseAssignments: typeof inferClientServerRoles = (nodes, edges) => {
  const result = inferClientServerRoles(nodes, edges);
  return { ...result, assignments: [...result.assignments].reverse() };
};
```

Pass a duplicate-case corpus and assert the exact corpus validation failure is forwarded unchanged. Mutate caller-owned cases after one run and confirm a fresh default run remains deeply equal.

- [ ] **Step 5: Run the full focused evaluation group**

Run:

```bash
bun run test:run -- \
  test/core/effects/architecture-role-evaluation.test.ts \
  src/core/effects/architecture-role-evaluation.property.test.ts \
  test/core/effects/client-server-role-evals.test.ts \
  test/core/effects/client-server-role-evaluation.test.ts \
  test/core/effects/architecture-role-classification.test.ts \
  test/core/effects/client-server-layout-strategy.test.ts
```

Expected: PASS. If the exact measured values differ, inspect corpus construction and the existing classifier first. Update the literal only when the assignment-level diff proves the plan’s hand-calculated expectation was wrong; do not modify classifier behavior or gold labels to obtain the desired threshold.

- [ ] **Step 6: Lint and commit the adapter**

Run: `bunx eslint src/core/effects/client-server-role-evaluation.ts test/core/effects/client-server-role-evaluation.test.ts`

Expected: exit 0.

```bash
git add src/core/effects/client-server-role-evaluation.ts test/core/effects/client-server-role-evaluation.test.ts
git commit -m "feat: evaluate client-server role inference"
```

---

### Task 5: Reconcile Slice 42 Roadmap And Release Gates

**Files:**
- Modify: `docs/src/content/docs/overview/intelligent-layout-roadmap.md`

**Interfaces:**
- Consumes: the exact passing `runClientServerRoleEvaluation()` result from Task 4.
- Produces: a completed Slice 42 delivery record and a bounded next slice for OPY/Rig evidence exposure.

- [ ] **Step 1: Update roadmap status and delivery record**

Change the open Phase 4 items to complete:

```markdown
- [x] Evaluate Client-Server inference confidence and correction frequency.
- [x] Define the evidence threshold required before exposing Client-Server role evidence to OPY/Rig.
```

Append this delivery record after Slice 41, replacing values only if the passing Task 4 literal was corrected from assignment-level evidence:

```markdown
### Slice 42 Delivery Record

**Completed**: 2026-07-13

Delivered:

- [x] Added a clone-isolated, hand-authored Client-Server gold corpus covering eight categories, 33 threshold-eligible assignments, and two explicit-role controls.
- [x] Measured 31 correct and two incorrect eligible assignments: correction frequency `6.06%` and fallback rate `15.15%`.
- [x] Evaluated only emitted confidence candidates: `0.65`, `0.70`, `0.80`, `0.85`, and `0.90`.
- [x] Selected `0.70` as the lowest threshold with zero overconfident errors, `100%` exposed precision, `75.76%` coverage, and at least three correct examples for each recommended role.
- [x] Qualified `client`, `service`, `domain`, `persistence`, and `external-dependency` for future OPY/Rig evidence exposure.
- [x] Kept runtime telemetry, persistence, classifier tuning, and evidence-exposure UI outside this measurement slice.

Next slice:

- [ ] Design OPY/Rig Client-Server role-evidence exposure using only the five qualified roles at confidence `>= 0.70`.
- [ ] Keep `unclassified` and below-threshold assignments withheld while preserving source and evidence provenance for qualified assignments.
- [ ] Treat corpus expansion or classifier changes as threshold-invalidating changes that must rerun the exact evaluation contract.
```

Also update the roadmap summary and “next product workstream” paragraphs to state that Slice 42 is shipped and evidence exposure is next. Keep automated post-fix Client-Server PNG refresh explicitly deferred.

- [ ] **Step 2: Run focused tests once more before broad gates**

Run the six-test command from Task 4 Step 5.

Expected: PASS.

- [ ] **Step 3: Run all frontend and docs gates**

Run each command separately and retain its exit status:

```bash
bun run test:run
bun run lint
bun run lint:guards
bun run build
bun run knip
bun run docs:check
bun run docs:build
```

Expected:

- Vitest: all test files and tests pass.
- ESLint and guard lint: exit 0 with no diagnostics.
- Frontend build: Astro check reports zero errors and build completes.
- Knip: exit 0 with no unused files, exports, or dependencies.
- Starlight check/build: zero errors and static pages build successfully.

- [ ] **Step 4: Run Rust release gates**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

Expected: all Rust tests pass; Clippy exits 0 with warnings denied.

- [ ] **Step 5: Review the final diff for scope and secrets**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~3
git diff HEAD~3 -- \
  src/core/effects/architecture-role-evaluation.ts \
  src/core/effects/architecture-role-evaluation.property.test.ts \
  src/core/effects/client-server-role-evals.ts \
  src/core/effects/client-server-role-evaluation.ts \
  test/core/effects/architecture-role-evaluation.test.ts \
  test/core/effects/client-server-role-evals.test.ts \
  test/core/effects/client-server-role-evaluation.test.ts \
  docs/src/content/docs/overview/intelligent-layout-roadmap.md
```

Expected: no whitespace errors; only evaluation, corpus, tests, and roadmap files are changed; no API keys, SQLite files, generated build output, classifier changes, or UI changes appear.

- [ ] **Step 6: Commit the roadmap reconciliation**

```bash
git add docs/src/content/docs/overview/intelligent-layout-roadmap.md
git commit -m "docs: record client-server inference threshold"
```

- [ ] **Step 7: Request final two-stage review**

Use `superpowers:requesting-code-review` after all gates pass. Review first for conformance to `docs/superpowers/specs/2026-07-13-client-server-inference-evaluation-design.md`, then for code quality. Resolve findings with focused tests and rerun every gate affected by a fix before declaring the slice complete.
