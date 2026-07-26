import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

/**
 * The grab area is wider than the visible line: a 1px target is unusable with a
 * pointer, so the handle is padded and the rule drawn inside it.
 */
export const paneDivider = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      // Track 3 of the shell grid, between the two panes.
      flex: "0 0 auto",
      gridRow: "1 / 2",
      gridColumn: "3 / 4",
      backgroundColor: "transparent",
      cursor: "col-resize",
      width: "10px",
      selectors: {
        "&::before": {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          transition: theme.transition.fast,
          backgroundColor: theme.color.border.secondary,
          width: theme.border.width.thin,
          content: "",
        },
        "&:hover::before, &:focus-visible::before": {
          boxShadow: theme.effect.glow.sm,
          backgroundColor: theme.color.border.focus,
        },
      },
      ":focus-visible": {
        outline: "none",
      },
    },
  },
});
