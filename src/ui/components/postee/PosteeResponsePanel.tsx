/**
 * PosteeResponsePanel Component
 *
 * Displays HTTP response results with three views:
 * - Execution: Last response from single request execution
 * - Load Test: Load testing panel for performance testing
 * - History: Execution history table with response inspection
 */

import type { PosteeHistoryEntry } from "@/core/effects/database.postee";
import type { PosteeRequestDraft } from "@/core/effects/postee";
import type { PreparedResponse } from "@/core/effects/postee/http-client";
import { CaretRightIcon, PlayIcon, SpinnerGapIcon as SpinnerGap, WarningIcon } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { ToggleButton } from "react-aria-components";
import { LoadTestPanel } from "./LoadTestPanel";
import { PosteeHistoryTable } from "./PosteeHistoryTable";
import { ResponseViewer } from "./ResponseViewer";

import * as layoutStyles from "../styles.css";
import * as styles from "./PosteeWorkspace.css";
import { baselineButton, baselineButtonActive } from "./ResponseViewer.css";

export interface PosteeResponsePanelProps {
  // Panel state
  isOpen: boolean;
  onToggleOpen: () => void;

  // Tab state
  activeTab: "Execution" | "LoadTest" | "History";

  // Request state
  selectedRequestDraft: PosteeRequestDraft | null;
  isRunning: boolean;

  // Response state
  lastResponse: PreparedResponse | null;
  lastError: string | null;
  lastResponseDurationMs: number | null;
  baselineResponse: PreparedResponse | null;

  // History state
  history: PosteeHistoryEntry[];

  // Baseline comparison
  showDiff: boolean;
  onSetBaseline: () => void;
  onClearBaseline: () => void;
  onToggleDiff: () => void;

  // Global runtime settings
  sirenEnabledDefault: boolean;
  masterAudioEnabled: boolean;
  masterVolume: number;
  animationsEnabled: boolean;
}

