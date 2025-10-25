/**
 * Toolbar - Node creation controls
 *
 * Allows users to add C4 elements to the canvas.
 */

import {
	CloudIcon,
	 PackageIcon,
	UserIcon,
} from "@phosphor-icons/react";
import { toolbar, toolbarButton } from "./styles.css";

interface ToolbarProps {
	onAddPerson: () => void;
	onAddSystem: () => void;
	onAddExternalSystem: () => void;
}

export function Toolbar({
	onAddPerson,
	onAddSystem,
	onAddExternalSystem,
}: ToolbarProps) {
	return (
		<div className={toolbar}>
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
		</div>
	);
}
