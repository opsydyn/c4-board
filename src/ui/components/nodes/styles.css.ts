/**
 * C4 Node Styles
 *
 * Contract-based theming with CSS layers for proper cascade control.
 * Uses semantic design tokens for maintainability.
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

/**
 * Base Node
 * Shared styles for all C4 diagram nodes
 */
const baseNode = style({
	// Layout
	display: "flex",
	flexDirection: "column",
	transition: theme.transition.base,
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.thin} solid`,

	// Visual
	boxShadow: theme.effect.glow.base,
	backgroundColor: theme.color.background.surface,
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	minWidth: "220px",

	// Typography
	maxWidth: "320px",
	letterSpacing: theme.typography.letterSpacing.tight,
	fontFamily: theme.typography.family.mono,

	// Animation
	fontSize: theme.typography.size.base,

	selectors: {
		"&[data-selected='true']": {
			transform: "scale(1.03)",
			boxShadow: `0 0 20px ${theme.color.status.selected}99, 0 0 40px ${theme.color.status.selected}66`,
			borderColor: theme.color.status.selected,
			borderWidth: theme.border.width.base,
			backgroundColor: theme.color.background.raised,
		},
		"&:hover": {
			boxShadow: theme.effect.glow.md,
		},
	},
});

/**
 * Person Node
 * Represents human actors/users in the system
 */
export const personNode = style([
	baseNode,
	{
		borderColor: theme.color.border.person,
		backgroundColor: theme.color.surface.person,
	},
]);

export const personNodeIcon = style({
	display: "flex",
	flexShrink: 0, // Prevent icon from shrinking
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.person,
});

export const personNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1, // Take remaining space
});

export const personNodeTechnology = style({
	marginBottom: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const personNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * System Node
 * Represents software systems
 */
export const systemNode = style([
	baseNode,
	{
		borderColor: theme.color.border.system,
		backgroundColor: theme.color.surface.system,
	},
]);

export const systemNodeIcon = style({
	display: "flex",
	flexShrink: 0, // Prevent icon from shrinking
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.system,
});

export const systemNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1, // Take remaining space
});

export const systemNodeTechnology = style({
	marginBottom: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const systemNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * External System Node
 * Represents third-party/external systems
 */
export const externalSystemNode = style([
	baseNode,
	{
		borderStyle: "dashed",
		borderColor: theme.color.border.external,
		backgroundColor: theme.color.surface.external,
	},
]);

export const externalSystemNodeIcon = style({
	display: "flex",
	flexShrink: 0, // Prevent icon from shrinking
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.external,
});

export const externalSystemNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1, // Take remaining space
});

export const externalSystemNodeTechnology = style({
	marginBottom: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const externalSystemNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * Component Node
 * Represents components within containers
 */
export const componentNode = style([
	baseNode,
	{
		borderColor: theme.color.border.component,
		backgroundColor: theme.color.surface.component,
		padding: `${theme.spacing["4"]} ${theme.spacing["3"]}`,
		minWidth: "180px",
		maxWidth: "260px",
	},
]);

export const componentNodeIcon = style({
	display: "flex",
	flexShrink: 0, // Prevent icon from shrinking
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.component,
});

export const componentNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.base,
	fontWeight: theme.typography.weight.bold,
	flex: 1, // Take remaining space
});

export const componentNodeTechnology = style({
	marginBottom: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.xs,
});

export const componentNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.xs,
});

/**
 * Container Node (Resizable Group)
 * Represents containers (apps, databases) that can contain components
 */
export const containerNode = style({
	// Layout - transparent background to show children
	position: "relative",
	display: "flex",
	flexDirection: "column",
	transition: theme.transition.base,
	border: `${theme.border.width.base} dashed`,
	borderRadius: theme.border.radius.none, // ANGULAR - no rounding
	clipPath: theme.clipPath.lg, // Angled corners
	borderColor: theme.color.border.container,

	// Visual - dashed border to indicate grouping
	backgroundColor: theme.color.surface.container,
	padding: theme.spacing["4"],
	width: "100%",
	minWidth: "200px",
	height: "100%",

	// Animation
	minHeight: "150px",

	selectors: {
		"&[data-selected='true']": {
			borderColor: theme.color.status.selected,
			borderWidth: theme.border.width.base,
			boxShadow: `0 0 20px ${theme.color.status.selected}99, 0 0 40px ${theme.color.status.selected}66`,
			backgroundColor: theme.color.surface.containerSelected,
		},
		"&:hover": {
			borderColor: theme.color.interactive.hover,
		},
	},
});

export const containerNodeHeader = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	marginBottom: theme.spacing["3"],
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	paddingBottom: theme.spacing["2"],
});

export const containerNodeIcon = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.container,
});

export const containerNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
});

export const containerNodeTechnology = style({
	marginTop: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const containerNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * Node Content Container
 * Wrapper for node content
 */
export const nodeContent = style({
	display: "flex",
	flexDirection: "column",
});

/**
 * Editable Field
 * Visual indicator for inline-editable text fields
 */
export const editableField = style({
	cursor: "text",
	transition: theme.transition.base,

	selectors: {
		"&:hover": {
			opacity: 0.8,
			textDecoration: "underline",
			textDecorationStyle: "dotted",
			textUnderlineOffset: "4px",
		},
	},
});

// ============================================
// DDD NODE STYLES
// ============================================

/**
 * DDD Strategic - Bounded Context Node (Container-like)
 */
export const boundedContextNode = style({
	// Layout - transparent background to show children
	position: "relative",
	display: "flex",
	flexDirection: "column",
	transition: theme.transition.base,
	border: `${theme.border.width.base} dashed`, // DASHED like container
	borderRadius: theme.border.radius.none, // ANGULAR - no rounding
	clipPath: theme.clipPath.lg, // Angled corners
	borderColor: theme.color.border.boundedContext,

	// Visual - consistent semi-transparent background (like container)
	backgroundColor: theme.color.surface.boundedContext,
	padding: theme.spacing["4"],
	width: "100%", // IMPORTANT: maintain dimensions
	minWidth: "300px",
	height: "100%",
	minHeight: "200px",

	// Selection state
	selectors: {
		'&[data-selected="true"]': {
			borderColor: theme.color.status.selected,
			borderWidth: theme.border.width.base,
			boxShadow: `0 0 20px ${theme.color.status.selected}99, 0 0 40px ${theme.color.status.selected}66`,
		},
		"&:hover": {
			borderColor: theme.color.interactive.hover,
		},
	},
});

export const boundedContextNodeHeader = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	marginBottom: theme.spacing["3"],
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`, // Bottom border like container
	paddingBottom: theme.spacing["2"],
});

