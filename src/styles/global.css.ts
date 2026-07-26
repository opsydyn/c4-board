import { globalFontFace, globalStyle } from "@vanilla-extract/css";
import { resetLayer } from "./layers.css";
import { theme } from "./theme.css";

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

/**
 * Scrollbars.
 *
 * `color-scheme: dark` above is necessary but not sufficient. Chromium honours it
 * for scrollbars; WKWebView does not — it hands overlay scrollbars to AppKit,
 * which follows the *window's* appearance, not the document's. So the packaged
 * macOS app drew the system light-grey scrollbar over a black UI while the same
 * CSS looked correct in a browser.
 *
 * Painting them ourselves takes the platform out of the decision. WebKit replaces
 * the overlay scrollbar entirely once these pseudo-elements are styled, so the
 * dev server and the shipped app agree.
 *
 * Bare pseudo-element selectors are the weakest possible, so anything scoped to a
 * class — Monaco hiding its own, ScratchTabStrip's thin strip — still wins.
 */
globalStyle("*", {
  // For engines that implement the standard property rather than the WebKit
  // pseudo-elements. Harmless where `::-webkit-scrollbar` already applies.
  scrollbarWidth: "thin",
  scrollbarColor: `${theme.color.border.primary} transparent`,
});

globalStyle("::-webkit-scrollbar", {
  width: "10px",
  height: "10px",
});

globalStyle("::-webkit-scrollbar-track", {
  backgroundColor: "transparent",
});

globalStyle("::-webkit-scrollbar-thumb", {
  border: "2px solid transparent",
  backgroundClip: "content-box",
  backgroundColor: theme.color.border.primary,
});

globalStyle("::-webkit-scrollbar-thumb:hover", {
  backgroundColor: theme.color.interactive.primary,
});

// Where two scrollbars meet, this square is drawn by the UA and would otherwise
// stay light for the same reason the thumb did.
globalStyle("::-webkit-scrollbar-corner", {
  backgroundColor: "transparent",
});

// Reset border-radius on all interactive elements to ensure tactical clip-path styling
globalStyle("button, input, select, textarea", {
  borderRadius: 0,
});
