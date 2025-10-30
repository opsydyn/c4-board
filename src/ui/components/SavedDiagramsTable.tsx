import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
	ModuleRegistry,
	AllCommunityModule,
	type ColDef,
	type GridApi,
	type GridReadyEvent,
	type RowDoubleClickedEvent,
	type ICellRendererParams,
	type ValueFormatterParams,
	type GetRowIdParams,
	type RowSelectionOptions,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { useDatabase } from "../../core/effects/useDatabase";
import { getDiagramStats, listAllDiagrams } from "../../core/effects/canvas-persistence";
import { DiagramStatsPopover } from "./DiagramStatsPopover";
import {
	actionButton,
	agGridTheme,
	errorAlert,
	gridToolbar,
	quickFilter,
	quickFilterInput,
	tableContainer,
	toolbarTitle,
} from "./SavedDiagramsTable.css";

interface DiagramRow {
	id: string;
	name: string;
	description?: string;
	createdAt: number;
	updatedAt: number;
	lastUpdatedRelative: string;
	complexity?: number; // nodes + edges count
}

interface SavedDiagramsTableProps {
	onLoadDiagram: (diagramId: string) => void;
}

interface GridContext {
	onLoadDiagram: (diagramId: string) => void;
}

const InfoActionRenderer = (props: ICellRendererParams<DiagramRow, unknown, GridContext>) => {
	const diagramId = props.data?.id;
	if (!diagramId) {
		return null;
	}
	return <DiagramStatsPopover diagramId={diagramId} />;
};

ModuleRegistry.registerModules([AllCommunityModule]);

