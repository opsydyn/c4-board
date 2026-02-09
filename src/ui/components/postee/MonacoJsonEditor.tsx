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
import {
	TextAlignLeftIcon,
	CopySimpleIcon,
	CaretDownIcon,
	CaretRightIcon
} from "@phosphor-icons/react";
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

		// Register Code Lens provider for JSON
		monaco.languages.registerCodeLensProvider("json", {
			provideCodeLenses: (model) => {
				const lenses: {
					range: {
						startLineNumber: number;
						startColumn: number;
						endLineNumber: number;
						endColumn: number;
					};
					command?: {
						id: string;
						title: string;
					};
				}[] = [];
				try {
					const content = model.getValue();
					const parsed = JSON.parse(content.replace(/\{\{[^}]+\}\}/g, '""'));

					// Count top-level keys
					if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
						const keyCount = Object.keys(parsed).length;
						lenses.push({
							range: {
								startLineNumber: 1,
								startColumn: 1,
								endLineNumber: 1,
								endColumn: 1,
							},
							command: {
								id: "postee.showKeyCount",
								title: `${keyCount} ${keyCount === 1 ? "property" : "properties"}`,
							},
						});
					}

					// Find arrays and objects, show their sizes
					const lines = content.split('\n');
					for (let i = 0; i < lines.length; i++) {
						const line = lines[i];
						const trimmed = line?.trim() ?? "";

						// Array start
						if (trimmed.includes('[')) {
							const keyMatch = line?.match(/"([^"]+)"\s*:\s*\[/) ?? null;
							if (keyMatch) {
								try {
									// Try to count array items
									const key = keyMatch[1];
									const obj = parsed as Record<string, unknown>;
									if (key && Array.isArray(obj[key])) {
										const count = obj[key].length;
										lenses.push({
											range: {
												startLineNumber: i + 1,
												startColumn: 1,
												endLineNumber: i + 1,
												endColumn: 1,
											},
											command: {
												id: "postee.showArrayCount",
												title: `${count} ${count === 1 ? "item" : "items"}`,
											},
										});
									}
								} catch {
									// Ignore parse errors
								}
							}
						}

						// Object start
						if (trimmed.match(/"[^"]+"\s*:\s*\{/)) {
							const keyMatch = line?.match(/"([^"]+)"\s*:\s*\{/) ?? null;
							if (keyMatch) {
								try {
									const key = keyMatch[1];
									const obj = parsed as Record<string, unknown>;
									if (key && typeof obj[key] === "object" && obj[key] !== null) {
										const count = Object.keys(obj[key] as object).length;
										lenses.push({
											range: {
												startLineNumber: i + 1,
												startColumn: 1,
												endLineNumber: i + 1,
												endColumn: 1,
											},
											command: {
												id: "postee.showObjectCount",
												title: `${count} ${count === 1 ? "property" : "properties"}`,
											},
										});
									}
								} catch {
									// Ignore parse errors
								}
							}
						}
					}
				} catch {
					// Invalid JSON, no code lenses
				}

				return { lenses, dispose: () => {} };
			},
		});

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

		// Register enhanced token provider for semantic highlighting
		monaco.languages.setMonarchTokensProvider("json", {
			tokenizer: {
				root: [
					// Template variables: {{varName}}
					[/\{\{[^}]+\}\}/, "variable"],
					// JSON keys (before colon)
					[/"([^"\\]|\\.)*"\s*(?=:)/, "key"],
					// JSON string values (after colon or in arrays)
					[/"([^"\\]|\\.)*"/, "string.value"],
					// Numbers
					[/-?\d+\.?\d*([eE][+-]?\d+)?/, "number"],
					// Keywords
					[/\btrue\b/, "keyword.true"],
					[/\bfalse\b/, "keyword.false"],
					[/\bnull\b/, "keyword.null"],
					// Structural tokens
					[/[{}]/, "delimiter.curly"],
					[/[[\]]/, "delimiter.square"],
					[/[:,]/, "delimiter"],
				],
			},
		});

		// Define enhanced theme with semantic colors
		monaco.editor.defineTheme("postee-dark", {
			base: "vs-dark",
			inherit: true,
			rules: [
				// Template variables - bright green, italic
				{ token: "variable", foreground: "A5D6A7", fontStyle: "italic" },
				// JSON keys - cyan (matches theme)
				{ token: "key", foreground: "88C0D0", fontStyle: "bold" },
				// String values - lighter color
				{ token: "string.value", foreground: "A3BE8C" },
				// Numbers - orange
				{ token: "number", foreground: "D08770" },
				// Boolean true - green
				{ token: "keyword.true", foreground: "A3BE8C", fontStyle: "bold" },
				// Boolean false - red
				{ token: "keyword.false", foreground: "BF616A", fontStyle: "bold" },
				// Null - purple
				{ token: "keyword.null", foreground: "B48EAD", fontStyle: "italic" },
			],
			colors: {},
		});

		// Apply custom theme
		monaco.editor.setTheme("postee-dark");

		// Add decorations for {{variables}}
		const updateVariableDecorations = () => {
			const model = editor.getModel();
			if (!model) return [];

			const content = model.getValue();
			const decorations: {
				range: {
					startLineNumber: number;
					startColumn: number;
					endLineNumber: number;
					endColumn: number;
				};
				options: {
					inlineClassName?: string;
					beforeContentClassName?: string;
					afterContentClassName?: string;
					isWholeLine?: boolean;
					className?: string;
				};
			}[] = [];

			// Find all {{variable}} patterns
			const lines = content.split('\n');
			const variableRegex = /\{\{([^}]+)\}\}/g;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (!line) continue;

				let match;
				variableRegex.lastIndex = 0; // Reset regex
				while ((match = variableRegex.exec(line)) !== null) {
					const startColumn = match.index + 1;
					const endColumn = match.index + match[0].length + 1;

					decorations.push({
						range: {
							startLineNumber: i + 1,
							startColumn,
							endLineNumber: i + 1,
							endColumn,
						},
						options: {
							inlineClassName: 'postee-variable-decoration',
							beforeContentClassName: 'postee-variable-icon',
						},
					});
				}
			}

			return decorations;
		};

		// Initial decoration
		let decorationsCollection = editor.createDecorationsCollection(updateVariableDecorations());

		// Update decorations on content change
		editor.onDidChangeModelContent(() => {
			decorationsCollection.clear();
			decorationsCollection = editor.createDecorationsCollection(updateVariableDecorations());
		});

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

		// Add custom context menu items
		editor.addAction({
			id: 'postee.minifyJson',
			label: 'Minify JSON',
			contextMenuGroupId: 'modification',
			contextMenuOrder: 1,
			run: (ed) => {
				const model = ed.getModel();
				if (!model) return;

				try {
					const content = model.getValue();
					const withoutVars = content.replace(/\{\{[^}]+\}\}/g, '""');
					const parsed = JSON.parse(withoutVars);
					const minified = JSON.stringify(parsed);
					// Restore variables
					const originalMatches = content.match(/\{\{[^}]+\}\}/g) || [];
					let varIndex = 0;
					const restored = minified.replace(/""/g, () => {
						return originalMatches[varIndex++] || '""';
					});
					model.setValue(restored);
				} catch {
					// Invalid JSON, ignore
				}
			},
		});

		editor.addAction({
			id: 'postee.formatJson',
			label: 'Format JSON (Pretty Print)',
			contextMenuGroupId: 'modification',
			contextMenuOrder: 2,
			keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
			run: (ed) => {
				ed.getAction('editor.action.formatDocument')?.run();
			},
		});

		editor.addAction({
			id: 'postee.copyValue',
			label: 'Copy Selected Value',
			contextMenuGroupId: '9_cutcopypaste',
			contextMenuOrder: 3,
			run: (ed) => {
				const selection = ed.getSelection();
				if (!selection) return;

				const model = ed.getModel();
				if (!model) return;

				const selectedText = model.getValueInRange(selection);
				navigator.clipboard.writeText(selectedText);
			},
		});

		editor.addAction({
			id: 'postee.validateJson',
			label: 'Validate JSON',
			contextMenuGroupId: 'modification',
			contextMenuOrder: 4,
			run: (ed) => {
				const model = ed.getModel();
				if (!model) return;

				try {
					const content = model.getValue();
					const withoutVars = content.replace(/\{\{[^}]+\}\}/g, '""');
					JSON.parse(withoutVars);
					alert('✓ Valid JSON');
				} catch (error) {
					alert(`✗ Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			},
		});
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
						<TextAlignLeftIcon size={14} weight="bold" />
						FORMAT
					</button>
					<button
						type="button"
						className={actionButton}
						onClick={handleCopyJsonPath}
						title="Copy JSON Path (Cmd+Shift+C)"
					>
						<CopySimpleIcon size={14} weight="bold" />
						COPY PATH
					</button>
					<button
						type="button"
						className={actionButton}
						onClick={handleExpandAll}
						title="Expand All (Cmd+Shift+E)"
					>
						<CaretDownIcon size={14} weight="bold" />
						EXPAND
					</button>
					<button
						type="button"
						className={actionButton}
						onClick={handleCollapseAll}
						title="Collapse All (Cmd+Shift+L)"
					>
						<CaretRightIcon size={14} weight="bold" />
						COLLAPSE
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
					theme="postee-dark"
					options={{
						readOnly,
						minimap: {
							enabled: true,
							side: "right",
							showSlider: "mouseover",
							renderCharacters: false,
							maxColumn: 80,
							scale: 1,
						},
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
						// Enable Code Lens (inline hints showing object/array counts)
						codeLens: true,
						// Enable Sticky Scroll (keep parent keys visible when scrolling)
						stickyScroll: {
							enabled: true,
							maxLineCount: 5,
						},
						padding: {
							top: 8,
							bottom: 8,
						},
						scrollbar: {
							verticalScrollbarSize: 8,
							horizontalScrollbarSize: 8,
						},
						// Enable Find & Replace widget
						find: {
							seedSearchStringFromSelection: "selection",
							autoFindInSelection: "never",
							addExtraSpaceOnTop: true,
							loop: true,
						},
						// Enable Command Palette (Cmd+Shift+P / F1)
						quickSuggestionsDelay: 10,
						// Enable Breadcrumbs (shows JSON path at top)
						breadcrumbs: {
							enabled: true,
							showKeys: true,
							showArrays: true,
							showObjects: true,
							showFunctions: false,
							showVariables: true,
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
