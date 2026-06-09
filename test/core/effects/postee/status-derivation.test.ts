import type { PosteeHistoryEntry } from "@/core/effects/database.postee";
import { deriveRequestStatuses } from "@/core/effects/postee/status-derivation";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("deriveRequestStatuses", () => {
  it("should mark request as error when response status >= 400", async () => {
    // Arrange: Create test history with error status
    const history: PosteeHistoryEntry[] = [
      {
        id: "hist-1",
        request_id: "req-1",
        request_snapshot: "{}",
        response_status: 404,
        response_time_ms: 100,
        response_size_bytes: 1024,
        response_body: "Not Found",
        response_headers: "{}",
        error_message: null,
        executed_at: Date.now(),
      },
    ];

    // Act
    const result = await Effect.runPromise(deriveRequestStatuses(history));

    // Assert: Check tagged enum using _tag property
    expect(result.get("req-1")?._tag).toBe("Error");
  });

  it("should mark request as error when error_message exists", async () => {
    // Arrange
    const history: PosteeHistoryEntry[] = [
      {
        id: "hist-2",
        request_id: "req-2",
        request_snapshot: "{}",
        response_status: 200,
        response_time_ms: 100,
        response_size_bytes: 1024,
        response_body: "{}",
        response_headers: "{}",
        error_message: "Network timeout",
        executed_at: Date.now(),
      },
    ];

    // Act
    const result = await Effect.runPromise(deriveRequestStatuses(history));

    // Assert: Check tagged enum using _tag property
    expect(result.get("req-2")?._tag).toBe("Error");
  });

  it("should mark request as success when response status < 400", async () => {
    // Arrange
    const history: PosteeHistoryEntry[] = [
      {
        id: "hist-3",
        request_id: "req-3",
        request_snapshot: "{}",
        response_status: 200,
        response_time_ms: 100,
        response_size_bytes: 1024,
        response_body: "{}",
        response_headers: "{}",
        error_message: null,
        executed_at: Date.now(),
      },
    ];

    // Act
    const result = await Effect.runPromise(deriveRequestStatuses(history));

    // Assert: Check tagged enum using _tag property
    expect(result.get("req-3")?._tag).toBe("Success");
  });

  it("should mark request as unknown when response_status is null", async () => {
    // Arrange
    const history: PosteeHistoryEntry[] = [
      {
        id: "hist-4",
        request_id: "req-4",
        request_snapshot: "{}",
        response_status: null,
        response_time_ms: null,
        response_size_bytes: null,
        response_body: null,
        response_headers: null,
        error_message: null,
        executed_at: Date.now(),
      },
    ];

    // Act
    const result = await Effect.runPromise(deriveRequestStatuses(history));

    // Assert: Check tagged enum using _tag property
    expect(result.get("req-4")?._tag).toBe("Unknown");
  });

  it("should return most recent status when multiple history entries exist", async () => {
    // Arrange: Two history entries for same request, second one is more recent
    const baseTime = Date.now();
    const history: PosteeHistoryEntry[] = [
      {
        id: "hist-5a",
        request_id: "req-5",
        request_snapshot: "{}",
        response_status: 500, // error
        response_time_ms: 100,
        response_size_bytes: 1024,
        response_body: "Error",
        response_headers: "{}",
        error_message: null,
        executed_at: baseTime,
      },
      {
        id: "hist-5b",
        request_id: "req-5",
        request_snapshot: "{}",
        response_status: 200, // success
        response_time_ms: 100,
        response_size_bytes: 1024,
        response_body: "{}",
        response_headers: "{}",
        error_message: null,
        executed_at: baseTime + 1000, // More recent
      },
    ];

    // Act
    const result = await Effect.runPromise(deriveRequestStatuses(history));

    // Assert: Should return most recent status (success) using _tag property
    expect(result.get("req-5")?._tag).toBe("Success");
  });

  it("should ignore entries without request_id", async () => {
    // Arrange
    const history: PosteeHistoryEntry[] = [
      {
        id: "hist-6",
        request_id: null, // No request ID
        request_snapshot: "{}",
        response_status: 200,
        response_time_ms: 100,
        response_size_bytes: 1024,
        response_body: "{}",
        response_headers: "{}",
        error_message: null,
        executed_at: Date.now(),
      },
    ];

    // Act
    const result = await Effect.runPromise(deriveRequestStatuses(history));

    // Assert: Should be empty map
    expect(result.size).toBe(0);
  });
});
