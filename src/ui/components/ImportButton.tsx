/**
 * ImportButton Component
 *
 * Button for importing diagrams from PlantUML or Mermaid files.
 * Uses Tauri's file picker and file system APIs.
 */

import { UploadIcon as Upload } from "@phosphor-icons/react";
import { useState } from "react";
import { toolbarButton } from "./styles.css";

interface ImportButtonProps {
  onImport: (content: string, format: "plantuml" | "mermaid", mode: "replace" | "merge") => void;
  className?: string;
}

export function ImportButton({ onImport, className }: ImportButtonProps) {
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (isImporting) return;

    try {
      setIsImporting(true);

      // Dynamic import of Tauri APIs
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");

      // Open file picker dialog
      const selected = await open({
        title: "Import Diagram",
        multiple: false,
        filters: [
          {
            name: "Diagram Files",
            extensions: ["puml", "plantuml", "mmd", "mermaid"],
          },
          {
            name: "PlantUML Files",
            extensions: ["puml", "plantuml"],
          },
          {
            name: "Mermaid Files",
            extensions: ["mmd", "mermaid"],
          },
        ],
      });

      if (!selected) {
        // User cancelled
        setIsImporting(false);
        return;
      }

      // Read file content
      const content = await readTextFile(selected);

      // Determine format from extension
      const ext = selected.toLowerCase().split(".").pop();
      const format: "plantuml" | "mermaid" = ext === "puml" || ext === "plantuml" ? "plantuml" : "mermaid";

      // TODO: Ask user if they want to replace or merge
      // For now, default to replace
      const mode: "replace" | "merge" = "replace";

      // Invoke import callback
      onImport(content, format, mode);
    } catch (error) {
      console.error("Failed to import diagram:", error);
      // TODO: Show error toast/notification
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <button
      type="button"
      className={className ?? toolbarButton}
      onClick={handleImport}
      disabled={isImporting}
    >
      <Upload size={18} weight="duotone" />
      {isImporting ? "IMPORTING..." : "IMPORT"}
    </button>
  );
}
