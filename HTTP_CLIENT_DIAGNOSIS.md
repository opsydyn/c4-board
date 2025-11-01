# HTTP Client Error Diagnosis

## Error
```
Error: {
  "message": "Failed to perform HTTP request",
  "cause": {},
  "request": {
    "method": "GET",
    "url": "https://api.github.com/users/octocat"
  },
  "_tag": "HttpClientError"
}
```

## Root Cause Analysis

### 1. **Tauri HTTP Plugin Scope Missing** ⚠️

**Current Config** ([tauri.conf.json](src-tauri/tauri.conf.json#L58-L61)):
```json
{
  "permissions": [
    "http:allow-fetch",
    "http:allow-fetch-send",
    "http:allow-fetch-read-body",
    "http:allow-fetch-cancel"
  ]
}
```

**Problem**: The HTTP plugin has permissions but **no scope configuration**. In Tauri v2, the HTTP plugin requires explicit URL scopes to prevent security vulnerabilities.

**Solution**: Add HTTP scope to capabilities:
```json
{
  "identifier": "http:scope",
  "allow": [
    { "url": "https://**" },
    { "url": "http://localhost:*" }
  ]
}
```

### 2. **Empty Cause Object** 🔍

The error shows `"cause": {}` which means the actual error is being lost. Let me check the error handling:

**File**: [http-client.ts:355-420](src/core/effects/postee/http-client.ts#L355-L420)

```typescript
.catch((cause: unknown) => {
  const reason = controller.signal.reason;
  cleanup();

  const error = Match.value(cause).pipe(
    Match.when(
      (c: DOMException): c is DOMException =>
        c instanceof DOMException && c.name === "AbortError",
      () => // Handle abort
    ),
    Match.orElse(() =>
      HttpClientError({
        message: "Failed to perform HTTP request",
        cause,  // ⚠️ This might be a Tauri-specific error object
        request: {
          method: request.method,
          url: String(request.url),
        },
      }),
    ),
  );
```

**Issue**: Tauri's fetch plugin might throw errors that aren't `DOMException`, and we're catching them in the `Match.orElse()` without inspecting the cause properly.

### 3. **CSP May Block External Requests** ⚠️

**Current CSP** ([tauri.conf.json:34](src-tauri/tauri.conf.json#L34)):
```json
"csp": "default-src 'self' asset: https://asset.localhost; img-src 'self' asset: https://asset.localhost data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://* http://localhost:*"
```

**Analysis**:
- ✅ `connect-src 'self' https://* http://localhost:*` - Allows HTTPS connections
- ✅ Should allow `https://api.github.com`

**Verdict**: CSP looks OK for HTTPS requests.

---

## Recommended Fixes

### Fix 1: Add HTTP Plugin Scope (CRITICAL) ✅

Update [tauri.conf.json](src-tauri/tauri.conf.json):

```json
{
  "identifier": "default",
  "windows": ["*"],
  "permissions": [
    "http:allow-fetch",
    "http:allow-fetch-send",
    "http:allow-fetch-read-body",
    "http:allow-fetch-cancel",
    {
      "identifier": "http:scope",
      "allow": [
        { "url": "https://**" },
        { "url": "http://**" }
      ]
    }
    // ... other permissions
  ]
}
```

**Why**: Tauri v2 HTTP plugin requires explicit URL patterns for security.

### Fix 2: Improve Error Logging (HIGH) ✅

Update [http-client.ts:355](src/core/effects/postee/http-client.ts#L355):

```typescript
.catch((cause: unknown) => {
  const reason = controller.signal.reason;
  cleanup();

  // Log the raw error for debugging
  console.error("[postee][http-client] Raw fetch error:", {
    cause,
    causeType: typeof cause,
    causeConstructor: cause?.constructor?.name,
    causeMessage: cause instanceof Error ? cause.message : String(cause),
    reason,
    request: {
      method: request.method,
      url: String(request.url),
    },
  });

  // ... rest of error handling
});
```

**Why**: This will show us the actual error from Tauri's fetch plugin.

### Fix 3: Handle Tauri-Specific Errors (MEDIUM) ✅

Tauri's fetch might throw different error types. Update the pattern matching:

```typescript
const error = Match.value(cause).pipe(
  // Handle Tauri fetch errors
  Match.when(
    (c): c is Error => c instanceof Error && c.message.includes("fetch"),
    (err) =>
      HttpClientError({
        message: `Tauri fetch failed: ${err.message}`,
        cause: err,
        request: {
          method: request.method,
          url: String(request.url),
        },
      }),
  ),
  // Handle abort errors
  Match.when(
    (c: DOMException): c is DOMException =>
      c instanceof DOMException && c.name === "AbortError",
    () => // ... existing abort handling
  ),
  // Fallback
  Match.orElse(() =>
    HttpClientError({
      message: "Failed to perform HTTP request",
      cause,
      request: {
        method: request.method,
        url: String(request.url),
      },
    }),
  ),
);
```

---

## Testing Steps

### 1. Add HTTP Scope and Test
```bash
# Update tauri.conf.json with HTTP scope
# Restart dev server
npm run tauri dev

# Try the request again
```

### 2. Check Console Logs
Look for:
- `[postee][http-client] Raw fetch error:` - Shows actual error
- `[postee][http-client] request failed` - Shows our formatted error

### 3. Verify Permissions
```bash
# Check that HTTP permissions are loaded
# In Tauri dev tools console:
console.log("Permissions:", window.__TAURI__);
```

---

## Alternative: Use Native Fetch in Dev Mode

If Tauri's HTTP plugin is causing issues in dev mode, we can conditionally use native fetch:

```typescript
import { fetch as TauriFetch } from '@tauri-apps/plugin-http';

// Use Tauri fetch in production, native fetch in dev
const fetchImpl = import.meta.env.PROD ? TauriFetch : fetch;

// Then in HttpClientLive:
fetchImpl(request.url, init)
  .then(async (response) => {
    // ...
  });
```

**Pros**:
- Works in both dev (browser) and prod (Tauri)
- Better DX during development

**Cons**:
- Different code paths between dev/prod
- Might miss Tauri-specific issues during dev

---

## Expected Outcomes

### After Fix 1 (HTTP Scope):
✅ Request should succeed
✅ No "Failed to perform HTTP request" error

### After Fix 2 (Better Logging):
✅ Console shows actual error details
✅ Can see if it's a permissions issue, network issue, or Tauri bug

### After Fix 3 (Tauri Error Handling):
✅ Better error messages for Tauri-specific failures
✅ Clearer distinction between timeout, abort, and fetch errors

---

## Related Files

- ❌ [tauri.conf.json](src-tauri/tauri.conf.json) - Missing HTTP scope
- ⚠️ [http-client.ts:337](src/core/effects/postee/http-client.ts#L337) - TauriFetch usage
- ⚠️ [http-client.ts:355-420](src/core/effects/postee/http-client.ts#L355-L420) - Error handling

---

## Next Steps

1. **Apply Fix 1** (HTTP scope) - Most likely to fix the issue
2. **Apply Fix 2** (logging) - To see what's actually happening
3. **Test** with the GitHub API request
4. **If still failing**, apply Fix 3 or use native fetch in dev mode
