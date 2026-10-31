/**
 * The Colosseum's ambient crowd: Eric's "Gladiator arena ambience" (an hour; sounds/colosseum/CREDITS.md, made by
 * scripts/crowd-sounds.py), streamed. An <audio> element, so only what plays is downloaded (Range requests; the service
 * worker leaves the file to the network), started at a random point in the hour and looping at its end; its level goes
 * through Web Audio (`mediaGain`: a 1 s fade in and out, since iOS ignores an element's volume). It plays while the
 * gear's "Ambient crowd noise" is on, the game's Sound is on and the tab shows; if the browser won't start it before a
 * tap, it starts on the next tap or key. Nothing here runs on the frame loop.
 */
import { isMuted, mediaGain, onMuteChange } from "../sound.ts";

export const AMBIENT_URL = "/sounds/colosseum/ambient.mp3";
/** The file's length (s), to pick the start before its header has loaded. */
const LENGTH_S = 3600;
const FADE_S = 1;
const GESTURES = ["pointerdown", "touchend", "keydown"] as const;

export class Ambient {
  private el: HTMLAudioElement | null = null;
  private stopTimer = 0;
  private waiting = false;
  private readonly offMute: () => void;
  /** Where in the hour it started (s). */
  readonly start = 1 + Math.random() * (LENGTH_S - 2);

  constructor(private wanted: boolean) {
    this.offMute = onMuteChange(this.update);
    document.addEventListener("visibilitychange", this.update);
    this.update();
  }

  /** The gear's switch. */
  set(on: boolean) {
    this.wanted = on;
    this.update();
  }

  state() {
    return { playing: !!this.el && !this.el.paused, time: this.el?.currentTime ?? 0, start: this.start };
  }

  dispose() {
    this.offMute();
    document.removeEventListener("visibilitychange", this.update);
    this.stopWaiting();
    clearTimeout(this.stopTimer);
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute("src");
      this.el.load();
    }
  }

  private should = () => this.wanted && !isMuted() && document.visibilityState !== "hidden";

  private update = () => (this.should() ? this.play() : this.fadeOut());

  private element() {
    if (this.el) return this.el;
    const el = new Audio();
    el.loop = true;
    el.preload = "auto";
    // The start as a media fragment, so the first request is already for it; if a browser ignores the fragment, a seek.
    el.src = `${AMBIENT_URL}#t=${this.start.toFixed(1)}`;
    el.addEventListener("loadedmetadata", () => {
      if (el.currentTime < 1) el.currentTime = Math.min(this.start, (Number.isFinite(el.duration) ? el.duration : LENGTH_S) - 1);
    }, { once: true });
    this.el = el;
    return el;
  }

  private fadeTo(level: number) {
    const out = this.el && mediaGain(this.el);
    if (!out) return;
    const p = out.gain.gain;
    const now = out.ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(level, now + FADE_S);
  }

  private play() {
    clearTimeout(this.stopTimer);
    const el = this.element();
    this.fadeTo(1);
    if (el.paused) el.play().catch(() => this.waitForTap());
  }

  private fadeOut() {
    const el = this.el;
    if (!el || el.paused) return;
    this.fadeTo(0);
    clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => !this.should() && el.pause(), FADE_S * 1000);
  }

  /** Autoplay refused: try again inside the next tap or key (main.tsx's own listener has woken the audio by then). */
  private waitForTap() {
    if (this.waiting) return;
    this.waiting = true;
    for (const ev of GESTURES) window.addEventListener(ev, this.onTap, { passive: true });
  }

  private stopWaiting() {
    this.waiting = false;
    for (const ev of GESTURES) window.removeEventListener(ev, this.onTap);
  }

  private onTap = () => {
    this.stopWaiting();
    this.update();
  };
}
