import { useLayoutEffect, type MutableRef } from "preact/hooks";
import { LAST_STAND, kingHelpBlocked } from "@chessroyale/chess";
import { ENGINE_EYE, HEAD_SIZE, ON_BOARD_ANIMS, RECLUSE, RECLUSE_BUST, headOf } from "../characters/recluse.ts";
import { GOD_KING } from "../characters/god-king.ts";
import type { Character, Frame } from "../characters/sprite.ts";
import { RECLUSE_LINES } from "../characters/recluse-lines.ts";
import { animLength, cueAt } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { kingSay } from "../godKing.ts";
import { warmSounds } from "../sound.ts";
import { CRITICAL, bossVoice } from "../speech.tsx";
import { prewarmSprite } from "./BossEffect.tsx";
import { prewarmKing } from "./GodKing.tsx";
import { figureLoop, playInPlace } from "./BossCharacter.tsx";
import type { BossUi, KitMoment, MomentProps } from "./PowerParts.tsx";

/**
 * The Hidden Boss on screen (his rules: packages/chess/src/bosses/recluse.ts; admins only, in Boss alone):
 * - **The bullet clock** (his ultimate, no warning): where he stands (his bust in a phone's boss bar, his whole figure by
 *   the board on a computer) he consults the red book, then opens it like a spell book, its pages glowing and turning,
 *   his hair in the wind, laughing; holds the spell; slams it shut. His line as it begins; "BULLET!" as the book falls
 *   open. From then on the dock says "Bullet" with the time left in your bank on every move (Play.tsx).
 * - **The God King's help blocked** (his passive): tapping the God King's move or strike, the help doesn't come and
 *   nothing is spent; he slams the book shut and mocks it, and the God King says his help won't take hold.
 * All of it where he stands (playInPlace): he never steps onto the board.
 */

/** The bullet clock's moment where he stands: the book consulted, opened like a spell book, the spell held, slammed shut. */
export const BULLET_ANIMS = ["consult", "spellbook", "spellLoop", "spellClose"] as const;
/** Its beats (ms into the moment): "BULLET!" as the book falls open (spellbook's `open`), for `bannerMs`; its runs' end. */
export const BULLET = (() => {
  const a = RECLUSE.anims;
  const bannerAt = animLength(a.consult!) + (cueAt(a.spellbook!, "open") ?? 0);
  return { bannerAt, bannerMs: 1600, runMs: BULLET_ANIMS.reduce((t, n) => t + animLength(a[n]!), 0) };
})();

/** The bullet clock is on: his ultimate has come (to the end of the battle). */
export const bulletOn = (boss: Pick<BossView, "powers" | "result"> | null | undefined): boolean =>
  !!boss?.powers && boss.powers.ultimate === "bullet" && boss.powers.ultAt !== null && boss.powers.ultAt !== undefined && !boss.result;

/** The God King's help doesn't work against this boss (the Hidden Boss's passive). */
export const kingBlocked = (boss: Pick<BossView, "id"> | null | undefined): boolean => kingHelpBlocked(boss);

/** Starts a run of his animations where he stands, once per moment (a moment's view draws this). */
function InPlace({ runKey, anims, since }: { runKey: string; anims: readonly string[]; since: number }) {
  useLayoutEffect(() => playInPlace(runKey, anims, since), [runKey]);
  return null;
}

function bulletMoment({ moment, t, banner }: MomentProps) {
  return (
    <div class="power-moment pm-bullet pm-stay">
      <InPlace runKey={moment.key} anims={BULLET_ANIMS} since={moment.at} />
      {t >= BULLET.bannerAt && t < BULLET.bannerAt + BULLET.bannerMs && banner("BULLET!", "No added time.", "rage")}
    </div>
  );
}

let mocks = 0;
/**
 * The God King's help tried against him (his move or his strike, from the dock): it doesn't come and nothing is spent.
 * He slams the book shut and mocks it (his lines in turn), and the God King says his help won't take hold.
 */
export function mockKingHelp(boss: BossView): void {
  const n = mocks++;
  const key = `${boss.id}:${boss.startMove}:mock:${boss.crowdMoves}:${n}`;
  // (Phase 2, revived: the same slam with his hair in the wind.)
  playInPlace(key, [figureLoop() === "idle2" ? "slam2" : "slam"]);
  bossVoice.say(RECLUSE_LINES.mock[n % RECLUSE_LINES.mock.length], key, CRITICAL);
  kingSay("foeBlocked", key);
}

