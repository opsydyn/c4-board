import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import {
	buildBalancedCouplingModel,
	type BalancedCouplingModel,
} from "../../core/balancedCoupling";
import type { DiagramDomain } from "../machines/canvas.machine";
import type { NodeData } from "../../core/effects/node-operations";

const isC4Type = (value: unknown): boolean => {
	const c4Types = ["person", "system", "externalSystem", "container", "component"];
	return typeof value === "string" && c4Types.includes(value);
};

const isDDDType = (value: unknown): boolean => {
	const dddTypes = [
		"boundedContext", "aggregate", "domainEvent",
		"entity", "valueObject", "domainService", "repository", "factory",
		"command", "query", "applicationService",
		"integrationEvent", "antiCorruptionLayer", "saga"
	];
	return typeof value === "string" && dddTypes.includes(value);
};

export const useBalancedCouplingModel = (
	nodes: Node[],
	edges: Edge[],
	domain: DiagramDomain,
): BalancedCouplingModel =>
	useMemo(() => {
		// Filter nodes based on domain
		const filteredNodes = nodes.filter((node) => {
			const data = (node.data ?? {}) as Partial<NodeData>;
			const nodeType = data.c4Type ?? data.dddType ?? node.type;

			if (domain === "c4") {
				return isC4Type(nodeType);
			} else if (domain === "ddd") {
				return isDDDType(nodeType);
			}
			// domain === "combined" - show all
			return true;
		});

		return buildBalancedCouplingModel(filteredNodes, edges);
	}, [nodes, edges, domain]);
