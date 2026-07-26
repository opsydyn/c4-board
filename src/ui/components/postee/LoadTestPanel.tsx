import type { PosteeRequestDraft } from "@/core/effects/postee";
import { buildLoadTestRequestPayload, type LoadTestProgress } from "@/core/effects/postee/load-test";
import { toCsv, toJsonReport } from "@/core/effects/postee/load-test-export";
import {
  evaluateThresholds,
  formatThresholdVerdict,
  type LoadTestThreshold,
} from "@/core/effects/postee/load-test-thresholds";
import { HTTP_METHODS, type HttpMethod } from "@/core/effects/postee/types";
import { WarningOctagonIcon } from "@phosphor-icons/react";
import { GlyphCircle } from "@visx/glyph";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, Bar, LinePath } from "@visx/shape";
import { type SubmitEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import {
  chartHeader,
  chartRow,
  chartSection,
  chartVisualizationGrid,
  chartWrapper,
  latencyBandsCard,
  latencyBandsHeader,
  latencyLegend,
  latencyLegendItem,
  latencyLegendSwatch,
  loadTestButtonRow,
  loadTestControls,
  loadTestHeader,
  loadTestMetrics,
  loadTestPanel,
  loadTestStatus,
  loadTestStatusIndicator,
  loadTestStatusIndicatorActive,
  loadTestWarning,
  metricCard,
  metricLabel,
  metricValue,
  miniBarValue,
  miniBarWrapper,
  sectionTitle,
  submitButton,
  textInput,
} from "./PosteeWorkspace.css";
import { Select } from "./Select";
import { useLoadTest } from "./useLoadTest";

const methodOptions = HTTP_METHODS;

interface LoadTestPanelProps {
  requestDraft: PosteeRequestDraft;
  sirenEnabledDefault?: boolean;
  masterAudioEnabled?: boolean;
  masterVolume?: number;
  animationsEnabled?: boolean;
}

const viewWidth = 600;
const viewHeight = 160;
const scatterHeight = 180;

const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const toSirenVolumeDb = (masterVolume: number): number => -42 + Math.max(0, Math.min(1, masterVolume)) * 36;

interface ChartProps {
  samples: LoadTestProgress[];
  field: keyof LoadTestProgress;
  color: string;
  label: string;
  units?: string | undefined;
  showHeader?: boolean;
  maxValue?: number;
}

const MetricChart = ({
  samples,
  field,
  color,
  label,
  units,
  showHeader = true,
  maxValue,
}: ChartProps) => {
  const data = samples;

  const { xScale, yScale, safeMax, maxDisplay } = useMemo(() => {
    const maxElapsed = data.length > 0 ? data[data.length - 1]?.elapsed_ms ?? 1 : 1;

    const numericValues = data.map((sample) => {
      const rawValue = sample[field];
      const value = typeof rawValue === "number" && Number.isFinite(rawValue)
        ? rawValue
        : 0;
      return value;
    });

    const computedMax = typeof maxValue === "number" && maxValue > 0
      ? maxValue
      : numericValues.length > 0
      ? Math.max(...numericValues)
      : 0;

    const safeMaxValue = Math.max(computedMax, 1);

    return {
      xScale: scaleLinear({
        domain: [0, Math.max(maxElapsed, 1)],
        range: [0, viewWidth],
      }),
      yScale: scaleLinear({
        domain: [0, safeMaxValue],
        range: [viewHeight, 0],
        nice: true,
      }),
      safeMax: safeMaxValue,
      maxDisplay: computedMax,
    };
  }, [data, field, maxValue]);

  return (
    <div className={chartWrapper}>
      {showHeader && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.5rem",
          }}
        >
          <strong>{label}</strong>
          <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
            Max {formatNumber(
              maxDisplay > 0 ? maxDisplay : safeMax,
              units ? 2 : 0,
            )}
            {units ? ` ${units}` : ""}
          </span>
        </div>
      )}
      {data.length < 2
        ? (
          <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            Run a test to populate the chart.
          </div>
        )
        : (
          <svg
            width="100%"
            height="160"
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            role="img"
          >
            <LinePath<LoadTestProgress>
              data={data}
              x={(d) => xScale(d.elapsed_ms)}
              y={(d) => yScale((d[field] as number) ?? 0)}
              stroke={color}
              strokeWidth={2}
            />
          </svg>
        )}
    </div>
  );
};

