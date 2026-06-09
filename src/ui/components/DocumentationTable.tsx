/**
 * DocumentationTable - System usage documentation
 *
 * Blue-themed table showing how to use the diagram system
 * Includes OPSYDYN Visual Language legend
 */

import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo } from "react";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { docContentWrapper, docGridTheme, docTableContainer } from "./DocumentationTable.css";
import { OVLLegend } from "./OVLLegend";

interface DocRow {
  action: string;
  shortcut: string;
  description: string;
}

const DOCUMENTATION_DATA: DocRow[] = [
  {
    action: "Create Diagram",
    shortcut: "Ctrl+N",
    description: "Start a new C4 diagram from scratch",
  },
  {
    action: "Load Diagram",
    shortcut: "Click",
    description: "Double-click any row to open diagram in canvas",
  },
  {
    action: "View Stats",
    shortcut: "Info",
    description: "Click info icon to see diagram complexity metrics",
  },
  {
    action: "Select Multiple",
    shortcut: "Checkbox",
    description: "Use checkboxes to select diagrams for bulk operations",
  },
  {
    action: "Quick Filter",
    shortcut: "Type",
    description: "Search across all columns using the search box",
  },
  {
    action: "Column Filter",
    shortcut: "Filter",
    description: "Use column-specific filters for advanced search",
  },
];

export function DocumentationTable() {
  const columnDefs = useMemo<ColDef<DocRow>[]>(
    () => [
      {
        headerName: "Action",
        field: "action",
        flex: 1.2,
        minWidth: 150,
      },
      {
        headerName: "Shortcut",
        field: "shortcut",
        flex: 0.8,
        minWidth: 100,
      },
      {
        headerName: "Description",
        field: "description",
        flex: 2,
        minWidth: 250,
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      wrapHeaderText: true,
      autoHeaderHeight: true,
    }),
    [],
  );

  return (
    <div className={docContentWrapper}>
      {/* OPSYDYN Visual Language Legend */}
      <OVLLegend />

      {/* Keyboard Shortcuts & Usage Table */}
      <div className={docTableContainer}>
        <div className={`${docGridTheme} ag-theme-quartz`}>
          <AgGridReact<DocRow>
            rowData={DOCUMENTATION_DATA}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            domLayout="autoHeight"
            suppressMovableColumns
            headerHeight={40}
          />
        </div>
      </div>
    </div>
  );
}
