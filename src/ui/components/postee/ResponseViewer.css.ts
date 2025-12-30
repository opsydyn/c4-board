import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

export const responseViewerContainer = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["3"],
			backgroundColor: theme.color.background.surface,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: theme.clipPath.base,
			padding: theme.spacing["4"],
		},
	},
});

export const responseViewerHeader = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			gap: theme.spacing["4"],
			flexWrap: "wrap",
			fontSize: theme.typography.size.sm,
			color: theme.color.foreground.secondary,
			paddingBottom: theme.spacing["3"],
			borderBottom: `1px solid ${theme.color.border.secondary}`,
		},
	},
});

export const responseViewerContent = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["2"],
		},
	},
});

export const toggleButton = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["2"],
			padding: `${theme.spacing["2"]} 0`,
			backgroundColor: "transparent",
			border: "none",
			color: theme.color.foreground.primary,
			fontSize: theme.typography.size.sm,
			cursor: "pointer",
			textAlign: "left",
			transition: "color 0.2s ease",

			":hover": {
				color: theme.color.interactive.primary,
			},
		},
	},
});
