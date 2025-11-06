import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

export const searchContainer = style({
	"@layer": {
		[componentsLayer]: {
			position: "relative",
			width: "100%",
			marginBottom: theme.spacing["2"],
		},
	},
});

export const searchInputWrapper = style({
	"@layer": {
		[componentsLayer]: {
			position: "relative",
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["2"],
			backgroundColor: theme.color.background.surface,
			border: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.border.secondary}`,
			borderRadius: theme.border.radius.md,
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			transition: theme.transition.base,
			":focus-within": {
				borderColor: theme.color.semantic.person,
				boxShadow: theme.effect.glow.sm,
			},
		},
	},
});

export const searchIcon = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			color: theme.color.foreground.secondary,
		},
	},
});

export const searchInput = style({
	"@layer": {
		[componentsLayer]: {
			flex: 1,
			backgroundColor: "transparent",
			border: theme.border.width.none,
			outline: "none",
			color: theme.color.foreground.primary,
			fontSize: theme.typography.size.sm,
			fontFamily: theme.typography.family.mono,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			"::placeholder": {
				color: theme.color.foreground.tertiary,
			},
		},
	},
});

export const resultsDropdown = style({
	"@layer": {
		[componentsLayer]: {
			position: "absolute",
			top: `calc(100% + ${theme.spacing["1"]})`,
			left: 0,
			right: 0,
			maxHeight: "300px",
			overflowY: "auto",
			backgroundColor: theme.color.surface.overlay,
			border: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.semantic.person}`,
			borderRadius: theme.border.radius.md,
			boxShadow: theme.effect.glow.md,
			zIndex: theme.zIndex.dropdown,
		},
	},
});

export const resultItem = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "flex-start",
			gap: theme.spacing["2"],
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
			cursor: "pointer",
			borderBottom: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.border.secondary}`,
			transition: theme.transition.base,
			":hover": {
				backgroundColor: theme.color.surface.elevated,
			},
			":last-child": {
				borderWidth: theme.border.width.none,
			},
		},
	},
});

export const lineNumber = style({
	"@layer": {
		[componentsLayer]: {
			display: "inline-block",
			minWidth: "40px",
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			backgroundColor: theme.color.semantic.person,
			color: theme.color.background.base,
			fontSize: theme.typography.size.xs,
			fontFamily: theme.typography.family.mono,
			fontWeight: theme.typography.weight.bold,
			borderRadius: theme.border.radius.sm,
			textAlign: "center",
			flexShrink: 0,
		},
	},
});

export const resultContent = style({
	"@layer": {
		[componentsLayer]: {
			flex: 1,
			minWidth: 0,
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["1"],
		},
	},
});

export const resultText = style({
	"@layer": {
		[componentsLayer]: {
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			color: theme.color.foreground.primary,
			lineHeight: theme.typography.lineHeight.normal,
			wordBreak: "break-all",
			whiteSpace: "pre-wrap",
		},
	},
});

globalStyle(`${resultText} mark`, {
	backgroundColor: theme.color.semantic.person,
	color: theme.color.background.base,
	fontWeight: theme.typography.weight.bold,
	padding: `${theme.spacing["0"]} ${theme.spacing["1"]}`,
	borderRadius: theme.border.radius.sm,
});

export const emptyState = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["4"]} ${theme.spacing["3"]}`,
			textAlign: "center",
			color: theme.color.foreground.tertiary,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			letterSpacing: theme.typography.letterSpacing.wider,
		},
	},
});

export const kbd = style({
	"@layer": {
		[componentsLayer]: {
			display: "inline-block",
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			backgroundColor: theme.color.surface.elevated,
			border: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.border.primary}`,
			borderRadius: theme.border.radius.sm,
			fontSize: theme.typography.size.xs,
			fontFamily: theme.typography.family.mono,
			color: theme.color.foreground.secondary,
			lineHeight: theme.typography.lineHeight.tight,
		},
	},
});