interface MiniBarProps {
  value: number;
  maxValue: number;
  color: string;
}

const MiniBar = ({ value, maxValue, color }: MiniBarProps) => {
  const width = 160;
  const height = 48;
  const horizontalPadding = 12;
  const barHeight = 20;

  const effectiveMax = Math.max(maxValue, 1);
  const barScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, effectiveMax],
        range: [0, width - horizontalPadding * 2],
      }),
    [effectiveMax],
  );

  const scaledValue = Math.max(barScale(Math.max(value, 0)), 2);

  return (
    <svg width={width} height={height}>
      <Group top={(height - barHeight) / 2} left={horizontalPadding}>
        <rect
          width={width - horizontalPadding * 2}
          height={barHeight}
          rx={0}
          fill="rgba(44, 70, 60, 0.45)"
        />
        <Bar
          width={Math.min(scaledValue, width - horizontalPadding * 2)}
          height={barHeight}
          rx={0}
          fill={color}
        />
      </Group>
    </svg>
  );
};

interface MetricVisualizationProps {
  label: string;
  field: keyof LoadTestProgress;
  color: string;
  units?: string;
  samples: LoadTestProgress[];
}

const MetricVisualization = ({
  label,
  field,
  color,
  units,
  samples,
}: MetricVisualizationProps) => {
  const numericValues = useMemo(() => {
    return samples
      .map((sample) => {
        const raw = sample[field];
        if (typeof raw === "number" && Number.isFinite(raw)) {
          return raw;
        }
        return 0;
      })
      .filter((value) => Number.isFinite(value));
  }, [samples, field]);

  const latestValue = numericValues.length > 0
    ? numericValues[numericValues.length - 1] ?? 0
    : 0;
  const observedMax = numericValues.length > 0
    ? Math.max(...numericValues, latestValue)
    : latestValue;
  const domainMax = Math.max(observedMax, 1);

  return (
    <div className={chartSection}>
      <div className={chartHeader}>
        <span>{label}</span>
        <span className={miniBarValue}>
          {formatNumber(latestValue, 2)}
          {units ? ` ${units}` : ""}
        </span>
      </div>
      <div className={chartRow}>
        <div className={miniBarWrapper}>
          <MiniBar value={latestValue} maxValue={domainMax} color={color} />
          <span className={miniBarValue}>
            Max {formatNumber(observedMax, 2)}
            {units ? ` ${units}` : ""}
          </span>
        </div>
        <MetricChart
          samples={samples}
          field={field}
          color={color}
          label={label}
          units={units}
          showHeader={false}
          maxValue={domainMax}
        />
      </div>
    </div>
  );
};

