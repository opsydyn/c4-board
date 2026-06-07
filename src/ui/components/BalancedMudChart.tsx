import {
  CircleDashed,
  Cube,
  GitBranch,
  Graph,
  Hexagon,
  Scales,
  SquareHalf,
  Warning,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import { RadialGradient } from "@visx/gradient";
import { Group } from "@visx/group";
import { LegendOrdinal } from "@visx/legend";
import { ParentSize } from "@visx/responsive";
import { scaleOrdinal } from "@visx/scale";
import { Circle, Pie } from "@visx/shape";
import { useTooltip } from "@visx/tooltip";
import { useId, useMemo } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { type BalancedCouplingModel, type ModuleCouplingSnapshot, type RiskTier } from "../../core/balancedCoupling";
import { theme } from "../../styles/theme.css";
import {
  mudChartCanvas,
  mudChartCard,
  mudChartContributorList,
  mudChartContributorMetrics,
  mudChartContributorName,
  mudChartContributorRow,
  mudChartCriticalWarning,
  mudChartCriticalWarningSvg,
  mudChartEmptyState,
  mudChartExplainabilityCard,
  mudChartExplainabilityGrid,
  mudChartExplainabilityHeader,
  mudChartExplainabilityItem,
  mudChartExplainabilityLabel,
  mudChartExplainabilityMeta,
  mudChartExplainabilityValue,
  mudChartFormulaLine,
  mudChartHeader,
  mudChartHeaderTitleRow,
  mudChartHeaderToggle,
  mudChartHeaderToggleActive,
  mudChartLegendGroup,
  mudChartLegendLabel,
  mudChartLegendRow,
  mudChartMeta,
  mudChartPulse,
  mudChartSummaryGrid,
  mudChartSummaryItem,
  mudChartSummaryLabel,
  mudChartSummaryValue,
  mudChartTitle,
  mudChartTooltip,
} from "./styles.css";

interface BalancedMudChartProps {
  model: BalancedCouplingModel;
  selectedModuleId?: string | null;
  onSelectModule?: (moduleId: string) => void;
  mudAlertThreshold?: number;
  isExplainabilityVisible: boolean;
  onToggleExplainability: () => void;
}

const subdomainPalette: Record<ModuleCouplingSnapshot["subdomainType"], string> = {
  core: theme.color.status.critical,
  supporting: theme.color.status.ready,
  generic: theme.color.foreground.tertiary,
};

const integrationPalette: Record<ModuleCouplingSnapshot["integrationType"], string> = {
  intrusive: theme.color.status.critical,
  contract: theme.color.interactive.primary,
  functional: theme.color.status.ready,
};

const riskPulsePalette: Record<RiskTier, string> = {
  high: theme.color.status.critical,
  medium: theme.color.status.caution,
  low: theme.color.status.ready,
};

interface MudChartVizProps {
  width: number;
  height: number;
  model: BalancedCouplingModel;
  selectedModuleId?: string | null | undefined; // Allow undefined for strictness
  onHoverModule: (
    event: ReactMouseEvent<SVGCircleElement, MouseEvent>,
    snapshot: ModuleCouplingSnapshot,
  ) => void;
  onLeaveModule: () => void;
  onSelectModule?: ((moduleId: string) => void) | undefined; // Allow undefined explicitly
}

const MudChartViz = ({
  width,
  height,
  model,
  onHoverModule,
  onLeaveModule,
  onSelectModule,
  selectedModuleId,
}: MudChartVizProps) => {
  const { snapshots, aggregate } = model;

  if (width <= 20 || height <= 20) {
    return null;
  }

  const gradientId = useId();
  const centerX = width / 2;
  const centerY = height / 2;

  const maxRadius = Math.min(width, height) / 2 - 16;
  const baseMudRadius = Math.max(36, Math.min(maxRadius * 0.7, aggregate.averageBalance * 6));
  const complexityGain = Math.min(18, aggregate.averageModularity * 1.2);
  const riskGain = Math.min(24, aggregate.averageRisk);
  const mudRadius = Math.min(maxRadius, baseMudRadius + complexityGain + riskGain);
  const haloOuterRadius = Math.min(maxRadius + 18, mudRadius + 28);
  const haloInnerRadius = mudRadius + 10;

  const integrationSeries = useMemo(() => {
    const counts = snapshots.reduce(
      (acc, snapshot) => {
        acc[snapshot.integrationType] += 1;
        return acc;
      },
      {
        intrusive: 0,
        contract: 0,
        functional: 0,
      },
    );

    return (Object.entries(counts) as Array<[ModuleCouplingSnapshot["integrationType"], number]>)
      .filter(([, value]) => value > 0)
      .map(([type, value]) => ({ type, value }));
  }, [snapshots]);

  const moduleRingRadius = mudRadius + 24;
  const moduleRadiusBase = 6;

  const highestRiskModule = useMemo(() => {
    return snapshots.length > 0
      ? [...snapshots].sort((a, b) => b.systemicRisk - a.systemicRisk)[0]
      : undefined;
  }, [snapshots]);

  return (
    <svg width={width} height={height}>
      <RadialGradient
        id={`${gradientId}-sphere`}
        from={riskPulsePalette[highestRiskModule?.riskTier ?? "medium"]}
        fromOpacity={0.85}
        to={theme.color.background.surface}
        toOpacity={0.1}
        r={mudRadius}
        fx={centerX}
        fy={centerY}
      />
      <Group top={centerY} left={centerX}>
        <Circle
          cx={0}
          cy={0}
          r={haloOuterRadius}
          fill={theme.color.background.surface}
          opacity={0.35}
        />

        {integrationSeries.length > 0 && (
          <Pie
            data={integrationSeries}
            pieValue={(d) => d.value}
            outerRadius={haloOuterRadius}
            innerRadius={haloInnerRadius}
            padAngle={0.05}
          >
            {(pie) =>
              pie.arcs.map((arc) => (
                <path
                  key={arc.data.type}
                  d={pie.path(arc) ?? undefined}
                  fill={integrationPalette[arc.data.type]}
                  fillOpacity={0.45}
                  stroke={integrationPalette[arc.data.type]}
                  strokeOpacity={0.65}
                />
              ))}
          </Pie>
        )}

        <Circle
          cx={0}
          cy={0}
          r={mudRadius}
          fill={`url(#${gradientId}-sphere)`}
          stroke={theme.color.border.primary}
          strokeWidth={2}
        />

        <Circle
          className={mudChartPulse}
          cx={0}
          cy={0}
          r={mudRadius + aggregate.maxRisk * 1.6}
          stroke={riskPulsePalette[highestRiskModule?.riskTier ?? "medium"]}
          strokeWidth={1.5}
          fill="none"
          strokeOpacity={0.45}
        />

        <Group>
          <TextStack
            modularity={aggregate.averageModularity}
            balance={aggregate.averageBalance}
            risk={aggregate.averageRisk}
          />
        </Group>

        {snapshots.map((snapshot, index) => {
          const angle = (index / snapshots.length) * Math.PI * 2;
          const x = Math.cos(angle) * moduleRingRadius;
          const y = Math.sin(angle) * moduleRingRadius;
          const moduleRadius = moduleRadiusBase + snapshot.systemicRisk * 0.3;
          const isSelected = snapshot.id === selectedModuleId;

          return (
            <Group key={snapshot.id} top={y} left={x}>
              <Circle
                cx={0}
                cy={0}
                r={moduleRadius + (isSelected ? 4 : 2)}
                stroke={riskPulsePalette[snapshot.riskTier]}
                strokeWidth={isSelected ? 2 : 1}
                fill="none"
                opacity={isSelected ? 0.95 : 0.6}
              />
              <Circle
                role="button"
                tabIndex={0}
                cx={0}
                cy={0}
                r={moduleRadius}
                fill={subdomainPalette[snapshot.subdomainType]}
                fillOpacity={0.85}
                stroke={theme.color.background.base}
                strokeWidth={1}
                style={{ cursor: "pointer" }}
                onMouseEnter={(event) => onHoverModule(event, snapshot)}
                onMouseLeave={onLeaveModule}
                onBlur={onLeaveModule}
                onClick={() => onSelectModule?.(snapshot.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectModule?.(snapshot.id);
                  }
                }}
              />
            </Group>
          );
        })}
      </Group>
    </svg>
  );
};

