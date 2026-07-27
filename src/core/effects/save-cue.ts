/**
 * The save confirmation cue.
 *
 * Shape only — no audio API is touched here. The synth lives in the shell; what
 * it should sound like and when each note fires is data, which is why the one
 * property that matters can be asserted without a browser.
 *
 * That property: **the envelope must not sustain.** The cue was previously a
 * `PolySynth` with `sustain: 0.12`, which holds at 12% amplitude until something
 * releases it. `triggerAttackRelease` schedules that release, so the beep ended
 * only because the release arrived — and notes were scheduled from exactly
 * `Tone.now()`. Adding a card is the heaviest interaction that triggers a save,
 * and when the main thread stalls those times fall into the past. A release
 * scheduled in the past does not move the envelope, leaving it parked at sustain:
 * a continuous tone rather than a beep.
 *
 * With `sustain: 0` the envelope returns to silence on its own. A missed release
 * can no longer hold anything, whatever the scheduler does.
 */

export interface SaveCueEnvelope {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
}

/**
 * Percussive: attack, decay to silence, done. `sustain: 0` is load-bearing and
 * not a taste decision — see the module comment before changing it.
 */
export const SAVE_CUE_ENVELOPE: SaveCueEnvelope = {
  attack: 0.006,
  decay: 0.18,
  sustain: 0,
  release: 0.12,
};

export interface SaveCueNote {
  readonly note: string;
  /**
   * Seconds, deliberately — note values like `"16n"` resolve against Transport
   * BPM, a global this app never sets, so the cue's length was decided by a
   * default nobody chose.
   */
  readonly durationSeconds: number;
  readonly offsetSeconds: number;
}

export const SAVE_CUE_NOTES: ReadonlyArray<SaveCueNote> = [
  { note: "C4", durationSeconds: 0.12, offsetSeconds: 0 },
  { note: "E4", durationSeconds: 0.12, offsetSeconds: 0.08 },
  { note: "G4", durationSeconds: 0.18, offsetSeconds: 0.16 },
];

/**
 * Scheduling the first note at exactly `Tone.now()` puts it on the boundary of
 * already-past. A small lead costs nothing perceptually and keeps every event in
 * the future at the moment it is scheduled.
 */
export const SAVE_CUE_LEAD_SECONDS = 0.06;

/** When the last note has finished sounding, measured from the cue's start. */
export const saveCueTailSeconds = (): number =>
  SAVE_CUE_NOTES.reduce(
    (latest, note) => Math.max(latest, note.offsetSeconds + note.durationSeconds + SAVE_CUE_ENVELOPE.release),
    0,
  );
