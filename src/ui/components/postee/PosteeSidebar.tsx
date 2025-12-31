/**
 * PosteeSidebar Component
 *
 * Displays collections tree with requests, handles:
 * - Collection creation
 * - Collection selection/renaming/deletion
 * - Request selection
 * - Request status indicators
 */

import { useState, useCallback, useMemo, type FormEvent } from "react";
import type { Key, Selection } from "@react-types/shared";
import {
	Tree,
	TreeItem,
	TreeItemContent,
	ToggleButton,
	Button,
} from "react-aria-components";
import {
	CaretLeftIcon,
	FolderIcon,
	FileIcon,
	TrashSimpleIcon,
	PencilLineIcon,
	CaretRightIcon,
} from "@phosphor-icons/react";
import type {
	PosteeCollection,
	PosteeRequest,
} from "@/core/effects/database.postee";
import type { RequestStatus } from "@/core/effects/postee/status-derivation";
import type { CollectionId, RequestId } from "@/core/effects/postee/types";
import { InlineEditor } from "../nodes/InlineEditor";
import { PosteeSearchBox } from "./PosteeSearchBox";

import * as styles from "./PosteeWorkspace.css";
import * as layoutStyles from "../styles.css";

export interface PosteeSidebarProps {
	collections: PosteeCollection[];
	requestsByCollection: Record<string, PosteeRequest[]>;
	requestStatuses: Map<string, RequestStatus>;
	activeCollectionId: CollectionId | null;
	activeRequestId: RequestId | null;
	onCreateCollection: (name: string) => void;
	onSelectCollection: (collectionId: string) => void;
	onSelectRequest: (requestId: string) => void;
	onDeleteCollections: (collectionIds: string[]) => void;
	onRenameCollection: (collectionId: string, newName: string) => void;
	onToggleSidebar: () => void;
}

