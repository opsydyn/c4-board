/**
 * JSON Search Effects - Functional Core
 *
 * Pure search logic using Fuse.js for fuzzy searching of JSON content.
 * This is the functional core - contains zero I/O operations.
 */

import Fuse, { type FuseResultMatch, type IFuseOptions } from "fuse.js";

/**
 * Represents a line in JSON content with its metadata
 */
export interface JsonLine {
  lineNumber: number;
  content: string;
  trimmedContent: string;
  indentLevel: number;
}

/**
 * Search result with line number and score
 */
export interface JsonSearchResult {
  line: JsonLine;
  score: number;
  matches?: readonly FuseResultMatch[] | undefined;
}

/**
 * Fuse.js configuration for searching JSON lines
 */
const fuseOptions: IFuseOptions<JsonLine> = {
  keys: [
    { name: "trimmedContent", weight: 1.0 },
  ],
  threshold: 0.4, // Slightly more permissive for JSON content
  includeScore: true,
  includeMatches: true, // Include match positions for highlighting
  minMatchCharLength: 1,
  shouldSort: true,
  ignoreLocation: true,
};

/**
 * Parse JSON string into searchable lines
 * Pure function - no side effects
 */
export function parseJsonLines(jsonString: string): JsonLine[] {
  const lines = jsonString.split("\n");

  return lines.map((content, index) => {
    const trimmedContent = content.trim();
    const indentLevel = content.length - content.trimStart().length;

    return {
      lineNumber: index + 1, // Monaco uses 1-based line numbers
      content,
      trimmedContent,
      indentLevel,
    };
  }).filter(line => line.trimmedContent.length > 0); // Filter out empty lines
}

/**
 * Create a Fuse.js instance for searching JSON lines
 * Pure function - no side effects
 */
export function createJsonSearchIndex(lines: JsonLine[]): Fuse<JsonLine> {
  return new Fuse(lines, fuseOptions);
}

/**
 * Search JSON content using Fuse.js fuzzy search
 * Pure function - takes query and JSON string, returns results
 */
export function searchJsonContent(
  query: string,
  jsonString: string,
  maxResults = 20,
): JsonSearchResult[] {
  // Empty query returns no results
  if (!query || query.trim().length < 1) {
    return [];
  }

  const lines = parseJsonLines(jsonString);
  const fuse = createJsonSearchIndex(lines);
  const results = fuse.search(query, { limit: maxResults });

  return results.map((result) => ({
    line: result.item,
    score: result.score ?? 0,
    matches: result.matches,
  }));
}

/**
 * Highlight matched text in a line
 * Returns the line content with <mark> tags around matches
 */
export function highlightMatches(
  content: string,
  matches?: readonly FuseResultMatch[],
): string {
  if (!matches || matches.length === 0) {
    return content;
  }

  // Get all match indices
  const indices: Array<[number, number]> = [];
  for (const match of matches) {
    if (match.indices) {
      indices.push(...match.indices);
    }
  }

  // Sort and merge overlapping indices
  const sortedIndices = indices.sort((a, b) => a[0] - b[0]);
  const mergedIndices: Array<[number, number]> = [];

  for (const [start, end] of sortedIndices) {
    if (mergedIndices.length === 0) {
      mergedIndices.push([start, end]);
    } else {
      const last = mergedIndices[mergedIndices.length - 1];
      if (last && start <= last[1] + 1) {
        // Merge overlapping or adjacent ranges
        last[1] = Math.max(last[1], end);
      } else {
        mergedIndices.push([start, end]);
      }
    }
  }

  // Build highlighted string
  let result = "";
  let lastIndex = 0;

  for (const [start, end] of mergedIndices) {
    result += content.slice(lastIndex, start);
    result += `<mark>${content.slice(start, end + 1)}</mark>`;
    lastIndex = end + 1;
  }

  result += content.slice(lastIndex);

  return result;
}
