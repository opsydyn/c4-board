/**
 * SearchBox - Fuzzy search for canvas nodes
 *
 * Allows users to search for nodes by label, description, technology, or type.
 * Uses Fuse.js for fuzzy matching.
 */

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { Node } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	searchNodes,
	getNodeTypeLabel,
	getNodeTypeColor,
	type SearchResult,
} from "../../core/effects/search";
import {
	searchContainer,
	searchInputWrapper,
	searchIcon,
	searchInput,
	resultsDropdown,
	resultItem,
	resultBadge,
	resultContent,
	resultLabel,
	resultDescription,
	emptyState,
	kbd,
} from "./SearchBox.css";

interface SearchBoxProps {
	nodes: Node[];
	onSelectNode: (nodeId: string) => void;
}

export function SearchBox({ nodes, onSelectNode }: SearchBoxProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Search when query changes
	useEffect(() => {
		if (query.trim().length >= 2) {
			const searchResults = searchNodes(query, nodes);
			setResults(searchResults);
			setIsOpen(searchResults.length > 0);
			setSelectedIndex(0);
		} else {
			setResults([]);
			setIsOpen(false);
		}
	}, [query, nodes]);

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
					setSelectedIndex((prev) =>
						prev === 0 ? results.length - 1 : prev - 1,
					);
				} else if (event.key === "Enter" && results[selectedIndex]) {
					event.preventDefault();
					handleSelectNode(results[selectedIndex].node.id);
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
				containerRef.current &&
				event.target instanceof HTMLElement &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelectNode = useCallback(
		(nodeId: string) => {
			onSelectNode(nodeId);
			setIsOpen(false);
			setQuery("");
			inputRef.current?.blur();
		},
		[onSelectNode],
	);

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(event.target.value);
	};

	const handleInputFocus = () => {
		if (results.length > 0) {
			setIsOpen(true);
		}
	};

	return (
		<div className={searchContainer} ref={containerRef}>
			<div className={searchInputWrapper}>
				<div className={searchIcon}>
					<MagnifyingGlass size={16} weight="bold" />
				</div>
				<input
					ref={inputRef}
					type="text"
					className={searchInput}
					placeholder="Search nodes..."
					value={query}
					onChange={handleInputChange}
					onFocus={handleInputFocus}
					aria-label="Search nodes"
					aria-expanded={isOpen}
					aria-controls="search-results"
				/>
				<kbd className={kbd}>⌘K</kbd>
			</div>

			{isOpen && (
				<div className={resultsDropdown} id="search-results" role="listbox">
					{results.length > 0 ? (
						results.map((result, index) => {
							const nodeData = result.node.data || {};
							const label = String(nodeData.label || "Untitled");
							const description = nodeData.description ? String(nodeData.description) : "";
							const nodeType = result.node.type || "unknown";
							const typeLabel = getNodeTypeLabel(nodeType);
							const typeColor = getNodeTypeColor(nodeType);

							return (
								<div
									key={result.node.id}
									className={resultItem}
									onClick={() => handleSelectNode(result.node.id)}
									onMouseEnter={() => setSelectedIndex(index)}
									role="option"
									aria-selected={index === selectedIndex}
									style={{
										backgroundColor:
											index === selectedIndex
												? "rgba(0, 255, 170, 0.1)"
												: undefined,
									}}
								>
									<span
										className={resultBadge}
										style={{
											backgroundColor: `${typeColor}22`,
											color: typeColor,
											border: `1px solid ${typeColor}44`,
										}}
									>
										{typeLabel}
									</span>
									<div className={resultContent}>
										<div className={resultLabel}>{label}</div>
										{description && (
											<div className={resultDescription}>{description}</div>
										)}
									</div>
								</div>
							);
						})
					) : (
						<div className={emptyState}>[▒▒▒▒] NO TARGETS ACQUIRED</div>
					)}
				</div>
			)}
		</div>
	);
}