const LatencyBandsChart = ({ samples }: { samples: LoadTestProgress[] }) => {
  const chartData = useMemo(
    () =>
      samples.map((sample) => ({
        time: sample.elapsed_ms,
        p50: typeof sample.p50_latency_ms === "number"
          ? sample.p50_latency_ms
          : 0,
        p95: typeof sample.p95_latency_ms === "number"
          ? sample.p95_latency_ms
          : 0,
        p99: typeof sample.p99_latency_ms === "number"
          ? sample.p99_latency_ms
          : 0,
        avg: typeof sample.avg_latency_ms === "number"
          ? sample.avg_latency_ms
          : 0,
      })),
    [samples],
  );

  const hasData = chartData.length >= 2;

  const xScale = useMemo(() => {
    const maxElapsed = chartData.length > 0
      ? chartData[chartData.length - 1]?.time ?? 1
      : 1;
    return scaleLinear({
      domain: [0, Math.max(maxElapsed, 1)],
      range: [0, viewWidth],
    });
  }, [chartData]);

  const yScale = useMemo(() => {
    const maxLatency = chartData.length > 0
      ? Math.max(
        ...chartData.map((entry) => Math.max(entry.p50, entry.p95, entry.p99, entry.avg)),
      )
      : 1;
    return scaleLinear({
      domain: [0, Math.max(maxLatency, 1)],
      range: [viewHeight, 0],
      nice: true,
    });
  }, [chartData]);

  return (
    <div className={latencyBandsCard}>
      <div className={latencyBandsHeader}>
        <span>Latency Distribution Bands</span>
        <span>
          Latest P95: {formatNumber(
            chartData.length
              ? chartData[chartData.length - 1]?.p95 ?? 0
              : 0,
            2,
          )} ms
        </span>
      </div>

      {!hasData
        ? (
          <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
            Run a test to see percentile bands.
          </div>
        )
        : (
          <svg width="100%" height={viewHeight + 20} viewBox={`0 0 ${viewWidth} ${viewHeight + 20}`}>
            <Group top={10} left={0}>
              <AreaClosed<typeof chartData[number]>
                data={chartData}
                x={(d) => xScale(d.time) ?? 0}
                y={(d) => yScale(d.p50) ?? 0}
                yScale={yScale}
                fill="rgba(76, 195, 138, 0.35)"
                stroke="none"
              />
              <AreaClosed<typeof chartData[number]>
                data={chartData}
                x={(d) => xScale(d.time) ?? 0}
                y={(d) => yScale(d.p95) ?? 0}
                yScale={yScale}
                fill="rgba(143, 214, 255, 0.25)"
                stroke="none"
              />
              <AreaClosed<typeof chartData[number]>
                data={chartData}
                x={(d) => xScale(d.time) ?? 0}
                y={(d) => yScale(d.p99) ?? 0}
                yScale={yScale}
                fill="rgba(189, 231, 255, 0.2)"
                stroke="none"
              />
              <LinePath<typeof chartData[number]>
                data={chartData}
                x={(d) => xScale(d.time) ?? 0}
                y={(d) => yScale(d.avg) ?? 0}
                stroke="#F5A524"
                strokeWidth={1.5}
              />
            </Group>
          </svg>
        )}

      <div className={latencyLegend}>
        <div className={latencyLegendItem}>
          <span
            className={latencyLegendSwatch}
            style={{ backgroundColor: "rgba(76, 195, 138, 0.7)" }}
          />
          P50
        </div>
        <div className={latencyLegendItem}>
          <span
            className={latencyLegendSwatch}
            style={{ backgroundColor: "rgba(143, 214, 255, 0.55)" }}
          />
          P95
        </div>
        <div className={latencyLegendItem}>
          <span
            className={latencyLegendSwatch}
            style={{ backgroundColor: "rgba(189, 231, 255, 0.5)" }}
          />
          P99
        </div>
        <div className={latencyLegendItem}>
          <span
            className={latencyLegendSwatch}
            style={{ backgroundColor: "#F5A524" }}
          />
          Average
        </div>
      </div>
    </div>
  );
};

const ThroughputLatencyScatter = ({ samples }: { samples: LoadTestProgress[] }) => {
  const points = useMemo(() => {
    return samples
      .map((sample) => {
        const total = sample.requests_success + sample.requests_failed;
        const errorRate = total > 0 ? sample.requests_failed / total : 0;
        return {
          time: sample.elapsed_ms,
          rps: typeof sample.rps === "number" ? sample.rps : 0,
          latency: typeof sample.p95_latency_ms === "number" ? sample.p95_latency_ms : 0,
          errorRate,
        };
      })
      .filter((p) => Number.isFinite(p.rps) && Number.isFinite(p.latency));
  }, [samples]);

  const hasData = points.length >= 2;

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, Math.max(...points.map((p) => p.rps), 1)],
        range: [0, viewWidth],
        nice: true,
      }),
    [points],
  );

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, Math.max(...points.map((p) => p.latency), 1)],
        range: [scatterHeight, 0],
        nice: true,
      }),
    [points],
  );

  const colorForErrorRate = (rate: number) => {
    if (rate > 0.2) return "#F97066"; // red-ish
    if (rate > 0.05) return "#F5A524"; // amber
    return "#4CC38A"; // green
  };

  return (
    <div className={chartSection}>
      <div className={chartHeader}>
        <span>Throughput vs Latency (P95)</span>
        <span className={miniBarValue}>Color shows error rate</span>
      </div>
      {!hasData
        ? (
          <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
            Run a test to see the scatter.
          </div>
        )
        : (
          <svg width="100%" height={scatterHeight + 20} viewBox={`0 0 ${viewWidth} ${scatterHeight + 20}`}>
            <Group top={10} left={0}>
              {points.map((point, index) => (
                <GlyphCircle
                  key={`${point.time}-${index}`}
                  left={xScale(point.rps) ?? 0}
                  top={yScale(point.latency) ?? 0}
                  r={6}
                  fill={colorForErrorRate(point.errorRate)}
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={1}
                />
              ))}
            </Group>
          </svg>
        )}
    </div>
  );
};

