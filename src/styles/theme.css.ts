/**
 * Theme System
 *
 * Contract-based theming with type safety and CSS layers.
 * This is the main entry point for the design system.
 */

import { themeContract } from "./theme.contract.css";
import { darkTheme } from "./themes/dark.css";
import { lightTheme } from "./themes/light.css";

/**
 * Theme Contract Vars
 * Use these in your component styles for type-safe theming
 *
 * @example
 * ```ts
 * import { theme } from '@/styles/theme.css';
 *
 * const myStyle = style({
 *   color: theme.color.foreground.primary,
 *   backgroundColor: theme.color.background.surface,
 * });
 * ```
 */
export const theme = themeContract;

/**
 * Default Theme (Dark)
 * Applied by default via Layout.astro
 */
export const defaultTheme = darkTheme;

/**
 * All Available Themes
 * Export for theme switcher
 */
export const themes = {
  dark: darkTheme,
  light: lightTheme,
} as const;

export type ThemeName = keyof typeof themes;
