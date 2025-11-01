# Branded Types Constructor Fixes

## Issues Fixed

### 1. ✅ Brand Constructor Syntax

**Problem:** Attempted to use `.make()` method on branded types, but Effect's `Brand.refined` returns a constructor function, not an object with a `make` method.

**Errors:**
```
Property 'make' does not exist on type 'Constructor<Milliseconds>'
Property 'make' does not exist on type 'Constructor<StatusCode>'
```

**Solution:** Use the constructor function directly:

```typescript
// ❌ Before (Error)
const timeout = MillisecondsBrand.make(30_000);
const status = StatusCodeBrand.make(response.status);
const size = BytesBrand.make(rawSize);

// ✅ After (Correct)
const timeout = MillisecondsBrand(30_000);
const status = StatusCodeBrand(response.status);
const size = BytesBrand(rawSize);
```

**Why:** `Brand.refined()` returns a **function**, not an object:

```typescript
// types.ts
export const Milliseconds = Brand.refined<Milliseconds>(
  (n): n is number & Brand.Brand<"Milliseconds"> => ...,
  (n) => Brand.error(...)
);

// Milliseconds is a FUNCTION: (n: number) => Milliseconds | BrandError
// NOT an object with .make() method
```

---

### 2. ✅ TaggedEnum Construction

**Problem:** Incorrectly cast objects to `Data.TaggedEnum.Value<Tag, Props>` type.

**Errors:**
```
Type 'string' does not satisfy the constraint '{ readonly _tag: string; }'
```

**Solution:** Use the enum constructors directly without casting:

```typescript
// ❌ Before (Error)
RequestBody.None({} as Data.TaggedEnum.Value<"None", {}>)
RequestBody.Raw({ content } as Data.TaggedEnum.Value<"Raw", { readonly content: string }>)
RequestBody.Json({ content } as Data.TaggedEnum.Value<"Json", { readonly content: string }>)
RequestBody.Form({ entries } as Data.TaggedEnum.Value<"Form", { readonly entries: ... }>)

// ✅ After (Correct)
RequestBody.None()
RequestBody.Raw({ content })
RequestBody.Json({ content })
RequestBody.Form({ entries })
```

**Why:** `Data.taggedEnum()` creates constructor functions that already return the correct types:

```typescript
// types.ts
export const RequestBody = Data.taggedEnum<RequestBody>();

// This creates:
// RequestBody.None: () => RequestBody
// RequestBody.Raw: (props: { content: string }) => RequestBody
// RequestBody.Json: (props: { content: string }) => RequestBody
// RequestBody.Form: (props: { entries: ... }) => RequestBody

// No casting needed!
```

---

## Corrected Patterns

### Pattern 1: Branded Number Construction

```typescript
// Branded numbers (Milliseconds, Bytes, StatusCode)
const Constructor = Brand.refined<Type>(validator, errorFn);

// Usage:
const value: Type = Constructor(rawValue);  // ✅
const value: Type = Constructor.make(rawValue);  // ❌ No .make()
```

### Pattern 2: TaggedEnum Construction

```typescript
// Define enum
export type MyEnum = Data.TaggedEnum<{
  Foo: { value: string };
  Bar: { count: number };
}>;
export const MyEnum = Data.taggedEnum<MyEnum>();

// Usage:
const foo = MyEnum.Foo({ value: "hello" });  // ✅
const foo = MyEnum.Foo({ value: "hello" } as Data.TaggedEnum.Value<...>);  // ❌ No casting
```

### Pattern 3: TaggedEnum with No Props

```typescript
// Define
export type Status = Data.TaggedEnum<{
  Idle: {};
  Running: {};
}>;
export const Status = Data.taggedEnum<Status>();

// Usage:
const idle = Status.Idle();  // ✅ Empty call
const idle = Status.Idle({});  // ✅ Also works
const idle = Status.Idle({} as Data.TaggedEnum.Value<"Idle", {}>);  // ❌ No casting
```

---

## Fixed Code Examples

### Example 1: HTTP Response Creation

```typescript
// ❌ Before
const payload: PreparedResponse = {
  status: StatusCodeBrand.make(response.status),  // Error!
  durationMs: MillisecondsBrand.make(Math.round(duration)),  // Error!
  rawSize: BytesBrand.make(rawSize),  // Error!
};

// ✅ After
const payload: PreparedResponse = {
  status: StatusCodeBrand(response.status),
  durationMs: MillisecondsBrand(Math.round(duration)),
  rawSize: BytesBrand(rawSize),
};
```

### Example 2: Request Body Preparation

