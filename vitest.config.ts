import { defineConfig } from "vitest/config";
import { effectVitest } from "@effect/vitest";

export default defineConfig({
	plugins: [effectVitest()],
	test: {
		environment: "jsdom",
		setupFiles: "./tests/setup/test-setup.ts",
	},
});
