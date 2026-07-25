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
      gridRow: "1 / 2",
      gridColumn: "3 / 4",
      flex: "0 0 auto",
      width: "10px",
      cursor: "col-resize",
      backgroundColor: "transparent",
      selectors: {
        "&::before": {
          content: "",
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: theme.border.width.thin,
          transform: "translateX(-50%)",
          backgroundColor: theme.color.border.secondary,
          transition: theme.transition.fast,
        },
        "&:hover::before, &:focus-visible::before": {
          backgroundColor: theme.color.border.focus,
          boxShadow: theme.effect.glow.sm,
        },
      },
      ":focus-visible": {
        outline: "none",
      },
    },
  },
});
