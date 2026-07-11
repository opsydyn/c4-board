/**
 * ExportModal Component
 *
 * Modal dialog for exporting diagrams to PlantUML or Mermaid format.
 * Displays the generated code with copy and download functionality.
 * Uses React Aria Components for accessibility.
 */

import { CheckIcon as Check, CopyIcon as Copy, DownloadIcon as Download, XIcon as X } from "@phosphor-icons/react";
import { useState } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import {
  exportModalActions,
  exportModalButton,
  exportModalButtonPrimary,
  exportModalCloseButton,
  exportModalCodeBlock,
  exportModalContainer,
  exportModalContent,
  exportModalHeader,
  exportModalInner,
  exportModalOverlay,
  exportModalTitle,
} from "./ExportModal.css";

interface ExportModalProps {
  isOpen: boolean;
  exportedCode: string | null;
  exportFormat: "plantuml" | "mermaid" | null;
  diagramName?: string;
  onClose: () => void;
}

const FORMAT_CONFIG = {
  plantuml: {
    title: "EXPORT::PLANTUML",
    extension: "puml",
  },
  mermaid: {
    title: "EXPORT::MERMAID",
    extension: "mmd",
  },
};

export function ExportModal({
  isOpen,
  exportedCode,
  exportFormat,
  diagramName = "diagram",
  onClose,
}: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!exportedCode || !exportFormat) {
    return null;
  }

  const config = FORMAT_CONFIG[exportFormat];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    const filename = `${diagramName.replace(/[^a-zA-Z0-9-_]/g, "_")}.${config.extension}`;
    const blob = new Blob([exportedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      isDismissable
      className={exportModalOverlay}
    >
      <Modal className={exportModalContainer}>
        <Dialog>
          {({ close }) => (
            <div className={exportModalInner}>
              {/* Header */}
              <div className={exportModalHeader}>
                <Heading slot="title" className={exportModalTitle}>
                  {config.title}
                </Heading>
                <Button
                  onPress={close}
                  className={exportModalCloseButton}
                  aria-label="Close"
                >
                  <X size={24} weight="bold" />
                </Button>
              </div>

              {/* Code Display */}
              <div className={exportModalContent}>
                <pre className={exportModalCodeBlock}>
									<code>{exportedCode}</code>
                </pre>
              </div>

              {/* Actions */}
              <div className={exportModalActions}>
                <Button onPress={handleCopy} className={exportModalButton}>
                  {copied
                    ? (
                      <>
                        <Check size={20} weight="bold" />
                        Copied!
                      </>
                    )
                    : (
                      <>
                        <Copy size={20} weight="duotone" />
                        Copy to Clipboard
                      </>
                    )}
                </Button>
                <Button onPress={handleDownload} className={exportModalButtonPrimary}>
                  <Download size={20} weight="duotone" />
                  Download .{config.extension}
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
