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
			// ts-ignore because of missing types
			...vanillaExtract.configs.recommended.rules,
		},
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: { globals: globals.browser },
	},
	tseslint.configs.recommended,
	{
		...pluginReact.configs.flat.recommended,
		settings: {
			react: {
				version: "19.2",
			},
		},
		rules: {
			...(pluginReact.configs.flat.recommended?.rules || {}),
			"react/react-in-jsx-scope": "off", // Not needed with React 19 JSX transform
			"@typescript-eslint/no-explicit-any": "warn", // Allow any for now in MVP
		},
	},
]);
