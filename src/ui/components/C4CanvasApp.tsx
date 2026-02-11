import { AppErrorBoundary } from "./AppErrorBoundary";
import { C4CanvasContainer } from "./C4CanvasContainer";

export function C4CanvasApp() {
  return (
    <AppErrorBoundary
      title="OPSYDYN // C4 WORKSPACE ERROR"
      subtitle="The C4 surface failed during rendering. Diagnostics are available below."
    >
      <C4CanvasContainer />
    </AppErrorBoundary>
  );
}
