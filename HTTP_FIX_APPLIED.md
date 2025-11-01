# HTTP Client Fix Applied ✅

## Problem

Fetching external URLs failed with:
```
Error: {
  "message": "Failed to perform HTTP request",
  "cause": {},
  "request": {"method": "GET", "url": "https://api.github.com/users/octocat"},
  "_tag": "HttpClientError"
}
```

## Root Cause

**Tauri v2 HTTP Plugin requires explicit URL scopes** for security. The app had HTTP permissions but no scope configuration, causing all external requests to fail.

---

## Fixes Applied

### 1. Added HTTP Scope to Tauri Config ✅

**File**: [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json#L62-L68)

```json
{
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
  ]
}
```

**What this does**:
- ✅ Allows fetching from any HTTPS URL
- ✅ Allows fetching from any HTTP URL
- ✅ Applies to all Tauri windows

**Security**: This is appropriate for an HTTP client tool like Postee, which needs to fetch from arbitrary URLs.

### 2. Added Detailed Error Logging ✅

**File**: [src/core/effects/postee/http-client.ts:359-371](src/core/effects/postee/http-client.ts#L359-L371)

```typescript
.catch((cause: unknown) => {
  const reason = controller.signal.reason;
  cleanup();

  // Log the raw error for debugging Tauri fetch issues
  console.error("[postee][http-client] Raw fetch error:", {
    cause,
    causeType: typeof cause,
    causeConstructor: cause?.constructor?.name,
    causeMessage: cause instanceof Error ? cause.message : String(cause),
    causeStack: cause instanceof Error ? cause.stack : undefined,
    reason,
    request: {
      method: request.method,
      url: String(request.url),
    },
  });

  // Use pattern matching for error handling
  const error = Match.value(cause).pipe(
    // ... existing error handling
  );
});
```

**What this does**:
- ✅ Logs the actual error object before processing
- ✅ Shows error type, constructor, message, and stack
- ✅ Includes request context for debugging
- ✅ Helps diagnose Tauri-specific vs network errors

---

## Testing

### Before Testing

1. **Restart Tauri dev server** (required for config changes):
   ```bash
   # Kill existing process
   pkill -f "tauri dev"

   # Start fresh
   npm run tauri dev
   ```

2. **Open DevTools** to see console logs

### Test Cases

#### Test 1: GitHub API (HTTPS)
```typescript
const request = {
  id: RequestIdBrand("test-1"),
  method: "GET" as HttpMethod,
  url: HttpUrlBrand("https://api.github.com/users/octocat"),
  headers: [],
  body: RequestBody.None(),
  timeout: Duration.seconds(30),
};
```

**Expected**:
- ✅ Request succeeds
- ✅ Returns user data
- ✅ No errors in console

#### Test 2: HTTP URL (if allowed)
```typescript
const request = {
  // ... same as above but with http://
  url: HttpUrlBrand("http://httpbin.org/get"),
};
```

**Expected**:
- ✅ Request succeeds
- ✅ Returns response data

#### Test 3: Timeout
```typescript
const request = {
  // ... same as above
  url: HttpUrlBrand("https://httpbin.org/delay/35"), // Delay 35 seconds
  timeout: Duration.seconds(5), // Timeout after 5
};
```

**Expected**:
- ✅ Request times out after 5 seconds
- ✅ Error: `HttpClientTimeoutError`
- ✅ Console shows: `[postee][http-client] Raw fetch error:` with timeout reason

---

## What to Look For

### Success Case
**Console output**:
```
✅ No "[postee][http-client] Raw fetch error:" message
✅ No "[postee][http-client] request failed" message
```

**Response**:
```typescript
{
  status: StatusCodeBrand(200),
  statusText: "OK",
  headers: { ... },
  bodyText: "...",
  duration: Duration.millis(123),
  rawSize: BytesBrand(456),
}
```

### Failure Case (Network Error)
**Console output**:
```javascript
[postee][http-client] Raw fetch error: {
  cause: Error: ... // Actual error from Tauri
  causeType: "object",
  causeConstructor: "Error",
  causeMessage: "Network error: ...",
  causeStack: "...",
  reason: undefined,
  request: { method: "GET", url: "https://..." }
}

[postee][http-client] request failed {
  id: "...",
  method: "GET",
  url: "https://...",
  error: {
    _tag: "HttpClientError",
    message: "Failed to perform HTTP request",
    cause: Error: ...,
    request: { method: "GET", url: "https://..." }
  }
}
```

### Failure Case (Timeout)
**Console output**:
```javascript
[postee][http-client] Raw fetch error: {
  cause: DOMException: "AbortError",
  causeType: "object",
  causeConstructor: "DOMException",
  causeMessage: "The operation was aborted.",
  causeStack: undefined,
  reason: "timeout",
  request: { method: "GET", url: "https://..." }
}

[postee][http-client] request failed {
  error: {
    _tag: "HttpClientTimeoutError",
    message: "HTTP request timed out",
    elapsed: Duration(5000ms)
  }
}
```

---

## Related Issues

### If Requests Still Fail After Fix

1. **Check Console for Raw Error**:
   - Look for `[postee][http-client] Raw fetch error:`
   - Check `causeMessage` for actual error

2. **Common Tauri HTTP Errors**:
   - `"Network error"` → Check internet connection
   - `"SSL error"` → Check HTTPS certificate
   - `"Permission denied"` → HTTP scope might be too restrictive
   - `"Invalid URL"` → URL validation failed

3. **Verify Tauri Config Loaded**:
   ```bash
   # Check generated permissions file
   cat src-tauri/gen/schemas/capabilities/default.json
   ```

4. **Restart Dev Server** (config changes require restart):
   ```bash
   npm run tauri dev
   ```

---

## Security Considerations

### HTTP Scope Configuration

**Current**: Allows all HTTP/HTTPS URLs
```json
{ "url": "https://**" },
{ "url": "http://**" }
```

**Alternative**: Restrict to specific domains
```json
{ "url": "https://api.github.com/**" },
{ "url": "https://httpbin.org/**" },
{ "url": "http://localhost:*" }
```

**Recommendation for Postee**:
- ✅ Keep current scope (allows any URL)
- **Why**: Postee is an HTTP client tool like Postman - users need to fetch from arbitrary URLs
- **Security**: Tauri sandboxing still applies (no filesystem access, etc.)

### CSP (Content Security Policy)

**Current CSP** ([tauri.conf.json:34](src-tauri/tauri.conf.json#L34)):
```
connect-src 'self' https://* http://localhost:*
```

**Analysis**:
- ✅ Allows HTTPS connections from frontend
- ✅ Allows localhost for dev mode
- ✅ Works with HTTP plugin

**No changes needed**.

---

## Files Changed

### Modified
- ✅ [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) - Added HTTP scope
- ✅ [src/core/effects/postee/http-client.ts](src/core/effects/postee/http-client.ts) - Added error logging

### Created
- ✅ [HTTP_CLIENT_DIAGNOSIS.md](HTTP_CLIENT_DIAGNOSIS.md) - Detailed diagnosis
- ✅ [HTTP_FIX_APPLIED.md](HTTP_FIX_APPLIED.md) - This file

---

## Summary

✅ **HTTP scope added** - Tauri can now fetch from external URLs
✅ **Error logging improved** - Can diagnose fetch failures
✅ **ESLint passes** - No linting errors
✅ **Ready to test** - Restart dev server and try requests

**Next**: Test with a real HTTP request to verify the fix works!
