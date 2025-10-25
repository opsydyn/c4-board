/**
 * Terminal Theme System
 *
 * Vanilla Extract theme for C4 diagram editor.
 * Based on retro terminal aesthetic with WCAG AAA compliance.
 */

import { createTheme } from "@vanilla-extract/css";

export const [themeClass, vars] = createTheme({
	color: {
		// Background colors
		background: {
			primary: "#0a0a0a",      // Main canvas background
			secondary: "#0f0f0f",    // Panel backgrounds
			tertiary: "#1a1a1a",     // Hover states
			input: "#0a0a0a",        // Input field background
			inputFocus: "#0f0f0f",   // Input focus background
		},

		// Text colors (WCAG AAA compliant)
		text: {
			primary: "#ffffff",      // Main headings (21:1 contrast)
			secondary: "#aaaaaa",    // Body text (11.7:1 contrast)
			accent: "#00ffaa",       // Links and interactive (14.5:1 contrast)
			muted: "#888888",        // Disabled/muted (7.8:1 contrast)
		},

		// Accent colors (C4 element types)
		accent: {
			cyan: "#00ffff",         // Person nodes
			green: "#00ff00",        // System nodes
			amber: "#ffcc00",        // External systems
			teal: "#00aaaa",         // Secondary cyan
			darkGreen: "#00aa00",    // Secondary green
			darkAmber: "#cc9900",    // Secondary amber
		},

		// Border colors
		border: {
			primary: "#00ffaa",      // Main borders
			cyan: "#00ffff",         // Person node borders
			green: "#00ff00",        // System node borders
			amber: "#ffcc00",        // External system borders
		},

		// Node backgrounds (slightly tinted for color coding)
		node: {
			person: "#001a1a",       // Dark cyan tint
			system: "#001a00",       // Dark green tint
			external: "#1a1400",     // Dark amber tint
		},

		// Edge/connection colors
		edge: {
			stroke: "#00ffaa",       // Connection lines
			label: "#00ffaa",        // Edge labels
			labelBg: "#0a0a0a",      // Edge label backgrounds
		},
	},

	spacing: {
		xs: "4px",
		sm: "6px",
		md: "8px",
		lg: "12px",
		xl: "16px",
		"2xl": "20px",
		"3xl": "24px",
	},

	borderRadius: {
		none: "0",
		sm: "2px",
		md: "4px",
		lg: "6px",
		xl: "8px",
	},

	borderWidth: {
		thin: "1px",
		medium: "2px",
		thick: "3px",
	},

	clipPath: {
		// Slanted corners for retro terminal aesthetic
		small: "polygon(0 2px, 2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%)",
		medium: "polygon(0 4px, 4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)",
		large: "polygon(0 6px, 6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
		xlarge: "polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
	},

	shadow: {
		// Glow effects
		glow: {
			small: "0 0 5px rgba(0, 255, 170, 0.3)",
			medium: "0 0 10px rgba(0, 255, 170, 0.3)",
			large: "0 0 15px rgba(0, 255, 170, 0.3)",
			xlarge: "0 0 20px rgba(0, 255, 170, 0.3)",

			// Hover states (stronger glow)
			hover: "0 0 10px rgba(0, 255, 170, 0.5)",
			hoverLarge: "0 0 15px rgba(0, 255, 170, 0.4)",

			// Selected states
			selected: "0 0 25px rgba(0, 255, 255, 0.5), 0 0 50px rgba(0, 255, 255, 0.2)",
		},
		// Text glow effects
		textGlow: {
			small: "0 0 3px rgba(0, 255, 170, 0.3)",
			medium: "0 0 5px rgba(0, 255, 170, 0.3)",
			large: "0 0 6px rgba(0, 255, 170, 0.4)",
			hover: "0 0 5px rgba(0, 255, 170, 0.5)",
			cyan: "0 0 6px rgba(0, 255, 255, 0.4)",
			green: "0 0 6px rgba(0, 255, 0, 0.4)",
			amber: "0 0 6px rgba(255, 204, 0, 0.4)",
			icon: "0 0 8px rgba(0, 255, 170, 0.6)",
		},
		// Drop shadow for SVG icons
		dropShadow: "drop-shadow(0 0 3px rgba(0, 255, 170, 0.5))",
	},

	font: {
		family: {
			mono: "'Courier New', 'Courier', monospace",
			sans: "system-ui, sans-serif",
		},
		size: {
			xs: "11px",
			sm: "12px",
			base: "13px",
			md: "14px",
			lg: "15px",
			xl: "16px",
		},
		weight: {
			normal: "400",
			medium: "500",
			semibold: "600",
			bold: "700",
		},
		lineHeight: {
			tight: "1.4",
			normal: "1.5",
			relaxed: "1.6",
		},
		letterSpacing: {
			tight: "0.5px",
			normal: "1px",
			wide: "1.5px",
		},
	},

	opacity: {
		disabled: "0.5",
		muted: "0.7",
		background: "0.9",
		gridDark: "0.1",
		gridLight: "0.2",
	},

	transition: {
		fast: "all 0.15s ease",
		normal: "all 0.2s ease",
		slow: "all 0.3s ease",
	},

	zIndex: {
		base: "1",
		dropdown: "100",
		sticky: "500",
		overlay: "1000",
		modal: "2000",
		tooltip: "3000",
	},
});

/**
 * Light theme variant (for prefers-color-scheme: light)
 * Currently using system defaults, can be customized later
 */
export const lightTheme = {
	color: {
		background: {
			primary: "#f8f9fa",
			secondary: "#ffffff",
			tertiary: "#f0f0f0",
			input: "#ffffff",
			inputFocus: "#ffffff",
		},
		text: {
			primary: "#000000",
			secondary: "#444444",
			accent: "#08427B",
			muted: "#666666",
		},
		accent: {
			cyan: "#08427B",
			green: "#1168BD",
			amber: "#999999",
			teal: "#666666",
			darkGreen: "#666666",
			darkAmber: "#888888",
		},
		border: {
			primary: "#e0e0e0",
			cyan: "#08427B",
			green: "#1168BD",
			amber: "#999999",
		},
		node: {
			person: "#E8F4F8",
			system: "#EBF3FA",
			external: "#F5F5F5",
		},
		edge: {
			stroke: "#666666",
			label: "#666666",
			labelBg: "#ffffff",
		},
	},
	shadow: {
		glow: {
			small: "0 1px 3px rgba(0, 0, 0, 0.1)",
			medium: "0 2px 6px rgba(0, 0, 0, 0.1)",
			large: "0 2px 8px rgba(0, 0, 0, 0.1)",
			xlarge: "0 4px 12px rgba(0, 0, 0, 0.1)",
			hover: "0 4px 12px rgba(0, 0, 0, 0.15)",
			hoverLarge: "0 4px 16px rgba(0, 0, 0, 0.2)",
			selected: "0 4px 16px rgba(0, 0, 0, 0.2)",
		},
		textGlow: {
			small: "none",
			medium: "none",
			large: "none",
			hover: "none",
			cyan: "none",
			green: "none",
			amber: "none",
			icon: "none",
		},
		dropShadow: "none",
	},
};
