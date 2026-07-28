import type { RigUsageMetadata } from "@/core/effects/ai-agent.runtime";

/**
 * The usage envelope a provider that reports nothing produces.
 *
 * Rig 0.40 makes usage required on every command response, so fixtures that are
 * not about token accounting still need one. Zeros say "this run reported no
 * usage" — the same thing the runtime emits — rather than inventing a number
 * that a later budget assertion could read as real spend.
 */
export const ZERO_RIG_USAGE: RigUsageMetadata = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  toolUsePromptTokens: 0,
  reasoningTokens: 0,
};
