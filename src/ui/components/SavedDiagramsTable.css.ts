/**
 * SavedDiagramsTable Styles
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";
import { componentsLayer } from "../../styles/layers.css";

export const table = style({
	"@layer": {
		[componentsLayer]: {
			width: "100%",
			borderCollapse: "collapse",
			fontFamily: theme.typography.family.sans,
			fontSize: theme.typography.size.sm,
			backgroundColor: theme.color.background.surface,
			border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
			borderRadius: theme.border.radius.md,
			overflow: "hidden",
		},
	},
});

export const tableHeader = style({
	"@layer": {
		[componentsLayer]: {
			backgroundColor: theme.color.background.raised,
			borderBottom: `${theme.border.width.base} solid ${theme.color.border.primary}`,
		},
	},
});

export const tableRow = style({
	"@layer": {
		[componentsLayer]: {
			borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			transition: "background-color 0.15s ease",

			":hover": {
				backgroundColor: theme.color.background.raised,
			},

			":last-child": {
				borderBottom: "none",
			},
		},
	},
});

export const tableCell = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["3"]} ${theme.spacing["4"]}`,
			textAlign: "left",
			color: theme.color.foreground.primary,

			selectors: {
				[`${tableHeader} &`]: {
					fontWeight: theme.typography.weight.semibold,
					color: theme.color.foreground.secondary,
					fontSize: theme.typography.size.xs,
					textTransform: "uppercase",
					letterSpacing: "0.05em",
				},
			},
		},
	},
});
