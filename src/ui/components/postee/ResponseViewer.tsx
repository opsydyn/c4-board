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

import Editor, { DiffEditor } from "@monaco-editor/react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useRef, useState } from "react";
import { highlightMatches, type JsonSearchResult, searchJsonContent } from "../../../core/effects/json-search";
import {
  emptyState,
  kbd,
  lineNumber,
  resultContent,
  resultItem,
  resultsDropdown,
  resultText,
  searchContainer,
  searchIcon,
  searchInput,
  searchInputWrapper,
} from "./JsonSearchBox.css";
import {
  baselineButton,
  baselineButtonActive,
  clearButton,
  responseViewerContainer,
  responseViewerContent,
  responseViewerHeader,
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
  const [containerWidth, setContainerWidth] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const parsedHeaders = typeof headers === "string" ? JSON.parse(headers) : headers;

  // Monaco has a nice high-contrast dark theme built-in
  // We'll use "hc-black" (high contrast black) for techy vibes

  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    readOnly: true,
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
    lineNumbers: "on", // Enable line numbers for search navigation
    renderLineHighlight: "all",
    automaticLayout: true,
    wordWrap: "on",
    wrappingIndent: "indent",
    folding: true,
    bracketPairColorization: { enabled: true },
    // Enable Code Lens (inline hints showing object/array counts)
    codeLens: true,
    // Enable Sticky Scroll (keep parent keys visible when scrolling)
    stickyScroll: {
      enabled: true,
      maxLineCount: 5,
    },
    padding: { top: 8, bottom: 8 },
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    contextmenu: true, // Enable context menu for custom actions
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 3,
    glyphMargin: false,
    overviewRulerLanes: 3,
    // Enable Find widget (read-only, so no replace)
    find: {
      seedSearchStringFromSelection: "selection",
      autoFindInSelection: "never",
      addExtraSpaceOnTop: true,
      loop: true,
    },
    // Enable Command Palette (Cmd+Shift+P / F1)
    quickSuggestionsDelay: 10,
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
          setSelectedResultIndex((prev) => prev === 0 ? searchResults.length - 1 : prev - 1);
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
        searchContainerRef.current
        && event.target instanceof HTMLElement
        && !searchContainerRef.current.contains(event.target)
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
  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
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
            const parsed = JSON.parse(content);

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
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const trimmed = line?.trim() ?? "";

              // Array start
              if (trimmed.includes("[")) {
                const keyMatch = line?.match(/"([^"]+)"\s*:\s*\[/) ?? null;
                if (keyMatch) {
                  try {
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
                    // Ignore
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
                    // Ignore
                  }
                }
              }
            }
          } catch {
            // Invalid JSON
          }

          return { lenses, dispose: () => {} };
        },
      });

      // Register enhanced token provider for semantic highlighting
      monaco.languages.setMonarchTokensProvider("json", {
        tokenizer: {
          root: [
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
      monaco.editor.defineTheme("postee-response-dark", {
        base: "hc-black",
        inherit: true,
        rules: [
          // JSON keys - cyan (bold for emphasis)
          { token: "key", foreground: "88C0D0", fontStyle: "bold" },
          // String values - green
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
      monaco.editor.setTheme("postee-response-dark");

      // Add custom context menu items
      editor.addAction({
        id: "postee.copyAsJson",
        label: "Copy as JSON",
        contextMenuGroupId: "9_cutcopypaste",
        contextMenuOrder: 1,
        run: (ed) => {
          const model = ed.getModel();
          if (!model) return;
          navigator.clipboard.writeText(model.getValue());
        },
      });

      editor.addAction({
        id: "postee.copyValue",
        label: "Copy Selected Value",
        contextMenuGroupId: "9_cutcopypaste",
        contextMenuOrder: 2,
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
        id: "postee.expandAll",
        label: "Expand All",
        contextMenuGroupId: "navigation",
        contextMenuOrder: 1,
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE],
        run: (ed) => {
          ed.getAction("editor.unfoldAll")?.run();
        },
      });

      editor.addAction({
        id: "postee.collapseAll",
        label: "Collapse All",
        contextMenuGroupId: "navigation",
        contextMenuOrder: 2,
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL],
        run: (ed) => {
          ed.getAction("editor.foldAll")?.run();
        },
      });
    },
    [],
  );

  // Track container width for responsive diff view
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
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

  // Determine if we should use inline diff mode (when width is constrained)
  // Threshold: < 900px use inline, >= 900px use side-by-side
  const useInlineDiff = containerWidth > 0 && containerWidth < 900;

  return (
    <div ref={containerRef} className={responseViewerContainer}>
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
        {size !== undefined && (
          <span>
            <strong>Size:</strong> {size} bytes
          </span>
        )}
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
            {isJson && <span>(JSON)</span>}
          </button>

          {/* Diff comparison controls - only show for JSON */}
          {isJson && showBody && (
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              {baselineBody
                ? (
                  <>
                    <button
                      type="button"
                      onClick={onToggleDiff}
                      className={showDiff ? baselineButtonActive : baselineButton}
                    >
                      {showDiff ? "■ DIFF" : "□ DIFF"}
                    </button>
                    <button
                      type="button"
                      onClick={onClearBaseline}
                      className={clearButton}
                    >
                      ✕ CLEAR
                    </button>
                  </>
                )
                : (
                  <button
                    type="button"
                    onClick={onSetBaseline}
                    className={baselineButton}
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
                    {searchResults.length > 0
                      ? (
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
                                backgroundColor: index === selectedResultIndex
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
                      )
                      : <div className={emptyState}>[▒▒▒▒] NO MATCHES FOUND</div>}
                  </div>
                )}
              </div>
            )}

            {showDiff && baselineBody
              ? (
                <DiffEditor
                  height={useInlineDiff ? "500px" : "400px"}
                  language={isJson ? "json" : "plaintext"}
                  original={formattedBaselineBody}
                  modified={formattedBody}
                  originalModelPath="response-diff-original"
                  modifiedModelPath="response-diff-modified"
                  theme="postee-response-dark"
                  options={{
                    ...editorOptions,
                    readOnly: true,
                    renderSideBySide: !useInlineDiff,
                  }}
                />
              )
              : (
                <Editor
                  height="300px"
                  defaultLanguage={isJson ? "json" : "plaintext"}
                  value={formattedBody}
                  theme="postee-response-dark"
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
              theme="postee-response-dark"
              options={editorOptions}
            />
          )}
        </div>
      )}
    </div>
  );
}
