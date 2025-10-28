import { Panel, useReactFlow, getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { toPng } from "html-to-image";
import { DownloadSimple } from "@phosphor-icons/react";
import { toolbarButton } from "./styles.css";
import { theme } from "../../styles/theme.css";

const IMAGE_WIDTH = 1280;
const IMAGE_HEIGHT = 720;

function downloadImage(dataUrl: string) {
	const link = document.createElement("a");
	link.setAttribute("download", "diagram.png");
	link.setAttribute("href", dataUrl);
	link.click();
}

export function DownloadButton() {
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
		const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2);

		try {
			const dataUrl = await toPng(viewportElement, {
				backgroundColor: theme.color.background.base,
				width: IMAGE_WIDTH,
				height: IMAGE_HEIGHT,
				style: {
					width: `${IMAGE_WIDTH}px`,
					height: `${IMAGE_HEIGHT}px`,
					transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
				},
			});

			downloadImage(dataUrl);
		} catch (error) {
			console.error("Failed to export diagram as image", error);
		}
	};

	return (
		<Panel position="top-right">
			<button type="button" className={toolbarButton} onClick={handleDownload}>
				<DownloadSimple size={18} weight="duotone" />
				Download PNG
			</button>
		</Panel>
	);
}
