import { globalStyle, style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

const bevel = "0.5rem";

export const editorContainer = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["4"],
      clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.surface,
      padding: theme.spacing["4"],
    },
  },
});

export const editorHeader = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing["4"],
      borderBottom: `1px solid ${theme.color.border.secondary}`,
      paddingBottom: theme.spacing["4"],
    },
  },
});

export const environmentSelector = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flex: 1,
      flexDirection: "column",
      gap: theme.spacing["2"],
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
      transition: "all 0.2s ease",
      clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      cursor: "pointer",
      padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.md,

      selectors: {
        "&:hover": {
          borderColor: theme.color.border.focus,
          backgroundColor: theme.color.background.raised,
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
      clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.surface,
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
      transition: "all 0.2s ease",
      clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.surface,
      padding: theme.spacing["2"],

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

export const checkboxField = style({
  display: "contents",
});

export const checkboxIndicator = style({
  "@layer": {
    [componentsLayer]: {
      transition: "all 0.2s ease",
      clipPath: `polygon(
				2px 0%,
				100% 0%,
				100% calc(100% - 2px),
				calc(100% - 2px) 100%,
				0% 100%,
				0% 2px
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      width: "16px",
      height: "16px",

      selectors: {
        [`${variableCheckbox}[data-selected] &`]: {
          borderColor: theme.color.interactive.primary,
          backgroundColor: theme.color.interactive.primary,
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
      transition: "all 0.2s ease",
      clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
      width: "100%",
      textTransform: "uppercase",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
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
      textTransform: "uppercase",
      color: theme.color.foreground.tertiary,
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
      transition: "all 0.2s ease",
      clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
      width: "100%",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
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
      letterSpacing: "0.2em",
      fontFamily: theme.typography.family.mono,
    },
  },
});

export const secretToggle = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s ease",
      clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      cursor: "pointer",
      padding: theme.spacing["2"],
      color: theme.color.foreground.secondary,

      selectors: {
        "&:hover": {
          borderColor: theme.color.border.focus,
          backgroundColor: theme.color.background.raised,
          color: theme.color.foreground.primary,
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
      transition: "all 0.2s ease",
      clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      cursor: "pointer",
      padding: theme.spacing["2"],
      color: theme.color.status.critical,

      selectors: {
        "&:hover": {
          borderColor: theme.color.status.critical,
          backgroundColor: theme.color.status.critical,
          color: theme.color.foreground.primary,
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
      transition: "all 0.2s ease",
      clipPath: `polygon(
				${bevel} 0%,
				100% 0%,
				100% calc(100% - ${bevel}),
				calc(100% - ${bevel}) 100%,
				0% 100%,
				0% ${bevel}
			)`,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      cursor: "pointer",
      padding: `${theme.spacing["2"]} ${theme.spacing["4"]}`,
      color: theme.color.foreground.primary,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.weight.medium,

      selectors: {
        "&:hover": {
          borderColor: theme.color.interactive.hover,
          backgroundColor: theme.color.interactive.primary,
          color: theme.color.foreground.primary,
        },
      },
    },
  },
});
