import { describe, expect, it } from "vitest";
import {
  SqliteErrorClass,
  classifySqliteError,
  collectErrorMessages,
  isRetryable,
} from "../../../src/core/effects/sqlite-error-class";

describe("collectErrorMessages", () => {
  it("should extract message from a plain Error", () => {
    const error = new Error("database is busy");
    expect(collectErrorMessages(error)).toEqual(["database is busy"]);
  });

  it("should walk nested cause chains", () => {
    const inner = new Error("sqlite_busy");
    const outer = new Error("invoke failed");
    outer.cause = inner;
    expect(collectErrorMessages(outer)).toEqual([
      "invoke failed",
      "sqlite_busy",
    ]);
  });

  it("should handle bare string errors", () => {
    expect(collectErrorMessages("database is locked")).toEqual([
      "database is locked",
    ]);
  });

  it("should handle null/undefined gracefully", () => {
    expect(collectErrorMessages(null)).toEqual([]);
    expect(collectErrorMessages(undefined)).toEqual([]);
  });
});

describe("classifySqliteError", () => {
  it("should classify 'database is locked' as Locked", () => {
    const result = classifySqliteError(new Error("database is locked"));
    expect(result._tag).toBe("Locked");
  });

  it("should classify 'database schema is locked' as Locked", () => {
    const result = classifySqliteError(new Error("database schema is locked"));
    expect(result._tag).toBe("Locked");
  });

  it("should classify 'sqlite_locked' as Locked", () => {
    const result = classifySqliteError(new Error("sqlite_locked"));
    expect(result._tag).toBe("Locked");
  });

  it("should classify 'database is busy' as Busy", () => {
    const result = classifySqliteError(new Error("database is busy"));
    expect(result._tag).toBe("Busy");
  });

  it("should classify 'sqlite busy' as Busy", () => {
    const result = classifySqliteError(new Error("sqlite busy"));
    expect(result._tag).toBe("Busy");
  });

  it("should classify 'sqlite_busy' as Busy", () => {
    const result = classifySqliteError(new Error("sqlite_busy"));
    expect(result._tag).toBe("Busy");
  });

  it("should classify 'code: 5' as Busy", () => {
    const result = classifySqliteError(new Error("code: 5"));
    expect(result._tag).toBe("Busy");
  });

  it("should classify 'cannot start a transaction within a transaction' as TransactionState", () => {
    const result = classifySqliteError(
      new Error("cannot start a transaction within a transaction"),
    );
    expect(result._tag).toBe("TransactionState");
  });

  it("should classify 'cannot commit - no transaction is active' as TransactionState", () => {
    const result = classifySqliteError(
      new Error("cannot commit - no transaction is active"),
    );
    expect(result._tag).toBe("TransactionState");
  });

  it("should classify 'cannot rollback - no transaction is active' as TransactionState", () => {
    const result = classifySqliteError(
      new Error("cannot rollback - no transaction is active"),
    );
    expect(result._tag).toBe("TransactionState");
  });

  it("should classify unknown errors as NonRetryable", () => {
    const result = classifySqliteError(new Error("something unexpected"));
    expect(result._tag).toBe("NonRetryable");
  });

  it("should carry matched messages in the payload", () => {
    const inner = new Error("sqlite_busy");
    const outer = new Error("invoke failed");
    outer.cause = inner;
    const result = classifySqliteError(outer);
    expect(result._tag).toBe("Busy");
    expect(result.messages).toEqual(["invoke failed", "sqlite_busy"]);
  });

  it("should classify errors found in nested cause chains", () => {
    const inner = new Error("database is locked");
    const outer = new Error("command failed");
    outer.cause = inner;
    const result = classifySqliteError(outer);
    expect(result._tag).toBe("Locked");
  });

  it("should prioritize Locked over Busy when both present", () => {
    const inner = new Error("database is busy");
    const outer = new Error("database is locked");
    outer.cause = inner;
    const result = classifySqliteError(outer);
    expect(result._tag).toBe("Locked");
  });
});

describe("isRetryable", () => {
  it("should return true for Locked", () => {
    expect(isRetryable(SqliteErrorClass.Locked({ messages: [] }))).toBe(true);
  });

  it("should return true for Busy", () => {
    expect(isRetryable(SqliteErrorClass.Busy({ messages: [] }))).toBe(true);
  });

  it("should return false for TransactionState", () => {
    expect(
      isRetryable(SqliteErrorClass.TransactionState({ messages: [] })),
    ).toBe(false);
  });

  it("should return false for NonRetryable", () => {
    expect(isRetryable(SqliteErrorClass.NonRetryable({ messages: [] }))).toBe(
      false,
    );
  });
});
