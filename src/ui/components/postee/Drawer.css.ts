import { keyframes, style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

const slideIn = keyframes({
  from: { transform: "translateX(100%)" },
  to: { transform: "translateX(0)" },
});

export const drawerOverlay = style({
  "@layer": {
    [componentsLayer]: {
      position: "fixed",
      zIndex: 40,
      inset: 0,
      display: "flex",
      justifyContent: "flex-end",
      backgroundColor: "rgba(2, 5, 4, 0.55)",
    },
  },
});

/** Wide enough for the history table, never wider than the window. */
export const drawerDialog = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      borderLeft: `${theme.border.width.base} solid ${theme.color.border.primary}`,
      boxShadow: `${theme.effect.glow.lg}, -18px 0 60px rgba(0, 0, 0, 0.46)`,
      background: "linear-gradient(180deg, rgba(7, 13, 10, 0.985) 0%, rgba(4, 8, 6, 0.98) 100%)",
      width: "min(720px, 100vw)",
      height: "100%",
      "@media": {
        "(prefers-reduced-motion: no-preference)": {
          animation: `${slideIn} 160ms ease-out`,
        },
      },
    },
  },
});

export const drawerBody = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing["4"],
        outline: "none",
        // The drawer is fixed to the viewport; only its body scrolls.
        width: "100%",
        minHeight: 0,
        overflowY: "auto",
        color: theme.color.foreground.primary,
      },
    },
  },
  // Unlayered on purpose. The global reset sets `*{padding:0}` without a layer,
  // and an unlayered rule beats a layered one however specific the layered one is,
  // so padding declared inside @layer components silently computes to zero.
  // Matches the gutter on the request and response panes.
  { padding: `${theme.spacing["5"]} ${theme.spacing["4"]}` },
]);

export const drawerHeader = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing["3"],
        borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      },
    },
  },
  // Unlayered: see drawerBody.
  { paddingBottom: theme.spacing["4"] },
]);

export const drawerTitle = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.base,
    },
  },
});

export const drawerCloseButton = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "inline-flex",
        alignItems: "center",
        gap: theme.spacing["1"],
        clipPath: theme.clipPath.sm,
        border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
        backgroundColor: "transparent",
        cursor: "pointer",
        textTransform: theme.typography.textTransform.uppercase,
        letterSpacing: theme.typography.letterSpacing.wide,
        color: theme.color.foreground.secondary,
        fontFamily: theme.typography.family.mono,
        fontSize: theme.typography.size.xs,
        selectors: {
          "&[data-hovered]": {
            borderColor: theme.color.border.primary,
            color: theme.color.foreground.primary,
          },
        },
      },
    },
  },
  // Unlayered: see drawerBody.
  { padding: `${theme.spacing["1"]} ${theme.spacing["2"]}` },
]);
