import type { RigToolRisk } from "./agent-policy";

export type OpyAnomalyRequestKind =
  | "chat"
  | "review"
  | "proposal"
  | "action"
  | "tool-trace"
  | "mutation-plan";

export type OpyAnomalySignalKind =
  | "prompt-injection"
  | "secret-exfiltration"
  | "policy-evasion"
  | "destructive-mutation"
  | "suspicious-tool-trace"
  | "unsafe-mutation-plan";

export type OpyAnomalySeverity = "none" | "caution" | "critical";

export interface OpyAnomalySignal {
  readonly kind: OpyAnomalySignalKind;
  readonly severity: Exclude<OpyAnomalySeverity, "none">;
  readonly evidence: string;
}

export interface OpyAnomalyAssessment {
  readonly requestKind: OpyAnomalyRequestKind;
  readonly severity: OpyAnomalySeverity;
  readonly blocked: boolean;
  readonly score: number;
  readonly summary: string;
  readonly recommendedAction: string;
  readonly signals: ReadonlyArray<OpyAnomalySignal>;
}

interface OpyAnomalyPattern {
  readonly evidence: string;
  readonly kind: OpyAnomalySignalKind;
  readonly recommendedAction: string;
  readonly score: number;
  readonly severity: Exclude<OpyAnomalySeverity, "none">;
  readonly when: (input: {
    readonly normalizedText: string;
    readonly requestKind: OpyAnomalyRequestKind;
  }) => boolean;
}

const PROMPT_INJECTION_PATTERNS: ReadonlyArray<OpyAnomalyPattern> = [
  {
    kind: "prompt-injection",
    severity: "critical",
    score: 5,
    evidence: "Instruction override attempt",
    recommendedAction: "Remove instruction-override language and restate the architecture goal directly.",
    when: ({ normalizedText }) =>
      /ignore (all |the )?(previous|prior|above) (instructions|prompts)/i.test(normalizedText)
      || /disregard .*?(instructions|prompt|rules)/i.test(normalizedText)
      || /override .*?(system|developer) (prompt|instructions)/i.test(normalizedText),
  },
  {
    kind: "prompt-injection",
    severity: "critical",
    score: 5,
    evidence: "System prompt extraction request",
    recommendedAction: "Ask for architecture help, not hidden prompt or policy internals.",
    when: ({ normalizedText }) =>
      /reveal .*?(system prompt|developer prompt|hidden instructions)/i.test(normalizedText)
      || /show .*?(internal prompt|hidden prompt)/i.test(normalizedText),
  },
];

const SECRET_EXFILTRATION_PATTERNS: ReadonlyArray<OpyAnomalyPattern> = [
  {
    kind: "secret-exfiltration",
    severity: "critical",
    score: 5,
    evidence: "Secret or credential extraction request",
    recommendedAction: "Remove requests for keys, credentials, or secret material.",
    when: ({ normalizedText }) =>
      /(show|print|dump|reveal|extract|return|leak|display).{0,40}(api key|secret|token|password|credential|keychain|env var|environment variable|\.env|ssh key)/i
        .test(normalizedText),
  },
  {
    kind: "secret-exfiltration",
    severity: "critical",
    score: 5,
    evidence: "Policy or config exfiltration request",
    recommendedAction: "Ask for supported configuration status instead of raw secret or env output.",
    when: ({ normalizedText }) =>
      /(cat|read|open).{0,40}(\.env|keychain|credentials|token file|config secrets)/i.test(normalizedText),
  },
];

const POLICY_EVASION_PATTERNS: ReadonlyArray<OpyAnomalyPattern> = [
  {
    kind: "policy-evasion",
    severity: "critical",
    score: 4,
    evidence: "Safety or approval bypass request",
    recommendedAction: "Keep confirmation and policy boundaries intact; ask for a proposal or review instead.",
    when: ({ normalizedText }) =>
      /(bypass|disable|skip|ignore).{0,30}(confirmation|approval|guardrail|policy|safety|kill switch)/i
        .test(normalizedText)
      || /auto-apply/i.test(normalizedText),
  },
];

const DESTRUCTIVE_MUTATION_PATTERNS: ReadonlyArray<OpyAnomalyPattern> = [
  {
    kind: "destructive-mutation",
    severity: "caution",
    score: 2,
    evidence: "Broad destructive board change request",
    recommendedAction: "Narrow the requested change scope and confirm the exact board entities to modify.",
    when: ({ normalizedText, requestKind }) =>
      (requestKind === "proposal" || requestKind === "action")
      && /(delete|remove|wipe|clear|destroy|reset).{0,30}(all|entire|everything|whole board|every node|all nodes)/i
        .test(normalizedText),
  },
];

const ALL_PATTERNS: ReadonlyArray<OpyAnomalyPattern> = [
  ...PROMPT_INJECTION_PATTERNS,
  ...SECRET_EXFILTRATION_PATTERNS,
  ...POLICY_EVASION_PATTERNS,
  ...DESTRUCTIVE_MUTATION_PATTERNS,
];

