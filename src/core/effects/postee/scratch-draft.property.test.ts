import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { newPosteeScratchDraft, serialisePosteeScratchDraft } from "./scratch-draft";

describe("Postee scratch draft serialization", () => {
  it("never serializes a resolved environment value", () => {
    fc.assert(
      fc.property(fc.stringMatching(/[a-f0-9]{12,32}/), (suffix) => {
        const resolvedToken = `resolved-secret-${suffix}`;
        const stored = serialisePosteeScratchDraft({
          ...newPosteeScratchDraft({ id: "scratch-property", tabOrder: 0, now: 1 }),
          url: "https://{{host}}/{{token}}",
          headers: [{ id: "auth", key: "Authorization", value: "Bearer {{token}}", enabled: true }],
        });

        expect(JSON.stringify(stored)).not.toContain(resolvedToken);
      }),
    );
  });
});
