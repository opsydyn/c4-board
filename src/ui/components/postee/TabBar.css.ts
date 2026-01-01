import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

export const tabBar = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			gap: theme.spacing["3"],
			borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			marginBottom: theme.spacing["4"],
		},
	},
});

export const tab = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["3"]} ${theme.spacing["5"]}`,
			border: "none",
			background: "transparent",
			color: theme.color.foreground.secondary,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			textTransform: "uppercase",
			letterSpacing: theme.typography.letterSpacing.wide,
			cursor: "pointer",
			transition: theme.transition.base,
			position: "relative",

			":hover": {
				color: theme.color.foreground.primary,
				backgroundColor: theme.color.background.surface,
			},

			":focus": {
				outline: "none",
				color: theme.color.foreground.primary,
			},
		},
	},
});

export const tabActive = style({
	"@layer": {
		[componentsLayer]: {
			color: theme.color.foreground.primary,
			fontWeight: theme.typography.weight.medium,

			"::after": {
				content: '""',
				position: "absolute",
				bottom: "-1px",
				left: 0,
				right: 0,
				height: "2px",
				backgroundColor: theme.color.interactive.primary,
				boxShadow: theme.effect.glow.sm,
			},
		},
	},
});
