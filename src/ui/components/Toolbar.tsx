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
	sessionName: string;
	isSaving?: boolean;
	lastSaved?: number | null;
	diagramName?: string;
	currentLayout?: LayoutPresetName;
	animationsEnabled?: boolean;
}

function formatSaveTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 60000) {
		// Less than 1 minute
		return "STATE::SYNCED @ NOW";
	}
	if (diff < 3600000) {
		// Less than 1 hour
		const minutes = Math.floor(diff / 60000);
		return `${minutes}m ago`;
	}
	// Show time
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
	sessionName,
	isSaving = false,
	lastSaved = null,
	diagramName = "Untitled",
	currentLayout,
	animationsEnabled = true,
}: ToolbarProps) {
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
					{!isSaving && lastSaved && (
						<>
							<CheckCircleIcon size={14} weight="fill" />
							<span>SAVED {formatSaveTime(lastSaved)}</span>
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
				aria-label={animationsEnabled ? "Disable edge animations" : "Enable edge animations"}
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
			<a href="/saved-diagrams" className={toolbarLink}>
				<ListBulletsIcon size={20} weight="duotone" />
				LIST::SAVED
			</a>
		</div>
	);
}
