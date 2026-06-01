/**
 * CSS Cascade Layers
 *
 * Defines the layer order for predictable cascade control.
 * Layers are applied in order of declaration (first = lowest priority).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@layer
 */

import { globalLayer, layer } from "@vanilla-extract/css";

/**
 * Global layer definition
 * Establishes the cascade order for the entire app
 */
globalLayer("reset, theme, base, components, utilities, overrides");

/**
 * Reset Layer
 * Browser resets and normalizations (lowest priority)
 */
export const resetLayer = layer("reset");

/**
 * Theme Layer
 * CSS custom properties from theme contracts
 */
export const themeLayer = layer("theme");

/**
 * Base Layer
 * Default element styles (typography, colors)
 */
export const baseLayer = layer("base");

/**
 * Components Layer
 * Component-specific styles (cards, buttons, inputs)
 */
export const componentsLayer = layer("components");

/**
 * Utilities Layer
 * Utility classes and helpers
 */
export const utilitiesLayer = layer("utilities");

/**
 * Overrides Layer
 * Emergency overrides and third-party CSS fixes (highest priority)
 */
export const overridesLayer = layer("overrides");
