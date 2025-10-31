/**
 * PropertiesPanel - Edit selected node properties
 *
 * Displays when a node is selected, allows editing its properties.
 */

import type { Node } from "@xyflow/react";
import type { NodeData } from "../../core/effects/node-operations";
import {
	formGroup,
	input,
	label,
	panelTitle,
	propertiesPanel,
	textarea,
} from "./styles.css";
import { IconPicker } from "./icons/IconPicker";

interface PropertiesPanelProps {
	selectedNode: Node<NodeData> | null;
	onUpdateNode: (nodeId: string, updates: Partial<NodeData>) => void;
}

export function PropertiesPanel({
	selectedNode,
	onUpdateNode,
}: PropertiesPanelProps) {
	if (!selectedNode) return null;

	const handleChange = (field: keyof NodeData, value: string) => {
		onUpdateNode(selectedNode.id, { [field]: value });
	};

	return (
		<div className={propertiesPanel}>
			<h3 className={panelTitle}>MODE::EDIT {selectedNode.data?.c4Type}</h3>

			<IconPicker
				type={selectedNode.data?.c4Type ?? "system"}
				value={selectedNode.data?.iconId}
				onChange={(iconId) => onUpdateNode(selectedNode.id, { iconId })}
			/>

			<div className={formGroup}>
				<label className={label} htmlFor="node-label">
					Name
				</label>
				<input
					id="node-label"
					type="text"
					className={input}
					value={selectedNode.data?.label || ""}
					onChange={(e) => handleChange("label", e.target.value)}
					placeholder="Element name"
				/>
			</div>

			<div className={formGroup}>
				<label className={label} htmlFor="node-technology">
					Technology
				</label>
				<input
					id="node-technology"
					type="text"
					className={input}
					value={selectedNode.data?.technology || ""}
					onChange={(e) => handleChange("technology", e.target.value)}
					placeholder="E.G.::ASTRO / XSTATE / EFFECT"
				/>
			</div>

			<div className={formGroup}>
				<label className={label} htmlFor="node-description">
					Description
				</label>
				<textarea
					id="node-description"
					className={textarea}
					value={selectedNode.data?.description || ""}
					onChange={(e) => handleChange("description", e.target.value)}
		            placeholder="META::DESC"
				/>
			</div>
		</div>
	);
}
