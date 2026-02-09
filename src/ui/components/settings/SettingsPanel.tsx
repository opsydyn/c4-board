import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSettings, patchSettings, resetSettings } from "../../../core/effects/database";
import type {
	AppSettings,
	AppSettingsPatch,
	RedactionMode,
	TransitionIntensity,
} from "../../../core/effects/settings.types";
import { useDatabase } from "../../../core/effects/useDatabase";
import * as styles from "../../../pages/settings.css";

type SaveState = "loading" | "saving" | "saved" | "error";

const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

const isTransitionIntensity = (value: string): value is TransitionIntensity =>
	value === "low" || value === "normal" || value === "high";

const isRedactionMode = (value: string): value is RedactionMode =>
	value === "off" || value === "standard" || value === "strict";

const extractErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	return "Unknown settings error";
};

export function SettingsPanel() {
	const { runEffect } = useDatabase();
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [saveState, setSaveState] = useState<SaveState>("loading");
	const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
	const [pendingWrites, setPendingWrites] = useState(0);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [dataControlNotice, setDataControlNotice] = useState<string | null>(null);
	const [autosaveIntervalDraft, setAutosaveIntervalDraft] = useState("1500");
	const [historyRetentionDraft, setHistoryRetentionDraft] = useState("30");
	const [masterVolumeDraft, setMasterVolumeDraft] = useState(80);

	const mountedRef = useRef(true);
	const pendingWritesRef = useRef(0);
	const hasMutationErrorRef = useRef(false);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const loadSettings = useCallback(() => {
		setSaveState("loading");
		setErrorMessage(null);

		void runEffect(getSettings())
			.then((loadedSettings) => {
				if (!mountedRef.current) {
					return;
				}
				setSettings(loadedSettings);
				setSaveState("saved");
				hasMutationErrorRef.current = false;
			})
			.catch((error) => {
				if (!mountedRef.current) {
					return;
				}
				setSaveState("error");
				setErrorMessage(extractErrorMessage(error));
			});
	}, [runEffect]);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	useEffect(() => {
		if (!settings) {
			return;
		}
		setAutosaveIntervalDraft(String(settings.autosaveIntervalMs));
		setHistoryRetentionDraft(String(settings.historyRetentionDays));
		setMasterVolumeDraft(Math.round(settings.masterVolume * 100));
	}, [settings]);

	const runSettingsWrite = useCallback(
		(run: () => Promise<AppSettings>, optimisticSettings?: AppSettings) => {
			if (optimisticSettings) {
				setSettings(optimisticSettings);
			}
			setSaveState("saving");
			setErrorMessage(null);
			setDataControlNotice(null);

			pendingWritesRef.current += 1;
			setPendingWrites(pendingWritesRef.current);

			void run()
				.then((committedSettings) => {
					if (!mountedRef.current) {
						return;
					}
					hasMutationErrorRef.current = false;
					setSettings(committedSettings);
					setLastSavedAt(Date.now());
				})
				.catch((error) => {
					hasMutationErrorRef.current = true;
					if (!mountedRef.current) {
						return;
					}
					setErrorMessage(extractErrorMessage(error));

					// Re-hydrate from the database to prevent stale optimistic state.
					void runEffect(getSettings())
						.then((latest) => {
							if (!mountedRef.current) {
								return;
							}
							setSettings(latest);
						})
						.catch(() => {
							// Best-effort refresh only.
						});
				})
				.finally(() => {
					if (!mountedRef.current) {
						return;
					}
					pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
					setPendingWrites(pendingWritesRef.current);

					if (pendingWritesRef.current === 0) {
						setSaveState(hasMutationErrorRef.current ? "error" : "saved");
					}
				});
		},
		[runEffect],
	);

	const applyPatch = useCallback(
		(patch: AppSettingsPatch) => {
			if (!settings) {
				return;
			}

			const nextSettings: AppSettings = {
				...settings,
				...patch,
			};

			const hasChanges = Object.entries(patch).some(([key, value]) => {
				const typedKey = key as keyof AppSettings;
				return !Object.is(settings[typedKey], value);
			});

			if (!hasChanges) {
				return;
			}

			runSettingsWrite(() => runEffect(patchSettings(patch)), nextSettings);
		},
		[runEffect, runSettingsWrite, settings],
	);

	const handleResetToDefaults = useCallback(() => {
		if (!window.confirm("Reset all global settings to defaults?")) {
			return;
		}
		runSettingsWrite(() => runEffect(resetSettings()));
	}, [runEffect, runSettingsWrite]);

	const handlePlannedAction = useCallback((label: string, confirmation: string) => {
		if (!window.confirm(confirmation)) {
			return;
		}
		setDataControlNotice(`${label} is queued for implementation in Phase 4.`);
	}, []);

	const statusText = useMemo(() => {
		switch (saveState) {
			case "loading":
				return "STATE::LOADING";
			case "saving":
				return "STATE::SAVING";
			case "error":
				return "STATE::ERROR";
			case "saved":
				if (lastSavedAt === null) {
					return "STATE::SYNCED";
				}
				return `SAVED ${new Intl.DateTimeFormat(undefined, {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
					hour12: false,
				}).format(lastSavedAt)}`;
		}
	}, [lastSavedAt, saveState]);

	const statusClassName = useMemo(() => {
		switch (saveState) {
			case "loading":
				return `${styles.settingsStatusBadge} ${styles.settingsStatusLoading}`;
			case "saving":
				return `${styles.settingsStatusBadge} ${styles.settingsStatusSaving}`;
			case "saved":
				return `${styles.settingsStatusBadge} ${styles.settingsStatusSaved}`;
			case "error":
				return `${styles.settingsStatusBadge} ${styles.settingsStatusError}`;
		}
	}, [saveState]);

	const commitAutosaveInterval = useCallback(() => {
		if (!settings) {
			return;
		}
		const parsed = Number(autosaveIntervalDraft);
		if (!Number.isFinite(parsed)) {
			setAutosaveIntervalDraft(String(settings.autosaveIntervalMs));
			return;
		}
		const normalized = clamp(Math.round(parsed), 250, 60_000);
		setAutosaveIntervalDraft(String(normalized));
		applyPatch({ autosaveIntervalMs: normalized });
	}, [applyPatch, autosaveIntervalDraft, settings]);

	const commitHistoryRetentionDays = useCallback(() => {
		if (!settings) {
			return;
		}
		const parsed = Number(historyRetentionDraft);
		if (!Number.isFinite(parsed)) {
			setHistoryRetentionDraft(String(settings.historyRetentionDays));
			return;
		}
		const normalized = clamp(Math.round(parsed), 1, 3_650);
		setHistoryRetentionDraft(String(normalized));
		applyPatch({ historyRetentionDays: normalized });
	}, [applyPatch, historyRetentionDraft, settings]);

	const commitMasterVolume = useCallback(
		(nextPercent: number) => {
			const normalizedPercent = clamp(Math.round(nextPercent), 0, 100);
			setMasterVolumeDraft(normalizedPercent);
			applyPatch({ masterVolume: normalizedPercent / 100 });
		},
		[applyPatch],
	);

	return (
		<>
			<header className={styles.mainHeader}>
				<h1 className={styles.mainTitle}>Global Settings</h1>
				<div className={styles.settingsStatusBar}>
					<span className={statusClassName}>{statusText}</span>
					{pendingWrites > 0 && (
						<span className={styles.settingsRowValue}>
							QUEUE {pendingWrites}
						</span>
					)}
				</div>
				{errorMessage && <p className={styles.settingsErrorText}>{errorMessage}</p>}
				<p className={styles.mainSubtitle}>
					Global controls are now live. Values commit directly to local runtime storage.
				</p>
			</header>

			{settings ? (
				<div className={styles.settingsGrid}>
					<article id="experience" className={styles.settingsCard}>
						<h2 className={styles.settingsCardTitle}>Experience</h2>
						<p className={styles.settingsCardDescription}>
							Visual defaults for transitions, chart motion, and global UI mode.
						</p>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Animations</span>
								<span className={styles.settingsRowHint}>Global default</span>
							</div>
							<div className={styles.settingsControlGroup}>
								<button
									type="button"
									className={styles.settingsToggleControl}
									data-active={settings.animationsEnabled ? "true" : "false"}
									onClick={() =>
										applyPatch({
											animationsEnabled: !settings.animationsEnabled,
										})
									}
								>
									{settings.animationsEnabled ? "ON" : "OFF"}
								</button>
							</div>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Transition Intensity</span>
								<span className={styles.settingsRowHint}>Low / Normal / High</span>
							</div>
							<div className={styles.settingsControlGroup}>
								<select
									className={styles.settingsSelectControl}
									value={settings.transitionIntensity}
									onChange={(event) => {
										const value = event.currentTarget.value;
										if (isTransitionIntensity(value)) {
											applyPatch({ transitionIntensity: value });
										}
									}}
								>
									<option value="low">LOW</option>
									<option value="normal">NORMAL</option>
									<option value="high">HIGH</option>
								</select>
							</div>
						</div>
					</article>

					<article id="audio" className={styles.settingsCard}>
						<h2 className={styles.settingsCardTitle}>Audio</h2>
						<p className={styles.settingsCardDescription}>
							Default behavior for save chimes, sirens, and global master volume.
						</p>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Master Audio</span>
								<span className={styles.settingsRowHint}>
									Applies across all workspaces
								</span>
							</div>
							<button
								type="button"
								className={styles.settingsToggleControl}
								data-active={settings.masterAudioEnabled ? "true" : "false"}
								onClick={() =>
									applyPatch({ masterAudioEnabled: !settings.masterAudioEnabled })
								}
							>
								{settings.masterAudioEnabled ? "ON" : "OFF"}
							</button>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Save Chime</span>
								<span className={styles.settingsRowHint}>Canvas save events</span>
							</div>
							<button
								type="button"
								className={styles.settingsToggleControl}
								data-active={settings.saveChimeEnabled ? "true" : "false"}
								onClick={() =>
									applyPatch({ saveChimeEnabled: !settings.saveChimeEnabled })
								}
							>
								{settings.saveChimeEnabled ? "ON" : "OFF"}
							</button>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Load Test Siren Default</span>
								<span className={styles.settingsRowHint}>Postee load chamber</span>
							</div>
							<button
								type="button"
								className={styles.settingsToggleControl}
								data-active={settings.sirenEnabledDefault ? "true" : "false"}
								onClick={() =>
									applyPatch({
										sirenEnabledDefault: !settings.sirenEnabledDefault,
									})
								}
							>
								{settings.sirenEnabledDefault ? "ON" : "OFF"}
							</button>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Master Volume</span>
								<span className={styles.settingsRowHint}>
									Commits on release
								</span>
							</div>
							<div className={styles.settingsControlGroup}>
								<input
									type="range"
									min={0}
									max={100}
									step={1}
									value={masterVolumeDraft}
									className={styles.settingsRangeControl}
									onChange={(event) =>
										setMasterVolumeDraft(
											clamp(event.currentTarget.valueAsNumber, 0, 100),
										)
									}
									onMouseUp={() => commitMasterVolume(masterVolumeDraft)}
									onTouchEnd={() => commitMasterVolume(masterVolumeDraft)}
									onBlur={() => commitMasterVolume(masterVolumeDraft)}
									onKeyUp={() => commitMasterVolume(masterVolumeDraft)}
								/>
								<span className={styles.settingsRangeValue}>
									{masterVolumeDraft}%
								</span>
							</div>
						</div>
					</article>

					<article id="save-sync" className={styles.settingsCard}>
						<h2 className={styles.settingsCardTitle}>Save & Sync</h2>
						<p className={styles.settingsCardDescription}>
							Defaults for autosave cadence, navigation-save behavior, and sync diagnostics.
						</p>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Autosave</span>
								<span className={styles.settingsRowHint}>C4 board persistence</span>
							</div>
							<button
								type="button"
								className={styles.settingsToggleControl}
								data-active={settings.autosaveEnabled ? "true" : "false"}
								onClick={() =>
									applyPatch({ autosaveEnabled: !settings.autosaveEnabled })
								}
							>
								{settings.autosaveEnabled ? "ON" : "OFF"}
							</button>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Autosave Interval (ms)</span>
								<span className={styles.settingsRowHint}>250 - 60000</span>
							</div>
							<div className={styles.settingsControlGroup}>
								<input
									type="number"
									min={250}
									max={60_000}
									step={250}
									value={autosaveIntervalDraft}
									className={styles.settingsNumberControl}
									onChange={(event) =>
										setAutosaveIntervalDraft(event.currentTarget.value)
									}
									onBlur={commitAutosaveInterval}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											commitAutosaveInterval();
										}
									}}
								/>
							</div>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Save On Navigate</span>
								<span className={styles.settingsRowHint}>Route transitions</span>
							</div>
							<button
								type="button"
								className={styles.settingsToggleControl}
								data-active={settings.saveOnNavigate ? "true" : "false"}
								onClick={() =>
									applyPatch({ saveOnNavigate: !settings.saveOnNavigate })
								}
							>
								{settings.saveOnNavigate ? "ON" : "OFF"}
							</button>
						</div>
					</article>

					<article id="data-control" className={styles.settingsCard}>
						<h2 className={styles.settingsCardTitle}>Data Control</h2>
						<p className={styles.settingsCardDescription}>
							Export/import actions are scaffolded here and intentionally gated.
						</p>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Workspace Backup</span>
								<span className={styles.settingsRowHint}>C4 + Postee payload</span>
							</div>
							<div className={styles.settingsInlineActions}>
								<button
									type="button"
									className={styles.settingsActionButton}
									onClick={() =>
										handlePlannedAction(
											"Export backup bundle",
											"Generate a backup export placeholder action?",
										)
									}
								>
									Export
								</button>
								<button
									type="button"
									className={styles.settingsActionButton}
									onClick={() =>
										handlePlannedAction(
											"Import backup bundle",
											"Run import placeholder flow? Existing data is not modified in this phase.",
										)
									}
								>
									Import
								</button>
							</div>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>History Retention (days)</span>
								<span className={styles.settingsRowHint}>1 - 3650</span>
							</div>
							<div className={styles.settingsControlGroup}>
								<input
									type="number"
									min={1}
									max={3_650}
									step={1}
									value={historyRetentionDraft}
									className={styles.settingsNumberControl}
									onChange={(event) =>
										setHistoryRetentionDraft(event.currentTarget.value)
									}
									onBlur={commitHistoryRetentionDays}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											commitHistoryRetentionDays();
										}
									}}
								/>
							</div>
						</div>
						{dataControlNotice && (
							<p className={styles.settingsNotice}>{dataControlNotice}</p>
						)}
					</article>

					<article id="privacy-security" className={styles.settingsCard}>
						<h2 className={styles.settingsCardTitle}>Privacy & Security</h2>
						<p className={styles.settingsCardDescription}>
							Telemetry and redaction defaults for runtime diagnostics.
						</p>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Diagnostics Sharing</span>
								<span className={styles.settingsRowHint}>
									Error and crash reporting
								</span>
							</div>
							<button
								type="button"
								className={styles.settingsToggleControl}
								data-active={settings.telemetryEnabled ? "true" : "false"}
								onClick={() =>
									applyPatch({ telemetryEnabled: !settings.telemetryEnabled })
								}
							>
								{settings.telemetryEnabled ? "ON" : "OFF"}
							</button>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Secret Redaction</span>
								<span className={styles.settingsRowHint}>Request data masking</span>
							</div>
							<select
								className={styles.settingsSelectControl}
								value={settings.redactionMode}
								onChange={(event) => {
									const value = event.currentTarget.value;
									if (isRedactionMode(value)) {
										applyPatch({ redactionMode: value });
									}
								}}
							>
								<option value="off">OFF</option>
								<option value="standard">STANDARD</option>
								<option value="strict">STRICT</option>
							</select>
						</div>
					</article>

					<article id="system-status" className={styles.settingsCard}>
						<h2 className={styles.settingsCardTitle}>System Status</h2>
						<p className={styles.settingsCardDescription}>
							Runtime diagnostics for write queue and local persistence.
						</p>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Database Runtime</span>
								<span className={styles.settingsRowHint}>
									Single connection + WAL
								</span>
							</div>
							<span className={styles.settingsRowValue}>ONLINE</span>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Write Queue</span>
								<span className={styles.settingsRowHint}>
									In-flight settings writes
								</span>
							</div>
							<span className={styles.settingsRowValue}>{pendingWrites}</span>
						</div>
					</article>

					<article id="about" className={styles.settingsCard}>
						<h2 className={styles.settingsCardTitle}>About</h2>
						<p className={styles.settingsCardDescription}>
							Product identity and build channel.
						</p>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Software Version</span>
								<span className={styles.settingsRowHint}>Runtime metadata</span>
							</div>
							<span className={styles.settingsRowValue}>V1.0.0</span>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Release Channel</span>
								<span className={styles.settingsRowHint}>Distribution track</span>
							</div>
							<span className={styles.settingsRowValue}>STABLE</span>
						</div>
					</article>

					<article
						id="danger-zone"
						className={`${styles.settingsCard} ${styles.settingsCardDanger}`}
					>
						<h2 className={styles.settingsCardTitle}>Danger Zone</h2>
						<p className={styles.settingsCardDescription}>
							Destructive operations stay explicit and confirmation-gated.
						</p>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Reset Global Settings</span>
								<span className={styles.settingsRowHint}>
									Restores defaults immediately
								</span>
							</div>
							<button
								type="button"
								className={`${styles.settingsActionButton} ${styles.settingsActionButtonDanger}`}
								onClick={handleResetToDefaults}
							>
								Reset
							</button>
						</div>
						<div className={styles.settingsRow}>
							<div className={styles.settingsRowLabel}>
								<span>Delete All Diagrams</span>
								<span className={styles.settingsRowHint}>
									Intentionally locked in this phase
								</span>
							</div>
							<button
								type="button"
								className={`${styles.settingsActionButton} ${styles.settingsActionButtonDanger}`}
								disabled
							>
								Locked
							</button>
						</div>
					</article>
				</div>
			) : (
				<div className={styles.settingsLoadingState}>
					INITIALIZING SETTINGS RUNTIME
				</div>
			)}
		</>
	);
}
