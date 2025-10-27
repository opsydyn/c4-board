/**
 * SearchBox Styles
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";
import { componentsLayer } from "../../styles/layers.css";

export const searchContainer = style({
	"@layer": {
		[componentsLayer]: {
			position: "relative",
			display: "flex",
			alignItems: "center",
			minWidth: "280px",
		},
	},
});

export const searchInputWrapper = style({
	"@layer": {
		[componentsLayer]: {
			position: "relative",
			display: "flex",
			alignItems: "center",
			width: "100%",
		},
	},
});

export const searchIcon = style({
	"@layer": {
		[componentsLayer]: {
			position: "absolute",
			left: theme.spacing["3"],
			display: "flex",
			alignItems: "center",
			pointerEvents: "none",
			color: theme.color.foreground.tertiary,
		},
	},
});

export const searchInput = style({
	"@layer": {
		[componentsLayer]: {
			transition: theme.transition.base,
			outline: "none",
			border: `${theme.border.width.base} solid ${theme.color.semantic.person}`,
			borderRadius: theme.border.radius.none, // ANGULAR - no rounding
			clipPath: theme.clipPath.sm, // Angled corners
			backgroundColor: theme.color.background.input,
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]} ${theme.spacing["2"]} ${theme.spacing["10"]}`,
			width: "100%",
			color: theme.color.foreground.primary,
			fontFamily: theme.typography.family.mono, // MONOSPACE ONLY
			fontSize: theme.typography.size.sm,
			textTransform: theme.typography.textTransform.uppercase, // UPPERCASE
			letterSpacing: theme.typography.letterSpacing.engineering, // TACTICAL SPACING

			"::placeholder": {
				color: theme.color.foreground.tertiary,
				textTransform: theme.typography.textTransform.uppercase,
			},

			":focus": {
				borderColor: theme.color.status.ready,
				boxShadow: `0 0 12px ${theme.color.status.ready}66`, // Tactical glow
				backgroundColor: theme.color.background.inputFocus,
			},
		},
	},
});

export const resultsDropdown = style({
	"@layer": {
		[componentsLayer]: {
			position: "absolute",
			zIndex: theme.zIndex.dropdown,
			top: "calc(100% + 4px)",
			right: 0,
			left: 0,
			border: `${theme.border.width.base} solid ${theme.color.status.ready}`,
			borderRadius: theme.border.radius.none, // ANGULAR
			clipPath: theme.clipPath.sm, // Angled corners
			boxShadow: `0 0 20px ${theme.color.status.ready}33`, // Tactical glow
			backgroundColor: theme.color.background.surface,
			maxHeight: "400px",
			overflowY: "auto",
		},
	},
});

export const resultItem = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "flex-start",
			gap: theme.spacing["3"],
			transition: theme.transition.fast,
			borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			cursor: "pointer",
			padding: theme.spacing["3"],

			":last-child": {
				borderBottom: "none",
			},

			":hover": {
				backgroundColor: theme.color.background.raised,
			},
		},
	},
});

export const resultBadge = style({
	"@layer": {
		[componentsLayer]: {
			flexShrink: 0,
			borderRadius: theme.border.radius.none, // ANGULAR
			clipPath: theme.clipPath.sm, // Angled corners
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.engineering, // ENGINEERING SPACING
			fontSize: theme.typography.size.xs,
			fontWeight: theme.typography.weight.medium,
			fontFamily: theme.typography.family.mono, // MONOSPACE
		},
	},
});

export const resultContent = style({
	"@layer": {
		[componentsLayer]: {
			flex: 1,
			minWidth: 0,
		},
	},
});

export const resultLabel = style({
	"@layer": {
		[componentsLayer]: {
			marginBottom: theme.spacing["1"],
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: theme.color.foreground.primary,
			fontSize: theme.typography.size.sm,
			fontWeight: theme.typography.weight.semibold,
			fontFamily: theme.typography.family.mono, // MONOSPACE
			textTransform: theme.typography.textTransform.uppercase, // UPPERCASE
			letterSpacing: theme.typography.letterSpacing.wide, // TACTICAL
		},
	},
});

export const resultDescription = style({
	"@layer": {
		[componentsLayer]: {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: theme.color.foreground.secondary,
			fontSize: theme.typography.size.xs,
			fontFamily: theme.typography.family.mono, // MONOSPACE
		},
	},
});

export const emptyState = style({
	"@layer": {
		[componentsLayer]: {
			padding: theme.spacing["6"],
			textAlign: "center",
			color: theme.color.foreground.tertiary,
			fontSize: theme.typography.size.sm,
		},
	},
});

export const kbd = style({
	"@layer": {
		[componentsLayer]: {
			display: "inline-block",
			marginLeft: theme.spacing["2"],
			border: `${theme.border.width.thin} solid ${theme.color.status.ready}`,
			borderRadius: theme.border.radius.none, // ANGULAR
			clipPath: theme.clipPath.sm, // Angled corners
			backgroundColor: theme.color.background.raised,
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.xs,
			textTransform: theme.typography.textTransform.uppercase,
		},
	},
});
