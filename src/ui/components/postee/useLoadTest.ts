import { useCallback, useEffect, useMemo, useState } from "react";
import { Effect } from "effect";
import {
	startLoadTest,
	listenLoadTestProgress,
	listenLoadTestComplete,
	listenLoadTestError,
	ensureTauriRuntime,
	isTauriRuntime,
	type LoadTestConfigInput,
	type LoadTestProgress,
} from "@/core/effects/postee";

type LoadTestStatus = "idle" | "running" | "complete" | "error";

const MAX_SAMPLES = 600;

export interface LoadTestState {
	status: LoadTestStatus;
	error: string | null;
	latest: LoadTestProgress | null;
	samples: LoadTestProgress[];
	start: (config: LoadTestConfigInput) => Promise<void>;
	isSupported: boolean;
	isDetecting: boolean;
	reset: () => void;
}

export const useLoadTest = (): LoadTestState => {
	const [status, setStatus] = useState<LoadTestStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [samples, setSamples] = useState<LoadTestProgress[]>([]);
	const [latest, setLatest] = useState<LoadTestProgress | null>(null);
	const [isSupported, setIsSupported] = useState<boolean>(isTauriRuntime());
	const [isDetecting, setIsDetecting] = useState<boolean>(!isTauriRuntime());

	const reset = useCallback(() => {
		setStatus("idle");
		setError(null);
		setSamples([]);
		setLatest(null);
		setIsSupported(isTauriRuntime());
		setIsDetecting(!isTauriRuntime());
	}, []);

	useEffect(() => {
		let cancelled = false;
		if (!isTauriRuntime()) {
			setIsDetecting(true);
		}

		void ensureTauriRuntime()
			.then((ready) => {
				if (cancelled) {
					return;
				}
				setIsDetecting(false);
				setIsSupported(ready);
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				setIsDetecting(false);
				setIsSupported(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!isSupported) {
			return;
		}

		let cancelled = false;
		let unlistenFns: Array<() => void> = [];

		const register = async () => {
			try {
				const progressUnlisten = await Effect.runPromise(
					listenLoadTestProgress(({ payload }) => {
						if (cancelled || !payload) {
							return;
						}

						setLatest(payload);
						setSamples((prev) => {
							const next = [...prev, payload];
							return next.length > MAX_SAMPLES
								? next.slice(next.length - MAX_SAMPLES)
								: next;
						});
					}),
				);

				const completeUnlisten = await Effect.runPromise(
					listenLoadTestComplete(({ payload }) => {
						if (cancelled || !payload) {
							return;
						}
						setLatest(payload);
						setSamples((prev) => {
							const next = [...prev, payload];
							return next.length > MAX_SAMPLES
								? next.slice(next.length - MAX_SAMPLES)
								: next;
						});
						setStatus("complete");
					}),
				);

				const errorUnlisten = await Effect.runPromise(
					listenLoadTestError(({ payload }) => {
						if (cancelled) {
							return;
						}
						const message =
							typeof payload === "string"
								? payload
								: payload ?? "Load test failed";
						setError(message);
						setStatus("error");
					}),
				);

				if (!cancelled) {
					unlistenFns = [
						progressUnlisten,
						completeUnlisten,
						errorUnlisten,
					];
				} else {
					progressUnlisten();
					completeUnlisten();
					errorUnlisten();
				}
			} catch (subscriptionError) {
				if (!cancelled) {
					console.error(
						"Failed to subscribe to load test events",
						subscriptionError,
					);
					setError("Unable to subscribe to load test events");
				}
			}
		};

		void register();

		return () => {
			cancelled = true;
			unlistenFns.forEach((fn) => fn());
		};
	}, [isSupported]);

	const start = useCallback(
		async (config: LoadTestConfigInput) => {
			setStatus("running");
			setError(null);
			setSamples([]);
			setLatest(null);

			try {
				const ready = await ensureTauriRuntime();
				setIsSupported(ready);
				setIsDetecting(false);

				if (!ready) {
					throw new Error(
						"Load testing requires the desktop runtime.",
					);
				}

				await Effect.runPromise(startLoadTest(config));
			} catch (cause) {
				const message =
					cause instanceof Error
						? cause.message
						: "Failed to start load test";
				console.error("Failed to start load test", cause);
				setError(message);
				setStatus("error");
			}
		},
		[],
	);

		return useMemo(
			() => ({
				status,
			error,
			latest,
			samples,
			start,
			isSupported,
			isDetecting,
			reset,
		}),
		[status, error, latest, samples, start, reset, isSupported, isDetecting],
	);
};
