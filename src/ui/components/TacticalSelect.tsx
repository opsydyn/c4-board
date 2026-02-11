import { CaretDownIcon, CheckIcon, GridFourIcon } from "@phosphor-icons/react";
import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  menuSelect,
  menuSelectChevronIcon,
  menuSelectContainer,
  menuSelectLeadIcon,
  menuSelectList,
  menuSelectOption,
  menuSelectOptionIcon,
  menuSelectPopover,
  menuSelectShell,
} from "./LayoutMenu.css";

export interface TacticalSelectOption {
  readonly value: string;
  readonly label: string;
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface TacticalSelectProps {
  readonly id?: string;
  readonly value: string;
  readonly options: readonly TacticalSelectOption[];
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
}

export function TacticalSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: TacticalSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxId = id ? `${id}-listbox` : undefined;
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const isInsideTrigger = rootRef.current?.contains(target) ?? false;
      const isInsidePopover = popoverRef.current?.contains(target) ?? false;
      if (!isInsideTrigger && !isInsidePopover) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePopoverPosition = () => {
      const trigger = rootRef.current;
      if (!trigger) {
        return;
      }

      const viewportPadding = 8;
      const offset = 4;
      const triggerRect = trigger.getBoundingClientRect();
      const popoverHeight = popoverRef.current?.getBoundingClientRect().height ?? 0;

      const width = Math.round(
        Math.min(
          Math.max(180, triggerRect.width),
          window.innerWidth - viewportPadding * 2,
        ),
      );
      let left = Math.round(triggerRect.left);
      const maxLeft = window.innerWidth - width - viewportPadding;
      left = Math.max(viewportPadding, Math.min(left, maxLeft));

      const belowTop = Math.round(triggerRect.bottom + offset);
      const aboveSpace = Math.max(120, Math.round(triggerRect.top - viewportPadding - offset));
      const belowSpace = Math.max(
        120,
        Math.round(window.innerHeight - belowTop - viewportPadding),
      );

      const shouldOpenAbove = belowSpace < 180 && aboveSpace > belowSpace;

      const maxHeight = shouldOpenAbove ? aboveSpace : belowSpace;
      const measuredHeight = popoverHeight > 0 ? popoverHeight : maxHeight;
      const top = shouldOpenAbove
        ? Math.max(
          viewportPadding,
          Math.round(triggerRect.top - offset - Math.min(measuredHeight, maxHeight)),
        )
        : belowTop;

      setPopoverStyle({
        top,
        left,
        width,
        maxHeight,
      });
    };

    updatePopoverPosition();
    const rafId = window.requestAnimationFrame(updatePopoverPosition);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) {
      return;
    }
    setIsOpen((previous) => !previous);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (
      event.key === "Enter"
      || event.key === " "
      || event.key === "ArrowDown"
    ) {
      event.preventDefault();
      setIsOpen(true);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  const handleBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node)) {
      setIsOpen(false);
      return;
    }
    const isInsideTrigger = event.currentTarget.contains(nextTarget);
    const isInsidePopover = popoverRef.current?.contains(nextTarget) ?? false;
    if (!isInsideTrigger && !isInsidePopover) {
      setIsOpen(false);
    }
  };

  return (
    <div className={menuSelectContainer} ref={rootRef} onBlur={handleBlur}>
      <div className={menuSelectShell}>
        <GridFourIcon
          size={14}
          weight="duotone"
          aria-hidden="true"
          className={menuSelectLeadIcon}
        />
        <button
          id={id}
          type="button"
          className={menuSelect}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
        >
          {selectedOption?.label ?? value}
        </button>
        <CaretDownIcon
          size={14}
          weight="bold"
          aria-hidden="true"
          className={menuSelectChevronIcon}
        />
      </div>
      {isOpen
        && typeof document !== "undefined"
        && createPortal(
          <div
            ref={popoverRef}
            className={menuSelectPopover}
            style={popoverStyle ?? undefined}
          >
            <ul id={listboxId} role="listbox" className={menuSelectList}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected ? "true" : "false"}
                      className={menuSelectOption}
                      onClick={() => handleSelect(option.value)}
                    >
                      <span>{option.label}</span>
                      {isSelected && (
                        <CheckIcon
                          size={14}
                          weight="bold"
                          aria-hidden="true"
                          className={menuSelectOptionIcon}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
