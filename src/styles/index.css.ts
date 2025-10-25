import { style } from "@vanilla-extract/css";

export const main = style({
	display: "flex",
	flexDirection: "column",
	justifyContent: "center",
	margin: 0,
	paddingTop: "10vh",
	textAlign: "center",
});

export const logoTauri = style({
	selectors: {
		"&:hover": {
			filter: "drop-shadow(0 0 2em #24c8db)",
		},
	},
});

export const logoAstro = style({
	selectors: {
		"&:hover": {
			filter: "drop-shadow(0 0 2em rgb(184, 81, 34))",
		},
	},
});

export const greetInput = style({
	marginRight: "5px",
});

export const lightModeOnly = style({
	"@media": {
		"(prefers-color-scheme: dark)": {
			display: "none",
		},
	},
});

export const darkModeOnly = style({
	"@media": {
		"(prefers-color-scheme: light)": {
			display: "none",
		},
	},
});
