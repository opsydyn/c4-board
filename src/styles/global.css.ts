import { globalStyle, globalFontFace } from "@vanilla-extract/css";

// Self-hosted Berkeley Mono font faces (variable + static fallbacks)
globalFontFace("Berkeley Mono", {
	src: `url("/fonts/BerkeleyMonoVariable-Regular.woff2") format("woff2"), url("/fonts/BerkeleyMonoVariable-Regular.woff") format("woff")`,
	fontDisplay: "swap",
	fontStyle: "normal",
	fontWeight: "100 900",
});

globalFontFace("Berkeley Mono", {
	src: `url("/fonts/BerkeleyMonoVariable-Italic.woff2") format("woff2"), url("/fonts/BerkeleyMonoVariable-Italic.woff") format("woff")`,
	fontDisplay: "swap",
	fontStyle: "italic",
	fontWeight: "100 900",
});

globalFontFace("Berkeley Mono", {
	src: `url("/fonts/BerkeleyMono-Regular.woff2") format("woff2"), url("/fonts/BerkeleyMono-Regular.woff") format("woff")`,
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
	src: `url("/fonts/BerkeleyMono-BoldItalic.woff2") format("woff2"), url("/fonts/BerkeleyMono-BoldItalic.woff") format("woff")`,
	fontDisplay: "swap",
	fontStyle: "italic",
	fontWeight: 700,
});

// Minimal global resets
globalStyle("*, *::before, *::after", {
	boxSizing: "border-box",
	margin: 0,
	padding: 0,
});

globalStyle("html, body", {
	fontFamily:
		"'Berkeley Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
	fontSynthesis: "none",
	WebkitFontSmoothing: "antialiased",
	MozOsxFontSmoothing: "grayscale",
	WebkitTextSizeAdjust: "100%",
});
