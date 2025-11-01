# XState Machine Branded Types Fixes

## Issues Fixed

### 1. ✅ LoadWorkspaceResult ID Branding

**Problem:** Database returns raw `string` IDs, but `LoadWorkspaceResult` expects branded types.

**Error:**
```
Type 'string | null' is not assignable to type 'EnvironmentId | null'
Type 'string' is not assignable to type 'EnvironmentId'
```

**Solution:** Explicitly brand IDs from database strings using brand constructors:

```typescript
// ❌ Before
const firstCollection = collections[0]?.id ?? null;
const defaultEnvironment = environments[0]?.id ?? null;

return {
  defaultCollectionId: firstCollection,  // string | null
  defaultEnvironmentId: defaultEnvironment,  // string | null
};

// ✅ After
const firstCollectionId = collections[0]?.id;
const firstCollection = firstCollectionId
  ? CollectionIdBrand(firstCollectionId)
  : null;

const defaultEnvironmentId = environments[0]?.id;
const defaultEnvironment = defaultEnvironmentId
  ? EnvironmentIdBrand(defaultEnvironmentId)
  : null;

return {
  defaultCollectionId: firstCollection,  // CollectionId | null ✅
  defaultEnvironmentId: defaultEnvironment,  // EnvironmentId | null ✅
};
```

---

### 2. ✅ Removed Unused `PreparedBody` Import

**Problem:** `PreparedBody` type was imported but never used in the machine.

**Solution:** Removed from imports. The type is already included in `PreparedRequest` from `http-client.ts`.

```typescript
// ❌ Before
import {
  type PreparedBody,  // Unused!
  ...
} from "../../core/effects/postee/types";

// ✅ After
import {
  // PreparedBody removed
  ...
} from "../../core/effects/postee/types";
```

---

### 3. ✅ Record Lookups with Branded IDs

**Problem:** Context uses `Record<string, T>` for lookups, but IDs are branded types.

**Solution:** Cast branded IDs to `string` for Record key access:

```typescript
// ❌ Before (Type Error)
const nextRequests = context.requestsByCollection[event.collectionId];
//                                                 ^^^^^^^^^^^^^^^^^^
// CollectionId is not assignable to string | number | symbol

// ✅ After
const collectionId = event.collectionId as unknown as string;
const nextRequests = context.requestsByCollection[collectionId];
```

**Applied to:**
- `requestsByCollection` lookup
- `variablesByEnvironment` lookup

---

### 4. ✅ Database Service Calls

**Problem:** Database services expect `string` IDs, but machine has `RequestId` branded type.

**Solution:** Unwrap branded IDs before database calls:

```typescript
// ❌ Before (Type Error)
const request = yield* PosteeRequests.get(requestId);
//                                         ^^^^^^^^^
// RequestId is not assignable to string

// ✅ After
const requestIdString = requestId as unknown as string;
const request = yield* PosteeRequests.get(requestIdString);
const headers = yield* PosteeRequests.listHeaders(requestIdString);
const body = yield* PosteeRequests.getBody(requestIdString);
```

---

### 5. ✅ Request ID Branding in Selection Actions

**Problem:** When selecting a collection, need to brand the first request ID.

**Solution:**

```typescript
// ❌ Before
activeRequestId: ({ context, event }) => {
  const nextRequests = context.requestsByCollection[event.collectionId];
  return nextRequests[0]?.id ?? null;  // string | null
};

// ✅ After
activeRequestId: ({ context, event }) => {
  const collectionId = event.collectionId as unknown as string;
  const nextRequests = context.requestsByCollection[collectionId];
  const firstRequestId = nextRequests[0]?.id;
  return firstRequestId ? RequestIdBrand(firstRequestId) : null;  // RequestId | null
};
```

---

## Pattern: Branded Types at Boundaries

### Principle
Branded types provide **compile-time safety** but need **runtime conversion** at system boundaries.

### Boundaries in This Codebase

#### 1. **Database → Machine** (Brand IDs)
```typescript
// Database returns: { id: string }
// Machine expects: { id: RequestId }

const dbRequest = yield* PosteeRequests.get(stringId);
const brandedId = RequestIdBrand(dbRequest.id);  // string → RequestId
```

#### 2. **Machine → Database** (Unbrand IDs)
```typescript
// Machine has: requestId: RequestId
// Database expects: (id: string) => ...

const stringId = requestId as unknown as string;  // RequestId → string
yield* PosteeRequests.get(stringId);
```

