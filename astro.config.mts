import react from "@astrojs/react";
import type { Plugin } from 'vite';

// import playformCompress from "@playform/compress";
// import playformInline from "@playform/inline";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	vite: {
		plugins: [vanillaExtractPlugin() as unknown as Plugin],
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
