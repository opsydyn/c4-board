import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  Object.assign(window, { ResizeObserver: StubResizeObserver });
}

if (typeof globalThis !== "undefined" && !("ResizeObserver" in globalThis)) {
  Object.assign(globalThis, { ResizeObserver: StubResizeObserver });
}

// Monaco's clipboard contribution probes this at import time; jsdom omits it.
if (typeof document !== "undefined" && typeof document.queryCommandSupported !== "function") {
  Object.assign(document, { queryCommandSupported: () => false });
}

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});
