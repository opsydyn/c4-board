import type { PosteeEnvironmentVariable } from "@/core/effects/database.postee";
import { Eye, EyeSlash, Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import {
  Button,
  Checkbox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  TextField,
} from "react-aria-components";
import {
  addButton,
  checkboxIndicator,
  deleteButton,
  editorContainer,
  editorHeader,
  environmentActions,
  environmentSelector,
  secretToggle,
  secretValue,
  selectPopover,
  selectTrigger,
  variableCheckbox,
  variableKeyInput,
  variableList,
  variableRow,
  variableValueInput,
} from "./EnvironmentEditor.css";

export interface EnvironmentEditorProps {
  /** Current environment ID */
  environmentId: string;
  /** Available environments to switch between */
  environments: Array<{ id: string; name: string; is_default: number }>;
  /** Variables for the current environment */
  variables: PosteeEnvironmentVariable[];
  /** Callback when environment changes */
  onEnvironmentChange: (environmentId: string) => void;
  /** Callback when variables are modified */
  onVariablesChange: (variables: PosteeEnvironmentVariable[]) => void;
  /** Callback to create a new environment */
  onCreateEnvironment?: () => void;
}

export function EnvironmentEditor({
  environmentId,
  environments,
  variables,
  onEnvironmentChange,
  onVariablesChange,
  onCreateEnvironment,
}: EnvironmentEditorProps) {
  // Track which secret values are currently visible
  const [visibleSecrets, setVisibleSecrets] = useState<Set<number>>(new Set());

  const handleAddVariable = () => {
    const newVariable: PosteeEnvironmentVariable = {
      id: Date.now(), // Temporary ID for new variables
      environment_id: environmentId,
      key: "",
      value: "",
      is_secret: 0,
      is_enabled: 1,
      sort_order: variables.length,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    onVariablesChange([...variables, newVariable]);
  };

  const handleRemoveVariable = (id: number) => {
    onVariablesChange(variables.filter((v) => v.id !== id));
  };

  const handleUpdateVariable = (
    id: number,
    updates: Partial<PosteeEnvironmentVariable>,
  ) => {
    onVariablesChange(
      variables.map((v) => v.id === id ? { ...v, ...updates, updated_at: Date.now() } : v),
    );
  };

  const toggleSecretVisibility = (id: number) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={editorContainer}>
      <div className={editorHeader}>
        <Select
          selectedKey={environmentId}
          onSelectionChange={(key) => onEnvironmentChange(key as string)}
          className={environmentSelector}
        >
          <Label>Environment</Label>
          <Button className={selectTrigger}>
            <SelectValue />
            <span aria-hidden="true">▼</span>
          </Button>
          <Popover className={selectPopover}>
            <ListBox>
              {environments.map((env) => (
                <ListBoxItem key={env.id} id={env.id}>
                  {env.name}
                  {env.is_default === 1 && " (default)"}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>

        <div className={environmentActions}>
          {onCreateEnvironment && (
            <Button onPress={onCreateEnvironment}>
              <Plus size={16} weight="bold" />
              New Environment
            </Button>
          )}
        </div>
      </div>

      <div className={variableList}>
        {variables.map((variable) => {
          const isSecret = variable.is_secret === 1;
          const isVisible = visibleSecrets.has(variable.id);

          return (
            <div key={variable.id} className={variableRow}>
              <Checkbox
                isSelected={variable.is_enabled === 1}
                onChange={(isSelected) =>
                  handleUpdateVariable(variable.id, {
                    is_enabled: isSelected ? 1 : 0,
                  })}
                className={variableCheckbox}
              >
                <div className={checkboxIndicator} />
              </Checkbox>

              <TextField
                value={variable.key}
                onChange={(value) => handleUpdateVariable(variable.id, { key: value })}
                className={variableKeyInput}
              >
                <Input placeholder="VARIABLE_NAME" />
              </TextField>

              <TextField
                value={variable.value ?? ""}
                onChange={(value) => handleUpdateVariable(variable.id, { value })}
                className={variableValueInput}
              >
                <Input
                  type={isSecret && !isVisible ? "password" : "text"}
                  placeholder="value"
                  className={isSecret ? secretValue : ""}
                />
              </TextField>

              <Button
                onPress={() =>
                  handleUpdateVariable(variable.id, {
                    is_secret: isSecret ? 0 : 1,
                  })}
                className={secretToggle}
                aria-label={isSecret ? "Mark as regular" : "Mark as secret"}
              >
                {isSecret ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
              </Button>

              {isSecret && (
                <Button
                  onPress={() => toggleSecretVisibility(variable.id)}
                  className={secretToggle}
                  aria-label={isVisible ? "Hide value" : "Show value"}
                >
                  {isVisible ? <Eye size={16} weight="bold" /> : <EyeSlash size={16} weight="bold" />}
                </Button>
              )}

              <Button
                onPress={() => handleRemoveVariable(variable.id)}
                className={deleteButton}
                aria-label="Delete variable"
              >
                <Trash size={16} weight="bold" />
              </Button>
            </div>
          );
        })}

        <Button onPress={handleAddVariable} className={addButton}>
          <Plus size={16} weight="bold" />
          Add Variable
        </Button>
      </div>
    </div>
  );
}
