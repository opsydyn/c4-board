import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import {
	buildBalancedCouplingModel,
	type BalancedCouplingModel,
} from "../../core/balancedCoupling";

export const useBalancedCouplingModel = (
	nodes: Node[],
	edges: Edge[],
): BalancedCouplingModel =>
	useMemo(() => buildBalancedCouplingModel(nodes, edges), [nodes, edges]);
