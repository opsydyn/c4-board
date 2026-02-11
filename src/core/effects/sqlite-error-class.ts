import { Data, Match } from "effect";

// ---------------------------------------------------------------------------
// TaggedEnum: SQLite error classification
// ---------------------------------------------------------------------------

export type SqliteErrorClass = Data.TaggedEnum<{
  Locked: { readonly messages: readonly string[] };
  Busy: { readonly messages: readonly string[] };
  TransactionState: { readonly messages: readonly string[] };
  NonRetryable: { readonly messages: readonly string[] };
}>;

export const SqliteErrorClass = Data.taggedEnum<SqliteErrorClass>();

// ---------------------------------------------------------------------------
// Error message extraction (walks nested cause chains)
// ---------------------------------------------------------------------------

export const collectErrorMessages = (error: unknown): string[] => {
  const messages: string[] = [];
  const visited = new Set<unknown>();
  let cursor: unknown = error;

  while (
    cursor !== null
    && cursor !== undefined
    && (typeof cursor === "object" || typeof cursor === "function")
    && !visited.has(cursor)
  ) {
    visited.add(cursor);

    if ("message" in cursor && typeof cursor.message === "string") {
      messages.push(cursor.message.toLowerCase());
    }

    if ("cause" in cursor) {
      cursor = cursor.cause;
      continue;
    }

    break;
  }

  if (messages.length === 0 && typeof error === "string") {
    messages.push(error.toLowerCase());
  }

  return messages;
};

// ---------------------------------------------------------------------------
// String-match predicates (applied to lowercased message arrays)
// ---------------------------------------------------------------------------

const LOCKED_PATTERNS = [
  "database is locked",
  "database schema is locked",
  "sqlite_locked",
] as const;

const BUSY_PATTERNS = [
  "database is busy",
  "sqlite busy",
  "sqlite_busy",
  "code: 5",
] as const;

const TRANSACTION_STATE_PATTERNS = [
  "cannot start a transaction within a transaction",
  "cannot commit - no transaction is active",
  "cannot rollback - no transaction is active",
] as const;

const matchesAny = (
  messages: readonly string[],
  patterns: readonly string[],
): boolean => messages.some((msg) => patterns.some((pattern) => msg.includes(pattern)));

// ---------------------------------------------------------------------------
// Classification (pure function)
// ---------------------------------------------------------------------------

export const classifySqliteError = (error: unknown): SqliteErrorClass => {
  const messages = collectErrorMessages(error);

  if (matchesAny(messages, LOCKED_PATTERNS)) {
    return SqliteErrorClass.Locked({ messages });
  }

  if (matchesAny(messages, BUSY_PATTERNS)) {
    return SqliteErrorClass.Busy({ messages });
  }

  if (matchesAny(messages, TRANSACTION_STATE_PATTERNS)) {
    return SqliteErrorClass.TransactionState({ messages });
  }

  return SqliteErrorClass.NonRetryable({ messages });
};

// ---------------------------------------------------------------------------
// Retryable predicate (exhaustive match)
// ---------------------------------------------------------------------------

export const isRetryable = (cls: SqliteErrorClass): boolean =>
  Match.value(cls).pipe(
    Match.tag("Locked", () => true),
    Match.tag("Busy", () => true),
    Match.tag("TransactionState", () => false),
    Match.tag("NonRetryable", () => false),
    Match.exhaustive,
  );
