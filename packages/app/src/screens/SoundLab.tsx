import { useState } from "preact/hooks";
import { REEL_VOICES, getReelVoice, play, setReelVoice, unlockAudio, type ReelVoice } from "../sound.ts";

/** Delays (ms) of a roulette that slows down, like the reveal's reel. */
function reelDelays(steps = 11, total = 1900): number[] {
  const raw = Array.from({ length: steps }, (_, i) => Math.pow(1.22, i));
  const scale = total / raw.reduce((s, x) => s + x, 0);
  let t = 0;
  return raw.map((d) => {
    const at = t;
    t += d * scale;
    return at;
  });
}

/** Plays a whole roulette in a voice: the slowing steps, then the winner's three tones. */
function preview(voice: ReelVoice) {
  unlockAudio();
  const delays = reelDelays();
  delays.forEach((at) => setTimeout(() => play("reel", voice), at));
  setTimeout(() => play("select", voice), delays[delays.length - 1]! + 450);
}

/**
 * Audition the game's sounds and choose the roulette voice for the reveal.
 * The choice is saved on this device. Open with ?soundlab or from the first screen.
 */
export function SoundLab({ onBack }: { onBack: () => void }) {
  const [chosen, setChosen] = useState(getReelVoice());
  return (
    <div class="screen soundlab">
      <h1>Sound lab</h1>
      <p class="muted">
        The roulette plays while the move is being selected after each round, then three tones as the winner blinks. Tap ▶
        to hear a voice, and “Use” to make it the one the game plays on this device.
      </p>
      <ul class="lab-list">
        {(Object.keys(REEL_VOICES) as ReelVoice[]).map((v) => (
          <li key={v} class={chosen === v ? "chosen" : ""}>
            <button type="button" class="lab-play" onClick={() => preview(v)} aria-label={`Play ${REEL_VOICES[v].label}`}>
              ▶
            </button>
            <span class="lab-name">{REEL_VOICES[v].label}</span>
            <button
              type="button"
              class="lab-use"
              disabled={chosen === v}
              onClick={() => {
                setReelVoice(v);
                setChosen(v);
                preview(v);
              }}
            >
              {chosen === v ? "In use" : "Use"}
            </button>
          </li>
        ))}
      </ul>
      <h2 class="small muted">Other sounds</h2>
      <ul class="lab-list">
        {(
          [
            ["ripple", "Every board moving after a round"],
            ["tick", "Clock tick (last 10 s)"],
            ["move", "Piece move"],
            ["capture", "Capture"],
          ] as const
        ).map(([s, label]) => (
          <li key={s}>
            <button
              type="button"
              class="lab-play"
              onClick={() => {
                unlockAudio();
                setTimeout(() => play(s), 60);
              }}
              aria-label={`Play ${label}`}
            >
              ▶
            </button>
            <span class="lab-name">{label}</span>
          </li>
        ))}
      </ul>
      <p class="muted small">
        Found a sound you like? Send the file (or a link) and it can replace any of these. Good free sources: freesound.org
        (filter by the CC0 licence; try “steel drum hit”, “kalimba”, “roulette”), or make one in BeepBox (beepbox.co) and
        export a WAV.
      </p>
      <button type="button" class="btn btn-secondary" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
