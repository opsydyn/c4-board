/**
 * LayoutMenu - Auto-Layout Preset Selector
 *
 * Nested menu using React Aria for selecting C4 layout algorithms.
 * Categorized by: Essential, Advanced, Utility layouts.
 */

import {
	Menu,
	MenuItem,
	MenuTrigger,
	Button,
	Popover,
	MenuSection,
	Header,
	Separator,
} from "react-aria-components";
import { GridFourIcon, CaretDownIcon } from "@phosphor-icons/react";
import { getAllPresets, type LayoutPresetName } from "../../core/effects/layout";
import {
	menuButton,
	menuPopover,
	menuContent,
	menuSection,
	menuHeader,
	menuItem,
	menuSeparator,
	menuIcon,
} from "./LayoutMenu.css";

interface LayoutMenuProps {
	onSelectLayout: (presetName: LayoutPresetName) => void;
	currentLayout?: LayoutPresetName;
	variant?: "all" | "selected";
}

export function LayoutMenu({
	onSelectLayout,
	currentLayout,
	variant = "all",
}: LayoutMenuProps) {
	const presets = getAllPresets();

	// Group presets by category
	const essentialPresets = presets.filter((p) => p.category === "essential");
	const advancedPresets = presets.filter((p) => p.category === "advanced");
	const utilityPresets = presets.filter((p) => p.category === "utility");

	const handleAction = (key: React.Key) => {
		const action = String(key);

		// Extract layout name from key (format: "layout-{name}")
		if (action.startsWith("layout-")) {
			const layoutName = action.replace("layout-", "") as LayoutPresetName;
			onSelectLayout(layoutName);
		}
	};

	const buttonLabel = variant === "selected" ? "Layout Selected" : "Layout All";

	return (
		<MenuTrigger>
			<Button className={menuButton}>
				<GridFourIcon size={20} weight={variant === "selected" ? "fill" : "duotone"} className={menuIcon} />
				{buttonLabel}
				<CaretDownIcon size={16} weight="bold" />
			</Button>
			<Popover className={menuPopover}>
				<Menu className={menuContent} onAction={handleAction}>
					{/* Essential Layouts Section */}
					<MenuSection className={menuSection}>
						<Header className={menuHeader}>ESSENTIAL LAYOUTS</Header>
						{essentialPresets.map((preset) => (
							<MenuItem
								key={`layout-${preset.name}`}
								id={`layout-${preset.name}`}
								className={menuItem}
								textValue={preset.label}
							>
								<div>
									<div style={{ fontWeight: 600 }}>{preset.label}</div>
									<div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
										{preset.description}
									</div>
								</div>
								{currentLayout === preset.name && (
									<span style={{ marginLeft: "auto", color: "#81A1C1" }}>✓</span>
								)}
							</MenuItem>
						))}
					</MenuSection>

					<Separator className={menuSeparator} />

					{/* Advanced Layouts Section */}
					<MenuSection className={menuSection}>
						<Header className={menuHeader}>ADVANCED PATTERNS</Header>
						{advancedPresets.map((preset) => (
							<MenuItem
								key={`layout-${preset.name}`}
								id={`layout-${preset.name}`}
								className={menuItem}
								textValue={preset.label}
							>
								<div>
									<div style={{ fontWeight: 600 }}>{preset.label}</div>
									<div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
										{preset.description}
									</div>
								</div>
								{currentLayout === preset.name && (
									<span style={{ marginLeft: "auto", color: "#81A1C1" }}>✓</span>
								)}
							</MenuItem>
						))}
					</MenuSection>

					<Separator className={menuSeparator} />

					{/* Utility Layouts Section */}
					<MenuSection className={menuSection}>
						<Header className={menuHeader}>UTILITY</Header>
						{utilityPresets.map((preset) => (
							<MenuItem
								key={`layout-${preset.name}`}
								id={`layout-${preset.name}`}
								className={menuItem}
								textValue={preset.label}
							>
								<div>
									<div style={{ fontWeight: 600 }}>{preset.label}</div>
									<div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
										{preset.description}
									</div>
								</div>
								{currentLayout === preset.name && (
									<span style={{ marginLeft: "auto", color: "#81A1C1" }}>✓</span>
								)}
							</MenuItem>
						))}
					</MenuSection>
				</Menu>
			</Popover>
		</MenuTrigger>
	);
}
