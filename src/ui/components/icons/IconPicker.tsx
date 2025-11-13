import {
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	MagnifyingGlassIcon,
	CheckIcon,
	XIcon,
	UploadSimpleIcon,
} from "@phosphor-icons/react";
import { DialogTrigger, Button, Popover, Dialog } from "react-aria-components";
import {
	DEFAULT_ICON_BY_TYPE,
	isCustomIconId,
	type BuiltInIconId,
	type CustomIconId,
	type NodeIconId,
	type C4Type,
} from "../../../core/effects/node-operations";
import { getNodeIconComponent, resolveNodeIconId } from "../../icons/nodeIcons";
import { useDatabase } from "../../../core/effects/useDatabase";
import {
	listCustomIcons,
	upsertCustomIcon,
	type CustomIcon as CustomIconRecord,
} from "../../../core/effects/database";
import * as styles from "./IconPicker.css";

const ICON_OPTIONS: Array<{ id: BuiltInIconId; label: string; group: string }> = [
	{ id: "phosphor:user-duotone", label: "Operator", group: "Actors" },
	{ id: "phosphor:package-duotone", label: "System", group: "Systems" },
	{ id: "phosphor:cloud-duotone", label: "External", group: "Systems" },
	{ id: "phosphor:stack-duotone", label: "Container", group: "Scopes" },
	{ id: "phosphor:cube-duotone", label: "Component", group: "Scopes" },
];

const MAX_ICON_FILE_SIZE = 512 * 1024; // 512KB
const ALLOWED_MIME_TYPES = new Set([
	"image/png",
	"image/svg+xml",
	"image/webp",
	"image/jpeg",
]);

interface SaveIconResult {
	icon_id: string;
	filename: string;
	mime_type: string;
	label: string;
	bytes_written: number;
}

interface CustomIconOption {
	id: CustomIconId;
	label: string;
	filename: string;
	mimeType: string;
}

