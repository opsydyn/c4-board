/**
 * MonacoJsonEditor - Monaco-based JSON editor with validation
 *
 * Features:
 * - Syntax highlighting
 * - Auto-formatting
 * - JSON validation
 * - Dark theme matching our design
 * - Custom actions (Copy JSON Path, Format, etc.)
 */

import { useRef, useCallback } from "react";
import Editor, { type Monaco, loader } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { monacoEditorContainer, monacoEditorWrapper, actionBar, actionButton } from "./MonacoJsonEditor.css";

const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
loader.config({ paths: { vs: `${baseUrl}monaco/vs` } });

/**
 * Get JSON path at cursor position (e.g., "data.user.email")
 */
function getJsonPathAtPosition(
	model: editor.ITextModel,
	position: { lineNumber: number; column: number }
): string {
	const content = model.getValue();
	// const _offset = model.getOffsetAt(position); // Currently unused

	try {
		// Simple JSON path extraction by parsing line by line
		const lines = content.split('\n');
		const path: string[] = [];
		let depth = 0;

		for (let i = 0; i < position.lineNumber; i++) {
			const line = lines[i];
			if (!line) continue;

			// Count braces to track depth
			const openBraces = (line.match(/\{/g) || []).length;
			const closeBraces = (line.match(/\}/g) || []).length;
			depth += openBraces - closeBraces;

			// Extract key from line (simplified)
			const keyMatch = line.match(/"([^"]+)"\s*:/);
			if (keyMatch && depth > path.length) {
				path.push(keyMatch[1]!);
			} else if (closeBraces > 0 && path.length > 0) {
				path.pop();
			}
		}

		return path.length > 0 ? path.join('.') : 'root';
	} catch {
		return 'root';
	}
}

/**
 * Register custom Monaco actions
 */
