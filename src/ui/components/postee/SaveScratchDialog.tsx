import type { PosteeCollection } from "@/core/effects/database.postee";
import { useCallback, useEffect, useState } from "react";
import { Button, Dialog, Heading, ListBox, ListBoxItem, Modal, ModalOverlay } from "react-aria-components";
import * as styles from "./SaveScratchDialog.css";

export interface SaveScratchDialogProps {
  readonly isOpen: boolean;
  readonly collections: ReadonlyArray<PosteeCollection>;
  readonly onClose: () => void;
  readonly onConfirm: (collectionId: string) => void;
}

export function SaveScratchDialog({
  isOpen,
  collections,
  onClose,
  onConfirm,
}: SaveScratchDialogProps) {
  const [collectionId, setCollectionId] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) setCollectionId(null);
  }, [isOpen]);
  const handleSelectionChange = useCallback((keys: "all" | Set<React.Key>) => {
    if (keys === "all") return;
    const first = keys.values().next().value;
    setCollectionId(first === undefined ? null : String(first));
  }, []);

  const handleConfirm = useCallback(() => {
    if (collectionId === null) return;
    onConfirm(collectionId);
  }, [collectionId, onConfirm]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={styles.overlay}
    >
      <Modal className={styles.modal}>
        <Dialog className={styles.dialog} aria-label="Save request">
          <Heading slot="title" className={styles.title}>Save request</Heading>
          <p className={styles.description}>Choose where to keep this request.</p>
          <ListBox
            aria-label="Collection"
            selectionMode="single"
            selectedKeys={collectionId === null ? new Set() : new Set([collectionId])}
            onSelectionChange={handleSelectionChange}
            className={styles.collectionList}
          >
            {collections.map((collection) => (
              <ListBoxItem key={collection.id} id={collection.id} className={styles.collectionItem}>
                {collection.name}
              </ListBoxItem>
            ))}
          </ListBox>
          {collections.length === 0 && (
            <p className={styles.emptyState}>Create a collection before saving this request.</p>
          )}
          <div className={styles.actions}>
            <Button className={styles.secondaryButton} onPress={onClose}>Cancel</Button>
            <Button
              className={styles.primaryButton}
              onPress={handleConfirm}
              isDisabled={collectionId === null}
            >
              Save request
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
