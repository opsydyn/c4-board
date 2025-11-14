/**
 * DDDToolbar - DDD element creation controls
 *
 * Allows users to add Domain-Driven Design elements to the canvas.
 */

import {
	BoundingBoxIcon,
	CubeIcon,
	LightningIcon,
	SquareIcon,
	DiamondIcon,
	GearIcon,
	DatabaseIcon,
	FactoryIcon,
	ArrowRightIcon,
	MagnifyingGlassIcon,
	UsersIcon,
	ShareNetworkIcon,
	ShieldIcon,
	GitBranchIcon,
	FloppyDiskIcon,
	CheckCircleIcon,
	ListBulletsIcon,
	PlusIcon,
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

interface DDDToolbarProps {
	// DDD Strategic
	onAddBoundedContext: () => void;
	onAddAggregate: () => void;
	onAddDomainEvent: () => void;
	// DDD Tactical
	onAddEntity: () => void;
	onAddValueObject: () => void;
	onAddDomainService: () => void;
	onAddRepository: () => void;
	onAddFactory: () => void;
	// DDD Application
	onAddCommand: () => void;
	onAddQuery: () => void;
	onAddApplicationService: () => void;
	// DDD Infrastructure
	onAddIntegrationEvent: () => void;
	onAddACL: () => void;
	onAddSaga: () => void;
	// Common actions
	onSave: () => void;
	onNewBoard: () => void;
	onAutoLayout: (presetName: LayoutPresetName) => void;
	onAutoLayoutSelected: (presetName: LayoutPresetName) => void;
	onDiagramNameChange: (name: string) => void;
	onSessionNameChange: (name: string) => void;
	sessionName: string;
	isSaving?: boolean;
	lastSaved?: number | null;
	diagramName?: string;
	currentLayout?: LayoutPresetName;
}

function formatSaveTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 60000) {
		return "STATE::SYNCED @ NOW";
	}
	if (diff < 3600000) {
		const minutes = Math.floor(diff / 60000);
		return `${minutes}m ago`;
	}
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DDDToolbar({
	onAddBoundedContext,
	onAddAggregate,
	onAddDomainEvent,
	onAddEntity,
	onAddValueObject,
	onAddDomainService,
	onAddRepository,
	onAddFactory,
	onAddCommand,
	onAddQuery,
	onAddApplicationService,
	onAddIntegrationEvent,
	onAddACL,
	onAddSaga,
	onSave,
	onNewBoard,
	onAutoLayout,
	onAutoLayoutSelected,
	onDiagramNameChange,
	onSessionNameChange,
	sessionName,
	isSaving = false,
	lastSaved = null,
	diagramName = "Untitled",
	currentLayout,
}: DDDToolbarProps) {
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

			{/* DDD Strategic Elements */}
			<button type="button" className={toolbarButton} onClick={onAddBoundedContext}>
				<BoundingBoxIcon size={20} weight="duotone" />
				ADD::CONTEXT
			</button>

			<button type="button" className={toolbarButton} onClick={onAddAggregate}>
				<CubeIcon size={20} weight="duotone" />
				ADD::AGGREGATE
			</button>

			<button type="button" className={toolbarButton} onClick={onAddDomainEvent}>
				<LightningIcon size={20} weight="duotone" />
				ADD::DOMAIN EVENT
			</button>

			{/* DDD Tactical Elements */}
			<button type="button" className={toolbarButton} onClick={onAddEntity}>
				<SquareIcon size={20} weight="duotone" />
				ADD::ENTITY
			</button>

			<button type="button" className={toolbarButton} onClick={onAddValueObject}>
				<DiamondIcon size={20} weight="duotone" />
				ADD::VALUE OBJECT
			</button>

			<button type="button" className={toolbarButton} onClick={onAddDomainService}>
				<GearIcon size={20} weight="duotone" />
				ADD::DOMAIN SERVICE
			</button>

			<button type="button" className={toolbarButton} onClick={onAddRepository}>
				<DatabaseIcon size={20} weight="duotone" />
				ADD::REPOSITORY
			</button>

			<button type="button" className={toolbarButton} onClick={onAddFactory}>
				<FactoryIcon size={20} weight="duotone" />
				ADD::FACTORY
			</button>

			{/* DDD Application Elements */}
			<button type="button" className={toolbarButton} onClick={onAddCommand}>
				<ArrowRightIcon size={20} weight="duotone" />
				ADD::COMMAND
			</button>

			<button type="button" className={toolbarButton} onClick={onAddQuery}>
				<MagnifyingGlassIcon size={20} weight="duotone" />
				ADD::QUERY
			</button>

			<button type="button" className={toolbarButton} onClick={onAddApplicationService}>
				<UsersIcon size={20} weight="duotone" />
				ADD::APP SERVICE
			</button>

			{/* DDD Infrastructure Elements */}
			<button type="button" className={toolbarButton} onClick={onAddIntegrationEvent}>
				<ShareNetworkIcon size={20} weight="duotone" />
				ADD::INTEGRATION EVENT
			</button>

			<button type="button" className={toolbarButton} onClick={onAddACL}>
				<ShieldIcon size={20} weight="duotone" />
				ADD::ACL
			</button>

			<button type="button" className={toolbarButton} onClick={onAddSaga}>
				<GitBranchIcon size={20} weight="duotone" />
				ADD::SAGA
			</button>

			{/* Saved diagrams link */}
			<a href="/saved-diagrams" className={toolbarLink}>
				<ListBulletsIcon size={20} weight="duotone" />
				LIST::SAVED
			</a>
		</div>
	);
}
