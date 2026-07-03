import { describe, expect, it } from "vitest";
import { getNextOpySurfaceMode, resolveOpyHostMode } from "../../src/ui/components/opySurfaceMode";

describe("getNextOpySurfaceMode", () => {
  it("switches drawer to floating", () => {
    expect(getNextOpySurfaceMode("drawer")).toBe("floating");
  });

  it("switches floating to drawer", () => {
    expect(getNextOpySurfaceMode("floating")).toBe("drawer");
  });
});

describe("resolveOpyHostMode", () => {
  it("uses no OPY host when OPY is closed in drawer mode", () => {
    expect(resolveOpyHostMode({ isOpen: false, surfaceMode: "drawer" })).toBe("closed");
  });

  it("keeps the floating host mounted when OPY is closed in floating mode", () => {
    expect(resolveOpyHostMode({ isOpen: false, surfaceMode: "floating" })).toBe("floating");
  });

  it("uses drawer host when OPY is open and drawer mode is selected", () => {
    expect(resolveOpyHostMode({ isOpen: true, surfaceMode: "drawer" })).toBe("drawer");
  });

  it("uses floating host when OPY is open and floating mode is selected", () => {
    expect(resolveOpyHostMode({ isOpen: true, surfaceMode: "floating" })).toBe("floating");
  });
});
