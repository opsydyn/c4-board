import { useState, useCallback, useEffect } from "react";
import { Button, Dialog, Form, Input, Label, TextField } from "react-aria-components";
import {
	edgeEditorOverlay,
	edgeEditorDialog,
	edgeEditorTitle,
	edgeEditorField,
	edgeEditorLabel,
	edgeEditorInput,
	edgeEditorHint,
	edgeEditorError,
	edgeEditorButtons,
	edgeEditorButton,
	edgeEditorPrimaryButton,
} from "./EdgeLabelEditor.css";

interface EdgeLabelEditorProps {
	readonly edgeId: string | null;
	readonly currentLabel: string;
	readonly isOpen: boolean;
	readonly onClose: () => void;
	readonly onSave: (edgeId: string, label: string) => void;
}

export function EdgeLabelEditor({
	edgeId,
	currentLabel,
	isOpen,
	onClose,
	onSave,
}: EdgeLabelEditorProps) {
	const [label, setLabel] = useState(currentLabel);
	const [error, setError] = useState<string | null>(null);

	// Reset label when dialog opens with new edge
	useEffect(() => {
		if (isOpen) {
			setLabel(currentLabel);
			setError(null);
		}
	}, [isOpen, currentLabel]);

	const handleSave = useCallback(() => {
		if (!edgeId) return;

		const trimmed = label.trim();

		// Validate
		if (!trimmed) {
			setError("Label cannot be empty");
			return;
		}

		if (trimmed.length > 100) {
			setError("Label too long (max 100 characters)");
			return;
		}

		// Save
		onSave(edgeId, trimmed);
		onClose();
	}, [edgeId, label, onSave, onClose]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSave();
			} else if (e.key === "Escape") {
				onClose();
			}
		},
		[handleSave, onClose],
	);

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			handleSave();
		},
		[handleSave],
	);

	if (!isOpen || !edgeId) return null;

	return (
		<div className={edgeEditorOverlay} onClick={onClose}>
			<Dialog
				className={edgeEditorDialog}
				aria-label="Edit edge label"
			>
				<div onClick={(e) => e.stopPropagation()}>
					<h3 className={edgeEditorTitle}>Edit Relationship</h3>

					<Form onSubmit={handleSubmit}>
						<TextField
							className={edgeEditorField}
							isRequired
							validationBehavior="native"
						>
							<Label className={edgeEditorLabel}>Relationship Type</Label>
							<Input
								className={edgeEditorInput}
								value={label}
								onChange={(e) => {
									setLabel(e.target.value);
									setError(null);
								}}
								onKeyDown={handleKeyDown}
								placeholder="uses, calls, reads from, writes to..."
								autoFocus
							/>
							<p className={edgeEditorHint}>
								Describe how the source relates to the target
							</p>
						</TextField>

						{error && <div className={edgeEditorError}>{error}</div>}

						<div className={edgeEditorButtons}>
							<Button
								type="button"
								className={edgeEditorButton}
								onPress={onClose}
							>
								Cancel
							</Button>
							<Button type="submit" className={edgeEditorPrimaryButton}>
								Save
							</Button>
						</div>
					</Form>
				</div>
			</Dialog>
		</div>
	);
}
