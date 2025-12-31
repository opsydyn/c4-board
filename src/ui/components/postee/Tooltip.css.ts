import { style, keyframes } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

const fadeIn = keyframes({
	from: {
		opacity: 0,
		transform: "translateY(4px)",
	},
	to: {
		opacity: 1,
		transform: "translateY(0)",
	},
});

export const tooltipTrigger = style({
	all: "unset",
	display: "inline-flex",
	cursor: "inherit",
});

export const tooltipContent = style({
	position: "absolute",
	bottom: "calc(100% + 8px)",
	left: "50%",
	transform: "translateX(-50%)",
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	backgroundColor: "rgba(12, 20, 16, 0.98)",
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	clipPath: theme.clipPath.sm,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.xs,
	fontWeight: theme.typography.weight.medium,
	whiteSpace: "nowrap",
	pointerEvents: "none",
	zIndex: 1000,
	boxShadow: theme.effect.glow.base,

	"@media": {
		"(prefers-reduced-motion: no-preference)": {
			animation: `${fadeIn} 0.15s ease-out`,
		},
	},

	selectors: {
		"&::before": {
			content: '""',
			position: "absolute",
			top: "100%",
			left: "50%",
			transform: "translateX(-50%)",
			width: 0,
			height: 0,
			borderLeft: "6px solid transparent",
			borderRight: "6px solid transparent",
			borderTop: `6px solid ${theme.color.border.primary}`,
		},
	},
});
