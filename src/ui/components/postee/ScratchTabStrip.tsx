import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { useCallback } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover, Tab, TabList, Tabs } from "react-aria-components";
import * as styles from "./ScratchTabStrip.css";

export interface ScratchTab {
  readonly id: string;
  readonly label: string;
  readonly dirty: boolean;
}

export interface ScratchTabStripProps {
  readonly tabs: ReadonlyArray<ScratchTab>;
  readonly activeId: string | null;
  readonly reopenable: ReadonlyArray<Pick<ScratchTab, "id" | "label">>;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onReopen: (id: string) => void;
}

export function ScratchTabStrip({
  tabs,
  activeId,
  reopenable,
  onSelect,
  onClose,
  onReopen,
}: ScratchTabStripProps) {
  const handleSelectionChange = useCallback((key: React.Key) => {
    onSelect(String(key));
  }, [onSelect]);

  return (
    <div className={styles.root} aria-label="Scratch requests">
      <Tabs
        {...(activeId === null ? {} : { selectedKey: activeId })}
        onSelectionChange={handleSelectionChange}
        className={styles.tabs}
      >
        <TabList className={styles.tabList} aria-label="Open scratch requests">
          {tabs.map((tab) => (
            <Tab key={tab.id} id={tab.id} className={styles.tab}>
              <span className={styles.tabLabel}>{tab.label}</span>
              {tab.dirty && <span className={styles.dirtyMarker} aria-label="Unsaved changes" />}
              <Button
                className={styles.closeButton}
                aria-label={`Close ${tab.label}`}
                onPress={() => onClose(tab.id)}
              >
                <XIcon size={14} weight="bold" aria-hidden="true" />
              </Button>
            </Tab>
          ))}
        </TabList>
      </Tabs>

      {reopenable.length > 0 && (
        <MenuTrigger>
          <Button className={styles.reopenButton} aria-label="Reopen drafts">
            <PlusIcon size={14} weight="bold" aria-hidden="true" />
            Reopen drafts
          </Button>
          <Popover className={styles.reopenPopover}>
            <Menu className={styles.reopenMenu} onAction={(key) => onReopen(String(key))}>
              {reopenable.map((draft) => (
                <MenuItem key={draft.id} id={draft.id} className={styles.reopenMenuItem}>
                  {draft.label}
                </MenuItem>
              ))}
            </Menu>
          </Popover>
        </MenuTrigger>
      )}
    </div>
  );
}
