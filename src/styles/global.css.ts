import { globalStyle } from "@vanilla-extract/css";

globalStyle(":root", {
	backgroundColor: "#f6f6f6",
	textRendering: "optimizeLegibility",
	lineHeight: "24px",
	color: "#0f0f0f",
	fontFamily: "Inter, Avenir, Helvetica, Arial, sans-serif",
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
	fontFamily: "inherit",
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
