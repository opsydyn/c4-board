import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

export const selectDropdownContainer = style({
	"@layer": {
		[componentsLayer]: {
			position: "relative",
			display: "inline-block",
			width: "100%",
		},
	},
});

export const selectButton = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: theme.spacing["2"],
			width: "100%",
			height: "36px",
			clipPath: theme.clipPath.sm,
			border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
			backgroundColor: theme.color.background.surface,
			color: theme.color.foreground.primary,
			padding: `0 ${theme.spacing["4"]}`,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			fontWeight: theme.typography.weight.semibold,
			cursor: "pointer",
			transition: theme.transition.base,

			":hover": {
				borderColor: theme.color.status.selected,
				boxShadow: `0 0 12px ${theme.color.status.selected}44`,
				backgroundColor: theme.color.background.raised,
			},

			":focus": {
				outline: "none",
				borderColor: theme.color.status.selected,
				boxShadow: `0 0 12px ${theme.color.status.selected}55`,
			},

			":disabled": {
				opacity: theme.opacity.disabled,
				cursor: "not-allowed",
			},
		},
	},
	selectors: {
		'&[aria-expanded="true"]': {
			borderColor: theme.color.status.selected,
			boxShadow: `0 0 12px ${theme.color.status.selected}55`,
		},
	},
});

export const selectMenu = style({
	"@layer": {
		[componentsLayer]: {
			position: "absolute",
			top: "calc(100% + 4px)",
			left: 0,
			right: 0,
			zIndex: theme.zIndex.tooltip,
			clipPath: theme.clipPath.md,
			border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
			backgroundColor: theme.color.background.surface,
			boxShadow: `0 0 30px ${theme.color.background.base}dd, 0 0 60px ${theme.color.status.selected}22`,
			backgroundImage: `
				linear-gradient(${theme.color.grid} 1px, transparent 1px),
				linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
			`,
			backgroundSize: "20px 20px",
			maxHeight: "240px",
			overflowY: "auto",
			listStyle: "none",
			margin: 0,
			padding: theme.spacing["2"],
		},
	},
});

export const selectOption = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			padding: `${theme.spacing["2"]} ${theme.spacing["4"]}`,
			clipPath: theme.clipPath.sm,
			border: `${theme.border.width.thin} solid transparent`,
			color: theme.color.foreground.primary,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			cursor: "pointer",
			transition: theme.transition.base,
			margin: `${theme.spacing["1"]} 0`,
			backgroundColor: "transparent",

			":hover": {
				transform: "translateX(4px)",
				borderColor: theme.color.status.selected,
				boxShadow: `0 0 8px ${theme.color.status.selected}33`,
				backgroundColor: theme.color.background.raised,
			},

			":focus": {
				outline: "none",
				borderColor: theme.color.status.selected,
				boxShadow: `0 0 12px ${theme.color.status.selected}55`,
				backgroundColor: theme.color.background.raised,
			},
		},
	},
});

export const selectOptionActive = style({
	"@layer": {
		[componentsLayer]: {
			borderColor: theme.color.status.selected,
			backgroundColor: theme.color.background.raised,
			color: theme.color.foreground.primary,
			fontWeight: theme.typography.weight.bold,
			boxShadow: `0 0 8px ${theme.color.status.selected}33`,
		},
	},
});
