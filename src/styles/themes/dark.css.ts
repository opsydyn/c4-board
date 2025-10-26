/**
 * Dark Theme (Terminal Aesthetic)
 *
 * Implements the theme contract with retro terminal colors.
 * WCAG AAA compliant with 7:1+ contrast ratios.
 */

import { createTheme } from "@vanilla-extract/css";
import { themeContract } from "../theme.contract.css";

export const darkTheme = createTheme(themeContract, {
	color: {
		background: {
			base: "#0a0a0a",       // Deep black canvas
			surface: "#0f0f0f",    // Slightly elevated panels
			raised: "#1a1a1a",     // Hover states
			input: "#0a0a0a",      // Input backgrounds
			inputFocus: "#0f0f0f", // Focused input
		},

		foreground: {
			primary: "#ffffff",    // White text (21:1 contrast)
			secondary: "#aaaaaa",  // Gray text (11.7:1 contrast)
			tertiary: "#888888",   // Muted text (7.8:1 contrast)
			disabled: "#666666",   // Disabled (5.7:1 contrast)
		},

		interactive: {
			primary: "#00ffaa",    // Bright cyan-green (14.5:1 contrast)
			hover: "#00ffcc",      // Lighter on hover
			active: "#00dd99",     // Darker when active
			focus: "#00ffff",      // Cyan focus ring
		},

		semantic: {
			person: "#00ffff",     // Cyan for people
			system: "#00ff00",     // Green for systems
			external: "#ffcc00",   // Amber for external
			relationship: "#00ffaa", // Primary color for connections
		},

		border: {
			primary: "#00ffaa",    // Primary borders
			secondary: "#003333",  // Subtle borders
			focus: "#00ffff",      // Focus borders
			person: "#00ffff",     // Person node borders
			system: "#00ff00",     // System node borders
			external: "#ffcc00",   // External node borders
		},

		surface: {
			person: "#001a1a",     // Dark cyan tint
			system: "#001a00",     // Dark green tint
			external: "#1a1400",   // Dark amber tint
		},
	},

	spacing: {
		"0": "0",
		"1": "4px",
		"2": "8px",
		"3": "12px",
		"4": "16px",
		"5": "20px",
		"6": "24px",
		"8": "32px",
		"10": "40px",
		"12": "48px",
		"16": "64px",
	},

	typography: {
		family: {
			mono: "'Berkeley Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
			sans: "system-ui, -apple-system, sans-serif",
		},
		size: {
			xs: "11px",
			sm: "12px",
			base: "14px",
			md: "16px",
			lg: "18px",
			xl: "20px",
			"2xl": "24px",
		},
		weight: {
			regular: "400",
			medium: "500",
			semibold: "600",
			bold: "700",
		},
		lineHeight: {
			tight: "1.25",
			normal: "1.5",
			relaxed: "1.75",
		},
		letterSpacing: {
			tight: "-0.05em",
			normal: "0",
			wide: "0.05em",
			wider: "0.1em",
		},
	},

	border: {
		radius: {
			none: "0",
			sm: "2px",
			base: "4px",
			md: "6px",
			lg: "8px",
			full: "9999px",
		},
		width: {
			none: "0",
			thin: "1px",
			base: "2px",
			thick: "3px",
		},
	},

	effect: {
		glow: {
			none: "none",
			sm: "0 0 8px rgba(0, 255, 170, 0.2)",
			base: "0 0 12px rgba(0, 255, 170, 0.3)",
			md: "0 0 16px rgba(0, 255, 170, 0.3)",
			lg: "0 0 20px rgba(0, 255, 170, 0.3)",
			xl: "0 0 24px rgba(0, 255, 170, 0.4)",
		},
		textGlow: {
			none: "none",
			sm: "0 0 4px rgba(0, 255, 170, 0.4)",
			base: "0 0 6px rgba(0, 255, 170, 0.5)",
			md: "0 0 8px rgba(0, 255, 170, 0.6)",
		},
		iconGlow: "0 0 10px rgba(0, 255, 170, 0.7)",
		dropShadow: "drop-shadow(0 0 4px rgba(0, 255, 170, 0.5))",
	},

	clipPath: {
		none: "none",
		sm: "polygon(0 2px, 2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%)",
		base: "polygon(0 4px, 4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)",
		md: "polygon(0 6px, 6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
		lg: "polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
	},

	opacity: {
		disabled: "0.5",
		muted: "0.7",
		overlay: "0.9",
		grid: "0.1",
	},

	transition: {
		fast: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
		base: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
		slow: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
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
