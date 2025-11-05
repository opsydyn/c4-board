/**
 * Tests for JSON Search Effects
 */

import { describe, it, expect } from "vitest";
import type { FuseResultMatch } from "fuse.js";
import {
	parseJsonLines,
	searchJsonContent,
	highlightMatches,
} from "./json-search";

describe("parseJsonLines", () => {
	it("should parse JSON string into lines with metadata", () => {
		const json = `{
  "name": "Alice",
  "age": 30
}`;

		const lines = parseJsonLines(json);

		expect(lines).toHaveLength(4);
		expect(lines[0]).toEqual({
			lineNumber: 1,
			content: "{",
			trimmedContent: "{",
			indentLevel: 0,
		});
		expect(lines[1]).toEqual({
			lineNumber: 2,
			content: '  "name": "Alice",',
			trimmedContent: '"name": "Alice",',
			indentLevel: 2,
		});
	});

	it("should filter out empty lines", () => {
		const json = `{
  "name": "Alice",

  "age": 30
}`;

		const lines = parseJsonLines(json);

		// Should only have 4 lines (excluding the empty line)
		expect(lines).toHaveLength(4);
		expect(lines.every((line) => line.trimmedContent.length > 0)).toBe(true);
	});
});

describe("searchJsonContent", () => {
	const sampleJson = `{
  "users": [
    {
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "role": "admin"
    },
    {
      "name": "Bob Smith",
      "email": "bob@example.com",
      "role": "user"
    }
  ],
  "settings": {
    "theme": "dark",
    "notifications": true
  }
}`;

	it("should find exact matches", () => {
		const results = searchJsonContent("Alice", sampleJson);

		expect(results.length).toBeGreaterThan(0);
		// Should find at least one result containing "Alice" (case-insensitive)
		const hasAlice = results.some((r) =>
			r.line.trimmedContent.toLowerCase().includes("alice"),
		);
		expect(hasAlice).toBe(true);
	});

	it("should perform fuzzy search", () => {
		const results = searchJsonContent("alce", sampleJson);

		// Fuzzy search should still find "Alice"
		expect(results.length).toBeGreaterThan(0);
		const hasAlice = results.some((r) =>
			r.line.trimmedContent.toLowerCase().includes("alice"),
		);
		expect(hasAlice).toBe(true);
	});

	it("should return empty array for empty query", () => {
		const results = searchJsonContent("", sampleJson);

		expect(results).toEqual([]);
	});

	it("should limit results to maxResults", () => {
		const results = searchJsonContent("e", sampleJson, 3);

		expect(results.length).toBeLessThanOrEqual(3);
	});

	it("should include line numbers", () => {
		const results = searchJsonContent("theme", sampleJson);

		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.line.lineNumber).toBeGreaterThan(0);
	});

	it("should sort results by relevance (score)", () => {
		const results = searchJsonContent("user", sampleJson);

		expect(results.length).toBeGreaterThan(0);

		// Scores should be in ascending order (lower is better in Fuse.js)
		for (let i = 1; i < results.length; i++) {
			expect(results[i]!.score).toBeGreaterThanOrEqual(results[i - 1]!.score);
		}
	});
});

describe("highlightMatches", () => {
	it("should wrap matched text in <mark> tags", () => {
		const content = "Hello World";
		const matches: Partial<FuseResultMatch>[] = [
			{
				indices: [[0, 4]],
			},
		];

		const highlighted = highlightMatches(content, matches as FuseResultMatch[]);

		expect(highlighted).toBe("<mark>Hello</mark> World");
	});

	it("should handle multiple matches", () => {
		const content = "Hello World Hello";
		const matches: Partial<FuseResultMatch>[] = [
			{
				indices: [
					[0, 4],
					[12, 16],
				],
			},
		];

		const highlighted = highlightMatches(content, matches as FuseResultMatch[]);

		expect(highlighted).toBe("<mark>Hello</mark> World <mark>Hello</mark>");
	});

	it("should merge overlapping matches", () => {
		const content = "Hello World";
		const matches: Partial<FuseResultMatch>[] = [
			{
				indices: [
					[0, 4],
					[3, 7],
				],
			},
		];

		const highlighted = highlightMatches(content, matches as FuseResultMatch[]);

		// Overlapping [0,4] and [3,7] should merge to [0,7]
		expect(highlighted).toBe("<mark>Hello Wo</mark>rld");
	});

	it("should return original content if no matches", () => {
		const content = "Hello World";

		const highlighted = highlightMatches(content, undefined);

		expect(highlighted).toBe("Hello World");
	});

	it("should handle adjacent matches", () => {
		const content = "HelloWorld";
		const matches: Partial<FuseResultMatch>[] = [
			{
				indices: [
					[0, 4],
					[5, 9],
				],
			},
		];

		const highlighted = highlightMatches(content, matches as FuseResultMatch[]);

		// Adjacent [0,4] and [5,9] should merge
		expect(highlighted).toBe("<mark>HelloWorld</mark>");
	});
});
