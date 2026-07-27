import { SAVE_CUE_ENVELOPE, SAVE_CUE_LEAD_SECONDS, SAVE_CUE_NOTES, saveCueTailSeconds } from "@/core/effects/save-cue";
import { describe, expect, it } from "vitest";

/**
 * The save cue must not be able to hold a note.
 *
 * It was a `PolySynth` with `sustain: 0.12` — an instrument envelope, not a
 * percussive one. After attack and decay it holds at 12% amplitude *for as long
 * as nothing releases it*, so the beep ended only because `triggerAttackRelease`
 * scheduled a release. The sound's termination depended entirely on that release
 * arriving.
 *
 * The notes were also scheduled from exactly `Tone.now()`. Adding a card is the
 * heaviest interaction that triggers a save — React re-render, ReactFlow layout,
 * an autosave round trip — and if the main thread stalls before the audio thread
 * reaches those events, their times are already in the past. A release scheduled
 * in the past does not move the envelope, which is then stuck at sustain: one
 * continuous tone until something else releases the voice.
 *
 * So the fix is not to schedule further ahead and hope. A cue that cannot sustain
 * cannot hang, whatever happens to the scheduling.
 */

describe("the save cue envelope", () => {
  it("does not sustain, so a missed release cannot hold the note", () => {
    // The whole bug in one assertion.
    expect(SAVE_CUE_ENVELOPE.sustain).toBe(0);
  });

  it("decays on its own within a beep's worth of time", () => {
    const selfSilencing = SAVE_CUE_ENVELOPE.attack + SAVE_CUE_ENVELOPE.decay;

    expect(selfSilencing).toBeLessThan(0.5);
  });

  it("still opens fast enough to read as a click rather than a swell", () => {
    expect(SAVE_CUE_ENVELOPE.attack).toBeLessThan(0.05);
  });
});

describe("the note schedule", () => {
  it("never starts at exactly now", () => {
    // Zero lead is what puts the first event on the boundary of already-past.
    expect(SAVE_CUE_LEAD_SECONDS).toBeGreaterThan(0);
  });

  it("keeps the lead short enough to feel immediate", () => {
    expect(SAVE_CUE_LEAD_SECONDS).toBeLessThan(0.2);
  });

  it("uses seconds rather than note values", () => {
    // "16n" resolves against Transport BPM — a global nothing in this app sets,
    // so the cue's length was at the mercy of a default.
    for (const note of SAVE_CUE_NOTES) {
      expect(typeof note.durationSeconds).toBe("number");
      expect(note.durationSeconds).toBeGreaterThan(0);
    }
  });

  it("plays its notes in order", () => {
    const offsets = SAVE_CUE_NOTES.map((note) => note.offsetSeconds);

    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it("is over quickly — it is a cue, not a chord", () => {
    expect(saveCueTailSeconds()).toBeLessThan(1);
  });

  it("has notes to play", () => {
    expect(SAVE_CUE_NOTES.length).toBeGreaterThan(0);
  });
});
