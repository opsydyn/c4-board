import { Panel, useReactFlow, getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { toPng } from "html-to-image";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { toolbarButton } from "./styles.css";
import { theme } from "../../styles/theme.css";

const EXPORT_PADDING = 96;
const MIN_EXPORT_SIZE = 800;

function downloadImage(dataUrl: string) {
	const link = document.createElement("a");
	link.setAttribute("download", "diagram.png");
	link.setAttribute("href", dataUrl);
	link.click();
}

interface DownloadButtonProps {
	variant?: "panel" | "inline";
	className?: string;
}

export function DownloadButton({ variant = "panel", className }: DownloadButtonProps) {
	const { getNodes } = useReactFlow();

	const handleDownload = async () => {
		const viewportElement = document.querySelector<HTMLElement>(".react-flow__viewport");
		if (!viewportElement) {
			console.warn("React Flow viewport not found, skipping download.");
			return;
		}

		const nodes = getNodes();
		if (nodes.length === 0) {
			console.warn("No nodes on canvas to export.");
			return;
		}

		const bounds = getNodesBounds(nodes);
		const exportWidth = Math.max(bounds.width + EXPORT_PADDING * 2, MIN_EXPORT_SIZE);
		const exportHeight = Math.max(bounds.height + EXPORT_PADDING * 2, MIN_EXPORT_SIZE);

		const viewport = getViewportForBounds(
			bounds,
			exportWidth,
			exportHeight,
			0.5,
			2,
			EXPORT_PADDING,
		);

		try {
			const dataUrl = await toPng(viewportElement, {
				backgroundColor: theme.color.background.base,
				width: exportWidth,
				height: exportHeight,
				canvasWidth: exportWidth,
				canvasHeight: exportHeight,
				style: {
					width: `${exportWidth}px`,
					height: `${exportHeight}px`,
					transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
					transformOrigin: "0 0",
					overflow: "visible",
				},
			});

			downloadImage(dataUrl);
		} catch (error) {
			console.error("Failed to export diagram as image", error);
		}
	};

	const button = (
		<button
			type="button"
			className={className ?? toolbarButton}
			onClick={handleDownload}
		>
			<DownloadSimpleIcon size={18} weight="duotone" />
			EXPORT::PNG
		</button>
	);

	if (variant === "panel") {
		return <Panel position="top-right">{button}</Panel>;
	}

	return button;
}
