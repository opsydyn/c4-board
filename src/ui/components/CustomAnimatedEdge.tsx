/**
 * CustomAnimatedEdge - Advanced edge component with flowing particles and pulsing arrows
 *
 * Features:
 * - Flowing particles along the edge path (data flow visualization)
 * - Pulsing directional arrow
 * - Particle count based on request volume
 * - Animation speed based on metadata
 */

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { EdgeData } from '../../core/effects/edge-operations';

export function CustomAnimatedEdge({
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	style = {},
	markerEnd,
	label,
	labelStyle,
	labelBgStyle,
	data,
}: EdgeProps) {
	const edgeData = data as EdgeData | undefined;
	const metadata = edgeData?.metadata;

	// Get edge path - using smoothstep for better routing
	const [edgePath, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	// Calculate animation parameters
	const animationSpeed = metadata?.animationSpeed ?? 'none';
	const requestVolume = metadata?.requestVolume ?? 0;

	// Determine if edge should animate
	const shouldAnimate = animationSpeed !== 'none';

	// Calculate animation duration based on speed
	let duration = 1500; // Default medium speed
	if (animationSpeed === 'slow') duration = 3000;
	if (animationSpeed === 'medium') duration = 1500;
	if (animationSpeed === 'fast') duration = 750;
	if (animationSpeed === 'auto') {
		// Auto-calculate based on volume
		if (requestVolume < 10) duration = 3000;
		else if (requestVolume < 100) duration = 1500;
		else if (requestVolume < 1000) duration = 750;
		else duration = 500;
	}

	// Calculate number of particles based on request volume
	let particleCount = 1;
	if (requestVolume > 10) particleCount = 2;
	if (requestVolume > 100) particleCount = 3;
	if (requestVolume > 500) particleCount = 4;
	if (requestVolume > 1000) particleCount = 5;

	// Get stroke color from style
	const strokeColor = (style?.stroke as string) ?? '#666666';

	// Generate particles with staggered delays
	const particles = shouldAnimate
		? Array.from({ length: particleCount }, (_, i) => {
				const delay = (i * duration) / particleCount;
				return (
					<circle
						key={`particle-${i}`}
						r={3}
						fill={strokeColor}
						opacity={0.8}
					>
						<animateMotion
							dur={`${duration}ms`}
							repeatCount="indefinite"
							path={edgePath}
							begin={`${delay}ms`}
						/>
					</circle>
				);
			})
		: [];

	return (
		<>
			{/* Base edge path with marker */}
			<BaseEdge
				path={edgePath}
				{...(markerEnd && { markerEnd })}
			/>
			{/* Styled edge path overlay */}
			<path
				d={edgePath}
				style={style}
				fill="none"
				className="react-flow__edge-path"
			/>

			{/* Flowing particles */}
			{particles}

			{/* Pulsing arrow indicator (additional visual at midpoint) */}
			{shouldAnimate && (
				<>
					{/* Calculate midpoint of path for pulsing arrow */}
					<circle
						cx={labelX}
						cy={labelY}
						r={6}
						fill={strokeColor}
						opacity={0.6}
					>
						{/* Pulse animation */}
						<animate
							attributeName="r"
							values="4;7;4"
							dur={`${duration * 2}ms`}
							repeatCount="indefinite"
						/>
						<animate
							attributeName="opacity"
							values="0.3;0.8;0.3"
							dur={`${duration * 2}ms`}
							repeatCount="indefinite"
						/>
					</circle>
				</>
			)}

			{/* Edge label (if provided) */}
			{label && (
				<EdgeLabelRenderer>
					<div
						style={{
							position: 'absolute',
							transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
							pointerEvents: 'all',
							...labelStyle,
						}}
						className="nodrag nopan"
					>
						<div
							style={{
								padding: '2px 6px',
								borderRadius: '3px',
								fontSize: '10px',
								fontWeight: 600,
								...labelBgStyle,
							}}
						>
							{label}
						</div>
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}
