/**
 * MonacoJsonEditor - Monaco-based JSON editor with validation
 *
 * Features:
 * - Syntax highlighting
 * - Auto-formatting
 * - JSON validation
 * - Dark theme matching our design
 */

import {  useRef } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { monacoEditorContainer, monacoEditorWrapper } from "./MonacoJsonEditor.css";

interface MonacoJsonEditorProps {
	value: string;
	onChange: (value: string) => void;
	readOnly?: boolean;
	height?: string;
	placeholder?: string;
}

export function MonacoJsonEditor({
	value,
	onChange,
	readOnly = false,
	height = "300px",
	placeholder = "{}",
}: MonacoJsonEditorProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

	const handleEditorDidMount = (
		editor: editor.IStandaloneCodeEditor,
		monaco: Monaco,
	) => {
		editorRef.current = editor;

		// Configure JSON validation to allow template variables {{varName}}
		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			allowComments: false,
			schemas: [],
			enableSchemaRequest: false,
			// Note: JSON validation will still flag {{variables}} as invalid
			// We handle this by making it less intrusive (warning instead of error)
		});

		// Register custom token provider for highlighting {{variables}}
		monaco.languages.setMonarchTokensProvider("json", {
			tokenizer: {
				root: [
					// Template variables: {{varName}}
					[/\{\{[^}]+\}\}/, "variable"],
					// Standard JSON tokens
					[/"[^"\\]*(?:\\.[^"\\]*)*"/, "string"],
					[/\d+/, "number"],
					[/true|false|null/, "keyword"],
				],
			},
		});

		// Define custom color for variables
		monaco.editor.defineTheme("postee-dark", {
			base: "vs-dark",
			inherit: true,
			rules: [
				{ token: "variable", foreground: "A5D6A7", fontStyle: "italic" }, // Light green for variables
			],
			colors: {},
		});

		// Apply custom theme
		monaco.editor.setTheme("postee-dark");

		// Auto-format on mount if value is valid JSON (ignoring variables)
		try {
			if (value && value.trim()) {
				// Try to parse JSON, but allow {{variables}}
				const withoutVars = value.replace(/\{\{[^}]+\}\}/g, '""');
				JSON.parse(withoutVars);
				editor.getAction("editor.action.formatDocument")?.run();
			}
		} catch {
			// Invalid JSON, don't format
		}
	};

	const handleChange = (newValue: string | undefined) => {
		onChange(newValue ?? "");
	};

	// Auto-format is already available via Shift+Alt+F (built-in Monaco keybinding)
	// No need for custom command registration

	return (
		<div className={monacoEditorContainer}>
			<div className={monacoEditorWrapper}>
				<Editor
					height={height}
					defaultLanguage="json"
					value={value || placeholder}
					onChange={handleChange}
					onMount={handleEditorDidMount}
					theme="vs-dark"
					options={{
						readOnly,
						minimap: { enabled: false },
						scrollBeyondLastLine: false,
						fontSize: 13,
						lineNumbers: "on",
						renderLineHighlight: "line",
						automaticLayout: true,
						tabSize: 2,
						insertSpaces: true,
						formatOnPaste: true,
						formatOnType: true,
						wordWrap: "on",
						wrappingIndent: "indent",
						folding: true,
						bracketPairColorization: {
							enabled: true,
						},
						padding: {
							top: 8,
							bottom: 8,
						},
						scrollbar: {
							verticalScrollbarSize: 8,
							horizontalScrollbarSize: 8,
						},
					}}
				/>
			</div>
		</div>
	);
}