interface TextStackProps {
  modularity: number;
  balance: number;
  risk: number;
}

const TextStack = ({ modularity, balance, risk }: TextStackProps) => (
  <Group>
    <text
      x={0}
      y={-10}
      textAnchor="middle"
      fill={theme.color.foreground.primary}
      fontFamily={theme.typography.family.mono}
      fontSize={14}
    >
      MOD {modularity.toFixed(1)}
    </text>
    <text
      x={0}
      y={8}
      textAnchor="middle"
      fill={theme.color.status.ready}
      fontFamily={theme.typography.family.mono}
      fontSize={12}
    >
      BAL {balance.toFixed(1)}
    </text>
    <text
      x={0}
      y={26}
      textAnchor="middle"
      fill={theme.color.status.critical}
      fontFamily={theme.typography.family.mono}
      fontSize={12}
    >
      RISK {risk.toFixed(1)}
    </text>
  </Group>
);

export function BalancedMudChart({
  model,
  onSelectModule,
  selectedModuleId,
  mudAlertThreshold = 8.0,
  isExplainabilityVisible,
  onToggleExplainability,
}: BalancedMudChartProps) {
  const {
    tooltipData,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<ModuleCouplingSnapshot>();

  const subdomainLegendScale = useMemo(
    () =>
      scaleOrdinal<string, string>({
        domain: ["Core", "Supporting", "Generic"],
        range: [
          subdomainPalette.core,
          subdomainPalette.supporting,
          subdomainPalette.generic,
        ],
      }),
    [],
  );

  const integrationLegendScale = useMemo(
    () =>
      scaleOrdinal<string, string>({
        domain: ["Intrusive", "Contract", "Functional"],
        range: [
          integrationPalette.intrusive,
          integrationPalette.contract,
          integrationPalette.functional,
        ],
      }),
    [],
  );

  const topRisk = useMemo(() => {
    return model.snapshots.length > 0
      ? [...model.snapshots].sort((a, b) => b.systemicRisk - a.systemicRisk)[0]
      : null;
  }, [model.snapshots]);

  const focusedSnapshot = useMemo(() => {
    if (selectedModuleId) {
      const selected = model.snapshots.find((snapshot) => snapshot.id === selectedModuleId);
      if (selected) {
        return selected;
      }
    }
    return topRisk ?? model.snapshots[0] ?? null;
  }, [model.snapshots, selectedModuleId, topRisk]);

  const strategyLabel = useMemo(() => {
    if (!focusedSnapshot?.provenance) {
      return "LEGACY";
    }
    switch (focusedSnapshot.provenance.strategy) {
      case "auto-derived":
        return "AUTO DERIVED";
      case "hybrid-override":
        return "HYBRID OVERRIDE";
      case "manual-curated":
        return "MANUAL CURATED";
      case "legacy-v1":
      default:
        return "LEGACY V1";
    }
  }, [focusedSnapshot?.provenance]);

  const subdomainCounts = useMemo(
    () =>
      model.snapshots.reduce(
        (acc, snapshot) => {
          acc[snapshot.subdomainType] += 1;
          return acc;
        },
        {
          core: 0,
          supporting: 0,
          generic: 0,
        },
      ),
    [model.snapshots],
  );

  const handleHover = (
    _event: ReactMouseEvent<SVGCircleElement, MouseEvent>,
    snapshot: ModuleCouplingSnapshot,
  ) => {
    showTooltip({
      tooltipData: snapshot,
    });
  };

  if (model.snapshots.length === 0) {
    return (
      <div className={mudChartCard}>
        <div className={mudChartHeader}>
          <div className={mudChartHeaderTitleRow}>
            <button
              type="button"
              className={`${mudChartHeaderToggle} ${isExplainabilityVisible ? mudChartHeaderToggleActive : ""}`}
              aria-pressed={isExplainabilityVisible}
              aria-label={isExplainabilityVisible
                ? "Hide coupling explainability panel"
                : "Show coupling explainability panel"}
              title={isExplainabilityVisible
                ? "Hide coupling explainability panel"
                : "Show coupling explainability panel"}
              onClick={onToggleExplainability}
            >
              <Graph size={16} weight="duotone" />
            </button>
            <h3 className={mudChartTitle}>Complexity Field</h3>
          </div>
        </div>
        <div className={mudChartEmptyState}>
          [░░░░] AWAITING TACTICAL DATA INPUT
        </div>
      </div>
    );
  }

  const riskLabel = topRisk ? `${topRisk.label} · ${topRisk.systemicRisk.toFixed(1)}` : "Stable";

  return (
    <>
      <div className={mudChartCard}>
        <div className={mudChartHeader}>
          <div className={mudChartHeaderTitleRow}>
            <button
              type="button"
              className={`${mudChartHeaderToggle} ${isExplainabilityVisible ? mudChartHeaderToggleActive : ""}`}
              aria-pressed={isExplainabilityVisible}
              aria-label={isExplainabilityVisible
                ? "Hide coupling explainability panel"
                : "Show coupling explainability panel"}
              title={isExplainabilityVisible
                ? "Hide coupling explainability panel"
                : "Show coupling explainability panel"}
              onClick={onToggleExplainability}
            >
              <Graph size={16} weight="duotone" />
            </button>
            <h3 className={mudChartTitle}>Complexity Field</h3>
          </div>
          <p className={mudChartMeta}>
            High risk nexus: {riskLabel}
          </p>
        </div>

        <div className={mudChartCanvas}>
          <ParentSize debounceTime={300} ignoreDimensions={["left", "top"]}>
            {({ width, height }) => (
              <MudChartViz
                width={width}
                height={height}
                model={model}
                onHoverModule={handleHover}
                onLeaveModule={hideTooltip}
                onSelectModule={onSelectModule}
                selectedModuleId={selectedModuleId}
              />
            )}
          </ParentSize>

          <div className={mudChartTooltip}>
            {tooltipOpen && tooltipData
              ? (
                <>
                  <div style={{ fontWeight: "bold", fontSize: "11px" }}>
                    {tooltipData.label}
                    {tooltipData.technology && <>[{tooltipData.technology}]</>}
                  </div>
                  {tooltipData.description && (
                    <div style={{ fontSize: "9px", opacity: 0.8, lineHeight: "1.3" }}>
                      {tooltipData.description}
                    </div>
                  )}
                  <div style={{ fontSize: "9px", opacity: 0.75, display: "flex", gap: "12px" }}>
                    <span>{tooltipData.subdomainType.toUpperCase()}</span>
                    <span>•</span>
                    <span>{tooltipData.integrationType.toUpperCase()}</span>
                    <span>•</span>
                    <span>MODE {tooltipData.scoreMode.toUpperCase()}</span>
                    <span>•</span>
                    <span>
                      PROV {tooltipData.provenance?.strategy
                        ? tooltipData.provenance.strategy.replaceAll("-", " ").toUpperCase()
                        : "LEGACY"}
                    </span>
                    <span>•</span>
                    <span>Risk {tooltipData.systemicRisk.toFixed(1)}</span>
                  </div>
                </>
              )
              : (
                <div style={{ opacity: 0.5, fontSize: "9px", letterSpacing: "0.5px" }}>
                  [████] ENGINEERING SYSTEM STANDBY
                </div>
              )}
          </div>

          {model.aggregate.averageRisk >= mudAlertThreshold && (
            <div className={mudChartCriticalWarning}>
              <span className={mudChartCriticalWarningSvg}>
                <WarningOctagonIcon size={16} weight="fill" />
              </span>

              <p>
                [CRITICAL] BIG BALL OF MUD DETECTED (THRESHOLD {mudAlertThreshold.toFixed(1)})
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={mudChartSummaryGrid}>
        <div className={mudChartSummaryItem}>
          <span className={mudChartSummaryLabel}>
            <Cube size={14} weight="duotone" /> Modules
          </span>
          <span className={mudChartSummaryValue}>{model.aggregate.totalModules}</span>
        </div>
        <div className={mudChartSummaryItem}>
          <span className={mudChartSummaryLabel}>
            <Warning size={14} weight="duotone" /> Avg Risk
          </span>
          <span className={mudChartSummaryValue}>
            {model.aggregate.averageRisk.toFixed(1)}
          </span>
        </div>
        <div className={mudChartSummaryItem}>
          <span className={mudChartSummaryLabel}>
            <Scales size={14} weight="duotone" /> Balance
          </span>
          <span className={mudChartSummaryValue}>
            {model.aggregate.averageBalance.toFixed(1)}
          </span>
        </div>
        <div className={mudChartSummaryItem}>
          <span className={mudChartSummaryLabel}>
            <GitBranch size={14} weight="duotone" /> Propagation
          </span>
          <span className={mudChartSummaryValue}>
            {model.aggregate.totalPropagation}
          </span>
        </div>
        <div className={mudChartSummaryItem}>
          <span className={mudChartSummaryLabel}>
            <CircleDashed size={14} weight="duotone" /> Core
          </span>
          <span className={mudChartSummaryValue}>{subdomainCounts.core}</span>
        </div>
        <div className={mudChartSummaryItem}>
          <span className={mudChartSummaryLabel}>
            <Hexagon size={14} weight="duotone" /> Supporting
          </span>
          <span className={mudChartSummaryValue}>{subdomainCounts.supporting}</span>
        </div>
        <div className={mudChartSummaryItem}>
          <span className={mudChartSummaryLabel}>
            <SquareHalf size={14} weight="duotone" /> Generic
          </span>
          <span className={mudChartSummaryValue}>{subdomainCounts.generic}</span>
        </div>
      </div>

      {isExplainabilityVisible && focusedSnapshot && (
        <section
          className={mudChartExplainabilityCard}
          aria-label="Coupling explainability panel"
        >
          <h4 className={mudChartExplainabilityHeader}>
            Explainability :: {focusedSnapshot.label}
          </h4>
          <p className={mudChartExplainabilityMeta}>
            Mode {focusedSnapshot.scoreMode.toUpperCase()} :: {strategyLabel}
          </p>
          <div className={mudChartExplainabilityGrid}>
            <div className={mudChartExplainabilityItem}>
              <span className={mudChartExplainabilityLabel}>Strength</span>
              <span className={mudChartExplainabilityValue}>
                {focusedSnapshot.formulaExplanation?.dimensions.strength.toFixed(1) ?? "N/A"}
              </span>
            </div>
            <div className={mudChartExplainabilityItem}>
              <span className={mudChartExplainabilityLabel}>Distance</span>
              <span className={mudChartExplainabilityValue}>
                {focusedSnapshot.formulaExplanation?.dimensions.distance.toFixed(1) ?? "N/A"}
              </span>
            </div>
            <div className={mudChartExplainabilityItem}>
              <span className={mudChartExplainabilityLabel}>Volatility</span>
              <span className={mudChartExplainabilityValue}>
                {focusedSnapshot.formulaExplanation?.dimensions.volatility.toFixed(1) ?? "N/A"}
              </span>
            </div>
            <div className={mudChartExplainabilityItem}>
              <span className={mudChartExplainabilityLabel}>XOR Balance</span>
              <span className={mudChartExplainabilityValue}>
                {focusedSnapshot.formulaExplanation?.xorBalance.toFixed(1) ?? "N/A"}
              </span>
            </div>
            <div className={mudChartExplainabilityItem}>
              <span className={mudChartExplainabilityLabel}>NOT Volatility</span>
              <span className={mudChartExplainabilityValue}>
                {focusedSnapshot.formulaExplanation?.notVolatility.toFixed(1) ?? "N/A"}
              </span>
            </div>
            <div className={mudChartExplainabilityItem}>
              <span className={mudChartExplainabilityLabel}>Balance</span>
              <span className={mudChartExplainabilityValue}>
                {focusedSnapshot.balance.toFixed(1)}
              </span>
            </div>
            <div className={mudChartExplainabilityItem}>
              <span className={mudChartExplainabilityLabel}>Systemic Risk</span>
              <span className={mudChartExplainabilityValue}>
                {focusedSnapshot.systemicRisk.toFixed(1)}
              </span>
            </div>
            <div className={mudChartExplainabilityItem}>
              <span className={mudChartExplainabilityLabel}>Risk Tier</span>
              <span className={mudChartExplainabilityValue}>
                {focusedSnapshot.riskTier.toUpperCase()}
              </span>
            </div>
          </div>
          <p className={mudChartFormulaLine}>
            BALANCE = MAX(XOR(STRENGTH, DISTANCE), NOT(VOLATILITY))
          </p>
          <p className={mudChartFormulaLine}>
            RISK = 11 - BALANCE :: PROPAGATION {focusedSnapshot.volatilityPropagation}
          </p>
          {focusedSnapshot.provenance && focusedSnapshot.provenance.overrideKeys.length > 0 && (
            <p className={mudChartFormulaLine}>
              OVERRIDES :: {focusedSnapshot.provenance.overrideKeys.join(", ").toUpperCase()}
            </p>
          )}
          <div className={mudChartContributorList}>
            {(focusedSnapshot.contributors?.length ?? 0) > 0
              ? focusedSnapshot.contributors?.map((contributor) => (
                <div key={contributor.id} className={mudChartContributorRow}>
                  <span className={mudChartContributorName}>
                    {contributor.label}
                  </span>
                  <span className={mudChartContributorMetrics}>
                    S {contributor.strength.toFixed(1)} · D {contributor.distance.toFixed(1)} · V{" "}
                    {contributor.volatility.toFixed(1)} · I {contributor.impact.toFixed(1)}
                  </span>
                </div>
              ))
              : (
                <div className={mudChartContributorRow}>
                  <span className={mudChartContributorName}>No contributor telemetry</span>
                  <span className={mudChartContributorMetrics}>MODEL LEGACY</span>
                </div>
              )}
          </div>
        </section>
      )}

      <div className={mudChartLegendRow}>
        <div className={mudChartLegendGroup}>
          <span className={mudChartLegendLabel}>Subdomain Types</span>
          <LegendOrdinal scale={subdomainLegendScale} direction="row" itemMargin="0 12px">
            {(legend) => (
              <>
                {legend.map((item, i) => (
                  <span key={`subdomain-${item.datum}-${i}`} style={{ color: item.value }}>
                    ● {item.datum}
                  </span>
                ))}
              </>
            )}
          </LegendOrdinal>
        </div>
        <div className={mudChartLegendGroup}>
          <span className={mudChartLegendLabel}>Integration Types</span>
          <LegendOrdinal scale={integrationLegendScale} direction="row" itemMargin="0 12px">
            {(legend) => (
              <>
                {legend.map((item, i) => (
                  <span key={`integration-${item.datum}-${i}`} style={{ color: item.value }}>
                    ● {item.datum}
                  </span>
                ))}
              </>
            )}
          </LegendOrdinal>
        </div>
      </div>
    </>
  );
}
