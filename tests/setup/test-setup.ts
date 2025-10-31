import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
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

afterEach(() => {
	vi.clearAllMocks();
	cleanup();
});
