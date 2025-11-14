/**
 * Database Test Component
 *
 * Demonstrates basic CRUD operations with Effect-TS + Tauri SQL
 * Following Functional Core, Imperative Shell pattern
 */

import { useEffect, useState } from "react";
import { useDatabase } from "../core/effects/useDatabase";
import {
	initDatabase,
	createDiagram,
	listDiagrams,
	createNode,
	getNodesByDiagram,
	type Diagram,
	type Node,
} from "../core/effects/database";

export function DatabaseTest() {
	const { runEffect } = useDatabase();
	const [diagrams, setDiagrams] = useState<Diagram[]>([]);
	const [nodes, setNodes] = useState<Node[]>([]);
	const [status, setStatus] = useState<string>("Idle");
	const [error, setError] = useState<string | null>(null);

	// Initialize database on mount
	useEffect(() => {
		runEffect(initDatabase)
			.then(() => setStatus("Database initialized"))
			.catch((err) => setError(String(err)));
	}, [runEffect]);

	const handleCreateDiagram = async () => {
		try {
			setStatus("Creating diagram...");
			const diagram = await runEffect(
				createDiagram({
					id: `diagram-${Date.now()}`,
					name: "My C4 Diagram",
					description: "Test diagram created from frontend",
				}),
			);
			setStatus(`Created: ${diagram.name}`);
			loadDiagrams();
		} catch (err) {
			setError(String(err));
		}
	};

	const handleCreateNode = async (diagramId: string) => {
		try {
			setStatus("Creating node...");
			const node = await runEffect(
				createNode({
					id: `node-${Date.now()}`,
					diagram_id: diagramId,
					domain: "c4",
					type: "person",
					label: "Test User",
					technology: "Human",
					description: "A test user node",
					position_x: 100,
					position_y: 100,
				}),
			);
			setStatus(`Created node: ${node.label}`);
			loadNodes(diagramId);
		} catch (err) {
			setError(String(err));
		}
	};

	const loadDiagrams = async () => {
		try {
			const allDiagrams = await runEffect(listDiagrams());
			setDiagrams(allDiagrams);
		} catch (err) {
			setError(String(err));
		}
	};

	const loadNodes = async (diagramId: string) => {
		try {
			const diagramNodes = await runEffect(getNodesByDiagram(diagramId));
			setNodes(diagramNodes);
		} catch (err) {
			setError(String(err));
		}
	};

	return (
		<div style={{ padding: "20px", fontFamily: "monospace" }}>
			<h1>Database CRUD Test</h1>

			<div style={{ marginBottom: "20px" }}>
				<strong>Status:</strong> {status}
			</div>

			{error && (
				<div style={{ color: "red", marginBottom: "20px" }}>
					<strong>Error:</strong> {error}
				</div>
			)}

			<div style={{ marginBottom: "20px" }}>
				<button onClick={handleCreateDiagram} style={{ marginRight: "10px" }}>
					Create Diagram
				</button>
				<button onClick={loadDiagrams}>Load Diagrams</button>
			</div>

			<div>
				<h2>Diagrams ({diagrams.length})</h2>
				{diagrams.map((diagram) => (
					<div
						key={diagram.id}
						style={{
							border: "1px solid #ccc",
							padding: "10px",
							marginBottom: "10px",
						}}
					>
						<div>
							<strong>{diagram.name}</strong>
						</div>
						<div>ID: {diagram.id}</div>
						<div>Description: {diagram.description ?? "None"}</div>
						<div>
							<button onClick={() => handleCreateNode(diagram.id)}>
								Add Node
							</button>
							<button onClick={() => loadNodes(diagram.id)}>Load Nodes</button>
						</div>
					</div>
				))}
			</div>

			<div>
				<h2>Nodes ({nodes.length})</h2>
				{nodes.map((node) => (
					<div
						key={node.id}
						style={{
							border: "1px solid #aaa",
							padding: "10px",
							marginBottom: "10px",
						}}
					>
						<div>
							<strong>{node.label}</strong> ({node.type})
						</div>
						<div>Position: ({node.position_x}, {node.position_y})</div>
						<div>Technology: {node.technology ?? "None"}</div>
						<div>Description: {node.description ?? "None"}</div>
						<div>
							Size: {node.width ?? "auto"} × {node.height ?? "auto"}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
