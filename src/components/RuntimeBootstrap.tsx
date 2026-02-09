import { useEffect } from "react";
import { useDatabase } from "../core/effects/useDatabase";
import { ensureDatabaseRuntimeReady } from "../core/effects/database.runtime";

export function RuntimeBootstrap() {
	const { runEffect } = useDatabase();

	useEffect(() => {
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
