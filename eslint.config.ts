import vanillaExtract from "@antebudimir/eslint-plugin-vanilla-extract";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
	{
		files: ["**/*.css.ts"],
		ignores: ["src/**/theme-contract.css.ts"],
		plugins: {
			"vanilla-extract": vanillaExtract,
		},
		rules: {
			// Apply all recommended rules
			...vanillaExtract.configs.recommended.rules,

			// Optionally override specific rules
			// 'vanilla-extract/concentric-order': 'warn', // Change severity from error to warn
			// 'vanilla-extract/no-empty-style-blocks': 'off', // Disable a recommended rule
			// 'vanilla-extract/no-zero-unit': 'warn', // Change severity from error to warn

			// Switch to a different ordering rule (see "Important" section below)
			// 'vanilla-extract/concentric-order': 'off',
			// 'vanilla-extract/alphabetical-order': 'error',
		},
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: { globals: globals.browser },
	},
	tseslint.configs.recommended,
	pluginReact.configs.flat.recommended,
]);
