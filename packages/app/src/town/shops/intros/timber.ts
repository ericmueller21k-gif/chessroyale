/**
 * Timber's intro (Nov 3), as data (shops/timeline.ts; CHALLENGE_FEEL.log): the log lies `log.at` squares west of the table's middle
 * from the walk in. His line shows `lineLeadMs` alone, then (the bubble its `lineMs`, riding his head) he walks west to the log
 * (his walk, mirrored) at `walkMs` a square; heaves it up (from then it's in his paws, his own frames); carries it to where he works
 * (his art's `reach` west of the middle, so the log he sets down stands on the table's place) at `carryMs` a square; sets it down (the
 * log standing on its own from the set-down's last frame); gnaws it (his teeth's sounds, not the log's) and on as the shavings' fog
 * boils up; under the fog's hold (`holdMs`) the log is gone and his table and board are in; it settles, its last frame a ring of
 * shavings on the floor; the stumps pop up at the stools' places and you hop back clear of them; he dusts off his paws (a step back,
 * as drawn) and walks to where he swings (`log.clear` from the middle); his attack; his sawdust sweep.
 */
import { BOSS_ART } from "../../render.ts";
import { TOWN_FEEL } from "../../feel.ts";
import { CHALLENGE_FEEL } from "../challenge.ts";
import {
  BOSS_BEAVER_INTRO,
  INTRO_TIMBER_FRONT,
  INTRO_TIMBER_LOG,
  INTRO_TIMBER_SHAVINGS,
  INTRO_TIMBER_STORM,
  INTRO_TIMBER_STUMP,
  INTRO_TIMBER_TABLE,
  INTRO_TIMBER_TABLE_PALETTE,
  TIMBER_INTRO_LIFT_AT,
  TIMBER_INTRO_REACH,
} from "../timber-intro-art.ts";
import { clipsOf, defineIntro, frameStart, type Place } from "../timeline.ts";
import { faceBeat, hopBack, lenOf, lineBeat, swingBeat } from "./common.ts";

const F = CHALLENGE_FEEL;
const L = F.log;
/** His pixels a square: his town figure's (BOSS_ART), `bossSquares` tall. */
const PER_SQ = BOSS_ART.timber.h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.timber ?? 1));
const M = clipsOf(BOSS_BEAVER_INTRO);
const footX = (f: { layers: readonly { part: string; x: number }[] }) => f.layers.find((l) => l.part.startsWith("foot"))?.x ?? 0;
const done = BOSS_BEAVER_INTRO.anims.done!.frames;
/** How far (squares) east of his foot the log stands as he works it, and how far west his dusting off steps him. */
export const TIMBER_REACH = TIMBER_INTRO_REACH[0] / PER_SQ;
export const TIMBER_BACK = (footX(BOSS_BEAVER_INTRO.anims.idle!.frames[0]!) - footX(done[done.length - 1]!)) / PER_SQ;
/** Where the log lies; where he works; where his dusting off leaves him (his row: the table's, on his drawn marks). */
const LOG: Place = { at: "table", dc: -L.at };
const WORK: Place = { at: "table", dc: -TIMBER_REACH };
const STEPPED: Place = { at: "table", dc: -TIMBER_REACH - TIMBER_BACK };
/** His walks (ms): from his mark west to the log, carrying it to where he works, from his step back to where he swings. */
const toLog = Math.round((L.at - F.standOff.across) * L.walkMs);
const carry = Math.round((L.at - TIMBER_REACH) * L.carryMs);
const toMark = Math.round((L.clear - TIMBER_REACH - TIMBER_BACK) * L.walkMs);
const setDown = M.setDown!;

export const TIMBER_INTRO = defineIntro({
  props: {
    log: { ch: INTRO_TIMBER_LOG, scale: "boss", off: { lying: TIMBER_INTRO_LIFT_AT } },
    ring: { ch: INTRO_TIMBER_SHAVINGS },
    stumps: { ch: INTRO_TIMBER_STUMP, at: ["bossStool", "youStool"] },
    table: {},
    board: {},
    worked: { ch: INTRO_TIMBER_LOG, scale: "boss", off: { standing: TIMBER_INTRO_REACH, gnawed: TIMBER_INTRO_REACH } },
    fog: { ch: INTRO_TIMBER_SHAVINGS, over: true },
  },
  mover: BOSS_BEAVER_INTRO,
  table: INTRO_TIMBER_TABLE,
  palette: INTRO_TIMBER_TABLE_PALETTE,
  storm: { tile: INTRO_TIMBER_STORM, front: INTRO_TIMBER_FRONT },
  clear: L.clear,
  cast: [{ actor: "log", play: "lying", frame: 0, move: { to: LOG } }],
  beats: [
    faceBeat(),
    lineBeat(L.lineLeadMs, F.lineMs),
    { step: "toLog", ms: toLog, acts: [{ actor: "boss", play: "walk", loop: true, flip: true, move: { from: "mark", to: LOG, ms: toLog } }] },
    { step: "lift", ms: lenOf(M.lift), acts: [{ actor: "boss", play: "lift" }, { actor: "log", hide: true }] },
    { step: "carry", ms: carry, acts: [{ actor: "boss", play: "carry", loop: true, move: { to: WORK, ms: carry } }] },
    {
      step: "setDown",
      ms: lenOf(setDown),
      acts: [{ actor: "boss", play: "setDown" }, { actor: "worked", at: frameStart(setDown, setDown.ms.length - 1), play: "standing", frame: 0, move: { to: WORK } }],
    },
    { step: "gnaw", ms: lenOf(clipsOf(INTRO_TIMBER_LOG).gnawed), acts: [{ actor: "boss", play: "gnaw", loop: true }, { actor: "worked", play: "gnawed", quiet: true }] },
    { step: "rise", ms: lenOf(clipsOf(INTRO_TIMBER_SHAVINGS).rise), acts: [{ actor: "fog", play: "rise" }] },
    {
      step: "hold",
      ms: L.holdMs,
      acts: [{ actor: "boss", play: "idle", frame: 0 }, { actor: "worked", hide: true }, { actor: "fog", play: "hold", loop: true }, { actor: "table", show: true }, { actor: "board", show: true }],
    },
    { step: "settle", ms: lenOf(clipsOf(INTRO_TIMBER_SHAVINGS).settle), acts: [{ actor: "fog", play: "settle" }] },
    {
      step: "pop",
      ms: lenOf(clipsOf(INTRO_TIMBER_STUMP).pop),
      acts: [{ actor: "fog", hide: true }, { actor: "ring", play: "settle", frame: -1 }, { actor: "stumps", play: "pop" }, { actor: "stools", show: true }, hopBack()[0]!],
    },
    { step: "dust", ms: lenOf(M.done), acts: [{ actor: "boss", play: "done" }, { actor: "stumps", play: "idle", frame: 0 }] },
    { step: "toMark", ms: toMark, acts: [{ actor: "boss", play: "walk", loop: true, flip: true, move: { from: STEPPED, to: "clear", ms: toMark } }] },
    swingBeat([{ actor: "boss", play: null }]),
  ],
  // (The test hook's, as before: his move, the log (lying, standing or gnawed), the fog, the shavings' ring, the stumps.)
  view: (c) => {
    const on = (k: string) => (c[k]?.on ? c[k]!.anim : null);
    return { wood: { move: c.boss?.on ? c.boss.anim : null, log: on("log") ?? on("worked"), fog: on("fog"), ring: !!c.ring?.on, stumps: on("stumps") } };
  },
});
/** (Its intro as data, by its home: shops/intro.ts finds it by its file's name.) */
export default TIMBER_INTRO;
