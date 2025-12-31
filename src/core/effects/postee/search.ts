/**
 * Postee Search Effects - Functional Core
 *
 * Pure search logic using Fuse.js for fuzzy searching of collections and requests.
 * This is the functional core - contains zero I/O operations.
 */

import Fuse, { type IFuseOptions } from "fuse.js";
import type { PosteeCollection, PosteeRequest } from "../database.postee";

/**
 * Unified search item representing either a collection or request
 */
export interface SearchItem {
	type: "collection" | "request";
	id: string;
	name: string;
	method?: string; // Only for requests
	url?: string; // Only for requests
	collectionId?: string; // Only for requests
	collectionName?: string; // Only for requests
}

/**
 * Search result with Fuse.js score
 */
export interface PosteeSearchResult {
	item: SearchItem;
	score: number;
}

/**
 * Fuse.js configuration for searching collections and requests
 */
const fuseOptions: IFuseOptions<SearchItem> = {
	keys: [
		{ name: "name", weight: 2.0 }, // Highest priority
		{ name: "method", weight: 1.5 }, // HTTP method
		{ name: "url", weight: 1.2 }, // Request URL
		{ name: "collectionName", weight: 0.8 }, // Parent collection
		{ name: "type", weight: 0.5 }, // Lowest priority
	],
	threshold: 0.3, // 0 = perfect match, 1 = match anything
	includeScore: true, // Include match score for sorting
	minMatchCharLength: 2, // Minimum characters to trigger search
	shouldSort: true, // Sort by relevance
	ignoreLocation: true, // Don't care where in the string the match is
};

/**
 * Convert collections and requests to searchable items
 * Pure function - no side effects
 */
export function createSearchItems(
	collections: PosteeCollection[],
	requestsByCollection: Record<string, PosteeRequest[]>,
): SearchItem[] {
	const items: SearchItem[] = [];

	// Add collections
	for (const collection of collections) {
		items.push({
			type: "collection",
			id: collection.id,
			name: collection.name,
		});
	}

	// Add requests
	for (const collection of collections) {
		const requests = requestsByCollection[collection.id] ?? [];
		for (const request of requests) {
			items.push({
				type: "request",
				id: request.id,
				name: request.name,
				method: request.method,
				url: request.url,
				collectionId: collection.id,
				collectionName: collection.name,
			});
		}
	}

	return items;
}

/**
 * Create a Fuse.js instance for searching collections/requests
 * Pure function - no side effects
 */
export function createPosteeSearchIndex(items: SearchItem[]): Fuse<SearchItem> {
	return new Fuse(items, fuseOptions);
}

/**
 * Search collections and requests using Fuse.js fuzzy search
 * Pure function - takes query and data, returns results
 */
export function searchPostee(
	query: string,
	collections: PosteeCollection[],
	requestsByCollection: Record<string, PosteeRequest[]>,
	maxResults = 10,
): PosteeSearchResult[] {
	// Empty query returns no results
	if (!query || query.trim().length < 2) {
		return [];
	}

	const items = createSearchItems(collections, requestsByCollection);
	const fuse = createPosteeSearchIndex(items);
	const results = fuse.search(query, { limit: maxResults });

	return results.map((result) => ({
		item: result.item,
		score: result.score ?? 0,
	}));
}
