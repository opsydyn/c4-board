# Final Gate Report

## Status

The final Knip dependency failure was resolved by removing the unused direct
dependency `@effect/typeclass` with Bun. No source or QUERY files were changed.

## Changed Files

- `package.json`
- `bun.lock`
- `.superpowers/sdd/final-gate-report.md`

## Verification

- `bun run knip` passed with exit code 0 and no diagnostics.
- `bun install --frozen-lockfile` passed with exit code 0 and reported no
  changes.

## Concerns

None identified beyond the verification commands recorded above.

---

## Final Whole-Branch Review Fixes (2026-07-24)

### Scope

This correction resolves the final whole-branch review findings for method-aware
Postee payloads, case-insensitive `Content-Type` completion, QUERY JSON
semantics, and the stale Vite optimizer entry.

### RED

Command:

```bash
bun run test:run -- src/core/effects/postee/http-method-policy.test.ts src/core/effects/postee/http-client.test.ts src/core/effects/postee/load-test.test.ts test/ui/components/postee/PosteeRequestBuilder.test.tsx
```

Result: exit 1, 13 failures across 4 files, with 45 tests still passing.

- GET, HEAD, and TRACE retained JSON content and inferred `Content-Type` in
  load-test payloads, while normal transport omitted the body.
- Normal preparation retained body content and inferred `Content-Type` for
  body-forbidden methods.
- A blank mixed-case `Content-Type` header was retained alongside an inferred
  JSON media type.
- The QUERY editor enabled Send for whitespace-only JSON although core rejected
  it after normalising the content to empty.

### GREEN

The effective-payload policy now owns body-forbidden omission, JSON semantic
normalisation, content-type canonicalisation, and serialisation. Normal
preparation, normal transport, and load-test preparation consume that policy.

Command:

```bash
bun run test:run -- src/core/effects/postee/http-method-policy.test.ts src/core/effects/postee/http-client.test.ts src/core/effects/postee/load-test.test.ts test/ui/components/postee/PosteeRequestBuilder.test.tsx test/ui/components/postee/LoadTestPanel.test.tsx test/core/effects/postee/form-validation.test.ts
```

Result: exit 0; 6 files passed and 67 tests passed.

### Fixed Findings

1. GET, HEAD, and TRACE now produce no body and no inferred `Content-Type` in
   both prepared normal requests and load-test payloads. QUERY JSON, form, and
   raw behavior remains covered by the existing focused tests; no fallback was
   introduced.
2. Effective `Content-Type` handling is case-insensitive. Blank variants are
   discarded before inference, and only the first nonblank content type is
   retained when request content is present.
3. Whitespace-only QUERY JSON normalises to empty in the shared policy, so the
   UI Send gate and core execution now both report that QUERY requires content.
4. Removed the obsolete `@effect/typeclass` entry from Vite `optimizeDeps`.

### Changed Files

- `src/core/effects/postee/http-method-policy.ts`
- `src/core/effects/postee/http-client.ts`
- `src/core/effects/postee/load-test.ts`
- `src/core/effects/postee/http-method-policy.test.ts`
- `src/core/effects/postee/http-client.test.ts`
- `src/core/effects/postee/load-test.test.ts`
- `test/ui/components/postee/PosteeRequestBuilder.test.tsx`
- `astro.config.mts`
- `.superpowers/sdd/final-gate-report.md`

### Final Verification

- Focused ESLint passed with no diagnostics.
- `bun run build` passed: Astro check reported 0 errors, 0 warnings, and 0 hints;
  static build completed for 6 pages.
- `bun run knip` passed with no diagnostics.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all --check` passed.
- `git diff --check` passed.
- A repository scan confirmed no `@effect/typeclass` reference remains in
  `astro.config.mts`, `package.json`, or `bun.lock`.

### Commit

- `fix: enforce Postee effective payload policy`

### Concerns

No desktop-runtime load test was run. The payload contract is covered through
the focused Vitest and IPC-boundary suites; Rust production code is unchanged.