function registerCustomActions(
	editor: editor.IStandaloneCodeEditor,
	monaco: typeof import("monaco-editor")
) {
	// Copy JSON Path action
	editor.addAction({
		id: 'postee.copyJsonPath',
		label: 'Copy JSON Path',
		keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC],
		contextMenuGroupId: 'navigation',
		contextMenuOrder: 1.5,
		run: (ed) => {
			const position = ed.getPosition();
			if (!position) return;

			const model = ed.getModel();
			if (!model) return;

			const jsonPath = getJsonPathAtPosition(model, position);
			navigator.clipboard.writeText(jsonPath);
		},
	});

	// Expand All action
	editor.addAction({
		id: 'postee.expandAll',
		label: 'Expand All',
		keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE],
		contextMenuGroupId: 'navigation',
		contextMenuOrder: 2,
		run: (ed) => {
			ed.getAction('editor.unfoldAll')?.run();
		},
	});

	// Collapse All action
	editor.addAction({
		id: 'postee.collapseAll',
		label: 'Collapse All',
		keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL],
		contextMenuGroupId: 'navigation',
		contextMenuOrder: 3,
		run: (ed) => {
			ed.getAction('editor.foldAll')?.run();
		},
	});
}

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

		// Configure JSON validation with IntelliSense and common schemas
		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			allowComments: false,
			enableSchemaRequest: true,
			schemaValidation: "error",
			schemas: [
				// Common REST API request body schema
				{
					uri: "http://postee/schemas/rest-api.json",
					fileMatch: ["*"],
					schema: {
						type: "object",
						properties: {
							id: {
								type: ["string", "number"],
								description: "Resource identifier",
							},
							name: {
								type: "string",
								description: "Resource name",
								minLength: 1,
							},
							email: {
								type: "string",
								format: "email",
								description: "Email address",
							},
							status: {
								type: "string",
								enum: ["active", "inactive", "pending"],
								description: "Resource status",
							},
							createdAt: {
								type: "string",
								format: "date-time",
								description: "Creation timestamp (ISO 8601)",
							},
							updatedAt: {
								type: "string",
								format: "date-time",
								description: "Last update timestamp (ISO 8601)",
							},
							data: {
								type: "object",
								description: "Additional data payload",
							},
							items: {
								type: "array",
								description: "List of items",
								items: {
									type: "object",
								},
							},
							count: {
								type: "integer",
								description: "Number of items",
								minimum: 0,
							},
							total: {
								type: "integer",
								description: "Total count",
								minimum: 0,
							},
							page: {
								type: "integer",
								description: "Current page number",
								minimum: 1,
							},
							limit: {
								type: "integer",
								description: "Items per page",
								minimum: 1,
								maximum: 100,
							},
						},
					},
				},
			],
		});

		// Enable IntelliSense features
		monaco.languages.json.jsonDefaults.setModeConfiguration({
			documentFormattingEdits: true,
			documentRangeFormattingEdits: true,
			completionItems: true,
			hovers: true,
			documentSymbols: true,
			tokens: true,
			colors: true,
			foldingRanges: true,
			diagnostics: true,
			selectionRanges: true,
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

		// Register custom actions
		registerCustomActions(editor, monaco);
	};

	const handleChange = (newValue: string | undefined) => {
		onChange(newValue ?? "");
	};

	// Action handlers
	const handleFormat = useCallback(() => {
		editorRef.current?.getAction("editor.action.formatDocument")?.run();
	}, []);

	const handleCopyJsonPath = useCallback(() => {
		if (!editorRef.current) return;

		const position = editorRef.current.getPosition();
		if (!position) return;

		const model = editorRef.current.getModel();
		if (!model) return;

		const jsonPath = getJsonPathAtPosition(model, position);
		navigator.clipboard.writeText(jsonPath);

		// Show a quick notification (optional - could use toast later)
		console.log("Copied JSON path:", jsonPath);
	}, []);

	// const handleCopyValue = useCallback(() => {
	// 	if (!editorRef.current) return;

	// 	const selection = editorRef.current.getSelection();
	// 	if (!selection) return;

	// 	const model = editorRef.current.getModel();
	// 	if (!model) return;

	// 	const selectedText = model.getValueInRange(selection);
	// 	navigator.clipboard.writeText(selectedText);
	// }, []);

	const handleExpandAll = useCallback(() => {
		editorRef.current?.getAction("editor.unfoldAll")?.run();
	}, []);

	const handleCollapseAll = useCallback(() => {
		editorRef.current?.getAction("editor.foldAll")?.run();
	}, []);

	return (
		<div className={monacoEditorContainer}>
			{/* Action Bar */}
			{!readOnly && (
				<div className={actionBar}>
					<button
						type="button"
						className={actionButton}
						onClick={handleFormat}
						title="Format Document (Shift+Alt+F)"
					>
						⚡ FORMAT
					</button>
					<button
						type="button"
						className={actionButton}
						onClick={handleCopyJsonPath}
						title="Copy JSON Path (Cmd+Shift+C)"
					>
						📋 COPY PATH
					</button>
					<button
						type="button"
						className={actionButton}
						onClick={handleExpandAll}
						title="Expand All (Cmd+Shift+E)"
					>
						▼ EXPAND
					</button>
					<button
						type="button"
						className={actionButton}
						onClick={handleCollapseAll}
						title="Collapse All (Cmd+Shift+L)"
					>
						▶ COLLAPSE
					</button>
				</div>
			)}

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
						// IntelliSense configuration
						quickSuggestions: {
							other: true,
							comments: false,
							strings: true,
						},
						suggestOnTriggerCharacters: true,
						acceptSuggestionOnCommitCharacter: true,
						acceptSuggestionOnEnter: "on",
						snippetSuggestions: "top",
						tabCompletion: "on",
						wordBasedSuggestions: "matchingDocuments",
						suggestSelection: "first",
						// Show parameter hints
						parameterHints: {
							enabled: true,
						},
						// Show hover information
						hover: {
							enabled: true,
							delay: 300,
						},
						// Better completion widget
						suggest: {
							showWords: true,
							showFields: true,
							showProperties: true,
							showValues: true,
							showEnums: true,
							showSnippets: true,
							localityBonus: true,
							shareSuggestSelections: true,
						},
					}}
				/>
			</div>
		</div>
	);
}
