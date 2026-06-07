import { useEffect } from "react";
import { useDatabase } from "../core/effects/useDatabase";
import { ensureDatabaseRuntimeReady } from "../core/effects/database.runtime";

export const hasTauriIpcRuntime = (): boolean => {
	if (typeof window === "undefined") {
		return false;
	}

	const candidate = window as typeof window & {
		__TAURI_INTERNALS__?: unknown;
		__TAURI_IPC__?: unknown;
	};

	return (
		typeof candidate.__TAURI_INTERNALS__ === "object" ||
		typeof candidate.__TAURI_IPC__ === "function"
	);
};

export function RuntimeBootstrap() {
	const { runEffect } = useDatabase();

	useEffect(() => {
		if (!hasTauriIpcRuntime()) {
			return;
		}

		let active = true;

		void runEffect(ensureDatabaseRuntimeReady()).catch((error) => {
			if (!active) {
				return;
			}
			console.error("❌ Runtime bootstrap failed:", error);
		});

		return () => {
			active = false;
		};
	}, [runEffect]);

	return null;
}
