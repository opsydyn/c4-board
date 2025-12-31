/**
 * Tooltip Component
 *
 * React Aria-powered tooltip for accessible, production-ready tooltips.
 * - Full keyboard navigation support
 * - Proper ARIA attributes
 * - Respects reduced motion preferences
 * - Smart positioning
 *
 * IMPORTANT: Children must be a single focusable element (button, ToggleButton, etc.)
 * Do not wrap in additional elements - TooltipTrigger works with any focusable child.
 */

import { TooltipTrigger, Tooltip as AriaTooltip } from "react-aria-components";
import type { ReactNode } from "react";
import * as styles from "./Tooltip.css";

export interface TooltipProps {
	content: string;
	children: ReactNode;
	delay?: number;
}

export function Tooltip({ content, children, delay = 500 }: TooltipProps) {
	return (
		<TooltipTrigger delay={delay}>
			{children}
			<AriaTooltip className={styles.tooltipContent}>
				{content}
			</AriaTooltip>
		</TooltipTrigger>
	);
}
