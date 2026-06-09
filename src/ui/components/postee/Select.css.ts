import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

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
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
      backgroundColor: theme.color.background.surface,
      cursor: "pointer",
      padding: `0 ${theme.spacing["4"]}`,
      width: "100%",
      height: "36px",
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.weight.semibold,

      ":hover": {
        borderColor: theme.color.status.selected,
        boxShadow: `0 0 12px ${theme.color.status.selected}44`,
        backgroundColor: theme.color.background.raised,
      },

      ":focus": {
        outline: "none",
        borderColor: theme.color.status.selected,
        boxShadow: `0 0 12px ${theme.color.status.selected}55`,
      },

      ":disabled": {
        opacity: theme.opacity.disabled,
        cursor: "not-allowed",
      },
    },
  },
  selectors: {
    "&[aria-expanded=\"true\"]": {
      borderColor: theme.color.status.selected,
      boxShadow: `0 0 12px ${theme.color.status.selected}55`,
    },
  },
});

export const selectMenu = style({
  "@layer": {
    [componentsLayer]: {
      position: "absolute",
      zIndex: theme.zIndex.tooltip,
      top: "calc(100% + 4px)",
      right: 0,
      left: 0,
      clipPath: theme.clipPath.md,
      margin: 0,
      border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
      boxShadow: `0 0 30px ${theme.color.background.base}dd, 0 0 60px ${theme.color.status.selected}22`,
      backgroundColor: theme.color.background.surface,
      backgroundImage: `
				linear-gradient(${theme.color.grid} 1px, transparent 1px),
				linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
			`,
      backgroundSize: "20px 20px",
      padding: theme.spacing["2"],
      maxHeight: "240px",
      overflowY: "auto",
      listStyle: "none",
    },
  },
});

export const selectOption = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      margin: `${theme.spacing["1"]} 0`,
      border: `${theme.border.width.thin} solid transparent`,
      backgroundColor: "transparent",
      cursor: "pointer",
      padding: `${theme.spacing["2"]} ${theme.spacing["4"]}`,
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,

      ":hover": {
        transform: "translateX(4px)",
        borderColor: theme.color.status.selected,
        boxShadow: `0 0 8px ${theme.color.status.selected}33`,
        backgroundColor: theme.color.background.raised,
      },

      ":focus": {
        outline: "none",
        borderColor: theme.color.status.selected,
        boxShadow: `0 0 12px ${theme.color.status.selected}55`,
        backgroundColor: theme.color.background.raised,
      },
    },
  },
});

export const selectOptionActive = style({
  "@layer": {
    [componentsLayer]: {
      borderColor: theme.color.status.selected,
      boxShadow: `0 0 8px ${theme.color.status.selected}33`,
      backgroundColor: theme.color.background.raised,
      color: theme.color.foreground.primary,
      fontWeight: theme.typography.weight.bold,
    },
  },
});
