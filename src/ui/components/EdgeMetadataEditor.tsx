import { useCallback, useEffect, useState } from "react";
import { Button, Dialog, Form, Input, Label, TextField } from "react-aria-components";
import type {
  EdgeAnimationSpeed,
  EdgeCommunicationStyle,
  EdgeMetadata,
  EdgeProtocol,
} from "../../core/effects/edge-operations";
import {
  edgeEditorButton,
  edgeEditorButtons,
  edgeEditorContent,
  edgeEditorDialog,
  edgeEditorError,
  edgeEditorField,
  edgeEditorHint,
  edgeEditorInput,
  edgeEditorLabel,
  edgeEditorOverlay,
  edgeEditorPrimaryButton,
  edgeEditorTitle,
} from "./EdgeLabelEditor.css";
import type { TacticalSelectOption } from "./TacticalSelect";
import { TacticalSelect } from "./TacticalSelect";

interface EdgeMetadataEditorProps {
  readonly edgeId: string | null;
  readonly currentLabel: string;
  readonly currentMetadata?: EdgeMetadata | undefined;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (
    edgeId: string,
    label: string,
    metadata: EdgeMetadata,
  ) => void;
}

const PROTOCOLS: EdgeProtocol[] = [
  "http",
  "https",
  "grpc",
  "graphql",
  "websocket",
  "mcp", // Model Context Protocol
  "kafka",
  "rabbitmq",
  "redis",
  "rest",
  "soap",
  "tcp",
  "udp",
  "custom",
];

const COMMUNICATION_STYLES: { value: EdgeCommunicationStyle; label: string }[] = [
  { value: "synchronous", label: "Synchronous (Solid line)" },
  { value: "asynchronous", label: "Asynchronous (Dashed line)" },
  { value: "optional", label: "Optional (Dotted line)" },
];

const ANIMATION_SPEEDS: { value: EdgeAnimationSpeed; label: string }[] = [
  { value: "none", label: "No Animation" },
  { value: "slow", label: "Slow (3s)" },
  { value: "medium", label: "Medium (1.5s)" },
  { value: "fast", label: "Fast (0.75s)" },
  { value: "auto", label: "Auto (based on volume)" },
];

const PROTOCOL_OPTIONS: TacticalSelectOption[] = [
  { value: "", label: "None" },
  ...PROTOCOLS.map((protocol) => ({
    value: protocol,
    label: protocol.toUpperCase(),
  })),
];

const COMMUNICATION_STYLE_OPTIONS: TacticalSelectOption[] = COMMUNICATION_STYLES.map((style) => ({
  value: style.value,
  label: style.label,
}));

const ANIMATION_SPEED_OPTIONS: TacticalSelectOption[] = ANIMATION_SPEEDS.map(
  (speed) => ({
    value: speed.value,
    label: speed.label,
  }),
);

