import { Effect } from "effect";
import {
  type DatabaseError,
  DatabaseService,
  getPosteeRequestBody,
  listPosteeRequestHeaders,
  replacePosteeRequestHeaders,
  updatePosteeRequest,
  upsertPosteeRequestBody,
} from "../database";
import type { PosteeRequest, PosteeRequestBody, PosteeRequestHeader } from "../database";

export interface PosteeDraftHeader {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly enabled: boolean;
}

export interface PosteeRequestDraft {
  readonly request: PosteeRequest;
  readonly headers: ReadonlyArray<PosteeDraftHeader>;
  readonly body: PosteeRequestBody;
}

const toDraftHeader = (header: PosteeRequestHeader): PosteeDraftHeader => ({
  id: String(header.id),
  key: header.key,
  value: header.value ?? "",
  enabled: header.is_enabled === 1,
});

const defaultBody = (requestId: string): PosteeRequestBody => ({
  request_id: requestId,
  mode: "json",
  raw: "{}",
  form_values: null,
});

export const loadPosteeRequestDraft = (
  request: PosteeRequest,
): Effect.Effect<PosteeRequestDraft, DatabaseError, DatabaseService> =>
  Effect.gen(function*() {
    const headers = yield* listPosteeRequestHeaders(request.id);
    const body = yield* getPosteeRequestBody(request.id);

    return {
      request,
      headers: headers.map(toDraftHeader),
      body: body ?? defaultBody(request.id),
    };
  });

export const savePosteeRequestDraft = (
  draft: PosteeRequestDraft,
): Effect.Effect<PosteeRequestDraft, DatabaseError, DatabaseService> =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const acceptedHeaders = draft.headers.filter(
      (header) => header.key.trim().length > 0,
    );
    const persistedHeaders = acceptedHeaders
      .map((header, sortOrder) => ({
        request_id: draft.request.id,
        key: header.key,
        value: header.value,
        is_enabled: header.enabled ? 1 : 0,
        sort_order: sortOrder,
      }));
    const body = { ...draft.body, request_id: draft.request.id };

    return yield* service.transaction(
      Effect.gen(function*() {
        const request = yield* updatePosteeRequest(draft.request);
        yield* replacePosteeRequestHeaders(draft.request.id, persistedHeaders);
        yield* upsertPosteeRequestBody(body);

        return {
          request,
          headers: acceptedHeaders,
          body,
        };
      }),
    );
  });
