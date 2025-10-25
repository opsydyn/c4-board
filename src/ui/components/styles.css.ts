/**
 * Component Styles
 */

import { style } from "@vanilla-extract/css";

export const canvasContainer = style({
	width: "100vw",
	height: "100vh",
	backgroundColor: "#1a1a1a",
	"@media": {
		"(prefers-color-scheme: light)": {
			backgroundColor: "#f8f9fa",
		},
	},
});

export const toolbar = style({
	position: "fixed",
	top: "20px",
	left: "20px",
	zIndex: 1000,
	backgroundColor: "#2a2a2a",
	padding: "12px",
	borderRadius: "8px",
	boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
	display: "flex",
	gap: "8px",
	flexDirection: "column",
	border: "1px solid #3a3a3a",
	"@media": {
		"(prefers-color-scheme: light)": {
			backgroundColor: "white",
			borderColor: "#e0e0e0",
			boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
		},
	},
});

export const toolbarButton = style({
	padding: "10px 14px",
	border: "1px solid #444",
	borderRadius: "6px",
	backgroundColor: "#333",
	color: "#fff",
	cursor: "pointer",
	fontSize: "14px",
	fontWeight: 500,
	display: "flex",
	alignItems: "center",
	gap: "8px",
	transition: "all 0.2s ease",
	":hover": {
		backgroundColor: "#444",
		borderColor: "#666",
		transform: "translateY(-1px)",
		boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
	},
	":active": {
		transform: "translateY(0)",
	},
	"@media": {
		"(prefers-color-scheme: light)": {
			backgroundColor: "white",
			color: "#333",
			borderColor: "#ddd",
			":hover": {
				backgroundColor: "#f0f0f0",
				borderColor: "#999",
			},
		},
	},
});

export const propertiesPanel = style({
	position: "fixed",
	top: "20px",
	right: "20px",
	width: "320px",
	zIndex: 1000,
	backgroundColor: "#2a2a2a",
	padding: "20px",
	borderRadius: "8px",
	boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
	border: "1px solid #3a3a3a",
	display: "flex",
	flexDirection: "column",
	gap: "16px",
	"@media": {
		"(prefers-color-scheme: light)": {
			backgroundColor: "white",
			borderColor: "#e0e0e0",
			boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
		},
	},
});

export const panelTitle = style({
	margin: 0,
	fontSize: "16px",
	fontWeight: 600,
	color: "#fff",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#333",
		},
	},
});

export const formGroup = style({
	display: "flex",
	flexDirection: "column",
	gap: "6px",
});

export const label = style({
	fontSize: "12px",
	fontWeight: 600,
	color: "#aaa",
	textTransform: "uppercase",
	letterSpacing: "0.5px",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#666",
		},
	},
});

export const input = style({
	padding: "10px 12px",
	border: "1px solid #444",
	borderRadius: "6px",
	fontSize: "14px",
	backgroundColor: "#1a1a1a",
	color: "#fff",
	transition: "all 0.2s ease",
	":focus": {
		outline: "none",
		borderColor: "#1168BD",
		backgroundColor: "#222",
		boxShadow: "0 0 0 3px rgba(17, 104, 189, 0.1)",
	},
	"@media": {
		"(prefers-color-scheme: light)": {
			backgroundColor: "white",
			color: "#333",
			borderColor: "#ddd",
			":focus": {
				backgroundColor: "#fff",
			},
		},
	},
});

export const textarea = style({
	padding: "10px 12px",
	border: "1px solid #444",
	borderRadius: "6px",
	fontSize: "14px",
	minHeight: "100px",
	resize: "vertical",
	backgroundColor: "#1a1a1a",
	color: "#fff",
	fontFamily: "inherit",
	lineHeight: "1.5",
	transition: "all 0.2s ease",
	":focus": {
		outline: "none",
		borderColor: "#1168BD",
		backgroundColor: "#222",
		boxShadow: "0 0 0 3px rgba(17, 104, 189, 0.1)",
	},
	"@media": {
		"(prefers-color-scheme: light)": {
			backgroundColor: "white",
			color: "#333",
			borderColor: "#ddd",
			":focus": {
				backgroundColor: "#fff",
			},
		},
	},
});
