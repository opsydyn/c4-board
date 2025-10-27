/**
 * Theme Contract
 *
 * Defines the structure of our design system tokens.
 * This creates a type-safe contract that all themes must implement.
 */

import { createThemeContract } from "@vanilla-extract/css";

/**
 * Design System Contract
 * All themes (dark, light, custom) must implement this structure
 */
export const themeContract = createThemeContract({
	color: {
		// Background colors - layered from base to surface
		background: {
			base: null,        // Canvas background (deepest layer)
			surface: null,     // Elevated surface (cards, panels)
			raised: null,      // Hover/focus states
			input: null,       // Input field backgrounds
			inputFocus: null,  // Input focus state
		},

		// Foreground colors - text hierarchy
		foreground: {
			primary: null,     // Headings, important text (highest contrast)
			secondary: null,   // Body text, descriptions
			tertiary: null,    // Muted text, placeholders
			disabled: null,    // Disabled state
		},

		// Interactive colors - user actions
		interactive: {
			primary: null,     // Primary actions, links
			hover: null,       // Hover state
			active: null,      // Active/pressed state
			focus: null,       // Focus ring
		},

		// Semantic colors - element types with meaning
		semantic: {
			person: null,      // C4 Person element (cyan)
			system: null,      // C4 System element (green)
			external: null,    // C4 External system (amber)
			container: null,   // C4 Container element (blue)
			component: null,   // C4 Component element (purple)
			relationship: null, // Connections/edges
		},

		// Operational status colors - military/engineering
		status: {
			ready: null,       // Green - normal/operational
			caution: null,     // Amber - warning/unknown
			critical: null,    // Red - error/critical
			selected: null,    // Cyan - focus/selected
		},

		// Grid and structural colors
		grid: null,            // Grid line color

		// Border colors - structural hierarchy
		border: {
			primary: null,     // Main borders
			secondary: null,   // Subtle borders
			focus: null,       // Focus indicator
			person: null,      // Person node border
			system: null,      // System node border
			external: null,    // External system border
			container: null,   // Container node border
			component: null,   // Component node border
		},

		// Surface tints - subtle background colors
		surface: {
			person: null,      // Person node background
			system: null,      // System node background
			external: null,    // External system background
			container: null,   // Container node background
			component: null,   // Component node background
			containerSelected: null, // Container when selected
		},
	},

	// Spacing scale - 4px base (0.25rem)
	spacing: {
		"0": null,    // 0px
		"1": null,    // 4px
		"2": null,    // 8px
		"3": null,    // 12px
		"4": null,    // 16px
		"5": null,    // 20px
		"6": null,    // 24px
		"8": null,    // 32px
		"10": null,   // 40px
		"12": null,   // 48px
		"16": null,   // 64px
	},

	// Typography scale
	typography: {
		// Font families
		family: {
			mono: null,
			sans: null,
		},
		// Font sizes (type scale)
		size: {
			xs: null,   // 11px
			sm: null,   // 12px
			base: null, // 14px
			md: null,   // 16px
			lg: null,   // 18px
			xl: null,   // 20px
			"2xl": null, // 24px
		},
		// Font weights
		weight: {
			regular: null,  // 400
			medium: null,   // 500
			semibold: null, // 600
			bold: null,     // 700
		},
		// Line heights
		lineHeight: {
			tight: null,   // 1.25
			normal: null,  // 1.5
			relaxed: null, // 1.75
		},
		// Letter spacing
		letterSpacing: {
			tight: null,       // -0.05em
			normal: null,      // 0
			wide: null,        // 0.05em
			wider: null,       // 0.1em
			engineering: null, // 0.15em - tactical labels
		},
		// Text transform
		textTransform: {
			uppercase: null,   // UPPERCASE
			none: null,        // normal
		},
	},

	// Border styles
	border: {
		radius: {
			none: null,  // 0
			sm: null,    // 2px
			base: null,  // 4px
			md: null,    // 6px
			lg: null,    // 8px
			full: null,  // 9999px
		},
		width: {
			none: null,  // 0
			thin: null,  // 1px
			base: null,  // 2px
			thick: null, // 3px
		},
		style: {
			solid: null,  // Solid line
			dashed: null, // Dashed line
			dotted: null, // Dotted line
		},
	},

	// Effects - shadows and glows
	effect: {
		// Box shadows (glow effects for terminal aesthetic)
		glow: {
			none: null,
			sm: null,
			base: null,
			md: null,
			lg: null,
			xl: null,
		},
		// Text shadows
		textGlow: {
			none: null,
			sm: null,
			base: null,
			md: null,
		},
		// Icon shadows
		iconGlow: null,
		// Drop shadows for SVG
		dropShadow: null,
	},

	// Clip paths - slanted corners for retro aesthetic
	clipPath: {
		none: null,
		sm: null,   // 2px clips
		base: null, // 4px clips
		md: null,   // 6px clips
		lg: null,   // 8px clips
	},

	// Opacity values
	opacity: {
		disabled: null,
		muted: null,
		overlay: null,
		grid: null,
	},

	// Transitions
	transition: {
		fast: null,
		base: null,
		slow: null,
	},

	// Z-index scale
	zIndex: {
		base: null,
		dropdown: null,
		sticky: null,
		overlay: null,
		modal: null,
		tooltip: null,
	},
});
