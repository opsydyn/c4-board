import { Effect } from "effect";
import {
  type DatabaseError,
  DatabaseService,
  deletePosteeGraphqlRequest,
  getPosteeGraphqlRequest,
  getPosteeRequestBody,
  listPosteeRequestHeaders,
  replacePosteeRequestHeaders,
  updatePosteeRequest,
  upsertPosteeGraphqlRequest,
  upsertPosteeRequestBody,
} from "../database";
import type { PosteeGraphqlRequest, PosteeRequest, PosteeRequestBody, PosteeRequestHeader } from "../database";
import { graphqlProtocolHeaders, prepareGraphqlDraft } from "./graphql";
import type { GraphqlDraftIssue } from "./graphql";
import { bodyModeToSumType, type RequestBody, type RequestBodyMode } from "./types";

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
  readonly graphql: PosteeGraphqlRequest | null;
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

const graphqlProtocolHeaderNames = new Set(
  graphqlProtocolHeaders.map((header) => header.key.toLowerCase()),
);

export const preparePosteeDraftBody = (
  draft: PosteeRequestDraft,
): Effect.Effect<RequestBody, GraphqlDraftIssue> => {
  if (draft.body.mode !== "graphql") {
    return Effect.succeed(
      bodyModeToSumType(
        draft.body.mode as Exclude<RequestBodyMode, "graphql">,
        draft.body.raw,
        draft.body.form_values,
      ),
    );
  }
  if (draft.request.method !== "POST") {
    return Effect.fail("GraphQL requests require POST.");
  }
  if (draft.graphql === null) {
    return Effect.fail("GraphQL requires an operation document.");
  }

  const preparation = prepareGraphqlDraft({
    document: draft.graphql.document,
    variablesJson: draft.graphql.variables_json,
    operationName: draft.graphql.operation_name,
  });
  return preparation.issue === null && preparation.body !== null
    ? Effect.succeed(preparation.body)
    : Effect.fail(preparation.issue ?? "GraphQL document is invalid.");
};

export const preparePosteeDraftHeaders = (
  draft: PosteeRequestDraft,
): ReadonlyArray<PosteeDraftHeader> => {
  const enabledHeaders = draft.headers.filter(
    (header) => header.enabled && header.key.trim().length > 0,
  );
  if (draft.body.mode !== "graphql") {
    return enabledHeaders;
  }
  return [
    ...enabledHeaders.filter(
      (header) => !graphqlProtocolHeaderNames.has(header.key.trim().toLowerCase()),
    ),
    ...graphqlProtocolHeaders.map((header) => ({
      id: `graphql-${header.key.toLowerCase()}`,
      key: header.key,
      value: header.value,
      enabled: true,
    })),
  ];
};

export const loadPosteeRequestDraft = (
  request: PosteeRequest,
): Effect.Effect<PosteeRequestDraft, DatabaseError, DatabaseService> =>
  Effect.gen(function*() {
    const headers = yield* listPosteeRequestHeaders(request.id);
    const body = yield* getPosteeRequestBody(request.id);
    const graphql = yield* getPosteeGraphqlRequest(request.id);

    return {
      request,
      headers: headers.map(toDraftHeader),
      body: body ?? defaultBody(request.id),
      graphql,
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
        if (body.mode === "graphql" && draft.graphql !== null) {
          yield* upsertPosteeGraphqlRequest({
            ...draft.graphql,
            request_id: draft.request.id,
          });
        } else {
          yield* deletePosteeGraphqlRequest(draft.request.id);
        }

        return {
          request,
          headers: acceptedHeaders,
          body,
          graphql: body.mode === "graphql" && draft.graphql !== null
            ? { ...draft.graphql, request_id: draft.request.id }
            : null,
        };
      }),
    );
  });
