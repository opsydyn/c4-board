import type { IconWeight, Icon } from "@phosphor-icons/react";
import {
	User,
	Package,
	Cloud,
	Stack,
	Cube,
} from "@phosphor-icons/react";
import { DEFAULT_ICON_BY_TYPE, type C4Type, type NodeIconId } from "../../core/effects/node-operations";

const iconRegistry: Record<NodeIconId, Icon> = {
	"phosphor:user-duotone": User,
	"phosphor:package-duotone": Package,
	"phosphor:cloud-duotone": Cloud,
	"phosphor:stack-duotone": Stack,
	"phosphor:cube-duotone": Cube,
};

const fallbackIconId: NodeIconId = "phosphor:package-duotone";

type ResolveOptions = {
	iconId?: NodeIconId;
	type: C4Type;
	size?: number;
	weight?: IconWeight;
	className?: string;
};

export function resolveNodeIconId(iconId: NodeIconId | undefined, type: C4Type): NodeIconId {
	return iconId ?? DEFAULT_ICON_BY_TYPE[type] ?? fallbackIconId;
}

export function renderNodeIcon({
	iconId,
	type,
	size = 24,
	weight = "duotone",
	className,
}: ResolveOptions) {
	const resolvedId = resolveNodeIconId(iconId, type);
	const IconComponent = iconRegistry[resolvedId] ?? iconRegistry[fallbackIconId];
	return <IconComponent size={size} weight={weight} className={className} />;
}

export function getNodeIconComponent(iconId: NodeIconId | undefined, type: C4Type) {
	const resolvedId = resolveNodeIconId(iconId, type);
	return iconRegistry[resolvedId] ?? iconRegistry[fallbackIconId];
}