export function EdgeMetadataEditor({
  edgeId,
  currentLabel,
  currentMetadata,
  isOpen,
  onClose,
  onSave,
}: EdgeMetadataEditorProps) {
  const [label, setLabel] = useState(currentLabel);
  const [protocol, setProtocol] = useState<EdgeProtocol | undefined>(
    currentMetadata?.protocol,
  );
  const [communicationStyle, setCommunicationStyle] = useState<
    EdgeCommunicationStyle | undefined
  >(currentMetadata?.communicationStyle ?? "synchronous");
  const [requestVolume, setRequestVolume] = useState<string>(
    currentMetadata?.requestVolume?.toString() ?? "",
  );
  const [latency, setLatency] = useState<string>(
    currentMetadata?.latency?.toString() ?? "",
  );
  const [animationSpeed, setAnimationSpeed] = useState<EdgeAnimationSpeed>(
    currentMetadata?.animationSpeed ?? "none",
  );
  const [notes, setNotes] = useState<string>(currentMetadata?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with new edge
  useEffect(() => {
    if (isOpen) {
      setLabel(currentLabel);
      setProtocol(currentMetadata?.protocol);
      setCommunicationStyle(
        currentMetadata?.communicationStyle ?? "synchronous",
      );
      setRequestVolume(currentMetadata?.requestVolume?.toString() ?? "");
      setLatency(currentMetadata?.latency?.toString() ?? "");
      setAnimationSpeed(currentMetadata?.animationSpeed ?? "none");
      setNotes(currentMetadata?.notes ?? "");
      setError(null);
    }
  }, [isOpen, currentLabel, currentMetadata]);

  const handleSave = useCallback(() => {
    if (!edgeId) return;

    const trimmedLabel = label.trim();

    // Validate label
    if (!trimmedLabel) {
      setError("Label cannot be empty");
      return;
    }

    if (trimmedLabel.length > 100) {
      setError("Label too long (max 100 characters)");
      return;
    }

    // Validate numbers
    const parsedVolume = requestVolume
      ? Number.parseFloat(requestVolume)
      : undefined;
    const parsedLatency = latency ? Number.parseFloat(latency) : undefined;

    if (requestVolume && Number.isNaN(parsedVolume)) {
      setError("Request volume must be a valid number");
      return;
    }

    if (latency && Number.isNaN(parsedLatency)) {
      setError("Latency must be a valid number");
      return;
    }

    // Build metadata with explicit undefined values
    const metadata: EdgeMetadata = {
      protocol: protocol ?? undefined,
      communicationStyle: communicationStyle ?? undefined,
      requestVolume: parsedVolume ?? undefined,
      latency: parsedLatency ?? undefined,
      animationSpeed: animationSpeed ?? undefined,
      notes: (notes.trim() || undefined) as string | undefined,
    };

    // Save
    onSave(edgeId, trimmedLabel, metadata);
    onClose();
  }, [
    edgeId,
    label,
    protocol,
    communicationStyle,
    requestVolume,
    latency,
    animationSpeed,
    notes,
    onSave,
    onClose,
  ]);

  const handleSubmit = useCallback(
    (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSave();
    },
    [handleSave],
  );

  if (!isOpen || !edgeId) return null;

  return (
    <div className={edgeEditorOverlay} onClick={onClose}>
      <Dialog className={edgeEditorDialog} aria-label="Edit edge metadata">
        <div className={edgeEditorContent} onClick={(e) => e.stopPropagation()}>
          <h3 className={edgeEditorTitle}>Edit Relationship</h3>

          <Form onSubmit={handleSubmit}>
            {/* Label Field */}
            <TextField className={edgeEditorField} isRequired>
              <Label className={edgeEditorLabel}>Relationship Type</Label>
              <Input
                className={edgeEditorInput}
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setError(null);
                }}
                placeholder="uses, calls, reads from, writes to..."
                autoFocus
              />
              <p className={edgeEditorHint}>
                Describe how the source relates to the target
              </p>
            </TextField>

            {/* Protocol Select */}
            <div className={edgeEditorField}>
              <Label className={edgeEditorLabel} htmlFor="edge-protocol">
                Protocol
              </Label>
              <TacticalSelect
                id="edge-protocol"
                ariaLabel="Edge protocol"
                value={protocol ?? ""}
                options={PROTOCOL_OPTIONS}
                onChange={(nextValue) => setProtocol(nextValue === "" ? undefined : (nextValue as EdgeProtocol))}
              />
              <p className={edgeEditorHint}>Communication protocol used</p>
            </div>

            {/* Communication Style Select */}
            <div className={edgeEditorField}>
              <Label className={edgeEditorLabel} htmlFor="edge-communication-style">
                Communication Style
              </Label>
              <TacticalSelect
                id="edge-communication-style"
                ariaLabel="Edge communication style"
                value={communicationStyle ?? "synchronous"}
                options={COMMUNICATION_STYLE_OPTIONS}
                onChange={(nextValue) => setCommunicationStyle(nextValue as EdgeCommunicationStyle)}
              />
              <p className={edgeEditorHint}>
                Affects line style (solid/dashed/dotted)
              </p>
            </div>

            {/* Request Volume */}
            <TextField className={edgeEditorField}>
              <Label className={edgeEditorLabel}>
                Request Volume (req/sec)
              </Label>
              <Input
                className={edgeEditorInput}
                type="number"
                min="0"
                step="0.1"
                value={requestVolume}
                onChange={(e) => {
                  setRequestVolume(e.target.value);
                  setError(null);
                }}
                placeholder="e.g., 100"
              />
              <p className={edgeEditorHint}>
                Affects line thickness (higher = thicker)
              </p>
            </TextField>

            {/* Latency */}
            <TextField className={edgeEditorField}>
              <Label className={edgeEditorLabel}>Latency (ms)</Label>
              <Input
                className={edgeEditorInput}
                type="number"
                min="0"
                step="0.1"
                value={latency}
                onChange={(e) => {
                  setLatency(e.target.value);
                  setError(null);
                }}
                placeholder="e.g., 50"
              />
              <p className={edgeEditorHint}>Average response time</p>
            </TextField>

            {/* Animation Speed */}
            <div className={edgeEditorField}>
              <Label className={edgeEditorLabel} htmlFor="edge-animation-speed">
                Animation Speed
              </Label>
              <TacticalSelect
                id="edge-animation-speed"
                ariaLabel="Edge animation speed"
                value={animationSpeed}
                options={ANIMATION_SPEED_OPTIONS}
                onChange={(nextValue) => setAnimationSpeed(nextValue as EdgeAnimationSpeed)}
              />
              <p className={edgeEditorHint}>
                Animated data flow visualization (particles along edge)
              </p>
            </div>

            {/* Notes */}
            <TextField className={edgeEditorField}>
              <Label className={edgeEditorLabel}>Notes</Label>
              <textarea
                className={edgeEditorInput}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                style={{ resize: "vertical" }}
              />
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
