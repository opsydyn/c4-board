/**
 * LayoutMenu Styles - Tactical Theme
 *
 * React Aria Menu styled with tactical/military aesthetic
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";
import { componentsLayer } from "../../styles/layers.css";

/**
 * Menu Trigger Button
 */
export const menuButton = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["2"],
			transition: theme.transition.base,

			// Tactical styling
			clipPath: theme.clipPath.sm,
			border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
			borderRadius: theme.border.radius.none,
			backgroundColor: theme.color.background.surface,

			// Typography
			cursor: "pointer",
			padding: `${theme.spacing["2"]} ${theme.spacing["4"]}`,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wider,
			color: theme.color.foreground.primary,
			fontFamily: theme.typography.family.mono,

			fontSize: theme.typography.size.sm,
			fontWeight: theme.typography.weight.semibold,

			selectors: {
				"&:hover": {
					borderColor: theme.color.status.selected,
					boxShadow: `0 0 12px ${theme.color.status.selected}44`,
					backgroundColor: theme.color.background.raised,
				},
				"&[data-pressed]": {
					transform: "scale(0.98)",
					backgroundColor: theme.color.background.base,
				},
			},
		},
	},
});

export const menuIcon = style({
	"@layer": {
		[componentsLayer]: {
			flexShrink: 0,
			color: theme.color.status.selected,
		},
	},
});

/**
 * Menu Popover Container
 */
export const menuPopover = style({
	"@layer": {
		[componentsLayer]: {
			clipPath: theme.clipPath.md,
			border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
			borderRadius: theme.border.radius.none,
			boxShadow: `0 0 30px ${theme.color.background.base}dd, 0 0 60px ${theme.color.status.selected}22`,
			backgroundColor: theme.color.background.surface,

			backgroundImage: `
				linear-gradient(${theme.color.grid} 1px, transparent 1px),
				linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
			`,
			backgroundSize: "20px 20px",
			minWidth: "380px",

			// Tactical grid background
			maxHeight: "600px",
			overflowY: "auto",

			// Animation
			animation: "slideIn 200ms ease-out",
		},
	},
});

/**
 * Menu Content
 */
export const menuContent = style({
	"@layer": {
		[componentsLayer]: {
			outline: "none",
			padding: theme.spacing["2"],
		},
	},
});

/**
 * Menu Section
 */
export const menuSection = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["2"]} 0`,
		},
	},
});

/**
 * Section Header
 */
export const menuHeader = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,

			textTransform: theme.typography.textTransform.uppercase,
			textShadow: theme.effect.textGlow.sm,
			letterSpacing: theme.typography.letterSpacing.engineering,
			color: theme.color.status.selected,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.xs,

			fontWeight: theme.typography.weight.bold,
		},
	},
});

/**
 * Menu Item
 */
export const menuItem = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["3"],
			transition: theme.transition.base,

			clipPath: theme.clipPath.sm,
			outline: "none",
			border: `${theme.border.width.thin} solid transparent`,
			borderRadius: theme.border.radius.none,

			backgroundColor: "transparent",
			cursor: "pointer",
			padding: `${theme.spacing["3"]} ${theme.spacing["4"]}`,

			color: theme.color.foreground.primary,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,

			selectors: {
				"&:hover, &[data-hovered]": {
					transform: "translateX(4px)",
					borderColor: theme.color.status.selected,
					boxShadow: `0 0 8px ${theme.color.status.selected}33`,
					backgroundColor: theme.color.background.raised,
				},
				"&[data-focused]": {
					borderColor: theme.color.status.selected,
					boxShadow: `0 0 12px ${theme.color.status.selected}55`,
					backgroundColor: theme.color.background.raised,
				},
				"&[data-pressed]": {
					transform: "translateX(2px) scale(0.98)",
					backgroundColor: theme.color.background.base,
				},
			},
		},
	},
});

/**
 * Menu Separator
 */
export const menuSeparator = style({
	"@layer": {
		[componentsLayer]: {
			margin: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
			border: "none",
			backgroundColor: theme.color.border.secondary,
			height: "1px",
		},
	},
});
