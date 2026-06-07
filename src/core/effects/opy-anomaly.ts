export type OpyAnomalyRequestKind = "chat" | "review" | "proposal" | "action";

export type OpyAnomalySignalKind =
  | "prompt-injection"
  | "secret-exfiltration"
  | "policy-evasion"
  | "destructive-mutation";

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

export const assessOpyRequestAnomaly = (input: {
  readonly requestKind: OpyAnomalyRequestKind;
  readonly text: string;
}): OpyAnomalyAssessment => {
  const normalizedText = input.text.trim().replace(/\s+/g, " ");
  if (normalizedText.length === 0) {
    return {
      requestKind: input.requestKind,
      severity: "none",
      blocked: false,
      score: 0,
      summary: "No anomaly signals detected.",
      recommendedAction: "Continue with the current OPY request.",
      signals: [],
    };
  }

  const matchedPatterns = ALL_PATTERNS.filter((pattern) =>
    pattern.when({
      normalizedText,
      requestKind: input.requestKind,
    })
  );
  const signals = dedupeSignals(
    matchedPatterns.map((pattern) => ({
      kind: pattern.kind,
      severity: pattern.severity,
      evidence: pattern.evidence,
    })),
  );
  const score = matchedPatterns.reduce((sum, pattern) => sum + pattern.score, 0);
  const blocked = matchedPatterns.some((pattern) => pattern.severity === "critical");
  const severity: OpyAnomalySeverity = blocked
    ? "critical"
    : matchedPatterns.some((pattern) => pattern.severity === "caution")
    ? "caution"
    : "none";

  return {
    requestKind: input.requestKind,
    severity,
    blocked,
    score,
    summary: buildSummary(input.requestKind, severity, signals),
    recommendedAction: buildRecommendedAction(severity, matchedPatterns),
    signals,
  };
};
