---
title: "ADR-NNN: [Short Title in Title Case]"
---

# ADR-NNN: [Short Title in Title Case]

**Status**: Proposed | Accepted | Superseded | Deprecated
**Date**: YYYY-MM-DD
**Deciders**: [List of people involved in the decision]
**Technical Story**: [Link to GitHub issue, discussion, or brief description]

## Context

What is the issue we're facing? What forces are at play?

- **Problem Statement**: Clearly describe the problem
- **Current State**: How things work now (if applicable)
- **Goals**: What we're trying to achieve
- **Constraints**: Technical, organizational, or business limitations

## Decision

What is the change that we're proposing and/or doing?

### Proposed Solution

[Detailed description of the solution]

### Implementation Details

[Key technical details, file changes, migration steps]

## Consequences

What becomes easier or more difficult to do and any risks introduced by this decision?

### Positive

- [Benefit 1]
- [Benefit 2]

### Negative

- [Cost 1]
- [Cost 2]

### Neutral

- [Neutral change 1]
- [Neutral change 2]

## Alternatives Considered

### Alternative 1: [Name]

[Description]

**Why Rejected**: [Reasoning]

### Alternative 2: [Name]

[Description]

**Why Rejected**: [Reasoning]

## Migration Plan (if applicable)

[Step-by-step plan for implementing the change]

1. Phase 1: [Description]
2. Phase 2: [Description]
3. Phase 3: [Description]

## Testing Strategy (if applicable)

**MANDATORY**: Follow Red-Green-Blue (TDD) workflow for all implementation.

[How will we verify this works?]

### Test Planning

List all test cases upfront before implementation:

1. [Test case 1: Description]
2. [Test case 2: Description]
3. [Test case 3: Description]

### Red-Green-Blue Workflow

For each test case:

#### 🔴 RED: Write Failing Test

```typescript
// Example: test/core/effects/[feature].test.ts
describe("[Feature]", () => {
  it("should [expected behavior]", async () => {
    // Arrange: Set up test data
    const input = [/* test data */];

    // Act: Call the function that doesn't exist yet
    const result = await Effect.runPromise(featureFunction(input));

    // Assert: Verify expected outcome
    expect(result).toBe(expected);
  });
});
```

Run: `bun test` → Should see RED (failing)

#### 🟢 GREEN: Minimal Implementation

Write the simplest code to make the test pass:

```typescript
// Example: src/core/effects/[feature].ts
export const featureFunction = (input: Input): Effect<Output, never> =>
  Effect.sync(() => {
    // Minimal implementation to pass test
    return result;
  });
```

Run: `bun test` → Should see GREEN (passing)

#### 🔵 BLUE: Refactor

Improve design while keeping tests green:

- Apply Functional Core, Imperative Shell pattern
- Extract pure helper functions
- Improve type safety and documentation
- Optimize performance if needed

Run: `bun test` → Should stay GREEN

### Test Coverage Goals

- **Unit tests** (Functional Core): 100% coverage of Effect services
- **Integration tests** (XState): Cover all state transitions and machine actions
- **Component tests**: Visual regression tests for UI components

## Success Metrics (if applicable)

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| [Metric 1] | [Value] | [Target] | [Status] |
| [Metric 2] | [Value] | [Target] | [Status] |

## References

- [Link to related documentation]
- [Link to related ADRs]
- [Link to technical resources]

## Follow-Up ADRs

- [ADR-NNN]: [Title] - [When needed and why]

---

## Notes

[Any additional context, discussions, or decisions made during implementation]

### Updates

- YYYY-MM-DD: [Change description]
