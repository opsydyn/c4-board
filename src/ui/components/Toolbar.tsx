/**
 * Toolbar - Node creation controls and save status
 *
 * Allows users to add C4 elements to the canvas and shows save status.
 */

import {
	CloudIcon,
	PackageIcon,
	UserIcon,
	FloppyDiskIcon,
	CheckCircleIcon,
	ListBulletsIcon,
	PlusIcon,
	StackIcon,
	CubeIcon,
	PlayIcon,
	PauseIcon,
} from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { Duration } from "effect";
import {
	toolbar,
	toolbarButton,
	saveStatus,
	boardNameInput,
	toolbarLink,
} from "./styles.css";
import { LayoutMenu } from "./LayoutMenu";
import type { LayoutPresetName } from "../../core/effects/layout";
import {Button} from 'react-aria-components';

const ONE_MINUTE = Duration.minutes(1);
const ONE_HOUR = Duration.hours(1);
const TICK_INTERVAL = Duration.seconds(10);

interface ToolbarProps {
	onAddPerson: () => void;
	onAddSystem: () => void;
	onAddExternalSystem: () => void;
	onAddContainer: () => void;
	onAddComponent: () => void;
	onSave: () => void;
	onNewBoard: () => void;
	onAutoLayout: (presetName: LayoutPresetName) => void;
	onAutoLayoutSelected: (presetName: LayoutPresetName) => void;
	onDiagramNameChange: (name: string) => void;
	onSessionNameChange: (name: string) => void;
	onToggleAnimations: () => void;
	onOpenSavedDiagrams?: () => void;
	sessionName: string;
	isSaving?: boolean;
	lastSaved?: number | null;
	saveError?: string | null;
	diagramName?: string;
	currentLayout?: LayoutPresetName;
	animationsEnabled?: boolean;
}

function formatSaveTime(timestamp: number, now: number): string {
	const elapsed = Duration.millis(now - timestamp);

	if (Duration.lessThan(elapsed, ONE_MINUTE)) {
		return "STATE::SYNCED @ NOW";
	}
	if (Duration.lessThan(elapsed, ONE_HOUR)) {
		const minutes = Math.floor(Duration.toMinutes(elapsed));
		return `${minutes}m ago`;
	}
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function useLiveSaveTime(timestamp: number | null): string | null {
	const [now, setNow] = useState(Date.now);

	useEffect(() => {
		if (timestamp === null) return;

		setNow(Date.now());

		const interval = setInterval(() => {
			setNow(Date.now());
		}, Duration.toMillis(TICK_INTERVAL));

		return () => clearInterval(interval);
	}, [timestamp]);

	if (timestamp === null) return null;
	return formatSaveTime(timestamp, now);
}

export function Toolbar({
	onAddPerson,
	onAddSystem,
	onAddExternalSystem,
	onAddContainer,
	onAddComponent,
	onSave,
	onNewBoard,
	onAutoLayout,
	onAutoLayoutSelected,
	onDiagramNameChange,
	onSessionNameChange,
	onToggleAnimations,
	onOpenSavedDiagrams,
	sessionName,
	isSaving = false,
	lastSaved = null,
	saveError = null,
	diagramName = "Untitled",
	currentLayout,
	animationsEnabled = true,
}: ToolbarProps) {
	const saveTimeLabel = useLiveSaveTime(lastSaved);

	return (
		<div className={toolbar}>
			{/* Board name editor and save status */}
			<div className={saveStatus}>
				<input
					type="text"
					value={diagramName}
					onChange={(e) => onDiagramNameChange(e.target.value)}
					className={boardNameInput}
					placeholder="Board name"
				/>
					<div>
						{isSaving && (
							<>
								<FloppyDiskIcon size={14} weight="fill" />
								<span>WRITE::…</span>
							</>
						)}
						{!isSaving && !saveError && saveTimeLabel && (
							<>
								<CheckCircleIcon size={14} weight="fill" />
								<span>SAVED {saveTimeLabel}</span>
							</>
						)}
						{!isSaving && saveError && (
							<>
								<CloudIcon size={14} weight="duotone" />
								<span title={saveError}>SAVE::ERROR</span>
							</>
						)}
					</div>
				</div>

			{/* New Board button */}
			<button type="button" className={toolbarButton} onClick={onNewBoard}>
				<PlusIcon size={20} weight="duotone" />
				INIT::BOARD
			</button>

			{/* Session name input */}
			<input
				type="text"
				placeholder="SESSION::ALPHA"
				value={sessionName}
				onChange={(e) => onSessionNameChange(e.target.value)}
				className={toolbarButton}
				style={{ flex: 1, maxWidth: "200px" }}
			/>

			{/* Save button */}
			<button
				type="button"
				className={toolbarButton}
				onClick={onSave}
				disabled={isSaving}
			>
				<FloppyDiskIcon size={20} weight="duotone" />
				SAVE::STATE
				</button>

				{/* Animation toggle button */}
				<Button
					type="button"
					className={toolbarButton}
					onPress={onToggleAnimations}
					aria-label={
						animationsEnabled
							? "Disable animation and save sounds"
							: "Enable animation and save sounds"
					}
				>
					{animationsEnabled ? (
						<>
							<PauseIcon size={20} weight="duotone" />
							ANIM::ON
						</>
					) : (
						<>
							<PlayIcon size={20} weight="duotone" />
							ANIM::OFF
						</>
					)}
				</Button>

			{/* Auto-layout menus */}
			<LayoutMenu
				onSelectLayout={onAutoLayout}
				variant="all"
				{...(currentLayout && { currentLayout })}
			/>

			<LayoutMenu
				onSelectLayout={onAutoLayoutSelected}
				variant="selected"
				{...(currentLayout && { currentLayout })}
			/>

			{/* Add node buttons */}
			<button type="button" className={toolbarButton} onClick={onAddPerson}>
				<UserIcon size={20} weight="duotone" />
				ADD::PERSON
			</button>

			<button type="button" className={toolbarButton} onClick={onAddSystem}>
				<PackageIcon size={20} weight="duotone" />
				ADD::SYSTEM
			</button>

			<button
				type="button"
				className={toolbarButton}
				onClick={onAddExternalSystem}
			>
				<CloudIcon size={20} weight="duotone" />
				ADD::EXTERNAL
			</button>

			<button
				type="button"
				className={toolbarButton}
				onClick={onAddContainer}
			>
				<StackIcon size={20} weight="duotone" />
				ADD::CONTAINER
			</button>

			<button
				type="button"
				className={toolbarButton}
				onClick={onAddComponent}
			>
				<CubeIcon size={20} weight="duotone" />
				ADD::COMPONENT
			</button>

				{/* Saved diagrams link */}
				{onOpenSavedDiagrams ? (
					<button
						type="button"
						className={toolbarLink}
						onClick={onOpenSavedDiagrams}
					>
						<ListBulletsIcon size={20} weight="duotone" />
						LIST::SAVED
					</button>
				) : (
					<a href="/saved-diagrams" className={toolbarLink}>
						<ListBulletsIcon size={20} weight="duotone" />
						LIST::SAVED
					</a>
				)}
			</div>
		);
	}
