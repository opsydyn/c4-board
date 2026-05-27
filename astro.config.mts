import react from "@astrojs/react";
// import playformCompress from "@playform/compress";
// import playformInline from "@playform/inline";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "astro/config";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://astro.build/config
export default defineConfig({
	vite: {
		optimizeDeps: {
			entries: [
				"src/pages/postee.astro",
				"src/core/effects/postee/**/*.ts",
				"src/ui/components/postee/**/*.tsx",
				"src/ui/machines/postee.machine.ts",
			],
			// Prebundle Postee-only dependencies at startup so the first /postee visit
			// does not invalidate the optimizer and strand the island hydration request.
			include: [
				"@effect/typeclass",
				"@monaco-editor/loader",
				"@monaco-editor/react",
				"@tauri-apps/api/core",
				"@tauri-apps/plugin-http",
				"@vanilla-extract/recipes/createRuntimeFn",
				"@vanilla-extract/sprinkles/createRuntimeSprinkles",
				"@visx/glyph",
				"@visx/group",
				"@visx/scale",
				"@visx/shape",
				"effect",
				"monaco-editor",
			],
		},
		plugins: [
			// Astro bundles its own Vite types; these plugins are runtime-compatible.
			// @ts-expect-error Plugin type mismatch between Astro's bundled Vite and workspace Vite.
			vanillaExtractPlugin(),
			// @ts-expect-error Plugin type mismatch between Astro's bundled Vite and workspace Vite.
			viteStaticCopy({
				targets: [
					{
						src: "node_modules/monaco-editor/min/vs",
						dest: "monaco",
					},
				],
			}),
		],
		resolve: {
			alias: {
				"@/ui": "/src/ui",
				"@/core": "/src/core",
				"@/schema": "/src/core/schema",
				"@ui": "/src/ui",
				"@core": "/src/core",
				"@schema": "/src/core/schema",
			},
		},
	},
	integrations: [
		// React for all components
		react(),
		// playformInline(),
		// playformCompress(),
	],
});
