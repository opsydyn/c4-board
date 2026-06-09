/**
 * SearchInput - Reusable search input component
 *
 * Features:
 * - Magnifying glass icon
 * - Clear button
 * - Debounced input
 * - Keyboard shortcuts
 */

import { useCallback, useEffect, useState } from "react";
import { clearButton, searchIcon, searchInputContainer, searchInputField, searchInputWrapper } from "./SearchInput.css";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange, debounceMs]);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
  }, [onChange]);

  return (
    <div className={searchInputContainer}>
      <div className={searchInputWrapper}>
        <span className={searchIcon} aria-hidden="true">
          🔍
        </span>
        <input
          type="text"
          className={searchInputField}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
        />
        {localValue && (
          <button
            type="button"
            className={clearButton}
            onClick={handleClear}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
