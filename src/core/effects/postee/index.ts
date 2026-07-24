import {
  clearPosteeHistory,
  createPosteeCollection,
  createPosteeEnvironment,
  createPosteeRequest,
  deletePosteeCollection,
  deletePosteeCollections,
  deletePosteeEnvironment,
  deletePosteeRequest,
  getPosteeRequest,
  getPosteeRequestBody,
  insertPosteeHistory,
  listPosteeCollections,
  listPosteeEnvironments,
  listPosteeEnvironmentVariables,
  listPosteeHistory,
  listPosteeRequestHeaders,
  listPosteeRequests,
  replacePosteeRequestHeaders,
  updatePosteeCollection,
  updatePosteeEnvironment,
  updatePosteeRequest,
  upsertPosteeEnvironmentVariables,
  upsertPosteeRequestBody,
} from "../database";
import type {
  PosteeCollection,
  PosteeEnvironment,
  PosteeEnvironmentVariable,
  PosteeGraphqlRequest,
  PosteeGraphqlSchemaSnapshot,
  PosteeHistoryEntry,
  PosteeRequest,
  PosteeRequestBody,
  PosteeRequestHeader,
} from "../database";

export const PosteeCollections = {
  list: () => listPosteeCollections(),
  create: (collection: Omit<PosteeCollection, "created_at" | "updated_at">) => createPosteeCollection(collection),
  update: updatePosteeCollection,
  remove: deletePosteeCollection,
  removeMany: (ids: ReadonlyArray<string>) => deletePosteeCollections(ids),
};

export const PosteeRequests = {
  list: (collectionId: string) => listPosteeRequests(collectionId),
  get: (id: string) => getPosteeRequest(id),
  create: (request: Omit<PosteeRequest, "created_at" | "updated_at">) => createPosteeRequest(request),
  update: updatePosteeRequest,
  remove: deletePosteeRequest,
  listHeaders: (requestId: string) => listPosteeRequestHeaders(requestId),
  replaceHeaders: (requestId: string, headers: ReadonlyArray<Omit<PosteeRequestHeader, "id">>) =>
    replacePosteeRequestHeaders(requestId, headers),
  getBody: getPosteeRequestBody,
  saveBody: upsertPosteeRequestBody,
};

export const PosteeEnvironments = {
  list: () => listPosteeEnvironments(),
  create: (environment: Omit<PosteeEnvironment, "created_at" | "updated_at">) => createPosteeEnvironment(environment),
  update: updatePosteeEnvironment,
  remove: deletePosteeEnvironment,
  listVariables: (environmentId: string) => listPosteeEnvironmentVariables(environmentId),
  saveVariables: (
    environmentId: string,
    variables: ReadonlyArray<Omit<PosteeEnvironmentVariable, "id" | "created_at" | "updated_at">>,
  ) => upsertPosteeEnvironmentVariables(environmentId, variables),
};

export const PosteeHistory = {
  list: (limit?: number) => listPosteeHistory(limit),
  record: (entry: PosteeHistoryEntry) => insertPosteeHistory(entry),
  clear: () => clearPosteeHistory(),
};

export type {
  PosteeCollection,
  PosteeEnvironment,
  PosteeEnvironmentVariable,
  PosteeGraphqlRequest,
  PosteeGraphqlSchemaSnapshot,
  PosteeHistoryEntry,
  PosteeRequest,
  PosteeRequestBody,
  PosteeRequestHeader,
};

export {
  loadPosteeRequestDraft,
  type PosteeDraftHeader,
  type PosteeRequestDraft,
  savePosteeRequestDraft,
} from "./request-draft";

// Export ConfigProvider (Effect Config-based)
export {
  extractVariableNames,
  hasVariables,
  makeConfigProvider,
  makeEffectConfigProvider,
  PosteeConfigProvider,
  PosteeConfigProviderLive,
  type PosteeConfigProviderService,
  resolveTemplateSync,
} from "./config-provider";

export {
  ensureTauriRuntime,
  isTauriRuntime,
  listenLoadTestComplete,
  listenLoadTestError,
  listenLoadTestProgress,
  type LoadTestConfigInput,
  type LoadTestProgress,
  startLoadTest,
} from "./load-test";

export {
  completeContentTypeHeaders,
  type EffectiveRequestHeader,
  evaluateRequestSemantics,
  getHttpMethodPolicy,
  hasRequestContent,
  type HttpMethodPolicy,
  type RequestContent,
  type RequestSemanticsIssue,
  serializeRequestBody,
} from "./http-method-policy";

export { type GraphqlDraft, type GraphqlDraftIssue, type GraphqlPreparation, prepareGraphqlDraft } from "./graphql";

export {
  fingerprintGraphqlSchemaContext,
  type GraphqlSchemaContext,
  GraphqlSchemaError,
  type GraphqlSchemaErrorCategory,
  loadGraphqlSchemaSnapshot,
  refreshGraphqlSchema,
} from "./graphql-schema";
