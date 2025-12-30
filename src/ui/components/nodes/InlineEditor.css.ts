/**
 * InlineEditor Styles (Vanilla Extract)
 *
 * Type-safe styles for the Lexical inline editor component
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

export const inlineEditorContainer = style({
	"@layer": {
		[componentsLayer]: {
			position: "relative",
			width: "100%",
			minHeight: "1.5rem",
		},
	},
});

export const inlineEditorContentEditable = style({
	"@layer": {
		[componentsLayer]: {
			outline: "none",
			clipPath: theme.clipPath.sm,
			border: `${theme.border.width.thin} solid ${theme.color.border.focus}`,
			padding: theme.spacing["2"],
			backgroundColor: theme.color.background.surface,
			color: theme.color.foreground.primary,
			fontFamily: theme.typography.family.sans,
			fontSize: theme.typography.size.sm,
			lineHeight: theme.typography.lineHeight.normal,
			minHeight: "2rem",
			maxHeight: "10rem",
			overflowY: "auto",
			cursor: "text",

			":focus": {
				boxShadow: theme.effect.glow.sm,
				borderColor: theme.color.status.selected,
			},
		},
	},
});

export const inlineEditorPlaceholder = style({
	"@layer": {
		[componentsLayer]: {
			color: theme.color.foreground.tertiary,
			position: "absolute",
			top: theme.spacing["2"],
			left: theme.spacing["2"],
			pointerEvents: "none",
			userSelect: "none",
			fontSize: theme.typography.size.sm,
			lineHeight: theme.typography.lineHeight.normal,
		},
	},
});

export const inlineEditorError = style({
	"@layer": {
		[componentsLayer]: {
			color: theme.color.status.critical,
			fontSize: theme.typography.size.xs,
			marginTop: theme.spacing["1"],
			padding: theme.spacing["1"],
			backgroundColor: `${theme.color.status.critical}15`,
			clipPath: theme.clipPath.sm,
		},
	},
});
