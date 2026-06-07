import { afterEach, describe, expect, it } from "vitest";
import { hasTauriIpcRuntime } from "../../src/components/RuntimeBootstrap";

type TauriWindowShape = typeof window & {
	__TAURI_INTERNALS__?: unknown;
	__TAURI_IPC__?: unknown;
};

const tauriWindow = window as TauriWindowShape;

const resetTauriGlobals = () => {
	delete tauriWindow.__TAURI_INTERNALS__;
	delete tauriWindow.__TAURI_IPC__;
};

describe("RuntimeBootstrap", () => {
	afterEach(() => {
		resetTauriGlobals();
	});

	it("does not treat plain browser dev as a Tauri IPC runtime", () => {
		resetTauriGlobals();

		expect(hasTauriIpcRuntime()).toBe(false);
	});

	it("detects the Tauri internals bridge", () => {
		tauriWindow.__TAURI_INTERNALS__ = {};

		expect(hasTauriIpcRuntime()).toBe(true);
	});

	it("detects the legacy Tauri IPC bridge", () => {
		tauriWindow.__TAURI_IPC__ = () => {};

		expect(hasTauriIpcRuntime()).toBe(true);
	});
});
