import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { IconWeight, Icon } from "@phosphor-icons/react";
import {
	UserIcon,
	PackageIcon,
	CloudIcon,
	StackIcon,
	CubeIcon,
} from "@phosphor-icons/react";
import {
	DEFAULT_ICON_BY_TYPE,
	extractCustomIconFilename,
	isCustomIconId,
	type BuiltInIconId,
	type CustomIconId,
	type NodeType,
	type NodeIconId,
} from "../../core/effects/node-operations";

type IconRenderProps = {
	size?: number;
	weight?: IconWeight;
	className?: string;
};
type IconComponent = (props: IconRenderProps) => ReactElement;


const builtInIconRegistry: Record<BuiltInIconId, Icon> = {
	"phosphor:user-duotone": UserIcon,
	"phosphor:package-duotone": PackageIcon,
	"phosphor:cloud-duotone": CloudIcon,
	"phosphor:stack-duotone": StackIcon,
	"phosphor:cube-duotone": CubeIcon,
};

const fallbackIconId: BuiltInIconId = "phosphor:package-duotone";

const customIconComponentCache = new Map<CustomIconId, IconComponent>();

type ResolveOptions = {
	iconId?: NodeIconId;
	type: NodeType;
	size?: number;
	weight?: IconWeight;
	className?: string;
};

export function resolveNodeIconId(iconId: NodeIconId | undefined, type: NodeType): NodeIconId {
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
	const IconComponent = getNodeIconComponent(resolvedId, type);
	return <IconComponent size={size} weight={weight} {...(className !== undefined && { className })} />;
}

export function getNodeIconComponent(iconId: NodeIconId | undefined, type: NodeType) {
	const resolvedId = resolveNodeIconId(iconId, type);
	if (isCustomIconId(resolvedId)) {
		return getOrCreateCustomIconComponent(resolvedId);
	}
	return builtInIconRegistry[resolvedId] ?? builtInIconRegistry[fallbackIconId];
}

function getOrCreateCustomIconComponent(iconId: CustomIconId): IconComponent {
	const cached = customIconComponentCache.get(iconId);
	if (cached) {
		return cached;
	}

	const CustomIcon: IconComponent = ({ size = 24, className }: IconRenderProps) => {
		const [src, setSrc] = useState<string | null>(null);

		useEffect(() => {
			let cancelled = false;

			async function loadIcon() {
				if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
					console.debug(`Custom icon ${iconId} skipped: not in Tauri environment`);
					return;
				}

				try {
					const [{ appLocalDataDir, join }, { convertFileSrc }] = await Promise.all([
						import("@tauri-apps/api/path"),
						import("@tauri-apps/api/core"),
					]);
					
					const baseDir = await appLocalDataDir();
					console.debug(`Custom icon base directory: ${baseDir}`);
					
					const filename = extractCustomIconFilename(iconId);
					console.debug(`Custom icon filename: ${filename}`);
					
					const iconPath = await join(baseDir, "icons", filename);
					console.debug(`Custom icon path: ${iconPath}`);
					
					const url = convertFileSrc(iconPath);
					console.debug(`Custom icon converted URL: ${url}`);
					
					if (!cancelled) {
						setSrc(url);
					}
				} catch (error) {
					console.error(`Failed to load custom icon ${iconId}:`, error);
					if (error instanceof Error) {
						console.error(`Error message: ${error.message}`);
						console.error(`Error stack: ${error.stack}`);
					}
				}
			}

			loadIcon();

			return () => {
				cancelled = true;
			};
		}, [iconId]);

		if (!src) {
			const Fallback = builtInIconRegistry[fallbackIconId];
			return <Fallback size={size} weight="duotone" className={className} />;
		}

		return (
			<img
				src={src}
				width={size}
				height={size}
				className={className}
				style={{ objectFit: "contain" }}
				alt={src}
			/>
		);
	};

	customIconComponentCache.set(iconId, CustomIcon);
	return CustomIcon;
}
