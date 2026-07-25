import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../styles/layers.css";
import { theme } from "../../styles/theme.css";

export const drawerRoot = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      // The last column of the workspace grid, mirroring the OPY drawer in Postee.
      gridRow: "1 / -1",
      gridColumn: "4 / 5",
      clipPath: theme.clipPath.lg,
      border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
      boxShadow: `${theme.effect.glow.lg}, -18px 0 60px rgba(0, 0, 0, 0.46)`,
      background: "linear-gradient(180deg, rgba(7, 13, 10, 0.985) 0%, rgba(4, 8, 6, 0.98) 100%)",
      minWidth: 0,
      overflow: "hidden",
      color: theme.color.foreground.primary,

      selectors: {
        "&[data-chrome-tone=\"ready\"]": {
          borderColor: theme.color.status.ready,
          boxShadow:
            `${theme.effect.glow.lg}, -18px 0 60px color-mix(in srgb, ${theme.color.status.ready} 14%, transparent)`,
        },
        "&[data-chrome-tone=\"caution\"]": {
          borderColor: theme.color.status.caution,
          boxShadow:
            `${theme.effect.glow.lg}, -18px 0 60px color-mix(in srgb, ${theme.color.status.caution} 16%, transparent)`,
        },
        "&[data-chrome-tone=\"critical\"]": {
          borderColor: theme.color.status.critical,
          boxShadow:
            `${theme.effect.glow.lg}, -18px 0 64px color-mix(in srgb, ${theme.color.status.critical} 18%, transparent)`,
        },
      },
    },
  },
});

export const drawerHeader = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing["3"],
        borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
        background: "linear-gradient(180deg, rgba(10, 18, 14, 0.98) 0%, rgba(7, 13, 10, 0.94) 100%)",
      },
    },
  },
  {
    padding: `${theme.spacing["4"]} ${theme.spacing["5"]}`,
    "@media": {
      "screen and (max-width: 760px)": {
        padding: `${theme.spacing["3"]} ${theme.spacing["4"]}`,
      },
    },
  },
]);

export const drawerIdentity = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flex: "1 1 auto",
      flexDirection: "column",
      gap: theme.spacing["1"],
      minWidth: 0,
    },
  },
});

export const drawerTitle = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      overflowWrap: "anywhere",
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
      fontWeight: 700,
    },
  },
});

export const drawerMeta = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing["3"],
      margin: 0,
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.tertiary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const drawerActions = style({
  "@layer": {
    [componentsLayer]: {
      display: "inline-flex",
      alignItems: "center",
      gap: theme.spacing["3"],
    },
  },
});

export const drawerActionButton = style({
  "@layer": {
    [componentsLayer]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.raised,
      cursor: "pointer",
      width: "2rem",
      height: "2rem",
      color: theme.color.foreground.secondary,

      ":hover": {
        borderColor: theme.color.interactive.primary,
        boxShadow: theme.effect.glow.sm,
        backgroundColor: theme.color.background.surface,
        color: theme.color.interactive.primary,
      },
    },
  },
});

export const drawerContent = style([
  {
    "@layer": {
      [componentsLayer]: {
        minHeight: 0,
        overflow: "auto",
      },
    },
  },
  {
    padding: theme.spacing["5"],
    "@media": {
      "screen and (max-width: 760px)": {
        padding: theme.spacing["4"],
      },
    },
  },
]);
