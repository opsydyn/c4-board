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
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			backgroundColor: theme.color.background.input,
			color: theme.color.foreground.primary,
			padding: `0 ${theme.spacing["2"]}`,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			cursor: "pointer",
			transition: theme.transition.base,

			":hover": {
				borderColor: theme.color.border.primary,
			},

			":focus": {
				outline: "none",
				borderColor: theme.color.border.focus,
				boxShadow: theme.effect.glow.sm,
			},

			":disabled": {
				opacity: theme.opacity.disabled,
				cursor: "not-allowed",
			},

			'[aria-expanded="true"]': {
				borderColor: theme.color.border.focus,
			},
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
			zIndex: 1000,
			clipPath: theme.clipPath.base,
			border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
			backgroundColor: theme.color.background.surface,
			boxShadow: theme.effect.glow.base,
			maxHeight: "240px",
			overflowY: "auto",
			listStyle: "none",
			margin: 0,
			padding: theme.spacing["1"],
		},
	},
});

export const selectOption = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
			clipPath: theme.clipPath.sm,
			color: theme.color.foreground.primary,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			cursor: "pointer",
			transition: theme.transition.fast,
			margin: `${theme.spacing["1"]} 0`,

			":hover": {
				backgroundColor: theme.color.background.hover,
			},

			":focus": {
				outline: "none",
				backgroundColor: theme.color.background.hover,
				boxShadow: `inset 0 0 0 1px ${theme.color.border.focus}`,
			},
		},
	},
});

export const selectOptionActive = style({
	"@layer": {
		[componentsLayer]: {
			backgroundColor: theme.color.background.selected,
			color: theme.color.foreground.primary,
			fontWeight: theme.typography.weight.medium,
		},
	},
});
