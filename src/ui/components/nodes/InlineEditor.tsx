/**
 * InlineEditor - Lexical-based inline text editor for node cards
 *
 * Features:
 * - Plain text mode for labels (single-line)
 * - Rich text mode for descriptions (multi-line)
 * - Auto-focus on mount
 * - Save on blur, cancel on ESC
 * - Simple validation
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import {
	$getRoot,
	$createParagraphNode,
	$createTextNode,
	COMMAND_PRIORITY_HIGH,
	KEY_ESCAPE_COMMAND,
	KEY_ENTER_COMMAND,
	BLUR_COMMAND,
	type EditorState,
} from "lexical";
import {
	inlineEditorContainer,
	inlineEditorContentEditable,
	inlineEditorPlaceholder,
	inlineEditorError,
} from "./InlineEditor.css";

export interface InlineEditorProps {
	value: string;
	placeholder?: string;
	mode: "plain" | "rich";
	maxLength?: number;
	onSave: (value: string) => void;
	onCancel: () => void;
	autoFocus?: boolean;
}

/**
 * Plugin to handle keyboard shortcuts (ESC to cancel, Enter to save)
 */
function KeyboardPlugin({
	mode,
	onSave,
	onCancel,
}: {
	mode: "plain" | "rich";
	onSave: () => void;
	onCancel: () => void;
}) {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		// Register ESC command to cancel
		const removeEscCommand = editor.registerCommand(
			KEY_ESCAPE_COMMAND,
			() => {
				onCancel();
				return true;
			},
			COMMAND_PRIORITY_HIGH,
		);

		// Register Enter command for plain mode (save)
		const removeEnterCommand =
			mode === "plain"
				? editor.registerCommand(
						KEY_ENTER_COMMAND,
						(event) => {
							if (event && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
								onSave();
								return true;
							}
							return false;
						},
						COMMAND_PRIORITY_HIGH,
					)
				: () => {}; // No-op for rich mode

		// Register Cmd/Ctrl+Enter for rich mode (save)
		const removeRichEnterCommand =
			mode === "rich"
				? editor.registerCommand(
						KEY_ENTER_COMMAND,
						(event) => {
							if (event && (event.metaKey || event.ctrlKey)) {
								onSave();
								return true;
							}
							return false;
						},
						COMMAND_PRIORITY_HIGH,
					)
				: () => {}; // No-op for plain mode

		return () => {
			removeEscCommand();
			removeEnterCommand();
			removeRichEnterCommand();
		};
	}, [editor, mode, onSave, onCancel]);

	return null;
}

/**
 * Plugin to auto-focus on mount
 */
function AutoFocusPlugin({ autoFocus }: { autoFocus: boolean }) {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		if (autoFocus) {
			editor.focus();
		}
	}, [editor, autoFocus]);

	return null;
}

/**
 * Plugin to handle blur event (save on blur)
 */
function BlurPlugin({ onBlur }: { onBlur: () => void }) {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		return editor.registerCommand(
			BLUR_COMMAND,
			() => {
				onBlur();
				return false;
			},
			COMMAND_PRIORITY_HIGH,
		);
	}, [editor, onBlur]);

	return null;
}

/**
 * Simple validation function
 */
function validateText(text: string, maxLength?: number): string | null {
	const trimmed = text.trim();

	if (trimmed.length === 0) {
		return "Text cannot be empty";
	}

	if (maxLength && trimmed.length > maxLength) {
		return `Maximum ${maxLength} characters allowed`;
	}

	return null; // No error
}

/**
 * Main InlineEditor component
 */
export function InlineEditor({
	value,
	placeholder = "Enter text...",
	mode,
	maxLength,
	onSave,
	onCancel,
	autoFocus = true,
}: InlineEditorProps) {
	const currentTextRef = useRef(value);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		currentTextRef.current = value;
	}, [value]);

	const handleChange = useCallback((editorState: EditorState) => {
		editorState.read(() => {
			const root = $getRoot();
			const textContent = root.getTextContent();
			currentTextRef.current = textContent;
		});
	}, []);

	const handleSave = useCallback(() => {
		const trimmed = currentTextRef.current.trim();

		// Validate
		const validationError = validateText(trimmed, maxLength);
		if (validationError) {
			setError(validationError);
			return;
		}

		onSave(trimmed);
	}, [maxLength, onSave]);

	const initialConfig = {
		namespace: "InlineEditor",
		theme: {},
		onError: (error: Error) => {
			console.error("Lexical error:", error);
			setError(error.message);
		},
		editorState: () => {
			// Initialize editor with plain text content
			const root = $getRoot();
			root.clear();
			if (value) {
				root.append($createParagraphNode().append($createTextNode(value)));
			}
		},
	};

	// Stop propagation to prevent ReactFlow interactions
	const handleClick = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
	}, []);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
	}, []);

	return (
		<div
			className={inlineEditorContainer}
			onClick={handleClick}
			onMouseDown={handleMouseDown}
		>
			<LexicalComposer initialConfig={initialConfig}>
				{mode === "plain" ? (
					<PlainTextPlugin
						contentEditable={
							<ContentEditable className={inlineEditorContentEditable} />
						}
						placeholder={
							<div className={inlineEditorPlaceholder}>{placeholder}</div>
						}
						ErrorBoundary={LexicalErrorBoundary}
					/>
				) : (
					<RichTextPlugin
						contentEditable={
							<ContentEditable className={inlineEditorContentEditable} />
						}
						placeholder={
							<div className={inlineEditorPlaceholder}>{placeholder}</div>
						}
						ErrorBoundary={LexicalErrorBoundary}
					/>
				)}
				<HistoryPlugin />
				<OnChangePlugin onChange={handleChange} />
				<KeyboardPlugin mode={mode} onSave={handleSave} onCancel={onCancel} />
				<AutoFocusPlugin autoFocus={autoFocus} />
				<BlurPlugin onBlur={handleSave} />
			</LexicalComposer>
			{error && <div className={inlineEditorError}>{error}</div>}
		</div>
	);
}
