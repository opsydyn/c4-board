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
} from "@phosphor-icons/react";
import { toolbar, toolbarButton, saveStatus, boardNameInput } from "./styles.css";

interface ToolbarProps {
	onAddPerson: () => void;
	onAddSystem: () => void;
	onAddExternalSystem: () => void;
	onSave: () => void;
	onNewBoard: () => void;
	onDiagramNameChange: (name: string) => void;
	onSessionNameChange: (name: string) => void;
	sessionName: string;
	isSaving?: boolean;
	lastSaved?: number | null;
	diagramName?: string;
}

function formatSaveTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 60000) {
		// Less than 1 minute
		return "just now";
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
	onSave,
	onNewBoard,
	onDiagramNameChange,
	onSessionNameChange,
	sessionName,
	isSaving = false,
	lastSaved = null,
	diagramName = "Untitled",
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
							<span>Saving...</span>
						</>
					)}
					{!isSaving && lastSaved && (
						<>
							<CheckCircleIcon size={14} weight="fill" />
							<span>Saved {formatSaveTime(lastSaved)}</span>
						</>
					)}
				</div>
			</div>

			{/* New Board button */}
			<button type="button" className={toolbarButton} onClick={onNewBoard}>
				<PlusIcon size={20} weight="duotone" />
				New Board
			</button>

			{/* Session name input */}
			<input
				type="text"
				placeholder="Session name (optional)"
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
				Save
			</button>

			{/* Add node buttons */}
			<button type="button" className={toolbarButton} onClick={onAddPerson}>
				<UserIcon size={20} weight="duotone" />
				Add Person
			</button>

			<button type="button" className={toolbarButton} onClick={onAddSystem}>
				<PackageIcon size={20} weight="duotone" />
				Add System
			</button>

			<button
				type="button"
				className={toolbarButton}
				onClick={onAddExternalSystem}
			>
				<CloudIcon size={20} weight="duotone" />
				Add External
			</button>

			{/* Saved diagrams link */}
			<a href="/saved-diagrams" className={toolbarButton}>
				<ListBulletsIcon size={20} weight="duotone" />
				View Saved
			</a>
		</div>
	);
}
