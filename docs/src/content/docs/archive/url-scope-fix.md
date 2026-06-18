---
title: "URL Scope Pattern Fix ✅"
---

# URL Scope Pattern Fix ✅

## Problem

After fixing GET request body issue, HTTP requests still failed with:

```javascript
[postee][http-client] Raw fetch error: {
  cause: "url not allowed on the configured scope: https://api.github.com/users/octocat",
  causeConstructor: "String",
  causeMessage: "url not allowed on the configured scope: https://api.github.com/users/octocat",
  causeType: "string"
}
```

---

## Root Cause

The URL pattern `https://*` only matches **one domain segment**, not full URLs with paths.

**Example**:
- `https://*` matches: `https://api` ❌
- `https://*` does NOT match: `https://api.github.com/users/octocat` ❌

**What we needed**: `https://**` to match **multiple segments** (domain + path).

---

## Solution Applied ✅

### Fixed Wildcard Pattern

**File**: [src-tauri/tauri.conf.json:45-47](src-tauri/tauri.conf.json#L45-L47)

**Before** (Incorrect):
```json
{
  "remote": {
    "urls": ["https://*", "http://*"]
  }
}
```

**After** (Correct):
```json
{
  "remote": {
    "urls": ["https://**", "http://**"]
  }
}
```

**Key Change**: `*` → `**`

---

## Tauri URL Pattern Syntax

### Single Wildcard (`*`)

Matches **one segment**:

```json
"urls": ["https://*"]
```

**Matches**:
- `https://github` ✅
- `https://api` ✅

**Does NOT match**:
- `https://api.github.com` ❌ (multiple segments)
- `https://github.com/octocat` ❌ (has path)

### Double Wildcard (`**`)

Matches **multiple segments** (any depth):

```json
"urls": ["https://**"]
```

**Matches**:
- `https://github.com` ✅
- `https://api.github.com` ✅
- `https://api.github.com/users/octocat` ✅
- `https://api.github.com/users/octocat/repos` ✅
- Any HTTPS URL with any domain and path ✅

### Port Wildcard (`:*`)

Matches **any port**:

```json
"urls": ["http://localhost:*"]
```

**Matches**:
- `http://localhost:3000` ✅
- `http://localhost:4321` ✅
- `http://localhost:8080` ✅

---

## Pattern Examples

### Example 1: Allow All HTTPS/HTTP (Our Config)

```json
{
  "urls": ["https://**", "http://**"]
}
```

**Allows**: Any URL starting with `https://` or `http://`

**Use Case**: HTTP client tools (Postman, Postee) that fetch arbitrary URLs

### Example 2: Specific Domain Only

```json
{
  "urls": ["https://api.github.com/**"]
}
```

**Allows**: Only `https://api.github.com/*` URLs

**Blocks**: All other domains

### Example 3: Multiple Specific Domains

```json
{
  "urls": [
    "https://api.github.com/**",
    "https://httpbin.org/**",
    "http://localhost:*"
  ]
}
```

**Allows**:
- GitHub API
- HTTPBin (testing)
- Localhost (any port)

**Blocks**: All other URLs

### Example 4: Specific Subdomain

```json
{
  "urls": ["https://api.example.com/**"]
}
```

**Allows**: `https://api.example.com/*`

**Blocks**: `https://www.example.com/*` (different subdomain)

### Example 5: Development + Production

```json
{
  "urls": [
    "https://api.production.com/**",
    "https://api.staging.com/**",
    "http://localhost:*"
  ]
}
```

---

## Verification

### Compilation ✅

```bash
cd src-tauri && cargo check
```

**Result**:
```
Compiling c4-board v0.0.0 (/Users/alan/Projects/tauri-astro-template/src-tauri)
Finished `dev` profile [unoptimized + debuginfo] target(s) in 3m 26s
```

✅ **No errors!**

### Testing

**Restart dev server** (required for config changes):
```bash
npm run tauri dev
```

**Test URL**: `GET https://api.github.com/users/octocat`

**Expected**:
- ✅ Request succeeds
- ✅ Returns user data
- ✅ No "url not allowed on the configured scope" error

**Console output should NOT show**:
```
[postee][http-client] Raw fetch error: {
  cause: "url not allowed on the configured scope: ..."
}
```

---

## Common Errors

### Error 1: Single Wildcard for Full URLs

```json
{
  "urls": ["https://*"]  // ❌ Only matches one segment
}
```

**Error**: `url not allowed on the configured scope: https://api.github.com/...`

**Fix**: Use `https://**`

### Error 2: Missing Port Wildcard

```json
{
  "urls": ["http://localhost"]  // ❌ No port specified
}
```

**Error**: `url not allowed on the configured scope: http://localhost:3000`

**Fix**: Use `http://localhost:*`

### Error 3: Wrong Protocol

```json
{
  "urls": ["https://**"]  // ❌ Only HTTPS
}
```

**Error**: `url not allowed on the configured scope: http://example.com`

**Fix**: Add both: `["https://**", "http://**"]`

---

## Security Considerations

### Current Config (Permissive)

```json
{
  "urls": ["https://**", "http://**"]
}
```

**Security**:
- ✅ Appropriate for HTTP client tools (Postee, Postman)
- ✅ User controls what URLs to fetch
- ✅ Tauri sandboxing still applies (no filesystem access, etc.)
- ⚠️ Allows any external URL

**When to use**: Building an HTTP client, API testing tool, or web scraper

### Restricted Config (More Secure)

```json
{
  "urls": [
    "https://api.yourapp.com/**",
    "https://analytics.yourapp.com/**",
    "http://localhost:*"
  ]
}
```

**Security**:
- ✅ Only allows specific domains
- ✅ Prevents accidental data leaks to unknown servers
- ✅ Better for production apps with known APIs

**When to use**: Building an app that only needs specific APIs

---

## Summary of All HTTP Fixes

### Fix 1: Tauri HTTP Scope (Configuration)
- ✅ Added `remote.urls` to capability
- ✅ Used `http:default` permission

### Fix 2: GET Request Body (HTTP Spec Compliance)
- ✅ Prevent body on GET/HEAD requests
- ✅ Check `methodAllowsBody` before adding body

### Fix 3: URL Pattern (This Fix)
- ✅ Changed `https://*` → `https://**`
- ✅ Allows full URLs with domain + path

---

## Files Changed

### Modified
- ✅ [src-tauri/tauri.conf.json:46](src-tauri/tauri.conf.json#L46)
  - Changed `"urls": ["https://*", "http://*"]`
  - To `"urls": ["https://**", "http://**"]`

### Created
- ✅ [HTTP_CLIENT_DIAGNOSIS.md](HTTP_CLIENT_DIAGNOSIS.md) - Initial diagnosis
- ✅ [HTTP_FIX_APPLIED.md](HTTP_FIX_APPLIED.md) - First attempt
- ✅ [HTTP_FIX_FINAL.md](HTTP_FIX_FINAL.md) - Remote config fix
- ✅ [GET_REQUEST_BODY_FIX.md](GET_REQUEST_BODY_FIX.md) - GET body fix
- ✅ [URL_SCOPE_FIX.md](URL_SCOPE_FIX.md) - This file

---

## Next Steps

1. **Restart dev server**: `npm run tauri dev`
2. **Test GET request**: Try `GET https://api.github.com/users/octocat`
3. **Verify success**: Should return user data with no errors

The HTTP client should now work correctly! 🎉

---

## Quick Reference

| Pattern | Matches | Use Case |
|---------|---------|----------|
| `https://*` | One domain segment | Single-level domains only |
| `https://**` | Any HTTPS URL | HTTP clients, unrestricted access |
| `https://api.example.com/**` | Specific domain + all paths | Restricted to one API |
| `http://localhost:*` | Localhost, any port | Local development |
| `https://*.example.com/**` | All subdomains of example.com | Multi-tenant apps |
