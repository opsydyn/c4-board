import type { PosteeHistoryEntry } from "@/core/effects/database.postee";
import { ArrowsOutSimpleIcon, DownloadSimpleIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import {
  AllCommunityModule,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  ModuleRegistry,
  type RowDoubleClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  actionButton,
  gridWrapper,
  historyHeader,
  historyPanel,
  historyTitle,
  quickFilter,
  quickFilterInput,
  toolbarActions,
  viewButton,
} from "./PosteeHistoryTable.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type ViewButtonCellProps = ICellRendererParams<HistoryRow> & {
  onViewClick: (id: string) => void;
  compareMode: boolean;
  isSelected: boolean;
  onSelectForCompare?: (id: string) => void;
};

function ViewButtonCell({
  data,
  onViewClick,
  compareMode,
  isSelected,
  onSelectForCompare,
}: ViewButtonCellProps) {
  if (!data) return null;

  if (compareMode && onSelectForCompare) {
    return (
      <button
        type="button"
        className={viewButton}
        onClick={() => onSelectForCompare(data.id)}
        style={{
          backgroundColor: isSelected ? "#00BCD4" : undefined,
          borderColor: isSelected ? "#00BCD4" : undefined,
          color: isSelected ? "#0A0E27" : undefined,
          fontWeight: isSelected ? "bold" : undefined,
        }}
      >
        {isSelected ? "✓ Selected" : "Select"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={viewButton}
      onClick={() => onViewClick(data.id)}
    >
      View
    </button>
  );
}

interface HistoryRow {
  id: string;
  method: string;
  url: string;
  status: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  sizeBytes: number | null;
  executedAt: number;
  executedRelative: string;
  error: string | null;
}

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const RELATIVE_THRESHOLDS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

const formatRelativeTime = (timestamp: number): string => {
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
};

const formatDuration = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  return `${value} ms`;
};

const formatSize = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KB`;
  }
  return `${value} B`;
};

interface PosteeHistoryTableProps {
  history: PosteeHistoryEntry[];
  onInspectEntry?: (entry: PosteeHistoryEntry) => void;
  compareMode?: boolean;
  selectedForCompare?: string[];
  onSelectForCompare?: (entryId: string) => void;
}

export function PosteeHistoryTable({
  history,
  onInspectEntry,
  compareMode = false,
  selectedForCompare = [],
  onSelectForCompare,
}: PosteeHistoryTableProps) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [entryMap, setEntryMap] = useState<Record<string, PosteeHistoryEntry>>({});
  const [quickFilterText, setQuickFilterText] = useState("");
  const gridApiRef = useRef<GridApi | null>(null);

  useEffect(() => {
    const mappedRows: HistoryRow[] = [];
    const map: Record<string, PosteeHistoryEntry> = {};
    for (const entry of history) {
      map[entry.id] = entry;
      let method = "-";
      let url = "-";
      try {
        const snapshot = JSON.parse(entry.request_snapshot ?? "{}") as {
          request?: { method?: string; url?: string };
        };
        method = snapshot?.request?.method ?? method;
        url = snapshot?.request?.url ?? url;
      } catch {
        // ignore parse errors
      }

      mappedRows.push({
        id: entry.id,
        method: method?.toUpperCase?.() ?? method,
        url,
        status: entry.response_status !== null
          ? `HTTP ${entry.response_status}`
          : entry.error_message
          ? "Error"
          : "-",
        statusCode: entry.response_status,
        responseTimeMs: entry.response_time_ms,
        sizeBytes: entry.response_size_bytes,
        executedAt: entry.executed_at,
        executedRelative: formatRelativeTime(entry.executed_at),
        error: entry.error_message,
      });
    }

    setRows(mappedRows);
    setEntryMap(map);
  }, [history]);

  useEffect(() => {
    if (!gridApiRef.current) {
      return;
    }
    gridApiRef.current.setGridOption("quickFilterText", quickFilterText);
  }, [quickFilterText]);

  const handleViewClick = useCallback(
    (id: string) => {
      const entry = entryMap[id];
      if (entry && onInspectEntry) {
        onInspectEntry(entry);
      }
    },
    [entryMap, onInspectEntry],
  );

  const columnDefs = useMemo<ColDef<HistoryRow>[]>(
    () => [
      {
        headerName: "Actions",
        field: "id",
        maxWidth: 100,
        pinned: "left",
        cellRenderer: ViewButtonCell,
        cellRendererParams: (params: { data?: HistoryRow }) => ({
          onViewClick: handleViewClick,
          compareMode,
          isSelected: params.data ? selectedForCompare.includes(params.data.id) : false,
          onSelectForCompare,
        }),
      },
      {
        headerName: "Method",
        field: "method",
        maxWidth: 100,
        filter: "agTextColumnFilter",
        floatingFilter: true,
      },
      {
        headerName: "URL",
        field: "url",
        flex: 2,
        minWidth: 220,
        filter: "agTextColumnFilter",
        floatingFilter: true,
      },
      {
        headerName: "Status",
        field: "status",
        maxWidth: 140,
        filter: "agTextColumnFilter",
        floatingFilter: true,
      },
      {
        headerName: "Duration",
        field: "responseTimeMs",
        maxWidth: 130,
        valueFormatter: ({ value }) => formatDuration(value as number | null),
      },
      {
        headerName: "Size",
        field: "sizeBytes",
        maxWidth: 130,
        valueFormatter: ({ value }) => formatSize(value as number | null),
      },
      {
        headerName: "Executed",
        field: "executedRelative",
        maxWidth: 140,
      },
      {
        headerName: "Executed At",
        field: "executedAt",
        minWidth: 200,
        valueFormatter: ({ value }) => typeof value === "number" ? formatTimestamp(value) : "-",
        sort: "desc",
      },
      {
        headerName: "Error",
        field: "error",
        flex: 1,
        minWidth: 200,
        valueFormatter: ({ value }) => value ?? "-",
      },
    ],
    [handleViewClick, compareMode, selectedForCompare, onSelectForCompare],
  );

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    filter: false,
  }), []);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
    if (quickFilterText) {
      event.api.setGridOption("quickFilterText", quickFilterText);
    }
    // Auto-size all columns on initial load (skip header)
    event.api.autoSizeAllColumns(false);
  }, [quickFilterText]);

  const getRowId = useCallback((params: GetRowIdParams<HistoryRow>) => params.data.id, []);

  const handleRowDoubleClicked = useCallback(
    (event: RowDoubleClickedEvent<HistoryRow>) => {
      if (!onInspectEntry) {
        return;
      }
      const id = event.data?.id;
      if (!id) {
        return;
      }
      const entry = entryMap[id];
      if (entry) {
        onInspectEntry(entry);
      }
    },
    [onInspectEntry, entryMap],
  );

  const handleExportCSV = useCallback(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.exportDataAsCsv({
      fileName: `postee-history-${new Date().toISOString().split("T")[0]}.csv`,
    });
  }, []);

  const handleAutoSizeColumns = useCallback(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.autoSizeAllColumns(false);
  }, []);

  return (
    <div className={historyPanel}>
      <div className={historyHeader}>
        <h3 className={historyTitle}>Execution History</h3>
        <div className={toolbarActions}>
          <label className={quickFilter}>
            <MagnifyingGlassIcon size={16} />
            <input
              className={quickFilterInput}
              placeholder="Filter history..."
              value={quickFilterText}
              onChange={(event) => setQuickFilterText(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={actionButton}
            onClick={handleAutoSizeColumns}
            title="Auto-size all columns to fit content"
          >
            <ArrowsOutSimpleIcon size={14} weight="bold" />
            Auto-Size
          </button>
          <button
            type="button"
            className={actionButton}
            onClick={handleExportCSV}
            title="Export to CSV"
          >
            <DownloadSimpleIcon size={14} weight="bold" />
            Export CSV
          </button>
        </div>
      </div>
      <div className={`${gridWrapper} ag-theme-quartz`}>
        <AgGridReact<HistoryRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          domLayout="normal"
          animateRows
          suppressMovableColumns
          headerHeight={44}
          getRowId={getRowId}
          onGridReady={onGridReady}
          onRowDoubleClicked={handleRowDoubleClicked}
          pagination={true}
          paginationPageSize={20}
          paginationPageSizeSelector={[10, 20, 50, 100]}
          rowSelection="multiple"
          enableCellTextSelection
        />
      </div>
    </div>
  );
}
