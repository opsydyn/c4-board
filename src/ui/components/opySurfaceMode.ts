export type OpyHostMode = "closed" | "drawer" | "floating";

export const getNextOpySurfaceMode = (
  currentMode: "drawer" | "floating",
): "drawer" | "floating" => currentMode === "drawer" ? "floating" : "drawer";

export const resolveOpyHostMode = (input: {
  readonly isOpen: boolean;
  readonly surfaceMode: "drawer" | "floating";
}): OpyHostMode => {
  if (!input.isOpen) {
    return "closed";
  }
  return input.surfaceMode;
};