function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleString([], {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

const RELATIVE_THRESHOLDS = {
	minute: 60 * 1000,
	hour: 60 * 60 * 1000,
	day: 24 * 60 * 60 * 1000,
};

function formatRelativeTime(timestamp: number): string {
	const delta = Date.now() - timestamp;
	if (delta < RELATIVE_THRESHOLDS.minute) return "just now";
	if (delta < RELATIVE_THRESHOLDS.hour) {
		const minutes = Math.floor(delta / RELATIVE_THRESHOLDS.minute);
		return `${minutes}m ago`;
	}
	if (delta < RELATIVE_THRESHOLDS.day) {
		const hours = Math.floor(delta / RELATIVE_THRESHOLDS.hour);
		return `${hours}h ago`;
	}
	const days = Math.floor(delta / RELATIVE_THRESHOLDS.day);
	return `${days}d ago`;
}

const LoadActionRenderer = (props: ICellRendererParams<DiagramRow, unknown, GridContext>) => {
	const diagramId = props.data?.id;
	const { onLoadDiagram } = props.context ?? {};
	if (!diagramId || typeof onLoadDiagram !== "function") {
		return null;
	}
	return (
		<button
			type="button"
			className={actionButton}
			onClick={(event) => {
				event.stopPropagation();
				onLoadDiagram(diagramId);
			}}
		>
			Load
		</button>
	);
};

export function SavedDiagramsTable({ onLoadDiagram }: SavedDiagramsTableProps) {
	const { runEffect } = useDatabase();
	const [rows, setRows] = useState<DiagramRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [quickFilterText, setQuickFilterText] = useState("");
	const gridApiRef = useRef<GridApi | null>(null);

	const fetchRows = useCallback(async () => {
		try {
			setLoading(true);
			const result = await runEffect(listAllDiagrams());
			// Load stats for each diagram to calculate complexity
			const mapped: DiagramRow[] = await Promise.all(
				result.map(async (diagram) => {
					let complexity = 0;
					try {
						const stats = await runEffect(
							getDiagramStats(diagram.id)
						);
						complexity = stats.nodeCount + stats.edgeCount;
					} catch {
						// If stats fail, complexity stays 0
					}

					return {
						id: diagram.id,
						name: diagram.name,
						createdAt: diagram.createdAt,
						updatedAt: diagram.updatedAt,
						lastUpdatedRelative: formatRelativeTime(diagram.updatedAt),
						complexity,
						...(diagram.description ? { description: diagram.description } : {}),
					};
				})
			);
			setRows(mapped);
			setError(null);
		} catch (err) {
			console.error("Failed to load diagrams", err);
			setError(err instanceof Error ? err.message : "Failed to load diagrams");
		} finally {
			setLoading(false);
		}
	}, [runEffect]);

	useEffect(() => {
		void fetchRows();
	}, [fetchRows]);

	useEffect(() => {
		if (!gridApiRef.current) {
			return;
		}
		if (loading) {
			gridApiRef.current.showLoadingOverlay();
			return;
		}
		if (error) {
			gridApiRef.current.showNoRowsOverlay();
			return;
		}
		if (rows.length === 0) {
			gridApiRef.current.showNoRowsOverlay();
		} else {
			gridApiRef.current.hideOverlay();
		}
	}, [loading, error, rows]);

	const columnDefs = useMemo<ColDef<DiagramRow>[]>(() => {
		const dateFormatter = ({ value }: ValueFormatterParams<DiagramRow, number>) =>
			typeof value === "number" ? formatTimestamp(value) : "-";
		return [
			{
				headerName: "Name",
				field: "name",
				flex: 1.4,
				minWidth: 220,
				filter: "agTextColumnFilter",
				floatingFilter: true,
			},
			{
				headerName: "Description",
				field: "description",
				flex: 1.2,
				minWidth: 200,
				filter: "agTextColumnFilter",
				floatingFilter: true,
				valueFormatter: ({ value }) => value ?? "-",
			},
			{
				headerName: "Last Updated",
				field: "updatedAt",
				flex: 0.9,
				minWidth: 180,
				valueFormatter: dateFormatter,
				filter: "agDateColumnFilter",
				floatingFilter: true,
				sort: "desc",
			},
			{
				headerName: "Relative",
				field: "lastUpdatedRelative",
				flex: 0.6,
				minWidth: 140,
				filter: false,
			},
			{
				headerName: "Created",
				field: "createdAt",
				flex: 0.9,
				minWidth: 180,
				valueFormatter: dateFormatter,
				filter: "agDateColumnFilter",
				floatingFilter: true,
			},
			{
				headerName: "Info",
				colId: "info",
				pinned: "right",
				lockPinned: true,
				maxWidth: 80,
				cellRenderer: InfoActionRenderer,
				floatingFilter: false,
				sortable: false,
			},
			{
				headerName: "Actions",
				colId: "actions",
				pinned: "right",
				lockPinned: true,
				maxWidth: 140,
				cellRenderer: LoadActionRenderer,
				floatingFilter: false,
				sortable: false,
			},
		];
	}, []);

	const defaultColDef = useMemo<ColDef>(() => ({
		resizable: true,
		sortable: true,
		filter: true,
		floatingFilter: true,
		wrapHeaderText: true,
		autoHeaderHeight: true,
		flex: 1,
	}), []);

	const onGridReady = useCallback((event: GridReadyEvent<DiagramRow>) => {
		gridApiRef.current = event.api;
		if (loading) {
			event.api.showLoadingOverlay();
		}
	}, [loading]);

	const handleQuickFilterChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setQuickFilterText(event.target.value);
		},
		[],
	);

	const handleRowDoubleClick = useCallback(
		(event: RowDoubleClickedEvent<DiagramRow>) => {
			if (event.data) {
				onLoadDiagram(event.data.id);
			}
		},
		[onLoadDiagram],
	);

	const getRowId = useCallback((params: GetRowIdParams<DiagramRow>) => params.data.id, []);

	const rowSelection = useMemo<RowSelectionOptions>(
		() => ({
			mode: "multiRow",
			checkboxes: true,
			headerCheckbox: true,
			selectAll: "filtered",
			enableClickSelection: false,
		}),
		[],
	);

	const selectionColumnDef = useMemo<ColDef<DiagramRow>>(
		() => ({
			maxWidth: 70,
			pinned: "left",
			lockPosition: true,
			sortable: false,
			floatingFilter: false,
			filter: false,
			headerName: "",
		}),
		[],
	);

	const statusBar = useMemo(
		() => ({
			statusPanels: [
				{
					statusPanel: "agTotalAndFilteredRowCountComponent",
					align: "left",
				},
				{
					statusPanel: "agSelectedRowCountComponent",
					align: "center",
				},
			],
		}),
		[],
	);

	if (error) {
		return (
			<div className={errorAlert} role="alert">
				<span>⚠</span>
				<div>
					<strong>Error loading diagrams</strong>
					<div>{error}</div>
				</div>
			</div>
		);
	}

	return (
		<div className={tableContainer}>
			<div className={gridToolbar}>
				<h2 className={toolbarTitle}>Saved Diagrams</h2>
				<label className={quickFilter} htmlFor="saved-diagrams-filter">
					<MagnifyingGlassIcon size={16} weight="bold" />
					<input
						type="search"
						id="saved-diagrams-filter"
						className={quickFilterInput}
						placeholder="Quick filter"
						value={quickFilterText}
						onChange={handleQuickFilterChange}
					/>
				</label>
			</div>
			<div className={`${agGridTheme} ag-theme-quartz`}>
				<AgGridReact<DiagramRow>
					rowData={rows}
					columnDefs={columnDefs}
					defaultColDef={defaultColDef}
					rowSelection={rowSelection}
					selectionColumnDef={selectionColumnDef}
					statusBar={statusBar}
					rowClassRules={{
						"complexity-low": (params) =>
							params.data?.complexity !== undefined &&
							params.data.complexity >= 0 &&
							params.data.complexity <= 5,
						"complexity-medium": (params) =>
							params.data?.complexity !== undefined &&
							params.data.complexity >= 6 &&
							params.data.complexity <= 10,
						"complexity-high": (params) =>
							params.data?.complexity !== undefined &&
							params.data.complexity >= 11,
					}}
					domLayout="normal"
					animateRows
					onGridReady={onGridReady}
					onRowDoubleClicked={handleRowDoubleClick}
					context={{ onLoadDiagram }}
					overlayLoadingTemplate="<span class='ag-overlay-loading-center'>Loading diagrams...</span>"
					overlayNoRowsTemplate="<span class='ag-overlay-loading-center'>No diagrams available.</span>"
					getRowId={getRowId}
					quickFilterText={quickFilterText}
				/>
			</div>
		</div>
	);
}
