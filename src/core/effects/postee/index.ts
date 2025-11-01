import {
	createPosteeCollection,
	createPosteeEnvironment,
	createPosteeRequest,
	deletePosteeCollection,
	deletePosteeEnvironment,
	deletePosteeRequest,
	getPosteeRequest,
	getPosteeRequestBody,
	listPosteeCollections,
	listPosteeEnvironmentVariables,
	listPosteeEnvironments,
	listPosteeHistory,
	listPosteeRequestHeaders,
	listPosteeRequests,
	replacePosteeRequestHeaders,
	upsertPosteeRequestBody,
	upsertPosteeEnvironmentVariables,
	updatePosteeCollection,
	updatePosteeEnvironment,
	updatePosteeRequest,
	insertPosteeHistory,
	clearPosteeHistory,
} from "../database";
import type {
	PosteeCollection,
	PosteeEnvironment,
	PosteeEnvironmentVariable,
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
};

export const PosteeRequests = {
	list: (collectionId: string) => listPosteeRequests(collectionId),
	get: (id: string) => getPosteeRequest(id),
	create: (request: Omit<PosteeRequest, "created_at" | "updated_at">) => createPosteeRequest(request),
	update: updatePosteeRequest,
	remove: deletePosteeRequest,
	listHeaders: (requestId: string) => listPosteeRequestHeaders(requestId),
	replaceHeaders: (requestId: string, headers: ReadonlyArray<Omit<PosteeRequestHeader, "id">>) => replacePosteeRequestHeaders(requestId, headers),
	getBody: getPosteeRequestBody,
	saveBody: upsertPosteeRequestBody,
};

export const PosteeEnvironments = {
	list: () => listPosteeEnvironments(),
	create: (environment: Omit<PosteeEnvironment, "created_at" | "updated_at">) => createPosteeEnvironment(environment),
	update: updatePosteeEnvironment,
	remove: deletePosteeEnvironment,
	listVariables: (environmentId: string) => listPosteeEnvironmentVariables(environmentId),
	saveVariables: (environmentId: string, variables: ReadonlyArray<Omit<PosteeEnvironmentVariable, "id" | "created_at" | "updated_at">>) =>
		upsertPosteeEnvironmentVariables(environmentId, variables),
};

export const PosteeHistory = {
	list: (limit?: number) => listPosteeHistory(limit),
	record: (entry: PosteeHistoryEntry) => insertPosteeHistory(entry),
	clear: () => clearPosteeHistory(),
};

export type {
	PosteeCollection,
	PosteeRequest,
	PosteeRequestBody,
	PosteeRequestHeader,
	PosteeEnvironment,
	PosteeEnvironmentVariable,
	PosteeHistoryEntry,
};
