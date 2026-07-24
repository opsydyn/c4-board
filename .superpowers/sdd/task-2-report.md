# Task 2 Report: HTTP Preparation, Transport, and Machine Execution

## RED

Command:

```bash
bun run test:run -- src/core/effects/postee/http-client.test.ts test/ui/machines/postee.machine.request-draft.test.ts
```

Output: failed as expected. `prepares QUERY JSON with a generated media type`
failed because prepared headers were empty. Both invalid QUERY cases failed because
`prepareRequest` succeeded instead of returning an `HttpClientError`. The persisted
machine suite passed before the implementation change.

## GREEN

Commands:

```bash
bun run test:run -- src/core/effects/postee/http-method-policy.test.ts src/core/effects/postee/http-client.test.ts test/ui/machines/postee.machine.request-draft.test.ts
bun run lint -- src/core/effects/postee/http-client.ts src/core/effects/postee/http-client.test.ts test/ui/machines/postee.machine.request-draft.test.ts
git diff --check
```

Output: 3 test files passed, 24 tests passed. Targeted ESLint passed. `git diff --check`
passed with no whitespace errors.

## Files

- `src/core/effects/postee/http-client.ts`
- `src/core/effects/postee/http-client.test.ts`
- `test/ui/machines/postee.machine.request-draft.test.ts`
- `.superpowers/sdd/task-2-report.md`

## Commit

`feat: execute RFC-valid QUERY requests`

## Self-review

- `prepareRequest` validates QUERY semantics after resolution and fails through
  `Effect.fail(HttpClientError(...))`.
- Completed media-type headers are retained in `PreparedRequest`, which is the
  request captured by the machine and included in its history snapshot.
- `toRequestInit` is exported, serialises only the prepared body, and does not
  add a media-type fallback. GET, HEAD, and empty-body omission follows the
  shared method policy and body serializer.
- The persisted-draft test captures the request at the real machine's test
  client layer and verifies the QUERY method, raw body, and history snapshot.

## Concerns

- Verification is intentionally focused on the Task 2 suites and targeted lint;
  the full repository test suite and desktop integration were not run.

## Build Typing Fix

Added an explicit `Exit.isFailure` guard in `http-client.test.ts` so TypeScript
narrows `exit.cause` without changing the test's failure assertion.
