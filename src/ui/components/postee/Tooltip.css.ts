import { keyframes, style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

const fadeIn = keyframes({
  from: {
    transform: "translateY(4px)",
    opacity: 0,
  },
  to: {
    transform: "translateY(0)",
    opacity: 1,
  },
});

export const tooltipTrigger = style({
  all: "unset",
  display: "inline-flex",
  cursor: "inherit",
});

export const tooltipContent = style({
  position: "absolute",
  zIndex: 1000,
  bottom: "calc(100% + 8px)",
  left: "50%",
  transform: "translateX(-50%)",
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  boxShadow: theme.effect.glow.base,
  backgroundColor: "rgba(12, 20, 16, 0.98)",
  pointerEvents: "none",
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  whiteSpace: "nowrap",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.xs,
  fontWeight: theme.typography.weight.medium,

  "@media": {
    "(prefers-reduced-motion: no-preference)": {
      animation: `${fadeIn} 0.15s ease-out`,
    },
  },

  selectors: {
    "&::before": {
      position: "absolute",
      top: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      borderTop: `6px solid ${theme.color.border.primary}`,
      borderRight: "6px solid transparent",
      borderLeft: "6px solid transparent",
      width: 0,
      height: 0,
      content: "\"\"",
    },
  },
});
