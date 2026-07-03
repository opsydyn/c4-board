import { describe, expect, it } from "vitest";
import { resolveOpyHostMode } from "../../src/ui/components/opySurfaceMode";

describe("resolveOpyHostMode", () => {
  it("uses no OPY host when OPY is closed", () => {
    expect(resolveOpyHostMode({ isOpen: false, surfaceMode: "drawer" })).toBe("closed");
  });

  it("uses drawer host when OPY is open and drawer mode is selected", () => {
    expect(resolveOpyHostMode({ isOpen: true, surfaceMode: "drawer" })).toBe("drawer");
  });

  it("uses floating host when OPY is open and floating mode is selected", () => {
    expect(resolveOpyHostMode({ isOpen: true, surfaceMode: "floating" })).toBe("floating");
  });
});
