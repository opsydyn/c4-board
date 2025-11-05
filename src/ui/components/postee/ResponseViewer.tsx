/**
 * ResponseViewer - Read-only Monaco viewer for HTTP responses
 *
 * Features:
 * - Syntax highlighting for JSON
 * - Auto-detection of content type
 * - Collapsible sections
 * - Dark theme
 * - Fuzzy search with line jumping
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import {
	responseViewerContainer,
	responseViewerHeader,
	responseViewerContent,
	toggleButton,
} from "./ResponseViewer.css";
import {
	searchJsonContent,
	highlightMatches,
	type JsonSearchResult,
} from "../../../core/effects/json-search";
import {
	searchContainer,
	searchInputWrapper,
	searchIcon,
	searchInput,
	resultsDropdown,
	resultItem,
	lineNumber,
	resultContent,
	resultText,
	emptyState,
	kbd,
} from "./JsonSearchBox.css";

interface ResponseViewerProps {
	body: string;
	headers?: Record<string, string> | string;
	status?: number;
	statusText?: string;
	duration?: number;
	size?: number;
	defaultExpanded?: boolean;
	// Diff comparison props
	baselineBody?: string | null;
	showDiff?: boolean;
	onSetBaseline?: () => void;
	onClearBaseline?: () => void;
	onToggleDiff?: () => void;
}

export function ResponseViewer({
	body,
	headers,
	status,
	statusText,
	duration,
	size,
	defaultExpanded = true,
	baselineBody = null,
	showDiff = false,
	onSetBaseline,
	onClearBaseline,
	onToggleDiff,
}: ResponseViewerProps) {
	const [showBody, setShowBody] = useState(defaultExpanded);
	const [showHeaders, setShowHeaders] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<JsonSearchResult[]>([]);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [selectedResultIndex, setSelectedResultIndex] = useState(0);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const searchContainerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

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

	// Format baseline body if exists and is JSON
	const formattedBaselineBody = (() => {
		if (!baselineBody) return "";
		try {
			return JSON.stringify(JSON.parse(baselineBody), null, 2);
		} catch {
			return baselineBody;
		}
	})();

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
		lineNumbers: "on", // Enable line numbers for search navigation
		renderLineHighlight: "all",
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
		lineNumbersMinChars: 3,
		glyphMargin: false,
		overviewRulerLanes: 0,
	};

	// Search JSON content when query changes
	useEffect(() => {
		if (isJson && searchQuery.trim().length >= 1) {
			const results = searchJsonContent(searchQuery, formattedBody);
			setSearchResults(results);
			setIsSearchOpen(results.length > 0);
			setSelectedResultIndex(0);
		} else {
			setSearchResults([]);
			setIsSearchOpen(false);
		}
	}, [searchQuery, formattedBody, isJson]);

	// Handle keyboard shortcuts for search
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// ⌘F or Ctrl+F to focus search (only if JSON body is shown)
			if ((event.metaKey || event.ctrlKey) && event.key === "f" && isJson && showBody) {
				event.preventDefault();
				searchInputRef.current?.focus();
			}

			// ESC to close search
			if (event.key === "Escape" && isSearchOpen) {
				event.preventDefault();
				setIsSearchOpen(false);
				setSearchQuery("");
				searchInputRef.current?.blur();
			}

			// Arrow keys to navigate results
			if (isSearchOpen && searchResults.length > 0) {
				if (event.key === "ArrowDown") {
					event.preventDefault();
					setSelectedResultIndex((prev) => (prev + 1) % searchResults.length);
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					setSelectedResultIndex((prev) =>
						prev === 0 ? searchResults.length - 1 : prev - 1,
					);
				} else if (event.key === "Enter" && searchResults[selectedResultIndex]) {
					event.preventDefault();
					jumpToLine(searchResults[selectedResultIndex].line.lineNumber);
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isSearchOpen, searchResults, selectedResultIndex, isJson, showBody]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				searchContainerRef.current &&
				event.target instanceof HTMLElement &&
				!searchContainerRef.current.contains(event.target)
			) {
				setIsSearchOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Jump to a specific line in Monaco editor
	const jumpToLine = useCallback((lineNumber: number) => {
		if (editorRef.current) {
			editorRef.current.revealLineInCenter(lineNumber);
			editorRef.current.setPosition({ lineNumber, column: 1 });
			editorRef.current.focus();
			setIsSearchOpen(false);
			setSearchQuery("");
		}
	}, []);

	// Handle editor mount
	const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
		editorRef.current = editor;
	}, []);

	const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchQuery(event.target.value);
	};

	const handleSearchFocus = () => {
		if (searchResults.length > 0) {
			setIsSearchOpen(true);
		}
	};

	const handleResultClick = (lineNumber: number) => {
		jumpToLine(lineNumber);
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
				<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
					<button
						type="button"
						className={toggleButton}
						onClick={() => setShowBody(!showBody)}
						style={{ marginBottom: 0 }}
					>
						{showBody ? "▼" : "▶"} <strong>Response Body</strong>
						{isJson && <span> (JSON)</span>}
					</button>

					{/* Diff comparison controls - only show for JSON */}
					{isJson && showBody && (
						<div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
							{baselineBody ? (
								<>
									<button
										type="button"
										onClick={onToggleDiff}
										style={{
											padding: "4px 8px",
											fontSize: "11px",
											background: showDiff ? "#88C0D0" : "transparent",
											color: showDiff ? "#0a0a0a" : "#88C0D0",
											border: "1px solid #88C0D0",
											borderRadius: "4px",
											cursor: "pointer",
											fontFamily: "monospace",
											textTransform: "uppercase",
										}}
									>
										{showDiff ? "■ DIFF" : "□ DIFF"}
									</button>
									<button
										type="button"
										onClick={onClearBaseline}
										style={{
											padding: "4px 8px",
											fontSize: "11px",
											background: "transparent",
											color: "#ff6b6b",
											border: "1px solid #ff6b6b",
											borderRadius: "4px",
											cursor: "pointer",
											fontFamily: "monospace",
											textTransform: "uppercase",
										}}
									>
										✕ CLEAR
									</button>
								</>
							) : (
								<button
									type="button"
									onClick={onSetBaseline}
									style={{
										padding: "4px 8px",
										fontSize: "11px",
										background: "transparent",
										color: "#88C0D0",
										border: "1px solid #88C0D0",
										borderRadius: "4px",
										cursor: "pointer",
										fontFamily: "monospace",
										textTransform: "uppercase",
									}}
								>
									☆ SET BASELINE
								</button>
							)}
						</div>
					)}
				</div>

				{showBody && (
					<>
						{/* Search Box - only show for JSON and not in diff mode */}
						{isJson && !showDiff && (
							<div className={searchContainer} ref={searchContainerRef}>
								<div className={searchInputWrapper}>
									<div className={searchIcon}>
										<MagnifyingGlassIcon size={16} weight="bold" />
									</div>
									<input
										ref={searchInputRef}
										type="text"
										className={searchInput}
										placeholder="SEARCH::JSON (FUZZY)"
										value={searchQuery}
										onChange={handleSearchChange}
										onFocus={handleSearchFocus}
										aria-label="Search JSON content"
										aria-expanded={isSearchOpen}
										aria-controls="json-search-results"
									/>
									<kbd className={kbd}>⌘F</kbd>
								</div>

								{isSearchOpen && (
									<div className={resultsDropdown} id="json-search-results" role="listbox">
										{searchResults.length > 0 ? (
											searchResults.map((result, index) => {
												const highlighted = highlightMatches(
													result.line.trimmedContent,
													result.matches,
												);

												return (
													<div
														key={`${result.line.lineNumber}-${index}`}
														className={resultItem}
														onClick={() => handleResultClick(result.line.lineNumber)}
														onMouseEnter={() => setSelectedResultIndex(index)}
														role="option"
														aria-selected={index === selectedResultIndex}
														style={{
															backgroundColor:
																index === selectedResultIndex
																	? "rgba(136, 192, 208, 0.1)"
																	: undefined,
														}}
													>
														<span className={lineNumber}>
															L{result.line.lineNumber}
														</span>
														<div className={resultContent}>
															<div
																className={resultText}
																// biome-ignore lint/security/noDangerouslySetInnerHtml: Controlled highlighting of search results
																dangerouslySetInnerHTML={{ __html: highlighted }}
															/>
														</div>
													</div>
												);
											})
										) : (
											<div className={emptyState}>[▒▒▒▒] NO MATCHES FOUND</div>
										)}
									</div>
								)}
							</div>
						)}

						{showDiff && baselineBody ? (
							<DiffEditor
								height="300px"
								language={isJson ? "json" : "plaintext"}
								original={formattedBaselineBody}
								modified={formattedBody}
								theme="hc-black"
								options={{
									...editorOptions,
									readOnly: true,
									renderSideBySide: true,
								}}
							/>
						) : (
							<Editor
								height="300px"
								defaultLanguage={isJson ? "json" : "plaintext"}
								value={formattedBody}
								theme="hc-black"
								options={editorOptions}
								onMount={handleEditorDidMount}
							/>
						)}
					</>
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
