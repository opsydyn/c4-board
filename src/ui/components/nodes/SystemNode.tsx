/**
 * SystemNode - C4 Software System Element
 *
 * Represents a software system in the architecture.
 * Styled as a gray/blue box.
 */

import { Package as PackageIcon } from "@phosphor-icons/react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	systemNode,
	systemNodeDescription,
	systemNodeIcon,
	systemNodeLabel,
	systemNodeTechnology,
} from "./styles.css";

export function SystemNode({ data, selected }: NodeProps) {
	return (
		<div className={systemNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} />

			<div className={systemNodeIcon}>
				<PackageIcon size={24} weight="duotone" />
			</div>

			<div className={nodeContent}>
				<div className={systemNodeLabel}>{data?.label ?? "Unnamed"}</div>
				{data?.technology && (
					<div className={systemNodeTechnology}>[{data.technology}]</div>
				)}
				{data?.description && (
					<div className={systemNodeDescription}>{data.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
