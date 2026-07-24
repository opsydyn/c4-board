/**
 * Response header entries — ADR-010.
 *
 * Headers travel as entries rather than a `Record` so repeated field lines
 * survive; `Set-Cookie` is the case that matters. Field names are
 * case-insensitive (RFC 9110 §5.1), so lookups fold case rather than assuming a
 * canonical spelling.
 */

import { Option } from "effect";

export type HeaderEntries = ReadonlyArray<readonly [string, string]>;

const parseJson = Option.liftThrowable((text: string) => JSON.parse(text) as unknown);

const isPair = (value: unknown): value is [string, string] =>
  Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "string";

/**
 * Reads header entries from a persisted `response_headers` value.
 *
 * Rows written before headers became entries hold a JSON object, whose repeated
 * fields were already collapsed. Both shapes are accepted so old history renders
 * as headers rather than as an indexed array.
 */
export const headerEntriesFromStored = (stored: string | null | undefined): HeaderEntries => {
  if (!stored) return [];
  return Option.match(parseJson(stored), {
    onNone: () => [],
    onSome: (payload) => {
      if (Array.isArray(payload)) return payload.filter(isPair);
      if (payload !== null && typeof payload === "object") {
        return Object.entries(payload as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string");
      }
      return [];
    },
  });
};

/** The first value for a field name, matched case-insensitively. */
export const findHeader = (entries: HeaderEntries, name: string): Option.Option<string> => {
  const wanted = name.toLowerCase();
  return Option.fromNullable(entries.find(([key]) => key.toLowerCase() === wanted)?.[1]);
};

/** Renders entries as a header block, the form these are conventionally read in. */
export const formatHeaderBlock = (entries: HeaderEntries): string =>
  entries.map(([key, value]) => `${key}: ${value}`).join("\n");
