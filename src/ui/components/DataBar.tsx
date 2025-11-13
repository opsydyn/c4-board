import { useCallback, useMemo, useState } from "react";
import { ToggleButton } from "react-aria-components";
import { CaretDownIcon } from "@phosphor-icons/react";
import { SavedDiagramsTable } from "./SavedDiagramsTable";
import { DocumentationTable } from "./DocumentationTable";
import {
	bottomPanel,
	bottomPanelHeader,
	bottomPanelContent,
	bottomTabButton,
	bottomTabButtonActive,
	bottomTabs,
	collapseToggle,
	historyPlaceholder,
} from "./styles.css";
// import { Effect } from 'effect'

type DataBarTab = "diagrams" | "diagrams_alt" | "history" | "docs";

interface DataBarProps {
	isOpen: boolean;
	onToggle: (open: boolean) => void;
	onLoadDiagram: (diagramId: string) => Promise<void> | void;
}

const TABS: Array<{ id: DataBarTab; label: string }> = [
	{
		id: "diagrams",
		label: "Saved Diagrams",
	},
	{
		id: "history",
		label: "History",
	},
	{
		id: "docs",
		label: "RTFM:V1",
	},
];


// Effect.sync(() => {
// 	console.log('[DataBar] Component mounted');
// });

// const loadDataEffect = Effect.try({
// 	try: () => {
// 		console.log('[DataBar] Attempting to load data...');
// 		// Simulate data loading
// 	},
// 	catch: (error) => {
// 		console.error('[DataBar] Error loading data:', error);
// 	},
// })



export function DataBar({ isOpen, onToggle, onLoadDiagram }: DataBarProps) {
	const [activeTab, setActiveTab] = useState<DataBarTab>("diagrams");

	const handleDiagramLoad = useCallback(
		(diagramId: string) => {
			void onLoadDiagram(diagramId);
		},
		[onLoadDiagram],
	);

	const content = useMemo(() => {
		switch (activeTab) {
			case "diagrams":
				return <SavedDiagramsTable onLoadDiagram={handleDiagramLoad} />;
			case "history":
				return (
					<div className={historyPlaceholder}>
						History analytics coming soon
					</div>
				);
			case "docs":
				return <DocumentationTable />;
			default:
				return null;
		}
	}, [activeTab, handleDiagramLoad]);

	return (
		<section className={bottomPanel} aria-label="Data bar">
			<div className={bottomPanelHeader}>
				<div className={bottomTabs} role="tablist" aria-label="Data views">
					{TABS.map((tab) => {
						const isActive = tab.id === activeTab;
						return (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={isActive}
								className={
									isActive
										? `${bottomTabButton} ${bottomTabButtonActive}`
										: bottomTabButton
								}
								onClick={() => setActiveTab(tab.id)}
							>
								<span>{tab.label}</span>
							</button>
						);
					})}
					</div>
				<ToggleButton
					isSelected={isOpen}
					onChange={(selected) => onToggle(selected)}
					className={collapseToggle}
					aria-label="Collapse data bar"
				>
					<CaretDownIcon size={16} weight="bold" />
					ESC
				</ToggleButton>
			</div>
			<div className={bottomPanelContent}>{content}</div>
		</section>
	);
}
