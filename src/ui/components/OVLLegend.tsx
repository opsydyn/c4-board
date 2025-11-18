/**
 * OVLLegend - OPSYDYN Visual Language Legend
 *
 * Interactive visual guide showing edge metadata encoding:
 * - Protocol colors (grpc, https, mcp, kafka, etc.)
 * - Communication styles (synchronous, asynchronous, optional)
 * - Animation speeds (none, slow, medium, fast, auto)
 * - Request volume visualization
 */

import { useMemo } from "react";
import { Group } from "@visx/group";
import { scaleOrdinal } from "@visx/scale";
import { LegendOrdinal } from "@visx/legend";
import { theme } from "../../styles/theme.css";
import {
	PROTOCOL_COLOR_MAP,
	EDGE_STYLE_MAP,
	ANIMATION_SPEED_MAP,
	type EdgeProtocol,
	type EdgeCommunicationStyle,
} from "../../core/effects/edge-operations";
import {
	ovlLegendCard,
	ovlLegendHeader,
	ovlLegendTitle,
	ovlLegendSubtitle,
	ovlLegendCanvas,
	ovlLegendSection,
	ovlLegendSectionTitle,
	ovlLegendGrid,
	ovlLegendItem,
	ovlLegendLabel,
	ovlLegendRow,
	ovlLegendGroup,
} from "./OVLLegend.css";

interface EdgeSampleProps {
	color: string;
	strokeDasharray?: string;
	strokeWidth?: number;
	animated?: boolean;
	label: string;
}

const EdgeSample = ({
	color,
	strokeDasharray = "none",
	strokeWidth = 2,
	animated = false,
	label,
}: EdgeSampleProps) => {
	return (
		<svg width={180} height={40} style={{ overflow: "visible" }}>
			<Group top={20} left={10}>
				{/* Edge line */}
				<line
					x1={0}
					y1={0}
					x2={120}
					y2={0}
					stroke={color}
					strokeWidth={strokeWidth}
					strokeDasharray={strokeDasharray}
					strokeLinecap="round"
				/>

				{/* Arrow marker */}
				<polygon
					points="120,0 112,-4 112,4"
					fill={color}
				/>

				{/* Animated particle */}
				{animated && (
					<circle r={3} fill={color} opacity={0.8}>
						<animateMotion
							dur="2000ms"
							repeatCount="indefinite"
							path="M 0,0 L 120,0"
						/>
					</circle>
				)}

				{/* Label */}
				<text
					x={130}
					y={0}
					dominantBaseline="middle"
					fill={theme.color.foreground.secondary}
					fontFamily={theme.typography.family.mono}
					fontSize={10}
				>
					{label}
				</text>
			</Group>
		</svg>
	);
};

