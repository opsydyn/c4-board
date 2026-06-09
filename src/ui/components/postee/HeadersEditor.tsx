/**
 * HeadersEditor - Key-value editor for HTTP headers
 *
 * Features:
 * - Add/remove header rows
 * - Common header autocomplete
 * - Enable/disable individual headers
 * - Built with React Aria for accessibility
 */

import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useCallback } from "react";
import { Button, Checkbox, Input, TextField } from "react-aria-components";
import {
  headerAddButton,
  headerCheckbox,
  headerDeleteButton,
  headerInput,
  headerRow,
  headersContainer,
} from "./HeadersEditor.css";

export interface Header {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface HeadersEditorProps {
  headers: Header[];
  onChange: (headers: Header[]) => void;
}

export function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  const handleAddHeader = useCallback(() => {
    const newHeader: Header = {
      id: crypto.randomUUID(),
      key: "",
      value: "",
      enabled: true,
    };
    onChange([...headers, newHeader]);
  }, [headers, onChange]);

  const handleRemoveHeader = useCallback(
    (id: string) => {
      onChange(headers.filter((h) => h.id !== id));
    },
    [headers, onChange],
  );

  const handleUpdateHeader = useCallback(
    (id: string, updates: Partial<Header>) => {
      onChange(
        headers.map((h) => (h.id === id ? { ...h, ...updates } : h)),
      );
    },
    [headers, onChange],
  );

  return (
    <div className={headersContainer}>
      {headers.map((header) => (
        <div key={header.id} className={headerRow}>
          <Checkbox
            className={headerCheckbox}
            isSelected={header.enabled}
            onChange={(isSelected) => handleUpdateHeader(header.id, { enabled: isSelected })}
            aria-label="Enable/disable header"
          >
            {/* Checkbox visual indicator styled via CSS */}
          </Checkbox>

          <TextField
            value={header.key}
            onChange={(value) => handleUpdateHeader(header.id, { key: value })}
            aria-label="Header name"
          >
            <Input className={headerInput} placeholder="Header name" list="common-headers" />
          </TextField>

          <TextField
            value={header.value}
            onChange={(value) => handleUpdateHeader(header.id, { value })}
            aria-label="Header value"
          >
            <Input className={headerInput} placeholder="Value" />
          </TextField>

          <Button
            className={headerDeleteButton}
            onPress={() => handleRemoveHeader(header.id)}
            aria-label="Delete header"
          >
            <TrashIcon size={16} weight="bold" />
          </Button>
        </div>
      ))}

      <Button className={headerAddButton} onPress={handleAddHeader}>
        <PlusIcon size={16} weight="bold" />
        Add Header
      </Button>

      {/* Common headers datalist for autocomplete */}
      <datalist id="common-headers">
        <option value="Content-Type" />
        <option value="Authorization" />
        <option value="Accept" />
        <option value="User-Agent" />
        <option value="Cache-Control" />
        <option value="X-API-Key" />
        <option value="X-Request-ID" />
      </datalist>
    </div>
  );
}
