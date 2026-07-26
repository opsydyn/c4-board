import { DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-019. The siren is opt-in.
 *
 * `sirenEnabledDefault` shipped as `true`, so a first-time user pressing the
 * obvious button got an oscillator in their ears with no warning. Anything that
 * makes noise on someone's machine should be opted into.
 *
 * The reason it was defensible before is gone: the siren was the only signal that
 * an unstoppable run was still going. Now that a run can be stopped, the alarm
 * can be what it always should have been.
 */

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("audible alarms are opt-in", () => {
  it("does not arm the siren by default", () => {
    expect(DEFAULT_APP_SETTINGS.sirenEnabledDefault).toBe(false);
  });

  it("leaves the rest of the audio defaults alone", () => {
    // Only the alarm changes. Save cues are quiet, brief and expected.
    expect(DEFAULT_APP_SETTINGS.masterAudioEnabled).toBe(true);
    expect(DEFAULT_APP_SETTINGS.saveVolEnabled).toBe(true);
  });

  it("does not re-arm the siren in the panel's own prop default", () => {
    // A component default of `true` would quietly override the settings default
    // for any caller that does not pass the prop.
    const panel = read("src/ui/components/postee/LoadTestPanel.tsx");

    expect(panel).not.toMatch(/sirenEnabledDefault\s*=\s*true/);
  });
});

describe("the siren can be silenced without stopping the run", () => {
  const panel = () => read("src/ui/components/postee/LoadTestPanel.tsx");

  it("keeps a control that only affects the noise", () => {
    // Silencing must never require aborting the measurement, and must not depend
    // on the global audio toggle being reachable from here.
    expect(panel()).toMatch(/setSirenEnabled/);
  });

  it("leaves the siren control usable while a run is in flight", () => {
    // A kill switch disabled during the run would be useless exactly when needed.
    const match = panel().match(/onClick=\{\(\) => setSirenEnabled[^}]*\}[\s\S]{0,400}?>/);

    expect(match?.[0] ?? "", "siren toggle not found").not.toMatch(
      /disabled=\{[^}]*status === "running"/,
    );
  });
});
