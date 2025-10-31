import { useMemo, useState, useCallback } from "react";
import { MagnifyingGlassIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import { DialogTrigger, Button, Popover, Dialog } from "react-aria-components";
import type { NodeIconId, C4Type } from "../../../core/effects/node-operations";
import { DEFAULT_ICON_BY_TYPE } from "../../../core/effects/node-operations";
import { getNodeIconComponent, resolveNodeIconId } from "../../icons/nodeIcons";
import {
	pickerContainer,
	trigger,
	triggerIcon,
	popoverContent,
	quickFilterRow,
	searchInput,
	iconGrid,
	iconButton,
	footerRow,
	footerButton,
} from "./IconPicker.css";

const ICON_OPTIONS: Array<{ id: NodeIconId; label: string; group: string }> = [
	{ id: "phosphor:user-duotone", label: "Operator", group: "Actors" },
	{ id: "phosphor:package-duotone", label: "System", group: "Systems" },
	{ id: "phosphor:cloud-duotone", label: "External", group: "Systems" },
	{ id: "phosphor:stack-duotone", label: "Container", group: "Scopes" },
	{ id: "phosphor:cube-duotone", label: "Component", group: "Scopes" },
];

interface IconPickerProps {
	value?: NodeIconId | null | undefined;
	type: C4Type;
	onChange: (iconId: NodeIconId) => void;
	onReset?: () => void;
}

export function IconPicker({ value, type, onChange, onReset }: IconPickerProps) {
	const resolvedIconId = resolveNodeIconId(value ?? undefined, type);
	const Icon = getNodeIconComponent(resolvedIconId, type);
	const [filter, setFilter] = useState("");

	const resolvedLabel = useMemo(() => {
		return ICON_OPTIONS.find((option) => option.id === resolvedIconId)?.label ?? resolvedIconId;
	}, [resolvedIconId]);

	const filteredOptions = useMemo(() => {
		const normalized = filter.trim().toLowerCase();
		if (!normalized) return ICON_OPTIONS;
		return ICON_OPTIONS.filter((option) =>
			option.label.toLowerCase().includes(normalized) ||
			option.group.toLowerCase().includes(normalized),
		);
	}, [filter]);

	const handleSelect = useCallback(
		(iconId: NodeIconId) => {
			onChange(iconId);
		},
		[onChange],
	);

	const handleReset = useCallback(() => {
		const fallback = DEFAULT_ICON_BY_TYPE[type];
		onChange(fallback);
		onReset?.();
	}, [onChange, onReset, type]);

	return (
		<div className={pickerContainer}>
			<DialogTrigger
				onOpenChange={(open) => {
					if (!open) setFilter("");
				}}
			>
				<Button className={trigger} aria-label="Select icon">
					<div className={triggerIcon}>
						<Icon size={24} weight="duotone" />
					</div>
					<span>{resolvedLabel}</span>
				</Button>

				<Popover offset={8} className={popoverContent}>
					<Dialog aria-label="Select node icon">
						{({ close }) => (
							<>
								<div className={quickFilterRow}>
									<MagnifyingGlassIcon size={16} weight="bold" />
									<input
										type="search"
										className={searchInput}
										placeholder="Filter icons"
										value={filter}
										onChange={(event) => setFilter(event.target.value)}
										autoFocus
									/>
								</div>

								<div className={iconGrid}>
									{filteredOptions.map((option) => {
										const OptionIcon = getNodeIconComponent(option.id, type);
										const isSelected = option.id === resolvedIconId;
										return (
											<Button
												key={option.id}
												type="button"
												className={iconButton}
												data-selected={isSelected ? "true" : undefined}
												aria-pressed={isSelected}
												aria-label={option.label}
												onPress={() => {
													handleSelect(option.id);
													close();
												}}
											>
												<OptionIcon size={20} weight="duotone" />
												<span>{option.label}</span>
											</Button>
										);
									})}
								</div>

								<div className={footerRow}>
									<Button
										className={footerButton}
										onPress={() => {
											handleReset();
											close();
										}}
									>
										<CheckIcon size={16} weight="bold" /> Reset to default
									</Button>
									<Button
										className={footerButton}
										onPress={() => close()}
									>
										<XIcon size={16} weight="bold" /> ESC
									</Button>
								</div>
							</>
						)}
					</Dialog>
				</Popover>
			</DialogTrigger>
		</div>
	);
}