export function PosteeSidebar({
	collections,
	requestsByCollection,
	requestStatuses,
	activeCollectionId,
	onCreateCollection,
	onSelectCollection,
	onSelectRequest,
	onDeleteCollections,
	onRenameCollection,
	onToggleSidebar,
}: PosteeSidebarProps) {
	const [newCollectionName, setNewCollectionName] = useState("");
	const [expandedKeys, setExpandedKeys] = useState<Set<Key> | "all">(
		() => new Set<Key>(),
	);
	const [selectedTreeKeys, setSelectedTreeKeys] = useState<Selection>(
		() => new Set<Key>(),
	);
	const [isRenamingCollectionId, setRenamingCollectionId] = useState<
		string | null
	>(null);

	const statusColors: Record<"Success" | "Error" | "Unknown", string> = {
		Success: "var(--icon-success, #4CC38A)",
		Error: "var(--icon-error, #FF6B6B)",
		Unknown: "var(--icon-neutral, #8FD6FF)",
	};

	const requestStatusMap = useMemo(() => {
		const map = new Map<string, "Success" | "Error" | "Unknown">();
		requestStatuses.forEach((status, requestId) => {
			map.set(requestId, status._tag);
		});
		return map;
	}, [requestStatuses]);

	const requestCollectionMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const collection of collections) {
			for (const request of requestsByCollection[collection.id] ?? []) {
				map.set(request.id, collection.id);
			}
		}
		return map;
	}, [collections, requestsByCollection]);

	const activeCollectionKey = activeCollectionId
		? (activeCollectionId as unknown as string)
		: null;

	const handleCreateCollection = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const trimmed = newCollectionName.trim();
			const name = trimmed.length > 0 ? trimmed : "Untitled Collection";
			onCreateCollection(name);
			setNewCollectionName("");
		},
		[newCollectionName, onCreateCollection],
	);

	const handleTreeSelectionChange = useCallback(
		(keys: Selection) => {
			if (keys === "all") {
				setSelectedTreeKeys(keys);
				return;
			}

			setSelectedTreeKeys(keys);

			const iterator = keys.values();
			const first = iterator.next();
			if (first.done) {
				return;
			}

			const key = String(first.value);
			if (key.startsWith("collection:")) {
				const collectionId = key.replace("collection:", "");
				onSelectCollection(collectionId);
				setRenamingCollectionId(null);
			} else if (key.startsWith("request:")) {
				const requestId = key.replace("request:", "");
				const collectionId = requestCollectionMap.get(requestId);
				if (collectionId && collectionId !== activeCollectionKey) {
					onSelectCollection(collectionId);
				}
				onSelectRequest(requestId);
				setRenamingCollectionId(null);
			}
		},
		[
			onSelectCollection,
			onSelectRequest,
			requestCollectionMap,
			activeCollectionKey,
		],
	);

	const handleExpandedChange = useCallback((keys: Iterable<Key> | "all") => {
		if (keys === "all") {
			setExpandedKeys("all");
			return;
		}

		setExpandedKeys(new Set(keys));
	}, []);

	const selectedCollectionIds = useMemo(() => {
		if (selectedTreeKeys === "all") {
			return collections.map((collection) => collection.id);
		}

		const ids: string[] = [];
		selectedTreeKeys.forEach((key) => {
			if (typeof key === "string" && key.startsWith("collection:")) {
				ids.push(key.replace("collection:", ""));
			}
		});
		return ids;
	}, [selectedTreeKeys, collections]);

	const canRenameCollection = selectedCollectionIds.length === 1;
	const canDeleteCollections = selectedCollectionIds.length > 0;
	const selectionCount = selectedCollectionIds.length;

	const handleStartRename = useCallback(() => {
		if (!canRenameCollection) {
			return;
		}

		setRenamingCollectionId(selectedCollectionIds[0] ?? null);
	}, [canRenameCollection, selectedCollectionIds]);

	const handleDeleteCollections = useCallback(() => {
		if (!canDeleteCollections) {
			return;
		}

		onDeleteCollections(selectedCollectionIds);
	}, [canDeleteCollections, selectedCollectionIds, onDeleteCollections]);

	const handleRenameSubmit = useCallback(
		(collectionId: string, newName: string) => {
			onRenameCollection(collectionId, newName);
			setRenamingCollectionId(null);
		},
		[onRenameCollection],
	);

	return (
		<aside className={styles.sidebar} aria-label="Collections panel">
			<div className={layoutStyles.panelHeader}>
				<ToggleButton
					isSelected={true}
					onChange={onToggleSidebar}
					className={layoutStyles.collapseToggle}
					aria-label="Collapse collections panel"
				>
					<CaretLeftIcon size={16} weight="bold" />
					Hide
				</ToggleButton>
			</div>
			<header className={styles.branding}>
				<span>Postee Collections</span>
				<span>
					<a href="/">C4:BOARD</a>
				</span>
				<span>{collections.length}</span>
			</header>

			<PosteeSearchBox
				collections={collections}
				requestsByCollection={requestsByCollection}
				onSelectCollection={onSelectCollection}
				onSelectRequest={onSelectRequest}
			/>

			<form className={styles.collectionForm} onSubmit={handleCreateCollection}>
				<input
					className={styles.textInput}
					type="text"
					placeholder="New collection name"
					value={newCollectionName}
					onChange={(event) => setNewCollectionName(event.target.value)}
					aria-label="New collection name"
				/>
				<button
					className={styles.submitButton}
					type="submit"
					disabled={!newCollectionName.trim()}
				>
					Add Collection
				</button>
			</form>

			{selectionCount > 0 && (
				<div className={styles.selectionToolbar}>
					<span>
						{selectionCount} collection
						{selectionCount === 1 ? "" : "s"} selected
					</span>
					<div style={{ display: "flex", gap: "0.5rem" }}>
						<button
							type="button"
							className={styles.selectionToolbarButton}
							onClick={handleStartRename}
							disabled={!canRenameCollection}
							aria-label="Rename collection"
						>
							<PencilLineIcon size={14} weight="bold" />
							<span>Rename</span>
						</button>
						<button
							type="button"
							className={styles.selectionToolbarButton}
							onClick={handleDeleteCollections}
							disabled={!canDeleteCollections}
							aria-label="Delete selected collections"
						>
							<TrashSimpleIcon size={14} weight="bold" />
							<span>Delete ({selectionCount})</span>
						</button>
					</div>
				</div>
			)}

			<div className={styles.collectionTree}>
				{collections.length === 0 ? (
					<div className={styles.emptyState}>
						<strong>No collections</strong>
						<span>Create your first collection to get started.</span>
					</div>
				) : (
					<Tree
						aria-label="Collections and requests"
						selectionMode="multiple"
						expandedKeys={expandedKeys}
						onExpandedChange={handleExpandedChange}
						selectedKeys={selectedTreeKeys}
						onSelectionChange={handleTreeSelectionChange}
					>
						{collections.map((collection) => {
							const collectionRequests =
								requestsByCollection[collection.id] ?? [];
							const isRenaming = isRenamingCollectionId === collection.id;

							return (
								<TreeItem
									key={`collection:${collection.id}`}
									id={`collection:${collection.id}`}
									textValue={collection.name}
								>
									<TreeItemContent>
										{(renderProps) => (
											<div className={styles.treeCollectionRow}>
												<Button
													slot="chevron"
													aria-label="Expand/collapse collection"
													className={styles.treeChevronButton}
													data-expanded={renderProps.isExpanded || undefined}
												>
													<CaretRightIcon size={14} weight="bold" />
												</Button>
												<span className={styles.treeIcon}>
													<FolderIcon
														size={18}
														weight="duotone"
													/>
												</span>
												{isRenaming ? (
													<InlineEditor
														value={collection.name}
														mode="plain"
														onSave={(newName: string) =>
															handleRenameSubmit(collection.id, newName)
														}
														onCancel={() => setRenamingCollectionId(null)}
														autoFocus
													/>
												) : (
													<>
														<span>{collection.name}</span>
														<span style={{ marginLeft: "auto", opacity: 0.6 }}>
															{collectionRequests.length}
														</span>
													</>
												)}
											</div>
										)}
									</TreeItemContent>
									{collectionRequests.map((request) => {
										const requestStatus =
											requestStatusMap.get(request.id) ?? "Unknown";
										const requestColor =
											statusColors[requestStatus] ?? statusColors.Unknown;
										return (
											<TreeItem
												key={`request:${request.id}`}
												id={`request:${request.id}`}
												textValue={`${request.method} ${request.name}`}
											>
												<TreeItemContent>
													{(itemProps) => (
														<div
															className={styles.treeRequestRow}
															data-selected={itemProps.isSelected || undefined}
														>
															<span className={styles.treeIcon}>
																<FileIcon
																	size={18}
																	weight="duotone"
																	color={requestColor}
																/>
															</span>
															<span className={styles.treeMethodBadge}>
																{request.method}
															</span>
															<span className={styles.treeRequestName}>
																{request.name}
															</span>
														</div>
													)}
												</TreeItemContent>
											</TreeItem>
										);
									})}
								</TreeItem>
							);
						})}
					</Tree>
				)}
			</div>
		</aside>
	);
}
