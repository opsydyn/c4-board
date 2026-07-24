# Task 4 Report: QUERY Load-Test Parity

## Status

Completed.

## RED Evidence

Command:

```sh
bun run test:run -- src/core/effects/postee/load-test.test.ts test/ui/components/postee/LoadTestPanel.test.tsx
```

Result: exit 1, 4 failed tests.

- `buildLoadTestRequestPayload` was not exported, so both adapter tests failed with `TypeError: buildLoadTestRequestPayload is not a function`.
- `LoadTestPanel` did not accept `requestDraft`, so the valid QUERY runner test made no `start` call and the invalid QUERY test found no alert.

## GREEN Evidence

Commands:

```sh
bun run test:run -- src/core/effects/postee/load-test.test.ts test/ui/components/postee/LoadTestPanel.test.tsx test/ui/components/postee/PosteeRequestBuilder.test.tsx
bun run lint -- src/core/effects/postee/load-test.ts src/core/effects/postee/load-test.test.ts src/ui/components/postee/PosteeWorkspace.tsx src/ui/components/postee/PosteeResponsePanel.tsx src/ui/components/postee/LoadTestPanel.tsx test/ui/components/postee/LoadTestPanel.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml build_request_plan_accepts_query_content
cargo fmt --manifest-path src-tauri/Cargo.toml --check
git diff --check
```

Results:

- Vitest: 3 files passed, 32 tests passed.
- ESLint: passed with no diagnostics.
- Cargo: `build_request_plan_accepts_query_content` passed; 1 passed, 20 filtered out.
- Rust formatting and whitespace checks passed.

## Changed Paths

- `src/core/effects/postee/load-test.ts`
- `src/core/effects/postee/load-test.test.ts`
- `src/ui/components/postee/PosteeWorkspace.tsx`
- `src/ui/components/postee/PosteeResponsePanel.tsx`
- `src/ui/components/postee/LoadTestPanel.tsx`
- `test/ui/components/postee/LoadTestPanel.test.tsx`
- `src-tauri/src/load_test/engine.rs`
- `.superpowers/sdd/task-4-report.md`

## Commit

`2464d3fa187428888c529248ced4efeac3f66077` (`feat: carry QUERY content into load tests`)

## Concerns

- The approved brief names `src-tauri/src/load_test/engine.rs`, while the explicit write scope names the nonexistent and unregistered `src-tauri/src/postee_http_engine.rs`. The required compiled QUERY request-plan regression was added to the actual `LoadTestEngine` module; no Rust production logic changed.
- No desktop-runtime end-to-end run was performed. The UI test verifies that invalid QUERY payloads cannot call the load-test hook and that valid QUERY method, body, and completed Content-Type are forwarded to it.