let warmed: "w" | "b" | null = null;
/**
 * His phase change's frames drawn ahead, a slice each animation frame, from when his battle shows (it comes only once
 * he's beaten, minutes later): his seizing and his rage where he stands, then his whole figure's on the board, and the
 * God King's (in the crowd's armor) as he's drained, so none stalls a slow phone the first time it shows
 * (.claude/LESSONS.md: "A stall the first time an effect shows"); and its sounds, made ahead in the sound worker.
 */
export function prewarmRecluse(side: "w" | "b"): void {
  if (warmed === side) return;
  warmed = side;
  const frames = (ch: typeof RECLUSE, names: readonly string[]) => names.flatMap((n) => ch.anims[n]?.frames ?? []);
  const PLACE = ["seize", "seizeLoop", "seized", "rage"];
  prewarmSprite(RECLUSE_BUST, frames(RECLUSE_BUST, PLACE));
  prewarmSprite(RECLUSE, frames(RECLUSE, [...PLACE, ...ON_BOARD_ANIMS]));
  // (The God King: triumphant, then his Last Stand from its blows, as the drain shows it.)
  let t = LAST_STAND.fallAt;
  const drained = GOD_KING.anims.lastStand!.frames.filter((f) => (t += f.ms) > LAST_STAND.slashAt);
  prewarmKing(side, [...GOD_KING.anims.raise!.frames, ...GOD_KING.anims.raised!.frames, ...drained]);
  warmSounds(["recluseDrain", "recluseSpark", "recluseArc"]);
}

/**
 * His half-engine look (Eric, Oct 14: "if we can avoid doing any sort of changing to the sprite and just do an overlay,
 * that would be sick"): over his drawing, from his phase change on (BossCharacter's `setEngineAt`), his left eye (our
 * right, the side towards the board) glows cold blue, faint circuit lines run from it to his temple and down his cheek,
 * and now and then it all flickers. A box the size of his drawing, holding one box the size of his head, moved onto his
 * head each frame (`placeEngine`, by the head part's place in the frame: either drawing, any animation). Few elements,
 * and only opacity and transform animate (styles.css, .bc-engine).
 */
export function EngineOverlay({ ch, elRef, on = false }: { ch: Character; elRef: MutableRef<HTMLSpanElement | null>; on?: boolean }) {
  return (
    <span ref={elRef} class={`bc-engine${on ? " on" : ""}`} aria-hidden="true" style={{ "--rc-w": ch.w, "--rc-h": ch.h }}>
      <span class="rc-eng-head">
        <svg class="rc-eng-circuit" viewBox={`0 0 ${HEAD_SIZE[0]} ${HEAD_SIZE[1]}`} shape-rendering="crispEdges">
          {/* (In the head's own pixels: from beside the eye up to his temple, down his cheek, and from under the eye.) */}
          <path class="rc-eng-trace" d="M18 18h3v1h-3z M20 15h1v3h-1z M20 19h1v4h-1z M19 23h1v2h-1z M16 22h1v1h-1z M17 23h2v1h-2z" />
          <path class="rc-eng-pad" d="M20 14h1v1h-1z M19 25h1v1h-1z M16 21h1v1h-1z" />
        </svg>
        <span class="rc-eng-eye" style={{ left: `${(ENGINE_EYE[0] / HEAD_SIZE[0]) * 100}%`, top: `${(ENGINE_EYE[1] / HEAD_SIZE[1]) * 100}%` }} />
      </span>
    </span>
  );
}

/** Moves the overlay's head box onto his head for a frame (a transform: its own size is the head's). */
export function placeEngine(el: HTMLElement | null, frame: Frame): void {
  const head = el?.firstElementChild as HTMLElement | null | undefined;
  const at = headOf(frame);
  if (!head || !at) return;
  head.style.transform = `translate(${((at[0] / HEAD_SIZE[0]) * 100).toFixed(2)}%, ${((at[1] / HEAD_SIZE[1]) * 100).toFixed(2)}%)`;
}

export const RECLUSE_UI = {
  id: "recluse",
  ultimate: { name: "Bullet" },
  moments: {
    bullet: { order: 2, kit: "ultimate" as KitMoment, dock: "Bullet!", view: bulletMoment },
  },
} satisfies BossUi;
