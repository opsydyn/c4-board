/**
 * ResponseViewer - Read-only Monaco viewer for HTTP responses
 *
 * Features:
 * - Syntax highlighting for JSON
 * - Auto-detection of content type
 * - Collapsible sections
 * - Dark theme
 */

import { useState } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
	responseViewerContainer,
	responseViewerHeader,
	responseViewerContent,
	toggleButton,
} from "./ResponseViewer.css";

interface ResponseViewerProps {
	body: string;
	headers?: Record<string, string> | string;
	status?: number;
	statusText?: string;
	duration?: number;
	size?: number;
	defaultExpanded?: boolean;
}

export function ResponseViewer({
	body,
	headers,
	status,
	statusText,
	duration,
	size,
	defaultExpanded = true,
}: ResponseViewerProps) {
	const [showBody, setShowBody] = useState(defaultExpanded);
	const [showHeaders, setShowHeaders] = useState(false);

	// Try to detect if body is JSON
	const isJson = (() => {
		try {
			JSON.parse(body);
			return true;
		} catch {
			return false;
		}
	})();

	// Format JSON if valid
	const formattedBody = isJson
		? JSON.stringify(JSON.parse(body), null, 2)
		: body;

	// Parse headers if string
	const parsedHeaders =
		typeof headers === "string" ? JSON.parse(headers) : headers;

	// Monaco has a nice high-contrast dark theme built-in
	// We'll use "hc-black" (high contrast black) for techy vibes

	const editorOptions: editor.IStandaloneEditorConstructionOptions = {
		readOnly: true,
		minimap: { enabled: false },
		scrollBeyondLastLine: false,
		fontSize: 13,
		lineNumbers: "off",
		renderLineHighlight: "none",
		automaticLayout: true,
		wordWrap: "on",
		wrappingIndent: "indent",
		folding: true,
		bracketPairColorization: { enabled: true },
		padding: { top: 8, bottom: 8 },
		scrollbar: {
			verticalScrollbarSize: 8,
			horizontalScrollbarSize: 8,
		},
		contextmenu: false,
		lineDecorationsWidth: 0,
		lineNumbersMinChars: 0,
		glyphMargin: false,
		overviewRulerLanes: 0,
	};

	return (
		<div className={responseViewerContainer}>
			{/* Response metadata */}
			<div className={responseViewerHeader}>
				{status !== undefined && (
					<span>
						<strong>Status:</strong> {status} {statusText}
					</span>
				)}
				{duration !== undefined && (
					<span>
						<strong>Duration:</strong> {duration}ms
					</span>
				)}
				{size !== undefined && <span><strong>Size:</strong> {size} bytes</span>}
			</div>

			{/* Response Body */}
			<div className={responseViewerContent}>
				<button
					type="button"
					className={toggleButton}
					onClick={() => setShowBody(!showBody)}
				>
					{showBody ? "▼" : "▶"} <strong>Response Body</strong>
					{isJson && <span> (JSON)</span>}
				</button>

				{showBody && (
					<Editor
						height="300px"
						defaultLanguage={isJson ? "json" : "plaintext"}
						value={formattedBody}
						theme="hc-black"
						options={editorOptions}
					/>
				)}
			</div>

			{/* Response Headers */}
			{parsedHeaders && Object.keys(parsedHeaders).length > 0 && (
				<div className={responseViewerContent}>
					<button
						type="button"
						className={toggleButton}
						onClick={() => setShowHeaders(!showHeaders)}
					>
						{showHeaders ? "▼" : "▶"} <strong>Response Headers</strong>
					</button>

					{showHeaders && (
						<Editor
							height="150px"
							defaultLanguage="json"
							value={JSON.stringify(parsedHeaders, null, 2)}
							theme="hc-black"
							options={editorOptions}
						/>
					)}
				</div>
			)}
		</div>
	);
}