const TOOL_TRACE_PATTERNS: ReadonlyArray<OpyAnomalyPattern> = [
  {
    kind: "suspicious-tool-trace",
    severity: "caution",
    score: 2,
    evidence: "Tool trace references secret or credential material",
    recommendedAction: "Inspect the tool boundary. Tool traces should never include secret or credential language.",
    when: ({ normalizedText }) =>
      /(api key|secret|token|password|credential|keychain|\.env|environment variable)/i.test(normalizedText),
  },
  {
    kind: "suspicious-tool-trace",
    severity: "caution",
    score: 2,
    evidence: "Tool trace references policy bypass or auto-apply language",
    recommendedAction: "Inspect the tool boundary. Action traces must preserve confirmation and policy constraints.",
    when: ({ normalizedText }) =>
      /(auto-apply|bypass confirmation|skip approval|disable guardrail|ignore policy)/i.test(normalizedText),
  },
  {
    kind: "suspicious-tool-trace",
    severity: "caution",
    score: 1,
    evidence: "Tool trace suggests broad destructive scope",
    recommendedAction: "Break the operation into smaller bounded actions before continuing.",
    when: ({ normalizedText }) =>
      /(delete|remove|wipe|clear|destroy).{0,30}(all|entire|everything|whole board|every node|all nodes)/i
        .test(normalizedText),
  },
];

const MUTATION_PLAN_PATTERNS: ReadonlyArray<OpyAnomalyPattern> = [
  {
    kind: "unsafe-mutation-plan",
    severity: "critical",
    score: 5,
    evidence: "Mutation plan references secret or credential extraction",
    recommendedAction: "Reject the plan and regenerate it with architecture-only language.",
    when: ({ normalizedText }) =>
      /(api key|secret|token|password|credential|keychain|\.env|environment variable)/i.test(normalizedText),
  },
  {
    kind: "unsafe-mutation-plan",
    severity: "critical",
    score: 4,
    evidence: "Mutation plan references confirmation or policy bypass",
    recommendedAction: "Reject the plan and require a policy-compliant proposal.",
    when: ({ normalizedText }) =>
      /(auto-apply|bypass confirmation|skip approval|disable guardrail|ignore policy)/i.test(normalizedText),
  },
  {
    kind: "unsafe-mutation-plan",
    severity: "caution",
    score: 2,
    evidence: "Mutation plan suggests broad destructive scope",
    recommendedAction: "Reduce blast radius and split the proposal into smaller bounded changes.",
    when: ({ normalizedText }) =>
      /(delete|remove|wipe|clear|destroy).{0,30}(all|entire|everything|whole board|every node|all nodes)/i
        .test(normalizedText),
  },
];

