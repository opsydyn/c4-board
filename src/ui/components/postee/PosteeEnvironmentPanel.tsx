/**
 * PosteeEnvironmentPanel Component
 *
 * Manages environment variables for different environments:
 * - Create new environments (Development, Staging, Production, etc.)
 * - Select active environment
 * - Edit environment variables (key-value pairs)
 */

import type { PosteeEnvironment, PosteeEnvironmentVariable } from "@/core/effects/database.postee";
import { CaretDownIcon } from "@phosphor-icons/react";
import { type SubmitEvent, useCallback, useState } from "react";
import { ToggleButton } from "react-aria-components";
import { EnvironmentEditor } from "./EnvironmentEditor";

import * as layoutStyles from "../styles.css";
import * as styles from "./PosteeWorkspace.css";

export interface PosteeEnvironmentPanelProps {
  // Panel state
  isOpen: boolean;
  onToggleOpen: () => void;

  // Environment state
  environments: PosteeEnvironment[];
  currentEnvironmentId: string;
  currentVariables: PosteeEnvironmentVariable[];

  // Callbacks
  onCreateEnvironment: (name: string) => void;
  onEnvironmentChange: (environmentId: string) => void;
  onVariablesChange: (variables: PosteeEnvironmentVariable[]) => void;
}

export function PosteeEnvironmentPanel({
  isOpen,
  onToggleOpen,
  environments,
  currentEnvironmentId,
  currentVariables,
  onCreateEnvironment,
  onEnvironmentChange,
  onVariablesChange,
}: PosteeEnvironmentPanelProps) {
  const [newEnvironmentName, setNewEnvironmentName] = useState("");

  const handleCreateEnvironment = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = newEnvironmentName.trim() || "Development";
      onCreateEnvironment(name);
      setNewEnvironmentName("");
    },
    [newEnvironmentName, onCreateEnvironment],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <section
      className={layoutStyles.bottomPanel}
      aria-label="Environment panel"
      style={{
        gridColumn: "1 / -1",
      }}
    >
      <div className={layoutStyles.bottomPanelHeader}>
        <h2 className={styles.sectionTitle}>Environment Variables</h2>
        <ToggleButton
          isSelected={isOpen}
          onChange={onToggleOpen}
          className={layoutStyles.collapseToggle}
          aria-label="Collapse environment panel"
        >
          <CaretDownIcon size={16} weight="bold" />
          Hide
        </ToggleButton>
      </div>
      <div className={styles.environmentContent}>
        {environments.length === 0
          ? (
            <div className={styles.environmentEmptyState}>
              <strong>No environments yet</strong>
              <span>
                Create your first environment to start managing environment variables (e.g., Development, Staging,
                Production).
              </span>
              <form
                className={styles.environmentForm}
                onSubmit={handleCreateEnvironment}
              >
                <input
                  className={styles.textInput}
                  type="text"
                  placeholder="Environment name (e.g., Development)"
                  value={newEnvironmentName}
                  onChange={(event) => setNewEnvironmentName(event.target.value)}
                  required
                  aria-label="Environment name"
                />
                <button className={styles.submitButton} type="submit">
                  Create Environment
                </button>
              </form>
            </div>
          )
          : (
            <EnvironmentEditor
              environmentId={currentEnvironmentId}
              environments={environments.map((env) => ({
                id: env.id,
                name: env.name,
                is_default: env.is_default,
              }))}
              variables={currentVariables}
              onEnvironmentChange={onEnvironmentChange}
              onVariablesChange={onVariablesChange}
            />
          )}
      </div>
    </section>
  );
}