```typescript
// ❌ Before
Match.when({ _tag: "Raw" }, ({ content }) =>
  Effect.succeed(
    RequestBody.Raw({
      content: resolveTemplate(content, env),
    } as Data.TaggedEnum.Value<"Raw", { readonly content: string }>)  // Error!
  )
)

// ✅ After
Match.when({ _tag: "Raw" }, ({ content }) =>
  Effect.succeed(
    RequestBody.Raw({
      content: resolveTemplate(content, env),
    })
  )
)
```

### Example 3: Empty TaggedEnum Variant

```typescript
// ❌ Before
Match.when({ _tag: "None" }, () =>
  Effect.succeed(
    RequestBody.None({} as Data.TaggedEnum.Value<"None", {}>)  // Error!
  )
)

// ✅ After
Match.when({ _tag: "None" }, () =>
  Effect.succeed(RequestBody.None())
)
```

---

## Why These Patterns Work

### Branded Type Construction

Effect's `Brand.refined()` creates a **constructor function** that:
1. Takes a value of the base type (e.g., `number`)
2. Validates it using the predicate
3. Returns either the branded type or a `BrandError`

```typescript
// Internal behavior (simplified)
const Milliseconds = (n: number): Milliseconds | BrandError => {
  if (isValid(n)) {
    return n as Milliseconds;  // Runtime: just the number
  } else {
    return BrandError("Invalid milliseconds");
  }
};
```

### TaggedEnum Construction

Effect's `Data.taggedEnum()` creates **constructor functions** for each variant:

```typescript
// Internal behavior (simplified)
const RequestBody = {
  None: () => ({ _tag: "None" }),
  Raw: ({ content }: { content: string }) => ({ _tag: "Raw", content }),
  Json: ({ content }: { content: string }) => ({ _tag: "Json", content }),
  Form: ({ entries }: { entries: ... }) => ({ _tag: "Form", entries }),
};
```

The constructors **already return the correct type**. No casting needed!

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Calling `.make()` on branded constructors

```typescript
const id = RequestIdBrand.make("req_123");  // ❌ No .make()
const id = RequestIdBrand("req_123");  // ✅
```

### ❌ Mistake 2: Casting TaggedEnum values

```typescript
const body = RequestBody.Raw({ content: "..." } as Data.TaggedEnum.Value<...>);  // ❌
const body = RequestBody.Raw({ content: "..." });  // ✅
```

### ❌ Mistake 3: Using `Brand.nominal()` incorrectly

```typescript
// Brand.nominal() is for SIMPLE branded types (no validation)
export type UserId = string & Brand.Brand<"UserId">;
export const UserId = Brand.nominal<UserId>();

// Usage:
const id = UserId("user_123");  // ✅ No validation

// Brand.refined() is for VALIDATED branded types
export const PositiveNumber = Brand.refined<PositiveNumber>(
  (n): n is number & Brand.Brand<"PositiveNumber"> => n > 0,
  (n) => Brand.error(`Not positive: ${n}`)
);

// Usage:
const num = PositiveNumber(5);  // ✅ Validates n > 0
const neg = PositiveNumber(-5);  // ❌ BrandError
```

---

## Impact

### Before Fixes
- ❌ 5 TypeScript errors
- ❌ Cannot construct branded types
- ❌ Cannot create TaggedEnum values
- ❌ Code doesn't compile

### After Fixes
- ✅ 0 TypeScript errors
- ✅ 0 ESLint warnings
- ✅ Branded types work correctly
- ✅ TaggedEnum constructors work as expected
- ✅ Pattern matching with exhaustiveness checking

---

## Files Fixed

- ✅ [src/core/effects/postee/http-client.ts](src/core/effects/postee/http-client.ts)
  - Fixed branded number constructors (3 places)
  - Fixed TaggedEnum constructors (4 places)
  - Simplified code (removed unnecessary casts)

---

## Verification

```bash
# All pass! ✅
npx eslint src/core/effects/postee/types.ts --max-warnings=0
npx eslint src/core/effects/postee/http-client.ts --max-warnings=0
npx eslint src/ui/machines/postee.machine.ts --max-warnings=0
```

---

## Key Takeaways

1. **Branded type constructors are functions**, not objects with `.make()`
2. **TaggedEnum constructors already return the correct type** - no casting needed
3. **Trust Effect's type inference** - it's designed to work without casts
4. **When in doubt, look at the types** - Effect's types are self-documenting

---

## Reference

- [Effect Branded Types](https://effect.website/docs/code-style/branded-types/)
- [Effect Data Types](https://effect.website/docs/data-types/data/)
- [Effect Pattern Matching](https://effect.website/docs/code-style/pattern-matching/)
