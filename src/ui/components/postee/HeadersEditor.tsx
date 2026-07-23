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
import { Button, CheckboxButton, CheckboxField, Input, TextField } from "react-aria-components";
import {
  headerAddButton,
  headerCheckbox,
  headerCheckboxField,
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
  disabled?: boolean;
  readOnly?: boolean;
}

export function HeadersEditor({
  headers,
  onChange,
  disabled = false,
  readOnly = false,
}: HeadersEditorProps) {
  const isDisabled = disabled || readOnly;

  const handleAddHeader = useCallback(() => {
    if (isDisabled) return;

    const newHeader: Header = {
      id: crypto.randomUUID(),
      key: "",
      value: "",
      enabled: true,
    };
    onChange([...headers, newHeader]);
  }, [headers, isDisabled, onChange]);

  const handleRemoveHeader = useCallback(
    (id: string) => {
      if (isDisabled) return;
      onChange(headers.filter((h) => h.id !== id));
    },
    [headers, isDisabled, onChange],
  );

  const handleUpdateHeader = useCallback(
    (id: string, updates: Partial<Header>) => {
      if (isDisabled) return;
      onChange(
        headers.map((h) => (h.id === id ? { ...h, ...updates } : h)),
      );
    },
    [headers, isDisabled, onChange],
  );

  return (
    <div className={headersContainer}>
      {headers.map((header) => (
        <div key={header.id} className={headerRow}>
          <CheckboxField
            className={headerCheckboxField}
            isSelected={header.enabled}
            isDisabled={isDisabled}
            onChange={(isSelected) => handleUpdateHeader(header.id, { enabled: isSelected })}
          >
            <CheckboxButton className={headerCheckbox} aria-label="Enable or disable header" />
          </CheckboxField>

          <TextField
            value={header.key}
            isDisabled={isDisabled}
            onChange={(value) => handleUpdateHeader(header.id, { key: value })}
            aria-label="Header name"
          >
            <Input className={headerInput} placeholder="Header name" list="common-headers" />
          </TextField>

          <TextField
            value={header.value}
            isDisabled={isDisabled}
            onChange={(value) => handleUpdateHeader(header.id, { value })}
            aria-label="Header value"
          >
            <Input className={headerInput} placeholder="Value" />
          </TextField>

          <Button
            className={headerDeleteButton}
            isDisabled={isDisabled}
            onPress={() => handleRemoveHeader(header.id)}
            aria-label="Delete header"
          >
            <TrashIcon size={16} weight="bold" />
          </Button>
        </div>
      ))}

      <Button className={headerAddButton} isDisabled={isDisabled} onPress={handleAddHeader}>
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
