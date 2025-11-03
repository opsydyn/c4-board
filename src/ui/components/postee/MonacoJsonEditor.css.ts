import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

export const monacoEditorContainer = style({
	"@layer": {
		[componentsLayer]: {
			width: "100%",
			position: "relative",
		},
	},
});

export const monacoEditorWrapper = style({
	"@layer": {
		[componentsLayer]: {
			clipPath: theme.clipPath.base,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			backgroundColor: theme.color.background.surface,
			overflow: "hidden",

			// Monaco editor specific overrides
			":focus-within": {
				borderColor: theme.color.border.focus,
				boxShadow: theme.effect.glow.sm,
			},
		},
	},
});
