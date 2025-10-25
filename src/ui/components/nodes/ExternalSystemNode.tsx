/**
 * ExternalSystemNode - C4 External System Element
 *
 * Represents an external/third-party system.
 * Styled as a gray box with dashed border.
 */

import { Cloud as CloudIcon } from "@phosphor-icons/react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	externalSystemNode,
	externalSystemNodeDescription,
	externalSystemNodeIcon,
	externalSystemNodeLabel,
	externalSystemNodeTechnology,
	nodeContent,
} from "./styles.css";

export function ExternalSystemNode({ data, selected }: NodeProps) {
	return (
		<div className={externalSystemNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} />

			<div className={externalSystemNodeIcon}>
				<CloudIcon size={24} weight="duotone" />
			</div>

			<div className={nodeContent}>
				<div className={externalSystemNodeLabel}>{data?.label ?? "Unnamed"}</div>
				{data?.technology && (
					<div className={externalSystemNodeTechnology}>[{data.technology}]</div>
				)}
				{data?.description && (
					<div className={externalSystemNodeDescription}>
						{data.description}
					</div>
				)}
			</div>

			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
