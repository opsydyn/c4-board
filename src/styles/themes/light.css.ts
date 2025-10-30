/**
 * Light Theme
 *
 * Implements the theme contract with light mode colors.
 * For users who prefer light backgrounds.
 */

import { createTheme } from "@vanilla-extract/css";
import { themeContract } from "../theme.contract.css";

export const lightTheme = createTheme(themeContract, {
	color: {
		background: {
			base: "#f8f9fa",
			surface: "#ffffff",
			raised: "#f0f0f0",
			input: "#ffffff",
			inputFocus: "#ffffff",
		},

		foreground: {
			primary: "#1a1a1a",
			secondary: "#4a4a4a",
			tertiary: "#6a6a6a",
			disabled: "#9a9a9a",
		},

		interactive: {
			primary: "#0066cc",
			hover: "#0052a3",
			active: "#003d7a",
			focus: "#0066cc",
		},

		semantic: {
			person: "#08427B",
			system: "#1168BD",
			external: "#996600",
			container: "#0066cc",   // Blue for containers
			component: "#8855cc",   // Purple for components
			relationship: "#666666",
		},

		status: {
			ready: "#2E7D32",      // Green - operational
			caution: "#F57C00",    // Orange - warning
			critical: "#C62828",   // Red - error
			selected: "#0277BD",   // Blue - focus
		},

		grid: "#d0d0d0",           // Grid line color

		border: {
			primary: "#e0e0e0",
			secondary: "#f0f0f0",
			focus: "#0066cc",
			person: "#08427B",
			system: "#1168BD",
			external: "#996600",
			container: "#0066cc",   // Blue border for containers
			component: "#8855cc",   // Purple border for components
		},

		surface: {
			person: "#E8F4F8",
			system: "#EBF3FA",
			external: "#FFF9E6",
			container: "#E6F0FF",   // Light blue tint for containers
			component: "#F0E6FF",   // Light purple tint for components
			containerSelected: "#CCE0FF", // Slightly darker blue when selected
			// UI overlays - semantic rgba values for compositing
			overlay: "rgba(255, 255, 255, 0.95)",  // Light overlay with opacity
			elevated: "rgba(248, 249, 250, 0.98)",  // Slightly elevated surface
			base: "rgba(255, 255, 255, 0.92)",      // Base panel surface
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
			engineering: "0.15em",
		},
		textTransform: {
			uppercase: "uppercase",
			none: "none",
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
		style: {
			solid: "solid",
			dashed: "dashed",
			dotted: "dotted",
		},
	},

	effect: {
		glow: {
			none: "none",
			sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
			base: "0 1px 3px rgba(0, 0, 0, 0.1)",
			md: "0 2px 6px rgba(0, 0, 0, 0.1)",
			lg: "0 4px 12px rgba(0, 0, 0, 0.1)",
			xl: "0 8px 24px rgba(0, 0, 0, 0.12)",
		},
		textGlow: {
			none: "none",
			sm: "none",
			base: "none",
			md: "none",
		},
		iconGlow: "none",
		dropShadow: "none",
	},

	clipPath: {
		none: "none",
		sm: "none",
		base: "none",
		md: "none",
		lg: "none",
	},

	opacity: {
		disabled: "0.5",
		muted: "0.7",
		overlay: "0.9",
		grid: "0.15",
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
