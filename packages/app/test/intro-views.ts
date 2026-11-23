/**
 * (Tests) An intro as data (shops/timeline.ts) read in the names its tests have always used (the old IntroNow's, before the intros
 * moved onto the timeline): the step, the line, the table and stools, the hop back (`back`, `hop` 0 to 1), Alfil's pyramid and its
 * drift, Big Boy's blocks and the board's drop, Timber's wood (his move, his places, the log, the fog, the ring, the stumps), Smudgy's
 * cloth. So their checks stay word for word: only how they get the numbers changed.
 */
import { CHALLENGE_FEEL } from "../src/town/shops/challenge.ts";
import { TIMBER_BACK, TIMBER_REACH } from "../src/town/shops/intros/timber.ts";
import { played, timelineAt, timelineBeats, timelineCues, type ActorNow, type IntroData, type Place } from "../src/town/shops/timeline.ts";

const F = CHALLENGE_FEEL;
const fr = (a: ActorNow | undefined) => (a?.on && a.anim ? { anim: a.anim, frame: a.frame } : null);
/** Timber's places by name (his intro's data: the log `log.at` west of the table's middle, where he works, his step back). */
function placeName(p: Place): string {
  if (typeof p === "string") return p;
  const dc = p.dc ?? 0;
  const near = (x: number) => Math.abs(dc - x) < 1e-9;
  return near(-F.log.at) ? "log" : near(-TIMBER_REACH) ? "work" : near(-TIMBER_REACH - TIMBER_BACK) ? "stepped" : `table${dc}`;
}

export const beatsOf = (d: IntroData) => timelineBeats(d.timeline);
export const cuesOf = (d: IntroData) => timelineCues(d.timeline);
/** When you hop back clear of the stools (ms into the intro), or Infinity: you don't. */
export const hopStartOf = (d: IntroData): number => played(d.timeline).acts.get("you")?.find((p) => p.act.move?.to === "clear")?.start ?? Infinity;

/** The intro `t` ms in, in the old names. */
export function nowOf(d: IntroData, t: number) {
  const n = timelineAt(d.timeline, t);
  const c = n.cast;
  const on = (k: string) => !!c[k]?.on;
  const py = c.pyramid;
  const crumbled = !!py?.on && py.anim === "crumble" && py.ended;
  return {
    step: n.step,
    line: on("line"),
    chant: on("chant"),
    table: on("board"),
    stools: on("stools"),
    back: c.you?.u ?? 0,
    hop: (c.you?.hop ?? 0) / F.hopUp,
    pyramid: crumbled ? null : fr(py),
    drift: crumbled,
    blocks: fr(c.blocks),
    drop: c.board?.lift ?? 0,
    wood: d.mover ? { fog: fr(c.fog), ring: on("ring"), stumps: fr(c.stumps) } : null,
    cloth: fr(c.cloth),
  };
}
/** Timber `t` ms in, as woodAt had him: his own move (null: his town figure), between which of his places, the log. */
export function woodOf(d: IntroData, t: number) {
  const c = timelineAt(d.timeline, t).cast;
  const b = c.boss!;
  // (Once there, from where it went: woodAt's places.)
  return {
    move: b.on && b.anim ? { anim: b.anim, frame: b.frame, flip: b.flip } : null,
    from: placeName(b.u >= 1 ? b.to : b.from),
    to: placeName(b.to),
    u: b.u,
    log: fr(c.log) ?? fr(c.worked),
  };
}
