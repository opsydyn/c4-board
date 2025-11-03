import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

export const headersContainer = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["2"],
		},
	},
});

export const headerRow = style({
	"@layer": {
		[componentsLayer]: {
			display: "grid",
			gridTemplateColumns: "auto 1fr 2fr auto",
			gap: theme.spacing["2"],
			alignItems: "center",
		},
	},
});

export const headerCheckbox = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "20px",
			height: "20px",
			cursor: "pointer",

			// React Aria checkbox styling
			"::before": {
				content: '""',
				display: "block",
				width: "16px",
				height: "16px",
				clipPath: theme.clipPath.sm,
				border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
				backgroundColor: theme.color.background.input,
				transition: theme.transition.base,
			},

			// '[data-selected]::before': {
			// 	backgroundColor: theme.color.interactive.primary,
			// 	borderColor: theme.color.interactive.primary,
			// },

			// ":hover::before": {
			// 	borderColor: theme.color.border.primary,
			// },
		},
	},
});

export const headerInput = style({
	"@layer": {
		[componentsLayer]: {
			height: "32px",
			clipPath: theme.clipPath.sm,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			backgroundColor: theme.color.background.input,
			color: theme.color.foreground.primary,
			padding: `0 ${theme.spacing["2"]}`,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			transition: theme.transition.base,

			":focus": {
				outline: "none",
				borderColor: theme.color.border.focus,
				boxShadow: theme.effect.glow.sm,
			},
		},
	},
});

export const headerKeyInput = style({});

export const headerValueInput = style({});

export const headerDeleteButton = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "32px",
			height: "32px",
			clipPath: theme.clipPath.sm,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			backgroundColor: "transparent",
			color: theme.color.status.critical,
			cursor: "pointer",
			transition: theme.transition.base,

			":hover": {
				backgroundColor: theme.color.status.critical,
				color: theme.color.background.base,
				borderColor: theme.color.status.critical,
			},
		},
	},
});

export const headerAddButton = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["2"],
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
			clipPath: theme.clipPath.sm,
			border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
			backgroundColor: "transparent",
			color: theme.color.foreground.primary,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			cursor: "pointer",
			transition: theme.transition.base,
			width: "fit-content",

			":hover": {
				backgroundColor: theme.color.background.surface,
				boxShadow: theme.effect.glow.sm,
			},
		},
	},
});
