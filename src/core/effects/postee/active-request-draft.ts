/**
 * Which request draft the workspace is currently editing.
 *
 * A saved request and a scratch are edited through the same shape, but only the
 * saved one had a draft resolved for it. Anything gated on that draft — the load
 * test panel among them — was therefore unreachable whenever a scratch was
 * selected, which is the default in a workspace with no collections.
 */

import type { PosteeRequest } from "../database";
import type { PosteeRequestDraft } from "./request-draft";
import { type PosteeScratchDraft, scratchAsRequestDraft } from "./scratch-draft";

export const resolveActiveRequestDraft = (
  activeSavedRequest: PosteeRequest | null,
  requestDrafts: Readonly<Record<string, PosteeRequestDraft>>,
  activeScratchDraft: PosteeScratchDraft | null,
): PosteeRequestDraft | null => {
  if (activeSavedRequest) return requestDrafts[activeSavedRequest.id] ?? null;
  return activeScratchDraft ? scratchAsRequestDraft(activeScratchDraft) : null;
};
