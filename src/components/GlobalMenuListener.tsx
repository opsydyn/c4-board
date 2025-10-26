/**
 * GlobalMenuListener - Listens to native menu events across all routes
 *
 * This component should be mounted in the root layout to handle menu events
 * regardless of which page the user is on.
 */

import { useEffect } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function GlobalMenuListener() {
	useEffect(() => {
		console.log("🎧 GlobalMenuListener mounted");

		let isMounted = true;
		const unlistenFns: UnlistenFn[] = [];
		const windowHandle = getCurrentWindow();

		const register = async (
			event: string,
			handler: () => void,
		): Promise<void> => {
			const unlisten = await windowHandle.listen(event, () => {
				if (!isMounted) {
					return;
				}
				handler();
			});
			unlistenFns.push(unlisten);
		};

		const navigateToCanvas = (searchParams?: Record<string, string>) => {
			const url = new URL(window.location.origin + "/canvas");
			if (searchParams) {
				for (const [key, value] of Object.entries(searchParams)) {
					url.searchParams.set(key, value);
				}
			}
			window.location.href = url.toString();
		};

		(async () => {
			// File menu - navigation
			await register("menu:new-board", () => {
				console.log("📋 Menu: New Board");
				if (window.location.pathname !== "/canvas") {
					navigateToCanvas({ action: "new-board" });
				}
			});
			await register("menu:open-board", () => {
				console.log("📋 Menu: Open Board");
				if (window.location.pathname !== "/saved-diagrams") {
					window.location.href = "/saved-diagrams";
				}
			});
			await register("menu:view-all", () => {
				console.log("📋 Menu: View All");
				if (window.location.pathname !== "/saved-diagrams") {
					window.location.href = "/saved-diagrams";
				}
			});

			// File menu - save (only works on canvas)
			await register("menu:save", () => {
				console.log("📋 Menu: Save");
				if (window.location.pathname !== "/canvas") {
					navigateToCanvas({ action: "save" });
				}
			});
			await register("menu:save-as", () => {
				console.log("📋 Menu: Save As");
				if (window.location.pathname !== "/canvas") {
					navigateToCanvas({ action: "save-as" });
				}
			});

			// Edit menu (only works on canvas)
			await register("menu:delete-node", () => {
				console.log("📋 Menu: Delete Node");
				if (window.location.pathname !== "/canvas") {
					navigateToCanvas({ action: "delete-node" });
				}
			});

			// Insert menu - navigate to canvas and add
			const handleInsert = (action: string) => {
				if (window.location.pathname !== "/canvas") {
					navigateToCanvas({ action });
				}
			};

			await register("menu:add-person", () => {
				console.log("📋 Menu: Add Person");
				handleInsert("add-person");
			});
			await register("menu:add-system", () => {
				console.log("📋 Menu: Add System");
				handleInsert("add-system");
			});
			await register("menu:add-external", () => {
				console.log("📋 Menu: Add External");
				handleInsert("add-external");
			});
			await register("menu:add-container", () => {
				console.log("📋 Menu: Add Container");
				handleInsert("add-container");
			});
			await register("menu:add-component", () => {
				console.log("📋 Menu: Add Component");
				handleInsert("add-component");
			});

			// View menu (only works on canvas)
			await register("menu:toggle-properties", () => {
				console.log("📋 Menu: Toggle Properties");
				if (window.location.pathname !== "/canvas") {
					navigateToCanvas({ action: "toggle-properties" });
				}
			});
			await register("menu:zoom-in", () => {
				console.log("📋 Menu: Zoom In");
				if (window.location.pathname !== "/canvas") {
					navigateToCanvas({ action: "zoom-in" });
				}
			});
			await register("menu:zoom-out", () => {
				console.log("📋 Menu: Zoom Out");
				if (window.location.pathname !== "/canvas") {
					navigateToCanvas({ action: "zoom-out" });
				}
			});
			await register("menu:zoom-reset", () => {
				console.log("📋 Menu: Zoom Reset");
				if (window.location.pathname !== "/canvas") {
					navigateToCanvas({ action: "zoom-reset" });
				}
			});
		})().catch((error) => {
			console.error("⚠️ Failed to register menu listeners", error);
		});

		// Cleanup listeners on unmount
		return () => {
			console.log("🎧 GlobalMenuListener unmounting");
			isMounted = false;
			unlistenFns.forEach((unlisten) => unlisten());
		};
	}, []);

	// This component doesn't render anything
	return null;
}
