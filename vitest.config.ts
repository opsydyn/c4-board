import { defineConfig, Plugin } from "vitest/config";
import path from "node:path";

// Custom plugin to mock Vanilla Extract CSS files in tests
function vanillaExtractMock(): Plugin {
	return {
		name: "vanilla-extract-mock",
		enforce: "pre",
		resolveId(id) {
			// Intercept all .css.ts imports
			if (id.endsWith(".css.ts") || id.endsWith(".css")) {
				return path.resolve(__dirname, "./tests/mocks/vanilla-extract.mock.ts");
			}
			return null;
		},
	};
}

export default defineConfig({
	plugins: [vanillaExtractMock()],
	resolve: {
		alias: {
			// Mock Vanilla Extract package in tests
			"@vanilla-extract/css": path.resolve(__dirname, "./tests/mocks/@vanilla-extract/css.ts"),
			// Project aliases
			"@/ui": path.resolve(__dirname, "./src/ui"),
			"@/core": path.resolve(__dirname, "./src/core"),
			"@/schema": path.resolve(__dirname, "./src/core/schema"),
			"@ui": path.resolve(__dirname, "./src/ui"),
			"@core": path.resolve(__dirname, "./src/core"),
			"@schema": path.resolve(__dirname, "./src/core/schema"),
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: "./tests/setup/test-setup.ts",
		// Additional alias configuration specifically for test environment
		alias: {
			"@vanilla-extract/css": path.resolve(__dirname, "./tests/mocks/@vanilla-extract/css.ts"),
		},
	},
});
