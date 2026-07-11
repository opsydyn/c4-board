import vanillaExtract from "@antebudimir/eslint-plugin-vanilla-extract";
import * as effectEslint from "@effect/eslint-plugin";
import js from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: [
      "**/.astro/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "src-tauri/target/**",
      "target/**",
    ],
  },
  ...effectEslint.configs.dprint,
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
    plugins: {
      react: pluginReact,
    },
    rules: {
      ...(pluginReact.configs.flat.recommended?.rules || {}),
      "react/react-in-jsx-scope": "off", // Not needed with React 19 JSX transform
      "@typescript-eslint/no-explicit-any": "warn", // Allow any for now in MVP
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name=/^useC4(?:Commands|Autosave|Navigation)Machine$/] > ObjectExpression > Property[value.type=/^(ArrowFunctionExpression|FunctionExpression)$/]",
          message:
            "Do not pass inline callbacks into C4 orchestration hooks. Use stable callbacks (useCallback or ref-backed wrappers) to avoid actor churn and render loops.",
        },
        {
          selector: "CallExpression[callee.name=/^useC4(?:Commands|Autosave|Navigation)Machine$/] > ObjectExpression",
          message:
            "Do not pass inline options objects into C4 orchestration hooks. Memoize options with useMemo to keep hook inputs stable.",
        },
      ],
    },
  },
  {
    files: ["src/env.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
]);
