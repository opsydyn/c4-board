import { Handle, Position } from "@xyflow/react";
import type { CSSProperties } from "react";

const layoutOnlyHandleStyle: CSSProperties = {
  opacity: 0,
  pointerEvents: "none",
};

export function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        isConnectable={false}
        style={layoutOnlyHandleStyle}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        isConnectable={false}
        style={layoutOnlyHandleStyle}
      />

      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        isConnectable={false}
        style={layoutOnlyHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        isConnectable={false}
        style={layoutOnlyHandleStyle}
      />
    </>
  );
}
