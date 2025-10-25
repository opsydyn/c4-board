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

globalStyle(":root", {
	backgroundColor: "#f6f6f6",
	textRendering: "optimizeLegibility",
	lineHeight: "24px",
	color: "#0f0f0f",
	fontFamily:
		"'Berkeley Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
	fontSize: "16px",
	fontWeight: 400,
	fontSynthesis: "none",
	WebkitFontSmoothing: "antialiased",
	MozOsxFontSmoothing: "grayscale",
	WebkitTextSizeAdjust: "100%",
});

globalStyle(".logo", {
	transition: "0.75s",
	willChange: "filter",
	padding: "1.5em",
	height: "6em",
});

globalStyle(".row", {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
});

globalStyle("a", {
	textDecoration: "inherit",
	color: "#646cff",
	fontWeight: 500,
});

globalStyle("a:hover", {
	color: "#535bf2",
});

globalStyle("h1", {
	textAlign: "center",
});

globalStyle("input, button", {
	transition: "border-color 0.25s",
	border: "1px solid transparent",
	borderRadius: "8px",
	boxShadow: "0 2px 2px rgba(0, 0, 0, 0.2)",
	backgroundColor: "#ffffff",
	padding: "0.6em 1.2em",
	color: "#0f0f0f",
	fontFamily: "'Berkeley Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
	fontSize: "1em",
	fontWeight: 500,
});

globalStyle("button", {
	cursor: "pointer",
});

globalStyle("button:hover", {
	borderColor: "#396cd8",
});

globalStyle("input, button", {
	outline: "none",
});

globalStyle(":root", {
	"@media": {
		"(prefers-color-scheme: dark)": {
			backgroundColor: "#2f2f2f",
			color: "#f6f6f6",
		},
	},
});

globalStyle("a:hover", {
	"@media": {
		"(prefers-color-scheme: dark)": {
			color: "#24c8db",
		},
	},
});

globalStyle("input", {
	"@media": {
		"(prefers-color-scheme: dark)": {
			backgroundColor: "#0f0f0f98",
			color: "#ffffff",
		},
	},
});

globalStyle("button", {
	"@media": {
		"(prefers-color-scheme: dark)": {
			backgroundColor: "#0f0f0f98",
			color: "#ffffff",
		},
	},
});
