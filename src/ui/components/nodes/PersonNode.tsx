/**
 * PersonNode - C4 Person Element
 *
 * Represents a human user/actor in the system.
 * Styled as a blue box with an icon.
 */

import { User as UserIcon } from "@phosphor-icons/react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	personNode,
	personNodeDescription,
	personNodeIcon,
	personNodeLabel,
	personNodeTechnology,
} from "./styles.css";

export function PersonNode({ data, selected }: NodeProps) {
	return (
		<div className={personNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} />

			<div className={personNodeIcon}>
				<UserIcon size={24} weight="duotone" />
			</div>

			<div className={nodeContent}>
				<div className={personNodeLabel}>{data?.label ?? "Unnamed"}</div>
				{data?.technology && (
					<div className={personNodeTechnology}>[{data.technology}]</div>
				)}
				{data?.description && (
					<div className={personNodeDescription}>{data.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