export const boundedContextNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.boundedContext,
});

export const boundedContextNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
});

export const boundedContextNodeTechnology = style({
	marginTop: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const boundedContextNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * DDD Tactical - Aggregate Node (Container-like)
 */
export const aggregateNode = style({
	// Layout - transparent background to show children
	position: "relative",
	display: "flex",
	flexDirection: "column",
	transition: theme.transition.base,
	border: `${theme.border.width.base} dashed`, // DASHED like container
	borderRadius: theme.border.radius.none, // ANGULAR - no rounding
	clipPath: theme.clipPath.lg, // Angled corners
	borderColor: theme.color.border.aggregate,

	// Visual - consistent semi-transparent background (like container)
	backgroundColor: theme.color.surface.aggregate,
	padding: theme.spacing["4"],
	width: "100%", // IMPORTANT: maintain dimensions
	minWidth: "240px",
	height: "100%",
	minHeight: "160px",

	// Selection state
	selectors: {
		'&[data-selected="true"]': {
			borderColor: theme.color.status.selected,
			borderWidth: theme.border.width.base,
			boxShadow: `0 0 20px ${theme.color.status.selected}99, 0 0 40px ${theme.color.status.selected}66`,
		},
		"&:hover": {
			borderColor: theme.color.interactive.hover,
		},
	},
});

export const aggregateNodeHeader = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	marginBottom: theme.spacing["3"],
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`, // Bottom border like container
	paddingBottom: theme.spacing["2"],
});

export const aggregateNodeIcon = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.aggregate,
});

export const aggregateNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
});

export const aggregateNodeTechnology = style({
	marginTop: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const aggregateNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * DDD Strategic - Domain Event Node
 */
export const domainEventNode = style([
	baseNode,
	{
		borderColor: theme.color.border.domainEvent,
		backgroundColor: theme.color.surface.domainEvent,
		borderStyle: "dashed",
		minWidth: "200px",
		maxWidth: "280px",
	},
]);

export const domainEventNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.domainEvent,
});

export const domainEventNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.base,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const domainEventNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.xs,
});

/**
 * DDD Tactical - Entity Node
 */
export const entityNode = style([
	baseNode,
	{
		borderColor: theme.color.border.entity,
		backgroundColor: theme.color.surface.entity,
	},
]);

export const entityNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.entity,
});

export const entityNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const entityNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * DDD Tactical - Value Object Node
 */
export const valueObjectNode = style([
	baseNode,
	{
		borderColor: theme.color.border.valueObject,
		backgroundColor: theme.color.surface.valueObject,
		minWidth: "180px",
		maxWidth: "260px",
	},
]);

export const valueObjectNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.valueObject,
});

export const valueObjectNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.base,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const valueObjectNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.xs,
});

/**
 * DDD Tactical - Domain Service Node
 */
export const domainServiceNode = style([
	baseNode,
	{
		borderColor: theme.color.border.domainService,
		backgroundColor: theme.color.surface.domainService,
	},
]);

export const domainServiceNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.domainService,
});

export const domainServiceNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const domainServiceNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * DDD Tactical - Repository Node
 */
export const repositoryNode = style([
	baseNode,
	{
		borderColor: theme.color.border.repository,
		backgroundColor: theme.color.surface.repository,
	},
]);

export const repositoryNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.repository,
});

export const repositoryNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const repositoryNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * DDD Tactical - Factory Node
 */
export const factoryNode = style([
	baseNode,
	{
		borderColor: theme.color.border.factory,
		backgroundColor: theme.color.surface.factory,
	},
]);

export const factoryNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.factory,
});

export const factoryNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const factoryNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * DDD Application - Command Node
 */
export const commandNode = style([
	baseNode,
	{
		borderColor: theme.color.border.command,
		backgroundColor: theme.color.surface.command,
		minWidth: "200px",
		maxWidth: "280px",
	},
]);

export const commandNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.command,
});

export const commandNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.base,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const commandNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.xs,
});

/**
 * DDD Application - Query Node
 */
export const queryNode = style([
	baseNode,
	{
		borderColor: theme.color.border.query,
		backgroundColor: theme.color.surface.query,
		minWidth: "200px",
		maxWidth: "280px",
	},
]);

export const queryNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.query,
});

export const queryNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.base,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const queryNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.xs,
});

/**
 * DDD Application - Application Service Node
 */
export const applicationServiceNode = style([
	baseNode,
	{
		borderColor: theme.color.border.applicationService,
		backgroundColor: theme.color.surface.applicationService,
	},
]);

export const applicationServiceNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.applicationService,
});

export const applicationServiceNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const applicationServiceNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * DDD Infrastructure - Integration Event Node
 */
export const integrationEventNode = style([
	baseNode,
	{
		borderColor: theme.color.border.integrationEvent,
		backgroundColor: theme.color.surface.integrationEvent,
		borderStyle: "dashed",
		minWidth: "200px",
		maxWidth: "280px",
	},
]);

export const integrationEventNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.integrationEvent,
});

export const integrationEventNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.base,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const integrationEventNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.xs,
});

/**
 * DDD Infrastructure - Anti-Corruption Layer Node
 */
export const aclNode = style([
	baseNode,
	{
		borderColor: theme.color.border.acl,
		backgroundColor: theme.color.surface.acl,
	},
]);

export const aclNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.acl,
});

export const aclNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const aclNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * DDD Infrastructure - Saga Node
 */
export const sagaNode = style([
	baseNode,
	{
		borderColor: theme.color.border.saga,
		backgroundColor: theme.color.surface.saga,
	},
]);

export const sagaNodeIcon = style({
	display: "flex",
	flexShrink: 0,
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.saga,
});

export const sagaNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	flex: 1,
});

export const sagaNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});
