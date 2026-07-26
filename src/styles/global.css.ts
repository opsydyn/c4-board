import { globalFontFace, globalStyle } from "@vanilla-extract/css";
import { resetLayer } from "./layers.css";

// Self-hosted Berkeley Mono font faces (variable + static fallbacks)
globalFontFace("Berkeley Mono", {
  src:
    `url("/fonts/BerkeleyMonoVariable-Regular.woff2") format("woff2"), url("/fonts/BerkeleyMonoVariable-Regular.woff") format("woff")`,
  fontDisplay: "swap",
  fontStyle: "normal",
  fontWeight: "100 900",
});

globalFontFace("Berkeley Mono", {
  src:
    `url("/fonts/BerkeleyMonoVariable-Italic.woff2") format("woff2"), url("/fonts/BerkeleyMonoVariable-Italic.woff") format("woff")`,
  fontDisplay: "swap",
  fontStyle: "italic",
  fontWeight: "100 900",
});

globalFontFace("Berkeley Mono", {
  src:
    `url("/fonts/BerkeleyMono-Regular.woff2") format("woff2"), url("/fonts/BerkeleyMono-Regular.woff") format("woff")`,
  fontDisplay: "swap",
  fontStyle: "normal",
  fontWeight: 400,
});

globalFontFace("Berkeley Mono", {
  src: `url("/fonts/BerkeleyMono-Italic.woff2") format("woff2"), url("/fonts/BerkeleyMono-Italic.woff") format("woff")`,
  fontDisplay: "swap",
  fontStyle: "italic",
  fontWeight: 400,
});

globalFontFace("Berkeley Mono", {
  src: `url("/fonts/BerkeleyMono-Bold.woff2") format("woff2"), url("/fonts/BerkeleyMono-Bold.woff") format("woff")`,
  fontDisplay: "swap",
  fontStyle: "normal",
  fontWeight: 700,
});

globalFontFace("Berkeley Mono", {
  src:
    `url("/fonts/BerkeleyMono-BoldItalic.woff2") format("woff2"), url("/fonts/BerkeleyMono-BoldItalic.woff") format("woff")`,
  fontDisplay: "swap",
  fontStyle: "italic",
  fontWeight: 700,
});

// Minimal global resets.
//
// Inside the reset layer, deliberately. Declared outside every layer this beat
// each of the 69 `padding` declarations component stylesheets make inside
// `@layer components` — an unlayered rule outranks a layered one regardless of
// specificity — so those components rendered with no padding at all.
globalStyle("*, *::before, *::after", {
  "@layer": {
    [resetLayer]: {
      boxSizing: "border-box",
      margin: 0,
      padding: 0,
    },
  },
});

globalStyle("html, body", {
  fontFamily:
    "'Berkeley Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  // Every surface here is dark, but the UA only knows that if we say so. Without
  // it, browser-drawn chrome we cannot style — scrollbars above all — renders in
  // the OS light palette, which showed up as a grey bar down the edge of any
  // scrolling panel. Also fixes form controls and the flash before paint.
  colorScheme: "dark",
  fontSynthesis: "none",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  WebkitTextSizeAdjust: "100%",
});

// Reset border-radius on all interactive elements to ensure tactical clip-path styling
globalStyle("button, input, select, textarea", {
  borderRadius: 0,
});
