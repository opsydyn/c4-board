import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import tseslint from "typescript-eslint";

const c4OrchestrationHookMatcher =
	"^useC4(?:Commands|Autosave|Navigation)Machine$";

export default defineConfig([
	{
		ignores: ["dist/**", ".astro/**", "coverage/**"],
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: {
			globals: globals.browser,
		},
	},
	tseslint.configs.recommended,
	{
		...pluginReact.configs.flat.recommended,
		settings: {
			react: {
				version: "19.2",
			},
		},
		plugins: {
			react: pluginReact,
		},
		rules: {
			...(pluginReact.configs.flat.recommended?.rules || {}),
			"react/react-in-jsx-scope": "off",
			"no-restricted-syntax": [
				"error",
				{
					selector: `CallExpression[callee.name=/${c4OrchestrationHookMatcher}/] > ObjectExpression > Property[value.type=/^(ArrowFunctionExpression|FunctionExpression)$/]`,
					message:
						"Do not pass inline callbacks into C4 orchestration hooks. Use stable callbacks (useCallback or ref-backed wrappers) to avoid actor churn and render loops.",
				},
				{
					selector: `CallExpression[callee.name=/${c4OrchestrationHookMatcher}/] > ObjectExpression`,
					message:
						"Do not pass inline options objects into C4 orchestration hooks. Memoize options with useMemo to keep hook inputs stable.",
				},
			],
		},
	},
]);