const SuccessFailureStacked = ({ samples }: { samples: LoadTestProgress[] }) => {
  const buckets = useMemo(() => {
    let prevSuccess = 0;
    let prevFail = 0;
    return samples.map((sample) => {
      const successDelta = Math.max(sample.requests_success - prevSuccess, 0);
      const failDelta = Math.max(sample.requests_failed - prevFail, 0);
      prevSuccess = sample.requests_success;
      prevFail = sample.requests_failed;
      return {
        time: sample.elapsed_ms,
        success: successDelta,
        fail: failDelta,
      };
    });
  }, [samples]);

  const hasData = buckets.length >= 1;

  const maxTotal = useMemo(
    () =>
      Math.max(
        1,
        ...buckets.map((b) => b.success + b.fail),
      ),
    [buckets],
  );

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, maxTotal],
        range: [scatterHeight, 0],
        nice: true,
      }),
    [maxTotal],
  );

  const barWidth = useMemo(() => {
    const count = Math.max(buckets.length, 1);
    return Math.max((viewWidth - 20) / count, 4);
  }, [buckets.length]);

  return (
    <div className={chartSection}>
      <div className={chartHeader}>
        <span>Success vs Failure per Tick</span>
        <span className={miniBarValue}>Stacked per sample</span>
      </div>
      {!hasData
        ? (
          <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
            Run a test to populate counts.
          </div>
        )
        : (
          <svg width="100%" height={scatterHeight + 30} viewBox={`0 0 ${viewWidth} ${scatterHeight + 30}`}>
            <Group top={10} left={10}>
              {buckets.map((bucket, index) => {
                const x = index * barWidth;
                const baseY = yScale(0);
                const successY = yScale(bucket.success);
                const successHeight = baseY - successY;
                const failTop = yScale(bucket.success + bucket.fail);
                const failHeight = successY - failTop;
                return (
                  <Group key={`${bucket.time}-${index}`} left={x}>
                    <Bar
                      x={0}
                      y={successY}
                      width={barWidth - 2}
                      height={successHeight}
                      fill="#4CC38A"
                      rx={0}
                    />
                    <Bar
                      x={0}
                      y={failTop}
                      width={barWidth - 2}
                      height={failHeight}
                      fill="#F97066"
                      rx={0}
                    />
                  </Group>
                );
              })}
            </Group>
          </svg>
        )}
    </div>
  );
};