const dedupeSignals = (
  signals: ReadonlyArray<OpyAnomalySignal>,
): ReadonlyArray<OpyAnomalySignal> => {
  const seen = new Set<string>();
  const deduped: OpyAnomalySignal[] = [];

  for (const signal of signals) {
    const key = `${signal.kind}:${signal.evidence}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(signal);
  }

  return deduped;
};

const buildSummary = (
  requestKind: OpyAnomalyRequestKind,
  severity: OpyAnomalySeverity,
  signals: ReadonlyArray<OpyAnomalySignal>,
): string => {
  if (severity === "none" || signals.length === 0) {
    return "No anomaly signals detected.";
  }

  const label = severity === "critical" ? "BLOCKED" : "CAUTION";
  const categories = [...new Set(signals.map((signal) => signal.kind.toUpperCase()))].join(", ");
  return `ANOMALY ${label} :: ${requestKind.toUpperCase()} :: ${categories}`;
};

const buildRecommendedAction = (
  severity: OpyAnomalySeverity,
  patterns: ReadonlyArray<OpyAnomalyPattern>,
): string => {
  if (severity === "none" || patterns.length === 0) {
    return "Continue with the current OPY request.";
  }

  return patterns[0]?.recommendedAction
    ?? "Restate the request in plain architecture terms without bypass or secret-extraction language.";
};

const createNoAnomalyAssessment = (
  requestKind: OpyAnomalyRequestKind,
): OpyAnomalyAssessment => ({
  requestKind,
  severity: "none",
  blocked: false,
  score: 0,
  summary: "No anomaly signals detected.",
  recommendedAction: "Continue with the current OPY request.",
  signals: [],
});

const assessPatternSet = (input: {
  readonly requestKind: OpyAnomalyRequestKind;
  readonly text: string;
  readonly patterns: ReadonlyArray<OpyAnomalyPattern>;
  readonly extraSignals?: ReadonlyArray<
    OpyAnomalySignal & { readonly score?: number; readonly recommendedAction?: string }
  >;
}): OpyAnomalyAssessment => {
  const normalizedText = input.text.trim().replace(/\s+/g, " ");
  if (normalizedText.length === 0) {
    return createNoAnomalyAssessment(input.requestKind);
  }

  const matchedPatterns = input.patterns.filter((pattern) =>
    pattern.when({
      normalizedText,
      requestKind: input.requestKind,
    })
  );
  const extraSignals = input.extraSignals ?? [];
  const signals = dedupeSignals([
    ...matchedPatterns.map((pattern) => ({
      kind: pattern.kind,
      severity: pattern.severity,
      evidence: pattern.evidence,
    })),
    ...extraSignals.map((signal) => ({
      kind: signal.kind,
      severity: signal.severity,
      evidence: signal.evidence,
    })),
  ]);
  const score = matchedPatterns.reduce((sum, pattern) => sum + pattern.score, 0)
    + extraSignals.reduce((sum, signal) => sum + (signal.score ?? 0), 0);
  const blocked = matchedPatterns.some((pattern) => pattern.severity === "critical")
    || extraSignals.some((signal) => signal.severity === "critical");
  const severity: OpyAnomalySeverity = blocked
    ? "critical"
    : [...matchedPatterns, ...extraSignals].some((signal) => signal.severity === "caution")
    ? "caution"
    : "none";
  const recommendedAction = blocked
    ? matchedPatterns[0]?.recommendedAction
      ?? extraSignals[0]?.recommendedAction
      ?? buildRecommendedAction(severity, matchedPatterns)
    : matchedPatterns[0]?.recommendedAction
      ?? extraSignals[0]?.recommendedAction
      ?? "Continue with the current OPY request.";

  return {
    requestKind: input.requestKind,
    severity,
    blocked,
    score,
    summary: buildSummary(input.requestKind, severity, signals),
    recommendedAction,
    signals,
  };
};

export const assessOpyRequestAnomaly = (input: {
  readonly requestKind: OpyAnomalyRequestKind;
  readonly text: string;
}): OpyAnomalyAssessment =>
  assessPatternSet({
    requestKind: input.requestKind,
    text: input.text,
    patterns: ALL_PATTERNS,
  });

export const assessOpyToolTraceAnomaly = (input: {
  readonly toolName: string;
  readonly inputSummary: string | null;
  readonly outputSummary: string | null;
  readonly errorSummary?: string | null;
}): OpyAnomalyAssessment =>
  assessPatternSet({
    requestKind: "tool-trace",
    text: [
      `tool ${input.toolName}`,
      input.inputSummary ?? "",
      input.outputSummary ?? "",
      input.errorSummary ?? "",
    ].filter((value) => value.trim().length > 0).join(" · "),
    patterns: TOOL_TRACE_PATTERNS,
  });

export const assessOpyMutationPlanAnomaly = (input: {
  readonly proposalSummary: string;
  readonly rationale: string;
  readonly warnings: ReadonlyArray<string>;
  readonly issueDetails: ReadonlyArray<string>;
  readonly impactDetails: ReadonlyArray<string>;
  readonly totalActions: number;
  readonly totalNodesCreated: number;
  readonly totalEdgesCreated: number;
  readonly highestRisk: RigToolRisk;
}): OpyAnomalyAssessment => {
  const extraSignals: Array<OpyAnomalySignal & { readonly score?: number; readonly recommendedAction?: string }> = [];

  if (input.totalActions >= 24 || input.totalNodesCreated >= 16 || input.totalEdgesCreated >= 24) {
    extraSignals.push({
      kind: "unsafe-mutation-plan",
      severity: "critical",
      evidence: "Extreme mutation batch planned",
      score: 4,
      recommendedAction: "Reject the plan and regenerate it as smaller bounded changes before apply.",
    });
  } else if (input.totalActions >= 6 || input.totalNodesCreated >= 6 || input.totalEdgesCreated >= 6) {
    extraSignals.push({
      kind: "unsafe-mutation-plan",
      severity: "caution",
      evidence: "Diagram-sized mutation batch planned",
      score: 2,
      recommendedAction: "Review the generated topology before applying.",
    });
  }

  if (input.highestRisk === "high") {
    extraSignals.push({
      kind: "unsafe-mutation-plan",
      severity: "caution",
      evidence: "Mutation plan includes high-risk actions",
      score: 2,
      recommendedAction: "Review the plan carefully and reduce risk before apply.",
    });
  }

  return assessPatternSet({
    requestKind: "mutation-plan",
    text: [
      input.proposalSummary,
      input.rationale,
      ...input.warnings,
      ...input.issueDetails,
      ...input.impactDetails,
      `actions ${input.totalActions}`,
      `nodes ${input.totalNodesCreated}`,
      `edges ${input.totalEdgesCreated}`,
      `highest risk ${input.highestRisk}`,
    ].filter((value) => value.trim().length > 0).join(" · "),
    patterns: MUTATION_PLAN_PATTERNS,
    extraSignals,
  });
};