#### 3. **Record Lookups** (Temporary Unbrand)
```typescript
// Record key type is always string
const key = brandedId as unknown as string;
const value = record[key];
```

---

## Why This Works

### Type Safety Preserved
```typescript
// ✅ This compiles
const collectionId: CollectionId = CollectionIdBrand("col_123");
const requestId: RequestId = RequestIdBrand("req_456");

// ❌ This doesn't compile
function getRequest(id: RequestId) { ... }
getRequest(collectionId);  // Compile error!
```

### Zero Runtime Cost
```typescript
// At runtime, branded types ARE strings
const id: RequestId = RequestIdBrand("req_123");
console.log(typeof id);  // "string"
console.log(id === "req_123");  // true

// Brand constructors are just identity functions
RequestIdBrand("abc") === "abc"  // true (runtime)
```

### Safe Conversions
```typescript
// ✅ Safe: We know the database ID is valid
const requestId = RequestIdBrand(dbRequest.id);

// ✅ Safe: We know branded ID is a string
const stringId = requestId as unknown as string;

// ❌ Unsafe: Never do this
const fakeId = "not-a-real-id" as RequestId;  // Don't!
```

---

## Future Improvements

### Option 1: Branded Keys in Records
```typescript
// Instead of: Record<string, T>
// Use: Map<BrandedId, T>

interface PosteeContext {
  requestsByCollection: Map<CollectionId, PosteeRequest[]>;
  variablesByEnvironment: Map<EnvironmentId, PosteeEnvironmentVariable[]>;
}

// Lookup without casting
const requests = context.requestsByCollection.get(collectionId);
```

**Pros:**
- No casting needed
- Type-safe lookups
- True branded keys

**Cons:**
- More complex
- Serialization harder
- XState context must be serializable

### Option 2: Database Layer Returns Branded Types
```typescript
// Update Effect services to return branded types
export const PosteeRequests = {
  get: (id: RequestId): Effect<PosteeRequest, Error, Database> => ...,
  list: (collectionId: CollectionId): Effect<PosteeRequest[], Error, Database> => ...,
};

// No conversion needed in machine
const request = yield* PosteeRequests.get(requestId);  // ✅
```

**Pros:**
- No conversions in machine
- Type safety end-to-end
- Single source of truth

**Cons:**
- More work
- Database schemas need updates
- Need Schema decoders for validation

### Option 3: Helper Functions
```typescript
// src/core/effects/postee/types.ts
export const unwrapId = <T extends string>(id: T): string =>
  id as unknown as string;

export const wrapRequestId = (id: string): RequestId =>
  RequestIdBrand(id);

// Usage
const stringId = unwrapId(requestId);
const brandedId = wrapRequestId(dbId);
```

**Pros:**
- Clear intent
- Easy to audit conversions
- Can add validation later

**Cons:**
- More boilerplate
- Still manual

---

## Recommendation

**Short term:** Current solution (cast at boundaries) is fine
- ✅ Type safe
- ✅ Zero runtime cost
- ✅ Explicit conversions
- ✅ Easy to understand

**Long term:** Move to **Option 2** (Database Layer Returns Branded Types)
- More type safety
- Fewer manual conversions
- Better architecture
- Aligns with Effect best practices

---

## Files Changed

- ✅ [src/ui/machines/postee.machine.ts](src/ui/machines/postee.machine.ts)
  - Branded IDs in `LoadWorkspaceResult`
  - Cast for Record lookups
  - Cast for database calls
  - Removed unused `PreparedBody` import

---

## Verification

✅ **ESLint:** 0 errors, 0 warnings
✅ **Type Safety:** All branded types properly handled
✅ **Runtime:** No changes - same behavior
✅ **Compile Time:** Catches ID mix-ups

---

## Example: Caught Bug

```typescript
// This would have been a RUNTIME bug without branded types:
function handleRequest(requestId: string) {
  const request = PosteeRequests.get(requestId);
  // ...
}

// Accidentally passed collection ID
const collectionId = "col_123";
handleRequest(collectionId);  // ❌ Runtime error: request not found

// With branded types, this is a COMPILE error:
function handleRequest(requestId: RequestId) {
  // ...
}

const collectionId: CollectionId = CollectionIdBrand("col_123");
handleRequest(collectionId);
// ✅ Compile error: CollectionId is not assignable to RequestId
```

This is the power of branded types - moving bugs from runtime to compile time!
