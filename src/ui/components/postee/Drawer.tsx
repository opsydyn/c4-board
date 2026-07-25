/**
 * A side drawer for surfaces consulted in bursts rather than watched continuously
 * (ADR-011).
 *
 * History used to be a third tab in the response panel, so reading it meant giving
 * up the response. A drawer overlays instead: nothing else in the workspace moves
 * or shrinks while it is open.
 *
 * Built on React Aria's modal primitives, as SaveScratchDialog is, which supplies
 * focus containment, Escape, and scroll locking rather than reimplementing them.
 */

import { CaretRightIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { drawerBody, drawerCloseButton, drawerDialog, drawerHeader, drawerOverlay, drawerTitle } from "./Drawer.css";

export interface DrawerProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function Drawer({ isOpen, title, onClose, children }: DrawerProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
      className={drawerOverlay}
    >
      <Modal className={drawerDialog}>
        <Dialog aria-label={title} className={drawerBody}>
          <header className={drawerHeader}>
            <Heading slot="title" className={drawerTitle}>{title}</Heading>
            <Button onPress={onClose} className={drawerCloseButton} aria-label={`Close ${title}`}>
              <CaretRightIcon size={16} weight="bold" />
              Close
            </Button>
          </header>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
