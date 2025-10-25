import react from "@astrojs/react";
import solidJs from "@astrojs/solid-js";

import playformCompress from "@playform/compress";
import playformInline from "@playform/inline";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	vite: {
		plugins: [
			vanillaExtractPlugin(),
		],
	},
	integrations: [solidJs(), playformInline(), playformCompress(), react()],
});
