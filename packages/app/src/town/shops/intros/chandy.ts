/**
 * Chandy's intro (Nov 16; Eric's design, the brief chandy-home.md), as data (shops/timeline.ts): you both walk on to your marks in
 * the water (the battle spot hidden under it); his line; a pause. **The board rises first** on its mossy post out of the water, water
 * streaming off it, the post's foot still under the water on the sunken platform (`post`). A gap. **The platform rises** (`platform`)
 * under you both, its deck from under the water to `deckUp` squares over it, the post and the board riding up on it and you both lifted
 * with it from the moment its deck reaches your feet (no waterline on you from then). It settles; **the milk crates drop on** at the
 * stools' places (his blue, your orange) and you hop back clear of them; the set stands a beat; **his entrance**: he points, then fires
 * (his own moves, the board figure's, until his God King attack comes with his rules); his attack's beat; **his wipe**: a wall of the swamp's water
 * rolling in over the screen from the side (INTRO_CHANDY_STORM and _FRONT). Every number is CHALLENGE_FEEL.swamp or the art's frames.
 */
import { CHANDY } from "../../../characters/chandy.ts";
import { TABLE_BOARD } from "../../houses/park.ts";
import { CHALLENGE_FEEL } from "../challenge.ts";
import {
  CHANDY_PLATFORM_WET,
  CHANDY_POST_TOP,
  INTRO_CHANDY_CRATE,
  INTRO_CHANDY_FRONT,
  INTRO_CHANDY_PLATFORM,
  INTRO_CHANDY_POST,
  INTRO_CHANDY_STORM,
} from "../chandy-intro-art.ts";
import { clipsOf, defineIntro, type Act } from "../timeline.ts";
import { faceBeat, hopBack, lenOf, lineBeat, pauseBeat, swingBeat, tableBeat } from "./common.ts";

const F = CHALLENGE_FEEL;
const S = F.swamp;
/** How far over the post's foot its cap is (squares): the board's slab sits there, not at a park table's height. */
const BOARD_UP = (INTRO_CHANDY_POST.foot[1] - CHANDY_POST_TOP - TABLE_BOARD.top) / 37;
const M = clipsOf(CHANDY);
/** When, into the platform's rise, its deck reaches the water's surface (your feet): you're lifted from then, at its pace. */
const atSurface = Math.round((-S.deckDown / (S.deckUp - S.deckDown)) * S.platformMs);
const lifted = (who: "you" | "boss"): Act => ({ actor: who, at: atSurface, lift: { from: 0, to: S.deckUp, ms: S.platformMs - atSurface, ease: "linear" } });
const ride = (actor: string, by = 0): Act => ({ actor, lift: { from: S.deckDown + by, to: S.deckUp + by, ms: S.platformMs, ease: "linear" } });

export const CHANDY_INTRO = defineIntro({
  props: {
    platform: { ch: INTRO_CHANDY_PLATFORM, at: ["table"], wet: CHANDY_PLATFORM_WET, flat: true },
    post: { ch: INTRO_CHANDY_POST, at: ["table"], wet: 0 },
    board: { wet: 0 },
    crateB: { ch: INTRO_CHANDY_CRATE, at: ["bossStool"] },
    crateY: { ch: INTRO_CHANDY_CRATE, at: ["youStool"] },
  },
  mover: CHANDY,
  storm: { tile: INTRO_CHANDY_STORM, front: INTRO_CHANDY_FRONT },
  beats: [
    faceBeat(),
    lineBeat(),
    pauseBeat(),
    {
      step: "post",
      ms: S.postMs,
      acts: [
        { actor: "post", play: "stream", loop: true, lift: { from: S.postFrom, to: S.deckDown, ms: S.postMs, ease: "smooth" } },
        { actor: "board", show: true, lift: { from: S.postFrom + BOARD_UP, to: S.deckDown + BOARD_UP, ms: S.postMs, ease: "smooth" } },
        { cue: "rise" },
      ],
    },
    pauseBeat(F.gapMs),
    {
      step: "platform",
      ms: S.platformMs,
      acts: [{ actor: "platform", play: "stream", loop: true }, ride("platform"), ride("post"), ride("board", BOARD_UP), lifted("you"), lifted("boss"), { cue: "rise" }],
    },
    { step: "settle", ms: S.settleMs, acts: [{ actor: "platform", play: "idle", frame: 0 }, { actor: "post", play: "idle", frame: 0 }] },
    {
      step: "crates",
      ms: S.cratesMs,
      acts: [
        { actor: "crateB", play: "blue", lift: { from: S.deckUp + S.crateDrop, to: S.deckUp, ms: S.cratesMs - 60, ease: "in" } },
        { actor: "crateY", play: "orange", lift: { from: S.deckUp + S.crateDrop, to: S.deckUp, ms: S.cratesMs - 60, ease: "in" } },
        { actor: "stools", show: true },
        { cue: "crate", at: S.cratesMs - 60 },
        ...hopBack(),
      ],
    },
    tableBeat(),
    {
      step: "entrance",
      ms: lenOf(M.point) + lenOf(M.fire),
      acts: [
        { actor: "boss", play: "point", move: { to: "clear" } },
        { actor: "boss", at: lenOf(M.point), play: "fire", move: { to: "clear" } },
      ],
    },
    swingBeat([{ actor: "boss", play: null }]),
  ],
  // (The test hook's: each piece's height (squares), whether it shows, and yours and his.)
  view: (c) => ({ swamp: Object.fromEntries(["post", "platform", "board", "crateB", "crateY", "you", "boss"].map((k) => [k, c[k] ? { on: c[k]!.on, lift: Math.round(c[k]!.lift * 1000) / 1000, anim: c[k]!.anim } : null])) }),
});
/** (Its intro as data, by its home: shops/intro.ts finds it by its file's name.) */
export default CHANDY_INTRO;
