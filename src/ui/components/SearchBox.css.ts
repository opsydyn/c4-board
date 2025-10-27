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
			pointerEvents: "none",
			color: theme.color.foreground.tertiary,
			display: "flex",
			alignItems: "center",
		},
	},
});

export const searchInput = style({
	"@layer": {
		[componentsLayer]: {
			width: "100%",
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]} ${theme.spacing["2"]} ${theme.spacing["10"]}`,
			backgroundColor: theme.color.background.input,
			border: `${theme.border.width.medium} solid ${theme.color.semantic.person}`,
			borderRadius: theme.border.radius.md,
			color: theme.color.foreground.primary,
			fontSize: theme.typography.size.sm,
			fontFamily: theme.typography.family.sans,
			transition: theme.transition.base,
			outline: "none",

			"::placeholder": {
				color: theme.color.foreground.tertiary,
			},

			":focus": {
				backgroundColor: theme.color.background.inputFocus,
				borderColor: theme.color.semantic.person,
				boxShadow: `0 0 0 3px ${theme.color.semantic.person}33`,
			},
		},
	},
});

export const resultsDropdown = style({
	"@layer": {
		[componentsLayer]: {
			position: "absolute",
			top: "calc(100% + 4px)",
			left: 0,
			right: 0,
			maxHeight: "400px",
			overflowY: "auto",
			backgroundColor: theme.color.background.surface,
			border: `${theme.border.width.medium} solid ${theme.color.semantic.person}`,
			borderRadius: theme.border.radius.md,
			boxShadow: theme.effect.glow.lg,
			zIndex: theme.zIndex.dropdown,
		},
	},
});

export const resultItem = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "flex-start",
			gap: theme.spacing["3"],
			padding: theme.spacing["3"],
			cursor: "pointer",
			transition: theme.transition.fast,
			borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,

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
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			borderRadius: theme.border.radius.sm,
			fontSize: theme.typography.size.xs,
			fontWeight: theme.typography.weight.medium,
			textTransform: "uppercase",
			letterSpacing: theme.typography.letterSpacing.wide,
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
			fontSize: theme.typography.size.sm,
			fontWeight: theme.typography.weight.semibold,
			color: theme.color.foreground.primary,
			marginBottom: theme.spacing["1"],
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
	},
});

export const resultDescription = style({
	"@layer": {
		[componentsLayer]: {
			fontSize: theme.typography.size.xs,
			color: theme.color.foreground.secondary,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
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
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			fontSize: theme.typography.size.xs,
			fontFamily: theme.typography.family.mono,
			backgroundColor: theme.color.background.raised,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			borderRadius: theme.border.radius.sm,
			marginLeft: theme.spacing["2"],
		},
	},
});
