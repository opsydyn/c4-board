/**
 * PosteeSearchBox - Fuzzy search for collections and requests
 *
 * Allows users to search for collections/requests by name, method, or URL.
 * Uses Fuse.js for fuzzy matching with Cmd+K shortcut.
 */

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PosteeCollection, PosteeRequest } from "../../../core/effects/database.postee";
import { type PosteeSearchResult, searchPostee } from "../../../core/effects/postee/search";
import * as styles from "./PosteeSearchBox.css";

export interface PosteeSearchBoxProps {
  collections: PosteeCollection[];
  requestsByCollection: Record<string, PosteeRequest[]>;
  onSelectCollection: (collectionId: string) => void;
  onSelectRequest: (requestId: string) => void;
}

export function PosteeSearchBox({
  collections,
  requestsByCollection,
  onSelectCollection,
  onSelectRequest,
}: PosteeSearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosteeSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search when query changes
  useEffect(() => {
    if (query.trim().length >= 2) {
      const searchResults = searchPostee(
        query,
        collections,
        requestsByCollection,
      );
      setResults(searchResults);
      setIsOpen(searchResults.length > 0);
      setSelectedIndex(0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, collections, requestsByCollection]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ⌘K or Ctrl+K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }

      // ESC to close
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setIsOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }

      // Arrow keys to navigate results
      if (isOpen && results.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((prev) => prev === 0 ? results.length - 1 : prev - 1);
        } else if (event.key === "Enter" && results[selectedIndex]) {
          event.preventDefault();
          handleSelectItem(results[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current
        && event.target instanceof HTMLElement
        && !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectItem = useCallback(
    (result: PosteeSearchResult) => {
      if (result.item.type === "collection") {
        onSelectCollection(result.item.id);
      } else {
        onSelectRequest(result.item.id);
      }
      setIsOpen(false);
      setQuery("");
      inputRef.current?.blur();
    },
    [onSelectCollection, onSelectRequest],
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleInputFocus = () => {
    if (results.length > 0) {
      setIsOpen(true);
    }
  };

  // Helper to get method badge color
  const getMethodColor = (method: string): string => {
    const colors: Record<string, string> = {
      GET: "#00FFAA",
      POST: "#4CC38A",
      PUT: "#FFA500",
      PATCH: "#FFD700",
      DELETE: "#FF6B6B",
      HEAD: "#8FD6FF",
      OPTIONS: "#A78BFA",
    };
    return colors[method] || "#8FD6FF";
  };

  return (
    <div className={styles.searchContainer} ref={containerRef}>
      <div className={styles.searchInputWrapper}>
        <div className={styles.searchIcon}>
          <MagnifyingGlassIcon size={16} weight="bold" />
        </div>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="SEARCH (⌘K)"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          aria-label="Search collections and requests"
          aria-expanded={isOpen}
          aria-controls="search-results"
        />
      </div>

      {isOpen && (
        <div className={styles.resultsDropdown} id="search-results" role="listbox">
          {results.length > 0
            ? (
              results.map((result, index) => (
                <div
                  key={`${result.item.type}-${result.item.id}`}
                  className={styles.resultItem}
                  onClick={() => handleSelectItem(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  role="option"
                  aria-selected={index === selectedIndex}
                  style={{
                    backgroundColor: index === selectedIndex
                      ? "rgba(0, 255, 170, 0.1)"
                      : undefined,
                  }}
                >
                  <span
                    className={styles.resultBadge}
                    style={{
                      backgroundColor: result.item.type === "collection"
                        ? "rgba(76, 195, 138, 0.2)"
                        : `${getMethodColor(result.item.method ?? "GET")}22`,
                      color: result.item.type === "collection"
                        ? "#4CC38A"
                        : getMethodColor(result.item.method ?? "GET"),
                      border: result.item.type === "collection"
                        ? "1px solid #4CC38A44"
                        : `1px solid ${getMethodColor(result.item.method ?? "GET")}44`,
                    }}
                  >
                    {result.item.type === "collection"
                      ? "COL"
                      : result.item.method}
                  </span>
                  <div className={styles.resultContent}>
                    <div className={styles.resultLabel}>{result.item.name}</div>
                    {result.item.url && (
                      <div className={styles.resultDescription}>
                        {result.item.collectionName && `${result.item.collectionName} › `}
                        {result.item.url}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )
            : <div className={styles.emptyState}>[▒▒▒▒] NO MATCHES FOUND</div>}
        </div>
      )}
    </div>
  );
}