const isDesktopTauriRuntime = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const deriveLabelFromFilename = (filename: string): string => {
	const withoutExtension =
		filename.split(".").slice(0, -1).join(".") || filename;
	const normalized = withoutExtension.replace(/[-_]+/g, " ").trim();
	if (!normalized) return filename;
	return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const mapCustomIcons = (records: CustomIconRecord[]): CustomIconOption[] =>
	records
		.filter((record): record is CustomIconRecord & { id: CustomIconId } =>
			isCustomIconId(record.id),
		)
		.map((record) => ({
			id: record.id as CustomIconId,
			label: record.label ?? deriveLabelFromFilename(record.filename),
			filename: record.filename,
			mimeType: record.mime_type,
		}));

interface IconPickerProps {
	value?: NodeIconId | null | undefined;
	type: C4Type;
	onChange: (iconId: NodeIconId) => void;
	onReset?: () => void;
}

export function IconPicker({ value, type, onChange, onReset }: IconPickerProps) {
	const { runEffect } = useDatabase();
	const [filter, setFilter] = useState("");
	const [customIcons, setCustomIcons] = useState<CustomIconOption[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [customLoading, setCustomLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const resolvedIconId = resolveNodeIconId(value ?? undefined, type);
	const Icon = getNodeIconComponent(resolvedIconId, type);
	const isTauri = isDesktopTauriRuntime();
	
	useEffect(() => {
		console.log('[IconPicker] Component mounted', {
			isTauri,
			hasTauriInternals: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
			windowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('TAURI')) : []
		});
	}, [isTauri]);

	const resolvedLabel = useMemo(() => {
		if (isCustomIconId(resolvedIconId)) {
			const custom = customIcons.find((option) => option.id === resolvedIconId);
			return custom?.label ?? resolvedIconId;
		}
		return (
			ICON_OPTIONS.find((option) => option.id === resolvedIconId)?.label ??
			resolvedIconId
		);
	}, [customIcons, resolvedIconId]);

	const filteredBuiltIns = useMemo(() => {
		const normalized = filter.trim().toLowerCase();
		if (!normalized) return ICON_OPTIONS;
		return ICON_OPTIONS.filter((option) => {
			const haystack = `${option.label} ${option.group}`.toLowerCase();
			return haystack.includes(normalized);
		});
	}, [filter]);

	const filteredCustomIcons = useMemo(() => {
		const normalized = filter.trim().toLowerCase();
		if (!normalized) return customIcons;
		return customIcons.filter((option) => {
			const haystack = `${option.label} ${option.filename}`.toLowerCase();
			return haystack.includes(normalized);
		});
	}, [customIcons, filter]);

	const defaultStatus = isTauri
		? "PNG, SVG, JPEG, WEBP • 512KB max"
		: "Custom uploads require the desktop runtime";
	const statusClass = errorMessage ? styles.errorText : styles.statusText;
	const statusContent = errorMessage ?? statusMessage ?? defaultStatus;

	const fetchCustomIcons = useCallback(async () => {
		if (!isDesktopTauriRuntime()) {
			return [] as CustomIconOption[];
		}
		const records = await runEffect(listCustomIcons());
		return mapCustomIcons(records);
	}, [runEffect]);

	useEffect(() => {
		if (!isOpen || !isTauri) {
			return;
		}

		let cancelled = false;
		setCustomLoading(true);
		setErrorMessage(null);

		fetchCustomIcons()
			.then((options) => {
				if (!cancelled) {
					setCustomIcons(options);
				}
			})
			.catch((error) => {
				console.error("Failed to load custom icons", error);
				if (!cancelled) {
					setErrorMessage("Failed to load custom icons");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setCustomLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [fetchCustomIcons, isOpen, isTauri]);

	const handleSelect = useCallback(
		(iconId: NodeIconId) => {
			onChange(iconId);
			setStatusMessage(null);
			setErrorMessage(null);
		},
		[onChange],
	);

	const handleReset = useCallback(() => {
		const fallback = DEFAULT_ICON_BY_TYPE[type];
		onChange(fallback);
		onReset?.();
		setStatusMessage(null);
		setErrorMessage(null);
	}, [onChange, onReset, type]);

	const handleOpenChange = useCallback((open: boolean) => {
		if (!open) {
			setFilter("");
			setStatusMessage(null);
			setErrorMessage(null);
		}
		setIsOpen(open);
	}, []);

	const handleUploadClick = useCallback(async () => {
		console.log('[IconPicker] Upload button clicked', { isTauri });
		if (!isTauri) {
			console.error('[IconPicker] Not in Tauri environment');
			setErrorMessage("Custom uploads require the desktop runtime");
			return;
		}
		
		try {
			console.log('[IconPicker] Opening file dialog...');
			const { open } = await import('@tauri-apps/plugin-dialog');
			
			const selected = await open({
				multiple: false,
				filters: [{
					name: 'Icon Files',
					extensions: ['png', 'svg', 'jpg', 'jpeg', 'webp']
				}]
			});
			
			if (!selected) {
				console.log('[IconPicker] No file selected from dialog');
				return;
			}
			
			console.log('[IconPicker] File selected from dialog:', selected);
			await handleFileUpload(selected);
			
		} catch (error) {
			console.error('[IconPicker] Dialog error:', error);
			setErrorMessage('Failed to open file dialog');
		}
	}, []);

	const handleFileUpload = useCallback(async (filePath: string) => {
		try {
			console.log('[IconPicker] Processing file:', filePath);
			
			// Get file info using Tauri FS API
			const { readFile, stat } = await import('@tauri-apps/plugin-fs');
			const { basename } = await import('@tauri-apps/api/path');
			
			const fileName = await basename(filePath);
			const fileStats = await stat(filePath);
			const fileData = await readFile(filePath);
			
			console.log('[IconPicker] File info:', {
				name: fileName,
				size: fileStats.size,
				path: filePath
			});
			
			// Determine MIME type from extension
			const ext = fileName.toLowerCase().split('.').pop() || '';
			let mimeType = '';
			switch (ext) {
				case 'png': mimeType = 'image/png'; break;
				case 'jpg':
				case 'jpeg': mimeType = 'image/jpeg'; break;
				case 'svg': mimeType = 'image/svg+xml'; break;
				case 'webp': mimeType = 'image/webp'; break;
				default:
					setErrorMessage('Unsupported file type. Use PNG, SVG, JPEG, or WEBP.');
					return;
			}
			
			if (!ALLOWED_MIME_TYPES.has(mimeType)) {
				console.error('[IconPicker] Invalid MIME type:', mimeType);
				setErrorMessage("Unsupported icon format. Use PNG, SVG, JPEG, or WEBP.");
				return;
			}
			
			if (fileStats.size > MAX_ICON_FILE_SIZE) {
				console.error('[IconPicker] File too large:', fileStats.size, 'max:', MAX_ICON_FILE_SIZE);
				setErrorMessage("Icon file too large (max 512KB).");
				return;
			}
			
			console.log('[IconPicker] Starting upload...');
			setUploading(true);
			setErrorMessage(null);
			
			const bytes = Array.from(fileData);
			console.log('[IconPicker] File data ready, bytes:', bytes.length);
			
			const { invoke } = await import("@tauri-apps/api/core");
			console.log('[IconPicker] Invoking save_custom_icon command...');
			
			const result = await invoke<SaveIconResult>("save_custom_icon", {
				payload: {
					filename: fileName,
					data: bytes,
					mime_type: mimeType,
				},
			});
			console.log('[IconPicker] Backend returned:', result);
			
			if (!isCustomIconId(result.icon_id)) {
				throw new Error("Unexpected icon identifier returned from backend");
			}
			
			const customId = result.icon_id as CustomIconId;
			const displayLabel =
				result.label || deriveLabelFromFilename(result.filename);
			
			console.log('[IconPicker] Saving to database...', { customId, displayLabel });
			await runEffect(
				upsertCustomIcon({
					id: customId,
					filename: result.filename,
					mime_type: result.mime_type ?? mimeType,
					label: displayLabel,
				}),
			);
			console.log('[IconPicker] Database save complete');
			
			const newOption: CustomIconOption = {
				id: customId,
				label: displayLabel,
				filename: result.filename,
				mimeType: result.mime_type ?? mimeType,
			};
			
			console.log('[IconPicker] Updating UI state with new icon');
			setCustomIcons((previous) => {
				const remaining = previous.filter((option) => option.id !== customId);
				return [newOption, ...remaining];
			});
			
			onChange(customId);
			setStatusMessage(`Uploaded ${displayLabel}`);
			setErrorMessage(null);
			console.log('[IconPicker] Upload complete, refreshing icon list...');
			
			fetchCustomIcons()
				.then((options) => {
					setCustomIcons(options);
				})
				.catch((fetchError) => {
					console.warn("Failed to refresh custom icon list", fetchError);
				});
			
		} catch (error) {
			console.error("Failed to upload custom icon", error);
			const message =
				typeof error === "string"
					? error
					: error instanceof Error
						? error.message
						: "Failed to upload icon";
			setErrorMessage(message);
			setStatusMessage(null);
		} finally {
			setUploading(false);
		}
	}, [fetchCustomIcons, onChange, runEffect]);

	return (
		<div className={styles.pickerContainer}>
			<DialogTrigger onOpenChange={handleOpenChange}>
				<Button className={styles.trigger} aria-label="Select icon">
					<div className={styles.triggerIcon}>
						<Icon size={24} weight="duotone" />
					</div>
					<span>{resolvedLabel}</span>
				</Button>

				<Popover offset={8} className={styles.popoverContent}>
					<Dialog aria-label="Select node icon">
						{({ close }) => (
							<>
								<div className={styles.quickFilterRow}>
									<MagnifyingGlassIcon size={16} weight="bold" />
									<input
										type="search"
										className={styles.searchInput}
										placeholder="Filter icons"
										value={filter}
										onChange={(event) => setFilter(event.target.value)}
										autoFocus
									/>
								</div>

								<div className={styles.helperRow}>
									<span className={statusClass}>{statusContent}</span>
									<Button
										className={styles.footerButton}
										onPress={handleUploadClick}
										isDisabled={!isTauri || uploading}
									>
										<UploadSimpleIcon size={16} weight="bold" />
										{uploading ? "Uploading..." : "Upload icon"}
									</Button>
								</div>

								{isTauri && (
									<>
										{customLoading ? (
											<span className={styles.statusText}>Loading custom icons…</span>
										) : filteredCustomIcons.length > 0 ? (
											<>
												<div className={styles.sectionHeading}>Custom Icons</div>
												<div className={styles.iconGrid}>
													{filteredCustomIcons.map((option) => {
														const OptionIcon = getNodeIconComponent(
															option.id,
															type,
														);
														const isSelected = option.id === resolvedIconId;

														return (
															<Button
																key={option.id}
																type="button"
																className={styles.iconButton}
																data-selected={
																	isSelected ? "true" : undefined
																}
																aria-pressed={isSelected}
																aria-label={option.label}
																onPress={() => {
																	handleSelect(option.id);
																	close();
																}}
															>
																<OptionIcon size={20} weight="duotone" />
																<span>{option.label}</span>
															</Button>
														);
													})}
												</div>
											</>
										) : (
											<span className={styles.statusText}>No custom icons yet.</span>
										)}
									</>
								)}

								<div className={styles.sectionHeading}>Library Icons</div>
								<div className={styles.iconGrid}>
									{filteredBuiltIns.map((option) => {
										const OptionIcon = getNodeIconComponent(option.id, type);
										const isSelected = option.id === resolvedIconId;
										return (
											<Button
												key={option.id}
												type="button"
												className={styles.iconButton}
												data-selected={isSelected ? "true" : undefined}
												aria-pressed={isSelected}
												aria-label={option.label}
												onPress={() => {
													handleSelect(option.id);
													close();
												}}
											>
												<OptionIcon size={20} weight="duotone" />
												<span>{option.label}</span>
											</Button>
										);
									})}
								</div>

								<div className={styles.footerRow}>
									<Button
										className={styles.footerButton}
										onPress={() => {
											handleReset();
											close();
										}}
									>
										<CheckIcon size={16} weight="bold" /> Reset to default
									</Button>
									<Button className={styles.footerButton} onPress={() => close()}>
										<XIcon size={16} weight="bold" /> ESC
									</Button>
								</div>
							</>
						)}
					</Dialog>
				</Popover>
			</DialogTrigger>
		</div>
	);
}