export function LoadTestPanel({
  requestDraft,
  sirenEnabledDefault = false,
  masterAudioEnabled = true,
  masterVolume = 0.8,
  animationsEnabled = true,
}: LoadTestPanelProps) {
  const {
    status,
    error,
    samples,
    latest,
    isDetecting,
    start,
    stop,
    isSupported,
    reset,
  } = useLoadTest();

  const [targetMethod, setTargetMethod] = useState<HttpMethod>(
    requestDraft.request.method as HttpMethod,
  );
  const [targetUrl, setTargetUrl] = useState<string>(requestDraft.request.url);
  const [durationSecs, setDurationSecs] = useState<string>("30");
  const [concurrency, setConcurrency] = useState<string>("10");
  const [rpsLimit, setRpsLimit] = useState<string>("");
  const [timeoutMs, setTimeoutMs] = useState<string>("30000");
  // ADR-019 slice 5. Empty means nothing is asserted about the run, which is a
  // different claim from asserting something that held.
  const [p95Budget, setP95Budget] = useState<string>("");
  const [errorRateBudget, setErrorRateBudget] = useState<string>("");
  const [isSirenEnabled, setSirenEnabled] = useState(sirenEnabledDefault);
  const sirenOscRef = useRef<Tone.Oscillator | null>(null);
  const sirenLfoRef = useRef<Tone.LFO | null>(null);
  const audioReadyRef = useRef(false);

  const primeSirenAudio = useCallback(async (): Promise<boolean> => {
    if (!masterAudioEnabled) {
      return false;
    }

    try {
      await Tone.start();
      audioReadyRef.current = true;
      return true;
    } catch {
      return false;
    }
  }, [masterAudioEnabled]);

  const getSirenOscillator = useCallback((): Tone.Oscillator => {
    if (!sirenOscRef.current) {
      sirenOscRef.current = new Tone.Oscillator({
        type: "sawtooth",
        frequency: 440,
        volume: toSirenVolumeDb(masterVolume),
      }).toDestination();
    }

    return sirenOscRef.current;
  }, [masterVolume]);

  const getSirenLfo = useCallback(
    (oscillator: Tone.Oscillator): Tone.LFO => {
      if (!sirenLfoRef.current) {
        sirenLfoRef.current = new Tone.LFO({
          type: "triangle",
          min: 300,
          max: 980,
          frequency: 0.25,
        });
        sirenLfoRef.current.connect(oscillator.frequency);
      }

      return sirenLfoRef.current;
    },
    [],
  );

  const stopSiren = useCallback(() => {
    const lfo = sirenLfoRef.current;
    if (lfo && lfo.state === "started") {
      lfo.stop();
    }

    const oscillator = sirenOscRef.current;
    if (oscillator && oscillator.state === "started") {
      oscillator.stop();
    }
  }, []);

  const startSiren = useCallback(async (): Promise<void> => {
    if (!masterAudioEnabled) {
      return;
    }

    if (!audioReadyRef.current) {
      const isReady = await primeSirenAudio();
      if (!isReady) {
        return;
      }
    }

    const oscillator = getSirenOscillator();
    const lfo = getSirenLfo(oscillator);

    if (lfo.state !== "started") {
      lfo.start();
    }
    if (oscillator.state !== "started") {
      oscillator.start();
    }
  }, [getSirenLfo, getSirenOscillator, masterAudioEnabled, primeSirenAudio]);

  useEffect(() => {
    setTargetMethod(requestDraft.request.method as HttpMethod);
    setTargetUrl(requestDraft.request.url);
  }, [requestDraft]);

  const payload = useMemo(
    () => buildLoadTestRequestPayload(targetMethod, requestDraft),
    [requestDraft, targetMethod],
  );

  const handleStart = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (payload._tag === "Invalid" || !targetUrl.trim()) {
        return;
      }

      await primeSirenAudio();

      const parsedDuration = Number(durationSecs);
      const parsedConcurrency = Number(concurrency);
      const parsedTimeout = Number(timeoutMs);
      const parsedRps = rpsLimit.trim().length > 0 ? Number(rpsLimit) : undefined;

      await start({
        url: targetUrl.trim(),
        method: payload.method,
        headers: [...payload.headers],
        body: payload.body,
        durationSecs: Number.isFinite(parsedDuration)
          ? Math.max(parsedDuration, 1)
          : 30,
        concurrency: Number.isFinite(parsedConcurrency)
          ? Math.max(parsedConcurrency, 1)
          : 10,
        timeoutMs: Number.isFinite(parsedTimeout)
          ? Math.max(parsedTimeout, 1000)
          : 30_000,
        rpsLimit: parsedRps && Number.isFinite(parsedRps)
          ? Math.max(parsedRps, 1)
          : null,
      });
    },
    [
      concurrency,
      durationSecs,
      rpsLimit,
      start,
      targetUrl,
      timeoutMs,
      primeSirenAudio,
      payload,
    ],
  );

  useEffect(() => {
    if (status === "running" && isSirenEnabled && masterAudioEnabled) {
      void startSiren();
      return;
    }

    stopSiren();
  }, [isSirenEnabled, masterAudioEnabled, startSiren, status, stopSiren]);

  useEffect(() => {
    setSirenEnabled(sirenEnabledDefault);
  }, [sirenEnabledDefault]);

  useEffect(() => {
    if (!sirenOscRef.current) {
      return;
    }

    sirenOscRef.current.volume.value = toSirenVolumeDb(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    return () => {
      stopSiren();
      sirenLfoRef.current?.dispose();
      sirenLfoRef.current = null;
      sirenOscRef.current?.dispose();
      sirenOscRef.current = null;
    };
  }, [stopSiren]);

  const statusText = useMemo(() => {
    switch (status) {
      case "idle":
        return "Idle";
      case "running":
        return "Running";
      case "complete":
        return "Complete";
      case "error":
        return "Error";
      default:
        return status;
    }
  }, [status]);

  /** Only the fields that were filled in become claims. ADR-019 slice 5. */
  const thresholds = useMemo<LoadTestThreshold[]>(() => {
    const declared: LoadTestThreshold[] = [];
    const p95 = Number.parseFloat(p95Budget);
    if (Number.isFinite(p95) && p95 > 0) {
      declared.push({ metric: "p95_latency_ms", comparator: "below", value: p95 });
    }
    const errorRate = Number.parseFloat(errorRateBudget);
    if (Number.isFinite(errorRate) && errorRate >= 0) {
      // Entered as a percentage because that is how people say it.
      declared.push({ metric: "error_rate", comparator: "below", value: errorRate / 100 });
    }
    return declared;
  }, [p95Budget, errorRateBudget]);

  const verdict = useMemo(
    () => (latest ? evaluateThresholds(latest, thresholds) : null),
    [latest, thresholds],
  );

  /**
   * Downloads through a blob URL rather than a filesystem plugin: the panel runs
   * in a webview, and this keeps the export path identical in the browser and the
   * packaged app.
   */
  const download = useCallback((contents: string, filename: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type: mime }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const isBlastDoorAlertActive = status === "running"
    && isSirenEnabled
    && masterAudioEnabled
    && animationsEnabled;

  return (
    <section className={loadTestPanel}>
      {
        /*
        The chamber shares a pane with the response now, so the standing warning is
        a title affordance rather than two lines of permanent copy (ADR-011 Phase 4).
      */
      }
      <header className={loadTestHeader}>
        <h3 className={sectionTitle}>OPSYDYN Load Chamber (Experimental)</h3>
        <span
          className={loadTestWarning}
          title="Initiating a load test seals the blast doors and arms the sirens. A runner will pound this endpoint every 100ms until the alarms clear."
        >
          <WarningOctagonIcon size={16} weight="bold" />
          Arms the sirens
        </span>
      </header>

      {isDetecting && (
        <div style={{ opacity: 0.7 }}>
          Calibrating telemetry array and waiting for the OPSYDYN runtime to finish booting…
        </div>
      )}

      {!isDetecting && !isSupported && (
        <div style={{ opacity: 0.7 }}>
          Blast doors only unlock inside the desktop console. Launch the OPSYDYN app to wield the load chamber.
        </div>
      )}

      <form onSubmit={handleStart}>
        <div className={loadTestControls}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span className={metricLabel}>HTTP Method</span>
            <Select
              value={targetMethod}
              options={methodOptions}
              onChange={setTargetMethod}
            />
          </label>
          <label style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span className={metricLabel}>Target URL</span>
            <input
              className={textInput}
              type="url"
              required
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://api.example.com/resource"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span className={metricLabel}>Duration (sec)</span>
            <input
              className={textInput}
              type="number"
              min={1}
              value={durationSecs}
              onChange={(event) => setDurationSecs(event.target.value)}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span className={metricLabel}>Concurrency</span>
            <input
              className={textInput}
              type="number"
              min={1}
              value={concurrency}
              onChange={(event) => setConcurrency(event.target.value)}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span className={metricLabel}>RPS Limit (optional)</span>
            <input
              className={textInput}
              type="number"
              min={1}
              value={rpsLimit}
              onChange={(event) => setRpsLimit(event.target.value)}
              placeholder="Unlimited"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span className={metricLabel}>Timeout (ms)</span>
            <input
              className={textInput}
              type="number"
              min={1000}
              step={500}
              value={timeoutMs}
              onChange={(event) => setTimeoutMs(event.target.value)}
            />
          </label>
          {/* ADR-019 slice 5. Optional: left blank, the run asserts nothing. */}
          <label className={metricCard}>
            <span className={metricLabel}>P95 Budget (ms, optional)</span>
            <input
              className={textInput}
              type="number"
              min={1}
              step={10}
              placeholder="no threshold"
              value={p95Budget}
              onChange={(event) => setP95Budget(event.target.value)}
            />
          </label>
          <label className={metricCard}>
            <span className={metricLabel}>Error Budget (%, optional)</span>
            <input
              className={textInput}
              type="number"
              min={0}
              step={0.1}
              placeholder="no threshold"
              value={errorRateBudget}
              onChange={(event) => setErrorRateBudget(event.target.value)}
            />
          </label>
        </div>
        <div className={loadTestButtonRow} style={{ marginTop: "1rem" }}>
          <button
            className={submitButton}
            type="submit"
            disabled={status === "running" || !targetUrl.trim() || isDetecting || payload._tag === "Invalid"}
          >
            {status === "running" ? "Load In Progress…" : "Initiate Load Test"}
          </button>
          {
            /*
            ADR-019. Enabled only while a run is in flight, and it is the one
            control that is. Stopping keeps the stats gathered so far — the
            backend emits `load-test-complete` with them — so aborting a run
            costs the remaining duration, not the measurement.
          */
          }
          <button
            type="button"
            className={submitButton}
            style={{
              backgroundColor: status === "running"
                ? "rgba(249, 112, 102, 0.22)"
                : "transparent",
              color: "inherit",
              borderColor: status === "running"
                ? "rgba(249, 112, 102, 0.85)"
                : "rgba(60, 92, 80, 0.6)",
            }}
            onClick={() => {
              void stop();
            }}
            disabled={status !== "running"}
          >
            Abort Run
          </button>
          <button
            type="button"
            className={submitButton}
            style={{
              backgroundColor: "transparent",
              color: "inherit",
              borderColor: "rgba(60, 92, 80, 0.6)",
            }}
            onClick={reset}
            disabled={status === "running"}
          >
            Purge Telemetry
          </button>
          {
            /* ADR-019 slice 5. A number you cannot compare with last week's is
              not a regression test, so the interval series has to leave. */
          }
          <button
            type="button"
            className={submitButton}
            style={{
              backgroundColor: "transparent",
              color: "inherit",
              borderColor: "rgba(60, 92, 80, 0.6)",
            }}
            onClick={() => {
              download(toCsv(samples), "load-test.csv", "text/csv");
            }}
            disabled={samples.length === 0}
          >
            Export CSV
          </button>
          <button
            type="button"
            className={submitButton}
            style={{
              backgroundColor: "transparent",
              color: "inherit",
              borderColor: "rgba(60, 92, 80, 0.6)",
            }}
            onClick={() => {
              download(
                toJsonReport(samples, verdict),
                "load-test.json",
                "application/json",
              );
            }}
            disabled={samples.length === 0}
          >
            Export JSON
          </button>
          <button
            type="button"
            className={submitButton}
            style={{
              backgroundColor: isSirenEnabled
                ? "rgba(249, 112, 102, 0.18)"
                : "transparent",
              color: "inherit",
              borderColor: isSirenEnabled
                ? "rgba(249, 112, 102, 0.8)"
                : "rgba(60, 92, 80, 0.6)",
            }}
            onClick={() => {
              setSirenEnabled((prev) => !prev);
            }}
          >
            {isSirenEnabled ? "SIREN::ON" : "SIREN::OFF"}
          </button>
          <span className={loadTestStatus}>
            <span
              className={isBlastDoorAlertActive
                ? `${loadTestStatusIndicator} ${loadTestStatusIndicatorActive}`
                : loadTestStatusIndicator}
              aria-hidden="true"
            />
            <span>Blast Door Status: {statusText}</span>
          </span>
          {verdict?.declared === true && status !== "running" && (
            <span
              className={loadTestStatus}
              role="status"
              style={{
                color: verdict.passed ? "#4CC38A" : "#F97066",
                whiteSpace: "pre-line",
              }}
            >
              {formatThresholdVerdict(verdict)}
            </span>
          )}
        </div>
      </form>

      {payload._tag === "Invalid" && (
        <div
          role="alert"
          style={{
            marginTop: "0.75rem",
            color: "var(--status-critical, #ff7373)",
            fontSize: "0.9rem",
          }}
        >
          {payload.message}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: "0.75rem",
            color: "var(--status-critical, #ff7373)",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {latest && (
        <div className={loadTestMetrics}>
          <div className={metricCard}>
            <span className={metricLabel}>Average RPS</span>
            <span className={metricValue}>
              {formatNumber(latest.rps, 2)}
            </span>
          </div>
          <div className={metricCard}>
            <span className={metricLabel}>P95 Latency (ms)</span>
            <span className={metricValue}>
              {formatNumber(latest.p95_latency_ms, 2)}
            </span>
          </div>
          <div className={metricCard}>
            <span className={metricLabel}>Success / Fail</span>
            <span className={metricValue}>
              {formatNumber(latest.requests_success)}/
              {formatNumber(latest.requests_failed)}
            </span>
          </div>
        </div>
      )}

      <div className={chartVisualizationGrid}>
        <MetricVisualization
          label="Requests per Second"
          field="interval_rps"
          color="#4CC38A"
          samples={samples}
        />
        <MetricVisualization
          label="Latency P95 (ms)"
          field="interval_p95_latency_ms"
          color="#8FD6FF"
          units="ms"
          samples={samples}
        />
        <ThroughputLatencyScatter samples={samples} />
        <SuccessFailureStacked samples={samples} />
      </div>
      <LatencyBandsChart samples={samples} />
    </section>
  );
}
