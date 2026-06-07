import type { OpyViewportSectionKey } from "../../core/effects/settings.types";

export type OpyWidgetChromeTone = "neutral" | "ready" | "caution" | "critical";

export interface OpyWidgetChromeSignal {
  readonly key: "focus" | "policy" | "anomaly" | "review" | "proposal" | "checkpoint";
  readonly targetSection: OpyViewportSectionKey;
  readonly label: string;
  readonly detail: string;
  readonly tone: OpyWidgetChromeTone;
  readonly isFresh: boolean;
}

export interface OpyWidgetChromeStatus {
  readonly frameTone: OpyWidgetChromeTone;
  readonly signals: readonly OpyWidgetChromeSignal[];
}

export interface OpyWidgetChromeFocusRequest {
  readonly action: "focus-section" | "clear-focus";
  readonly section: OpyViewportSectionKey;
  readonly signalKey?: OpyWidgetChromeSignal["key"];
  readonly nonce: number;
}

const CHROME_TONE_WEIGHT: Record<OpyWidgetChromeTone, number> = {
  neutral: 0,
  ready: 1,
  caution: 2,
  critical: 3,
};

export const pickHigherOpyWidgetChromeTone = (
  left: OpyWidgetChromeTone,
  right: OpyWidgetChromeTone,
): OpyWidgetChromeTone => (CHROME_TONE_WEIGHT[right] > CHROME_TONE_WEIGHT[left] ? right : left);

export const compareOpyWidgetChromeTone = (
  left: OpyWidgetChromeTone,
  right: OpyWidgetChromeTone,
): number => CHROME_TONE_WEIGHT[right] - CHROME_TONE_WEIGHT[left];

export const areOpyWidgetChromeStatusesEqual = (
  left: OpyWidgetChromeStatus | null,
  right: OpyWidgetChromeStatus | null,
): boolean => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  if (left.frameTone !== right.frameTone || left.signals.length !== right.signals.length) {
    return false;
  }

  return left.signals.every((signal, index) => {
    const next = right.signals[index];
    return next !== undefined
      && signal.key === next.key
      && signal.targetSection === next.targetSection
      && signal.label === next.label
      && signal.detail === next.detail
      && signal.tone === next.tone
      && signal.isFresh === next.isFresh;
  });
};