export function PosteeResponsePanel({
  isOpen,
  onToggleOpen,
  activeTab,
  selectedRequestDraft,
  isRunning,
  lastResponse,
  lastError,
  lastResponseDurationMs,
  baselineResponse,
  history,
  showDiff,
  onSetBaseline,
  onClearBaseline,
  onToggleDiff,
  sirenEnabledDefault,
  masterAudioEnabled,
  masterVolume,
  animationsEnabled,
}: PosteeResponsePanelProps) {
  type ComparedHistoryResponse = {
    body: string;
    status: number | null;
    executedAt: number;
    id: string;
  };

  const [inspectedHistoryEntry, setInspectedHistoryEntry] = useState<PosteeHistoryEntry | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  const handleInspectHistoryEntry = useCallback((entry: PosteeHistoryEntry) => {
    setInspectedHistoryEntry(entry);
  }, []);

  const clearInspectedHistoryEntry = useCallback(() => {
    setInspectedHistoryEntry(null);
  }, []);

  const handleSelectForCompare = useCallback((entryId: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(entryId)) {
        // Deselect
        return prev.filter((id) => id !== entryId);
      }
      if (prev.length >= 2) {
        // Replace the oldest selection and keep the newer one.
        return [...prev.slice(-1), entryId];
      }
      // Add to selection
      return [...prev, entryId];
    });
  }, []);

  const handleToggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev);
    if (compareMode) {
      // Exit compare mode - clear selections
      setSelectedForCompare([]);
    }
  }, [compareMode]);

  const handleClearSelection = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedForCompare([]);
  }, []);

  const inspectedHistoryResponse = useMemo(() => {
    if (!inspectedHistoryEntry) {
      return null;
    }

    const headers = (() => {
      const raw = inspectedHistoryEntry.response_headers;
      if (!raw) return undefined;
      if (typeof raw === "object") return raw as unknown as Record<string, string>;
      try {
        return JSON.parse(raw) as Record<string, string>;
      } catch {
        return raw;
      }
    })();

    const body = inspectedHistoryEntry.response_body
      ?? inspectedHistoryEntry.error_message
      ?? "";

    return {
      body,
      headers,
      status: inspectedHistoryEntry.response_status ?? undefined,
      statusText: inspectedHistoryEntry.error_message ?? undefined,
      duration: inspectedHistoryEntry.response_time_ms ?? undefined,
      size: inspectedHistoryEntry.response_size_bytes ?? undefined,
    };
  }, [inspectedHistoryEntry]);

  const comparisonResponses = useMemo<readonly [ComparedHistoryResponse, ComparedHistoryResponse] | null>(() => {
    if (selectedForCompare.length !== 2) return null;

    const entries = selectedForCompare
      .map((id) => history.find((entry) => entry.id === id))
      .filter((e): e is PosteeHistoryEntry => e !== undefined);

    if (entries.length !== 2) return null;

    const responses = entries.map((entry) => {
      // Extract body from response_body or error_message
      let body = "";
      if (entry.response_body) {
        // response_body might be a JSON string or already parsed
        if (typeof entry.response_body === "string") {
          body = entry.response_body;
        } else {
          body = JSON.stringify(entry.response_body, null, 2);
        }
      } else if (entry.error_message) {
        body = entry.error_message;
      }

      return {
        body,
        status: entry.response_status,
        executedAt: entry.executed_at,
        id: entry.id,
      };
    });
    return [responses[0]!, responses[1]!] as const;
  }, [selectedForCompare, history]);

  return (
    <>
      <div className={layoutStyles.panelHeader}>
        <ToggleButton
          isSelected={isOpen}
          onChange={onToggleOpen}
          className={layoutStyles.collapseToggle}
          aria-label="Collapse response panel"
        >
          <CaretRightIcon size={16} weight="bold" />
          Hide
        </ToggleButton>
      </div>

      {activeTab === "Execution" && (
        <div className={styles.responseTabContent}>
          <h2 className={styles.sectionTitle}>Execution</h2>

          {/* Empty state: No response yet */}
          {!lastResponse && !lastError && !isRunning && (
            <div className={styles.responseEmptyState}>
              <PlayIcon size={48} weight="light" />
              <h3>No response yet</h3>
              <p>
                Send a request using <kbd>⌘</kbd> + <kbd>Enter</kbd> or click the Send button above.
              </p>
            </div>
          )}

          {/* Loading state: Request in flight */}
          {isRunning && (
            <div className={styles.responseLoadingState}>
              <SpinnerGap size={48} weight="bold" className={styles.spinner} />
              <h3>Sending request...</h3>
              <p>You can cancel the request using the Cancel button above.</p>
            </div>
          )}

          {/* Error state */}
          {lastError && (
            <div className={styles.responseErrorState}>
              <WarningIcon size={48} weight="bold" />
              <h3>Request failed</h3>
              <pre className={styles.responseErrorMessage}>{lastError}</pre>
            </div>
          )}

          {/* Success state: Show response */}
          {lastResponse && !isRunning && (
            <ResponseViewer
              body={lastResponse.bodyText}
              headers={lastResponse.headers}
              status={lastResponse.status}
              statusText={lastResponse.statusText}
              {...(lastResponseDurationMs !== undefined && lastResponseDurationMs !== null && {
                duration: lastResponseDurationMs,
              })}
              size={Number(lastResponse.rawSize)}
              defaultExpanded
              baselineBody={baselineResponse?.bodyText ?? null}
              showDiff={showDiff}
              onSetBaseline={onSetBaseline}
              onClearBaseline={onClearBaseline}
              onToggleDiff={onToggleDiff}
            />
          )}
        </div>
      )}

      {activeTab === "LoadTest" && (
        <div className={styles.responseTabContent}>
          {selectedRequestDraft && (
            <LoadTestPanel
              requestDraft={selectedRequestDraft}
              sirenEnabledDefault={sirenEnabledDefault}
              masterAudioEnabled={masterAudioEnabled}
              masterVolume={masterVolume}
              animationsEnabled={animationsEnabled}
            />
          )}
        </div>
      )}

      {activeTab === "History" && (
        <div className={styles.responseTabContent}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 className={styles.sectionTitle}>Execution History</h2>
            <button
              type="button"
              className={compareMode ? baselineButtonActive : baselineButton}
              onClick={handleToggleCompareMode}
            >
              {compareMode ? "✕ Exit Compare" : "⚡ Compare"}
            </button>
          </div>
          <PosteeHistoryTable
            history={history}
            onInspectEntry={handleInspectHistoryEntry}
            compareMode={compareMode}
            selectedForCompare={selectedForCompare}
            onSelectForCompare={handleSelectForCompare}
          />

          {compareMode && (
            <div className={styles.panel}>
              {selectedForCompare.length === 0 && (
                <div className={styles.responseEmptyState}>
                  <h3>Compare Mode Active</h3>
                  <p>Select two history entries from the table above to compare their responses.</p>
                </div>
              )}
              {selectedForCompare.length === 1 && (
                <div className={styles.responseEmptyState}>
                  <h3>One Response Selected</h3>
                  <p>Select one more history entry to compare.</p>
                </div>
              )}
              {comparisonResponses && (
                <>
                  <div className={styles.historyDetailHeader}>
                    <div>
                      <h2 className={styles.sectionTitle}>Response Comparison</h2>
                      <p style={{ fontSize: "12px", color: "var(--color-foreground-secondary)", marginTop: "4px" }}>
                        Comparing: Baseline (left) vs Current (right)
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.historyCloseButton}
                      onClick={handleClearSelection}
                      aria-label="Clear selection and reset comparison"
                      title="Clear selection"
                    >
                      ✕ Clear
                    </button>
                  </div>
                  {(() => {
                    const [baselineComparison, currentComparison] = comparisonResponses;
                    return (
                      <ResponseViewer
                        body={currentComparison.body}
                        {...(currentComparison.status !== null && {
                          status: currentComparison.status,
                        })}
                        baselineBody={baselineComparison.body}
                        showDiff={true}
                        defaultExpanded
                      />
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {!compareMode && inspectedHistoryResponse && (
            <div className={styles.panel}>
              <div className={styles.historyDetailHeader}>
                <h2 className={styles.sectionTitle}>History Response</h2>
                <button
                  type="button"
                  className={styles.historyCloseButton}
                  onClick={clearInspectedHistoryEntry}
                >
                  Close
                </button>
              </div>
              <ResponseViewer
                body={inspectedHistoryResponse.body}
                {...(inspectedHistoryResponse.headers !== undefined && {
                  headers: inspectedHistoryResponse.headers,
                })}
                {...(inspectedHistoryResponse.status !== undefined && {
                  status: inspectedHistoryResponse.status,
                })}
                {...(inspectedHistoryResponse.statusText !== undefined && {
                  statusText: inspectedHistoryResponse.statusText,
                })}
                {...(inspectedHistoryResponse.duration !== undefined && {
                  duration: inspectedHistoryResponse.duration,
                })}
                {...(inspectedHistoryResponse.size !== undefined && {
                  size: inspectedHistoryResponse.size,
                })}
                defaultExpanded
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
