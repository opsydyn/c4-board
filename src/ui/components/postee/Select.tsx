/**
 * Custom Select Component
 *
 * A styled select dropdown that matches our clip-path aesthetic.
 * Replaces native <select> with custom implementation using React Aria.
 */

import { useState, useRef, useCallback } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import {
	selectButton,
	selectMenu,
	selectOption,
	selectOptionActive,
	selectDropdownContainer,
} from "./Select.css";

interface SelectProps<T extends string> {
	value: T;
	options: readonly T[];
	onChange: (value: T) => void;
	className?: string;
	disabled?: boolean;
}

export function Select<T extends string>({
	value,
	options,
	onChange,
	className,
	disabled = false,
}: SelectProps<T>) {
	const [isOpen, setIsOpen] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const handleToggle = useCallback(() => {
		if (!disabled) {
			setIsOpen((prev) => !prev);
		}
	}, [disabled]);

	const handleSelect = useCallback(
		(option: T) => {
			onChange(option);
			setIsOpen(false);
			buttonRef.current?.focus();
		},
		[onChange],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (disabled) return;

			switch (event.key) {
				case "Escape":
					setIsOpen(false);
					buttonRef.current?.focus();
					break;
				case "Enter":
				case " ":
					if (!isOpen) {
						event.preventDefault();
						setIsOpen(true);
					}
					break;
			}
		},
		[disabled, isOpen],
	);

	// Close on blur
	const handleBlur = useCallback((event: React.FocusEvent) => {
		// Check if the new focus target is outside the component
		if (!event.currentTarget.contains(event.relatedTarget as Node)) {
			setIsOpen(false);
		}
	}, []);

	return (
		<div className={selectDropdownContainer} onBlur={handleBlur}>
			<button
				ref={buttonRef}
				type="button"
				className={`${selectButton} ${className ?? ""}`}
				onClick={handleToggle}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				aria-expanded={isOpen}
				aria-haspopup="listbox"
			>
				<span>{value}</span>
				<CaretDownIcon size={16} weight="bold" />
			</button>

			{isOpen && (
				<ul className={selectMenu} role="listbox">
					{options.map((option) => (
						<li
							key={option}
							className={
								option === value
									? `${selectOption} ${selectOptionActive}`
									: selectOption
							}
							role="option"
							aria-selected={option === value}
							onClick={() => handleSelect(option)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									handleSelect(option);
								}
							}}
							tabIndex={0}
						>
							{option}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
