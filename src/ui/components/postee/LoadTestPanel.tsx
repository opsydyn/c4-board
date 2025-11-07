import {
	type FormEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { LinePath, Bar, AreaClosed } from "@visx/shape";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import type { LoadTestProgress } from "@/core/effects/postee";
import { useLoadTest } from "./useLoadTest";
import { WarningOctagon } from "@phosphor-icons/react";
import {
	loadTestPanel,
	loadTestControls,
	loadTestButtonRow,
	loadTestStatus,
	loadTestMetrics,
	metricCard,
	metricLabel,
	metricValue,
	chartWrapper,
	chartVisualizationGrid,
	chartSection,
	chartHeader,
	chartRow,
	miniBarWrapper,
	miniBarValue,
	latencyBandsCard,
	latencyBandsHeader,
	latencyLegend,
	latencyLegendItem,
	latencyLegendSwatch,
	textInput,
	submitButton,
	sectionTitle,
} from "./PosteeWorkspace.css";

const methodOptions = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"HEAD",
	"OPTIONS",
	"TRACE",
] as const;

interface LoadTestPanelProps {
	request?: {
		id: string;
		name: string;
		method: string;
		url: string;
	};
}

const viewWidth = 600;
const viewHeight = 160;

const formatNumber = (value: number, digits = 0) =>
	new Intl.NumberFormat(undefined, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(value);

interface ChartProps {
	samples: LoadTestProgress[];
	field: keyof LoadTestProgress;
	color: string;
	label: string;
	units?: string;
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
		const maxElapsed =
			data.length > 0 ? data[data.length - 1]?.elapsed_ms ?? 1 : 1;

		const numericValues = data.map((sample) => {
			const rawValue = sample[field];
			const value =
				typeof rawValue === "number" && Number.isFinite(rawValue)
					? rawValue
					: 0;
			return value;
		});

		const computedMax =
			typeof maxValue === "number" && maxValue > 0
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
						Max{" "}
						{formatNumber(
							maxDisplay > 0 ? maxDisplay : safeMax,
							units ? 2 : 0,
						)}
						{units ? ` ${units}` : ""}
					</span>
				</div>
			)}
			{data.length < 2 ? (
				<div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
					Run a test to populate the chart.
				</div>
			) : (
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
					rx={barHeight / 2}
					fill="rgba(44, 70, 60, 0.45)"
				/>
				<Bar
					width={Math.min(scaledValue, width - horizontalPadding * 2)}
					height={barHeight}
					rx={barHeight / 2}
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

	const latestValue =
		numericValues.length > 0
			? numericValues[numericValues.length - 1]
			: 0;
	const observedMax =
		numericValues.length > 0
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
				p50:
					typeof sample.p50_latency_ms === "number"
						? sample.p50_latency_ms
						: 0,
				p95:
					typeof sample.p95_latency_ms === "number"
						? sample.p95_latency_ms
						: 0,
				p99:
					typeof sample.p99_latency_ms === "number"
						? sample.p99_latency_ms
						: 0,
				avg:
					typeof sample.avg_latency_ms === "number"
						? sample.avg_latency_ms
						: 0,
			})),
		[samples],
	);

	const hasData = chartData.length >= 2;

	const xScale = useMemo(() => {
		const maxElapsed =
			chartData.length > 0
				? chartData[chartData.length - 1]?.time ?? 1
				: 1;
		return scaleLinear({
			domain: [0, Math.max(maxElapsed, 1)],
			range: [0, viewWidth],
		});
	}, [chartData]);

	const yScale = useMemo(() => {
		const maxLatency =
			chartData.length > 0
				? Math.max(
						...chartData.map((entry) =>
							Math.max(entry.p50, entry.p95, entry.p99, entry.avg),
						),
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
					Latest P95:{" "}
					{formatNumber(
						chartData.length
							? chartData[chartData.length - 1].p95
							: 0,
						2,
					)}{" "}
					ms
				</span>
			</div>

			{!hasData ? (
				<div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
					Run a test to see percentile bands.
				</div>
			) : (
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

export function LoadTestPanel({ request }: LoadTestPanelProps) {
	const {
		status,
		error,
		samples,
		latest,
		isDetecting,
		start,
		isSupported,
		reset,
	} = useLoadTest();

	const [targetMethod, setTargetMethod] = useState<string>(
		request?.method ?? "GET",
	);
	const [targetUrl, setTargetUrl] = useState<string>(request?.url ?? "");
	const [durationSecs, setDurationSecs] = useState<string>("30");
	const [concurrency, setConcurrency] = useState<string>("10");
	const [rpsLimit, setRpsLimit] = useState<string>("");
	const [timeoutMs, setTimeoutMs] = useState<string>("30000");

	useEffect(() => {
		if (request) {
			setTargetMethod(request.method);
			setTargetUrl(request.url);
		} else {
			setTargetUrl("");
		}
	}, [request]);

	const handleStart = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!targetUrl.trim()) {
				return;
			}

			const parsedDuration = Number(durationSecs);
			const parsedConcurrency = Number(concurrency);
			const parsedTimeout = Number(timeoutMs);
			const parsedRps =
				rpsLimit.trim().length > 0 ? Number(rpsLimit) : undefined;

			await start({
				url: targetUrl.trim(),
				method: targetMethod,
				durationSecs: Number.isFinite(parsedDuration)
					? Math.max(parsedDuration, 1)
					: 30,
				concurrency: Number.isFinite(parsedConcurrency)
					? Math.max(parsedConcurrency, 1)
					: 10,
				timeoutMs: Number.isFinite(parsedTimeout)
					? Math.max(parsedTimeout, 1000)
					: 30_000,
				rpsLimit:
					parsedRps && Number.isFinite(parsedRps)
						? Math.max(parsedRps, 1)
						: null,
			});
		},
		[
			concurrency,
			durationSecs,
			rpsLimit,
			start,
			targetMethod,
			targetUrl,
			timeoutMs,
		],
	);

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

	return (
		<section className={loadTestPanel}>
			<header>
				<h3 className={sectionTitle}>OPSYDYN Load Chamber (Experimental)</h3>
				<p
					style={{
						marginTop: "0.25rem",
						fontSize: "0.9rem",
						opacity: 0.75,
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					}}
				>
					<WarningOctagon size={18} weight="bold" />
					<span>
						Initiating a load test seals the blast doors and arms the sirens. A runner will pound this endpoint every 100ms until the alarms clear.
					</span>
				</p>
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
						<select
							value={targetMethod}
							onChange={(event) => setTargetMethod(event.target.value)}
							className={textInput}
						>
							{methodOptions.map((method) => (
								<option key={method} value={method}>
									{method}
								</option>
							))}
						</select>
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
				</div>
				<div className={loadTestButtonRow} style={{ marginTop: "1rem" }}>
					<button
						className={submitButton}
						type="submit"
						disabled={status === "running" || !targetUrl.trim() || isDetecting}
					>
						{status === "running" ? "Load In Progress…" : "Initiate Load Test"}
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
					<span className={loadTestStatus}>Blast Door Status: {statusText}</span>
				</div>
			</form>

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
					field="rps"
					color="#4CC38A"
					samples={samples}
				/>
				<MetricVisualization
					label="Latency P95 (ms)"
					field="p95_latency_ms"
					color="#8FD6FF"
					units="ms"
					samples={samples}
				/>
			</div>
			<LatencyBandsChart samples={samples} />
		</section>
	);
}
