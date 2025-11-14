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
			hover: "#f0f0f0",      // Light gray hover state
			selected: "#e6f0ff",   // Light blue selected state
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
			// C4 Architecture elements
			person: "#08427B",
			system: "#1168BD",
			external: "#996600",
			container: "#0066cc",   // Blue for containers
			component: "#8855cc",   // Purple for components
			relationship: "#666666",

			// DDD Strategic elements
			boundedContext: "#6366F1", // Indigo-500
			aggregate: "#10B981",      // Emerald-500
			domainEvent: "#F59E0B",    // Amber-500

			// DDD Tactical elements
			entity: "#3B82F6",         // Blue-500
			valueObject: "#06B6D4",    // Cyan-500
			domainService: "#EC4899",  // Pink-500
			repository: "#64748B",     // Slate-500
			factory: "#F97316",        // Orange-500

			// DDD Application elements
			command: "#EF4444",        // Red-500
			query: "#14B8A6",          // Teal-500
			applicationService: "#8B5CF6", // Violet-500

			// DDD Infrastructure elements
			integrationEvent: "#D946EF", // Fuchsia-500
			acl: "#84CC16",            // Lime-500
			saga: "#F43F5E",           // Rose-500
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

			// C4 node borders
			person: "#08427B",
			system: "#1168BD",
			external: "#996600",
			container: "#0066cc",   // Blue border for containers
			component: "#8855cc",   // Purple border for components

			// DDD Strategic borders
			boundedContext: "#6366F1",
			aggregate: "#10B981",
			domainEvent: "#F59E0B",

			// DDD Tactical borders
			entity: "#3B82F6",
			valueObject: "#06B6D4",
			domainService: "#EC4899",
			repository: "#64748B",
			factory: "#F97316",

			// DDD Application borders
			command: "#EF4444",
			query: "#14B8A6",
			applicationService: "#8B5CF6",

			// DDD Infrastructure borders
			integrationEvent: "#D946EF",
			acl: "#84CC16",
			saga: "#F43F5E",
		},

		surface: {
			// C4 node backgrounds
			person: "#E8F4F8",
			system: "#EBF3FA",
			external: "#FFF9E6",
			container: "#E6F0FF",   // Light blue tint for containers
			component: "#F0E6FF",   // Light purple tint for components
			containerSelected: "#CCE0FF", // Slightly darker blue when selected

			// DDD Strategic backgrounds
			boundedContext: "rgba(99, 102, 241, 0.08)",  // Indigo with transparency
			aggregate: "rgba(16, 185, 129, 0.08)",       // Emerald with transparency
			domainEvent: "rgba(245, 158, 11, 0.08)",     // Amber with transparency

			// DDD Tactical backgrounds
			entity: "rgba(59, 130, 246, 0.08)",          // Blue with transparency
			valueObject: "rgba(6, 182, 212, 0.08)",      // Cyan with transparency
			domainService: "rgba(236, 72, 153, 0.08)",   // Pink with transparency
			repository: "rgba(100, 116, 139, 0.08)",     // Slate with transparency
			factory: "rgba(249, 115, 22, 0.08)",         // Orange with transparency

			// DDD Application backgrounds
			command: "rgba(239, 68, 68, 0.08)",          // Red with transparency
			query: "rgba(20, 184, 166, 0.08)",           // Teal with transparency
			applicationService: "rgba(139, 92, 246, 0.08)", // Violet with transparency

			// DDD Infrastructure backgrounds
			integrationEvent: "rgba(217, 70, 239, 0.08)", // Fuchsia with transparency
			acl: "rgba(132, 204, 22, 0.08)",            // Lime with transparency
			saga: "rgba(244, 63, 94, 0.08)",            // Rose with transparency

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
