/**
 * C4 Node Styles
 *
 * Vanilla Extract styles for C4 diagram nodes.
 * Following C4 color conventions.
 */

import { style } from "@vanilla-extract/css";

const baseNode = style({
	transition: "all 0.2s ease",
	border: "2px solid",
	borderRadius: "8px",
	boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
	backgroundColor: "#2a2a2a",
	padding: "16px",
	minWidth: "200px",
	maxWidth: "300px",
	fontFamily: "system-ui, sans-serif",
	fontSize: "14px",

	selectors: {
		"&[data-selected='true']": {
			transform: "scale(1.02)",
			boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
		},
		"&:hover": {
			boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
		},
	},

	"@media": {
		"(prefers-color-scheme: light)": {
			backgroundColor: "white",
			boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
		},
	},
});

export const personNode = style([
	baseNode,
	{
		borderColor: "#08427B",
		backgroundColor: "#1a2a3a",
		"@media": {
			"(prefers-color-scheme: light)": {
				backgroundColor: "#E8F4F8",
			},
		},
	},
]);

export const personNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: "8px",
	color: "#5CA9E8",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#08427B",
		},
	},
});

export const personNodeLabel = style({
	marginBottom: "4px",
	color: "#5CA9E8",
	fontSize: "16px",
	fontWeight: 600,
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#08427B",
		},
	},
});

export const personNodeTechnology = style({
	marginBottom: "4px",
	color: "#aaa",
	fontSize: "12px",
	fontStyle: "italic",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#666",
		},
	},
});

export const personNodeDescription = style({
	marginTop: "8px",
	lineHeight: "1.4",
	color: "#ccc",
	fontSize: "13px",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#444",
		},
	},
});

export const systemNode = style([
	baseNode,
	{
		borderColor: "#1168BD",
		backgroundColor: "#1a2535",
		"@media": {
			"(prefers-color-scheme: light)": {
				backgroundColor: "#EBF3FA",
			},
		},
	},
]);

export const systemNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: "8px",
	color: "#6BA9E8",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#1168BD",
		},
	},
});

export const systemNodeLabel = style({
	marginBottom: "4px",
	color: "#6BA9E8",
	fontSize: "16px",
	fontWeight: 600,
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#1168BD",
		},
	},
});

export const systemNodeTechnology = style({
	marginBottom: "4px",
	color: "#aaa",
	fontSize: "12px",
	fontStyle: "italic",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#666",
		},
	},
});

export const systemNodeDescription = style({
	marginTop: "8px",
	lineHeight: "1.4",
	color: "#ccc",
	fontSize: "13px",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#444",
		},
	},
});

export const externalSystemNode = style([
	baseNode,
	{
		borderStyle: "dashed",
		borderColor: "#999999",
		backgroundColor: "#2a2a2a",
		"@media": {
			"(prefers-color-scheme: light)": {
				backgroundColor: "#F5F5F5",
			},
		},
	},
]);

export const externalSystemNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: "8px",
	color: "#bbb",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#999999",
		},
	},
});

export const externalSystemNodeLabel = style({
	marginBottom: "4px",
	color: "#ddd",
	fontSize: "16px",
	fontWeight: 600,
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#666",
		},
	},
});

export const externalSystemNodeTechnology = style({
	marginBottom: "4px",
	color: "#999",
	fontSize: "12px",
	fontStyle: "italic",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#888",
		},
	},
});

export const externalSystemNodeDescription = style({
	marginTop: "8px",
	lineHeight: "1.4",
	color: "#bbb",
	fontSize: "13px",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#555",
		},
	},
});

export const nodeContent = style({
	display: "flex",
	flexDirection: "column",
});