export function OVLLegend() {
	// Protocol colors scale
	const protocolScale = useMemo(() => {
		const protocols: EdgeProtocol[] = ["grpc", "https", "mcp", "graphql", "kafka", "websocket"];
		const colors = protocols.map((p) => PROTOCOL_COLOR_MAP[p]);

		return scaleOrdinal<string, string>({
			domain: protocols.map((p) => p.toUpperCase()),
			range: colors,
		});
	}, []);

	// Communication styles
	const communicationStyles: Array<{
		type: EdgeCommunicationStyle;
		label: string;
		description: string;
	}> = [
		{
			type: "synchronous",
			label: "Synchronous",
			description: "Request-response, blocking",
		},
		{
			type: "asynchronous",
			label: "Asynchronous",
			description: "Fire-and-forget, non-blocking",
		},
		{
			type: "optional",
			label: "Optional",
			description: "Degradable dependency",
		},
	];

	// Animation speeds
	const animationSpeeds: Array<{
		speed: keyof typeof ANIMATION_SPEED_MAP;
		label: string;
		description: string;
	}> = [
		{ speed: "slow", label: "Slow", description: "< 10 req/s" },
		{ speed: "medium", label: "Medium", description: "10-100 req/s" },
		{ speed: "fast", label: "Fast", description: "> 100 req/s" },
		{ speed: "auto", label: "Auto", description: "Volume-based" },
	];

	return (
		<div className={ovlLegendCard}>
			<div className={ovlLegendHeader}>
				<h3 className={ovlLegendTitle}>OPSYDYN Visual Language</h3>
				<p className={ovlLegendSubtitle}>
					Edge metadata visual encoding system for C4 and DDD diagrams
				</p>
			</div>

			<div className={ovlLegendCanvas}>
				{/* Protocol Colors Section */}
				<div className={ovlLegendSection}>
					<h4 className={ovlLegendSectionTitle}>Protocol → Color</h4>
					<div className={ovlLegendRow}>
						<LegendOrdinal scale={protocolScale} direction="row" itemMargin="0 20px 8px 0">
							{(legend) => (
								<div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
									{legend.map((item, i) => (
										<span
											key={`protocol-${item.datum}-${i}`}
											style={{
												color: item.value,
												fontFamily: theme.typography.family.mono,
												fontSize: "11px",
												fontWeight: 600,
											}}
										>
											● {item.datum}
										</span>
									))}
								</div>
							)}
						</LegendOrdinal>
					</div>
				</div>

				{/* Communication Styles Section */}
				<div className={ovlLegendSection}>
					<h4 className={ovlLegendSectionTitle}>Communication Style → Line Pattern</h4>
					<div className={ovlLegendGrid}>
						{communicationStyles.map((style) => (
							<div key={style.type} className={ovlLegendItem}>
								<EdgeSample
									color={theme.color.foreground.primary}
									strokeDasharray={EDGE_STYLE_MAP[style.type]}
									label={style.label}
								/>
								<span className={ovlLegendLabel}>{style.description}</span>
							</div>
						))}
					</div>
				</div>

				{/* Request Volume Section */}
				<div className={ovlLegendSection}>
					<h4 className={ovlLegendSectionTitle}>Request Volume → Thickness</h4>
					<div className={ovlLegendGrid}>
						<div className={ovlLegendItem}>
							<EdgeSample
								color={PROTOCOL_COLOR_MAP.grpc}
								strokeWidth={1}
								label="Low (< 10 req/s)"
							/>
						</div>
						<div className={ovlLegendItem}>
							<EdgeSample
								color={PROTOCOL_COLOR_MAP.grpc}
								strokeWidth={2}
								label="Medium (10-100)"
							/>
						</div>
						<div className={ovlLegendItem}>
							<EdgeSample
								color={PROTOCOL_COLOR_MAP.grpc}
								strokeWidth={4}
								label="High (> 100 req/s)"
							/>
						</div>
					</div>
				</div>

				{/* Animation Section */}
				<div className={ovlLegendSection}>
					<h4 className={ovlLegendSectionTitle}>Animation → Traffic Flow</h4>
					<div className={ovlLegendGrid}>
						{animationSpeeds.map((anim) => {
							const duration = ANIMATION_SPEED_MAP[anim.speed];
							return (
								<div key={anim.speed} className={ovlLegendItem}>
									<EdgeSample
										color={PROTOCOL_COLOR_MAP.mcp}
										animated={duration !== null}
										label={anim.label}
									/>
									<span className={ovlLegendLabel}>{anim.description}</span>
								</div>
							);
						})}
					</div>
				</div>

				{/* Key Protocols Reference */}
				<div className={ovlLegendSection}>
					<h4 className={ovlLegendSectionTitle}>Key Protocols</h4>
					<div className={ovlLegendGrid} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
						<div className={ovlLegendGroup}>
							<EdgeSample color={PROTOCOL_COLOR_MAP.grpc} label="gRPC" strokeWidth={3} />
							<span className={ovlLegendLabel} style={{ marginLeft: "8px" }}>
								High-performance RPC
							</span>
						</div>
						<div className={ovlLegendGroup}>
							<EdgeSample color={PROTOCOL_COLOR_MAP.https} label="HTTPS" strokeWidth={2} />
							<span className={ovlLegendLabel} style={{ marginLeft: "8px" }}>
								Secure HTTP REST
							</span>
						</div>
						<div className={ovlLegendGroup}>
							<EdgeSample color={PROTOCOL_COLOR_MAP.mcp} label="MCP" strokeWidth={2} animated />
							<span className={ovlLegendLabel} style={{ marginLeft: "8px" }}>
								Model Context Protocol
							</span>
						</div>
						<div className={ovlLegendGroup}>
							<EdgeSample color={PROTOCOL_COLOR_MAP.kafka} label="Kafka" strokeWidth={3} />
							<span className={ovlLegendLabel} style={{ marginLeft: "8px" }}>
								Event streaming
							</span>
						</div>
						<div className={ovlLegendGroup}>
							<EdgeSample color={PROTOCOL_COLOR_MAP.graphql} label="GraphQL" strokeWidth={2} />
							<span className={ovlLegendLabel} style={{ marginLeft: "8px" }}>
								Query language API
							</span>
						</div>
						<div className={ovlLegendGroup}>
							<EdgeSample color={PROTOCOL_COLOR_MAP.websocket} label="WebSocket" strokeWidth={2} />
							<span className={ovlLegendLabel} style={{ marginLeft: "8px" }}>
								Real-time bidirectional
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
