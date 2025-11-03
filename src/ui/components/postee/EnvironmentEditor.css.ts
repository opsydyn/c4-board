import { style, globalStyle } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

const bevel = "0.5rem";

export const editorContainer = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["4"],
			padding: theme.spacing["4"],
			backgroundColor: theme.color.background.surface,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
		},
	},
});

export const editorHeader = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["4"],
			paddingBottom: theme.spacing["4"],
			borderBottom: `1px solid ${theme.color.border.secondary}`,
		},
	},
});

export const environmentSelector = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["2"],
			flex: 1,
		},
	},
});

export const selectTrigger = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: theme.spacing["2"],
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
			backgroundColor: theme.color.background.input,
			color: theme.color.foreground.primary,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
			cursor: "pointer",
			fontSize: theme.typography.size.md,
			fontFamily: theme.typography.family.mono,
			transition: "all 0.2s ease",

			selectors: {
				"&:hover": {
					backgroundColor: theme.color.background.raised,
					borderColor: theme.color.border.focus,
				},
				"&:focus-visible": {
					outline: `2px solid ${theme.color.border.focus}`,
					outlineOffset: "2px",
				},
			},
		},
	},
});

export const selectPopover = style({
	"@layer": {
		[componentsLayer]: {
			backgroundColor: theme.color.background.surface,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
			padding: theme.spacing["2"],
			maxHeight: "300px",
			overflow: "auto",
		},
	},
});

export const environmentActions = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			gap: theme.spacing["2"],
		},
	},
});

export const variableList = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["2"],
		},
	},
});

export const variableRow = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["2"],
			padding: theme.spacing["2"],
			backgroundColor: theme.color.background.surface,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
			transition: "all 0.2s ease",

			selectors: {
				"&:hover": {
					backgroundColor: theme.color.background.raised,
				},
			},
		},
	},
});

export const variableCheckbox = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			cursor: "pointer",
		},
	},
});

export const checkboxIndicator = style({
	"@layer": {
		[componentsLayer]: {
			width: "16px",
			height: "16px",
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				2px 0%,
				100% 0%,
				100% calc(100% - 2px),
				calc(100% - 2px) 100%,
				0% 100%,
				0% 2px
			)`,
			backgroundColor: theme.color.background.input,
			transition: "all 0.2s ease",

			selectors: {
				[`${variableCheckbox}[data-selected] &`]: {
					backgroundColor: theme.color.interactive.primary,
					borderColor: theme.color.interactive.primary,
				},
				[`${variableCheckbox}:hover &`]: {
					borderColor: theme.color.border.focus,
				},
			},
		},
	},
});

export const variableKeyInput = style({
	"@layer": {
		[componentsLayer]: {
			flex: "0 0 200px",
		},
	},
});

globalStyle(`${variableKeyInput} input`, {
	"@layer": {
		[componentsLayer]: {
			width: "100%",
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
			backgroundColor: theme.color.background.input,
			color: theme.color.foreground.primary,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
			fontSize: theme.typography.size.sm,
			fontFamily: theme.typography.family.mono,
			textTransform: "uppercase",
			transition: "all 0.2s ease",
		},
	},
});

globalStyle(`${variableKeyInput} input:focus`, {
	"@layer": {
		[componentsLayer]: {
			outline: "none",
			borderColor: theme.color.border.focus,
			backgroundColor: theme.color.background.inputFocus,
		},
	},
});

globalStyle(`${variableKeyInput} input::placeholder`, {
	"@layer": {
		[componentsLayer]: {
			color: theme.color.foreground.tertiary,
			textTransform: "uppercase",
		},
	},
});

export const variableValueInput = style({
	"@layer": {
		[componentsLayer]: {
			flex: 1,
		},
	},
});

globalStyle(`${variableValueInput} input`, {
	"@layer": {
		[componentsLayer]: {
			width: "100%",
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
			backgroundColor: theme.color.background.input,
			color: theme.color.foreground.primary,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
			fontSize: theme.typography.size.sm,
			fontFamily: theme.typography.family.mono,
			transition: "all 0.2s ease",
		},
	},
});

globalStyle(`${variableValueInput} input:focus`, {
	"@layer": {
		[componentsLayer]: {
			outline: "none",
			borderColor: theme.color.border.focus,
			backgroundColor: theme.color.background.inputFocus,
		},
	},
});

globalStyle(`${variableValueInput} input::placeholder`, {
	"@layer": {
		[componentsLayer]: {
			color: theme.color.foreground.tertiary,
		},
	},
});

export const secretValue = style({
	"@layer": {
		[componentsLayer]: {
			fontFamily: theme.typography.family.mono,
			letterSpacing: "0.2em",
		},
	},
});

export const secretToggle = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			padding: theme.spacing["2"],
			backgroundColor: theme.color.background.input,
			color: theme.color.foreground.secondary,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
			cursor: "pointer",
			transition: "all 0.2s ease",

			selectors: {
				"&:hover": {
					backgroundColor: theme.color.background.raised,
					color: theme.color.foreground.primary,
					borderColor: theme.color.border.focus,
				},
			},
		},
	},
});

export const deleteButton = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			padding: theme.spacing["2"],
			backgroundColor: theme.color.background.input,
			color: theme.color.status.critical,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
			cursor: "pointer",
			transition: "all 0.2s ease",

			selectors: {
				"&:hover": {
					backgroundColor: theme.color.status.critical,
					color: theme.color.foreground.primary,
					borderColor: theme.color.status.critical,
				},
			},
		},
	},
});

export const addButton = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["2"],
			padding: `${theme.spacing["2"]} ${theme.spacing["4"]}`,
			backgroundColor: theme.color.background.input,
			color: theme.color.foreground.primary,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
			cursor: "pointer",
			fontSize: theme.typography.size.sm,
			fontWeight: theme.typography.weight.medium,
			transition: "all 0.2s ease",

			selectors: {
				"&:hover": {
					backgroundColor: theme.color.interactive.primary,
					color: theme.color.foreground.primary,
					borderColor: theme.color.interactive.hover,
				},
			},
		},
	},
});
