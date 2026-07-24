import { Effect } from "effect";
import {
  createPosteeRequest,
  deletePosteeScratchDraft,
  listPosteeScratchDrafts,
  type PosteeGraphqlRequest,
  type PosteeRequest,
  type PosteeRequestBody,
  type PosteeScratchDraftRow,
  setPosteeScratchDraftOpen,
  upsertPosteeScratchDraft,
} from "../database";
import { type DatabaseError, DatabaseService } from "../database.base";
import {
  persistPosteeRequestDraftInTransaction,
  type PosteeDraftHeader,
  type PosteeRequestDraft,
} from "./request-draft";
import type { HttpMethod } from "./types";

export interface PosteeScratchDraft {
  readonly id: string;
  readonly name: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly description: string | null;
  readonly headers: ReadonlyArray<PosteeDraftHeader>;
  readonly body: Omit<PosteeRequestBody, "request_id">;
  readonly graphql: Omit<PosteeGraphqlRequest, "request_id"> | null;
  readonly environmentId: string | null;
  readonly tabOrder: number;
  readonly isOpen: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

const parseHeaders = (headersJson: string): ReadonlyArray<PosteeDraftHeader> => {
  try {
    const value: unknown = JSON.parse(headersJson);
    return Array.isArray(value) ? value as ReadonlyArray<PosteeDraftHeader> : [];
  } catch {
    return [];
  }
};

export const serialisePosteeScratchDraft = (draft: PosteeScratchDraft): PosteeScratchDraftRow => ({
  id: draft.id,
  name: draft.name,
  method: draft.method,
  url: draft.url,
  description: draft.description,
  headers_json: JSON.stringify(draft.headers),
  body_mode: draft.body.mode,
  body_raw: draft.body.raw,
  form_values: draft.body.form_values,
  graphql_document: draft.graphql?.document ?? null,
  graphql_variables_json: draft.graphql?.variables_json ?? null,
  graphql_operation_name: draft.graphql?.operation_name ?? null,
  environment_id: draft.environmentId,
  tab_order: draft.tabOrder,
  is_open: draft.isOpen ? 1 : 0,
  created_at: draft.createdAt,
  updated_at: draft.updatedAt,
});

export const deserialisePosteeScratchDraft = (row: PosteeScratchDraftRow): PosteeScratchDraft => ({
  id: row.id,
  name: row.name,
  method: row.method as HttpMethod,
  url: row.url,
  description: row.description,
  headers: parseHeaders(row.headers_json),
  body: {
    mode: row.body_mode,
    raw: row.body_raw,
    form_values: row.form_values,
  },
  graphql: row.graphql_document === null
    ? null
    : {
      document: row.graphql_document,
      variables_json: row.graphql_variables_json ?? "{}",
      operation_name: row.graphql_operation_name,
    },
  environmentId: row.environment_id,
  tabOrder: row.tab_order,
  isOpen: row.is_open === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const newPosteeScratchDraft = (input: {
  readonly id: string;
  readonly tabOrder: number;
  readonly now: number;
}): PosteeScratchDraft => ({
  id: input.id,
  name: "Untitled request",
  method: "GET",
  url: "",
  description: null,
  headers: [],
  body: { mode: "json", raw: "{}", form_values: null },
  graphql: null,
  environmentId: null,
  tabOrder: input.tabOrder,
  isOpen: true,
  createdAt: input.now,
  updatedAt: input.now,
});

/**
 * Whether a draft still matches a freshly created one.
 *
 * A scratch is opened and persisted on every launch, so an untouched draft is
 * indistinguishable from one worth keeping — which is how "Reopen drafts" fills
 * with identical `Untitled request` entries. Identity, tab position, open state,
 * and timestamps are excluded: they change without the user authoring anything.
 */
export const isPristinePosteeScratchDraft = (draft: PosteeScratchDraft): boolean => {
  const reference = newPosteeScratchDraft({ id: draft.id, tabOrder: draft.tabOrder, now: draft.createdAt });
  return draft.name === reference.name
    && draft.method === reference.method
    && draft.url === reference.url
    && draft.description === reference.description
    && draft.headers.length === 0
    && draft.body.mode === reference.body.mode
    // A body that was cleared persists as null; both mean "nothing authored".
    && (draft.body.raw === null || draft.body.raw === reference.body.raw)
    && draft.body.form_values === reference.body.form_values
    && draft.graphql === null
    && draft.environmentId === reference.environmentId;
};

export const loadPosteeScratchDrafts = (openOnly?: boolean) =>
  Effect.map(listPosteeScratchDrafts(openOnly), (rows) => rows.map(deserialisePosteeScratchDraft));

export const savePosteeScratchDraft = (draft: PosteeScratchDraft) =>
  Effect.map(upsertPosteeScratchDraft(serialisePosteeScratchDraft(draft)), deserialisePosteeScratchDraft);

export const closePosteeScratchDraft = (id: string) => setPosteeScratchDraftOpen(id, false);

export const reopenPosteeScratchDraft = (id: string) => setPosteeScratchDraftOpen(id, true);

export const discardPosteeScratchDraft = (id: string) => deletePosteeScratchDraft(id);

export const promotePosteeScratchDraft = (input: {
  readonly scratch: PosteeScratchDraft;
  readonly collectionId: string;
  readonly requestId: string;
}): Effect.Effect<PosteeRequestDraft, DatabaseError, DatabaseService> =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    return yield* service.transaction(
      Effect.gen(function*() {
        const request = yield* createPosteeRequest({
          id: input.requestId,
          collection_id: input.collectionId,
          name: input.scratch.name,
          method: input.scratch.method,
          url: input.scratch.url,
          description: input.scratch.description,
          favorite: 0,
          sort_order: 0,
        });
        const draft: PosteeRequestDraft = {
          request,
          headers: input.scratch.headers,
          body: { ...input.scratch.body, request_id: request.id },
          graphql: input.scratch.graphql === null
            ? null
            : { ...input.scratch.graphql, request_id: request.id },
        };
        const saved = yield* persistPosteeRequestDraftInTransaction(draft);
        yield* deletePosteeScratchDraft(input.scratch.id);
        return saved;
      }),
    );
  });

/**
 * Presents a scratch as a saved request.
 *
 * A scratch has no collection and no persisted request row, so `collection_id` is
 * empty and its own id stands in — enough for anything that reads a request
 * without needing it to exist in `postee_requests`.
 */
export const scratchAsRequest = (scratch: PosteeScratchDraft): PosteeRequest => ({
  id: scratch.id,
  collection_id: "",
  name: scratch.name,
  method: scratch.method,
  url: scratch.url,
  description: scratch.description,
  favorite: 0,
  sort_order: scratch.tabOrder,
  created_at: scratch.createdAt,
  updated_at: scratch.updatedAt,
});

/** Presents a scratch as a request draft, so both kinds of editor share one shape. */
export const scratchAsRequestDraft = (scratch: PosteeScratchDraft): PosteeRequestDraft => ({
  request: scratchAsRequest(scratch),
  headers: scratch.headers,
  body: { ...scratch.body, request_id: scratch.id },
  graphql: scratch.graphql === null ? null : { ...scratch.graphql, request_id: scratch.id },
});
