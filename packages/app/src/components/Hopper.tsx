import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { BOSS_POWERS, HOPPER_NAME } from "@chessroyale/core";
import { HOPPER_BEATS, POWER_FX, TURF_HOLDS, pieceAt, turfCount, turfSquare, withPiece, withoutPiece, type TurfHold, type TurfView } from "@chessroyale/chess";
import { bossKit } from "../characters/kits.ts";
import { EFFECTS, cueAt } from "../characters/power-art.ts";
import { renderFrame } from "../characters/sprite.ts";
import { ladderWords, prizeKey, prizeWords, reelAt, reelStop, reelStrip } from "../carrot-race.ts";
import type { BossView } from "../game.ts";
import { play } from "../sound.ts";
import { CRITICAL } from "../speech.tsx";
import { BoardEffects, BossEffect, BossMoment, prewarm, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { Cast, PIECE_WORD, SoundAt, casterPoint, hash, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Chub & Chirp's powers on screen (the code id: hopper; their rules: packages/chess/src/bosses/hopper.ts and carrots.ts;
 * the beats: HOPPER_BEATS, on their animations' cues), all from the shared state and each moment's start, so everyone
 * online sees the same thing (docs/decisions/2026-10-18-hopper-wired.md):
 * - **Leapfrog** (its own screen at the start of his turn, before his move): "LEAPFROG!", then Chirp hops at the
 *   board's corner and his pawn, still on its square until then, takes off, arcs over yours and lands beyond it.
 * - **The Pawn Bounce** (the same, on the hop's beats; Nov 22): "BOUNCE!", then Chirp hops at the board's corner and your
 *   pawn, on the square its double push reached until then, bounces back one square.
 * - **The Carrot Patch** (the cast: his whole turn, as your turn begins): "CARROT PATCH!", then Chirp bounds five times
 *   while Chub tosses a carrot each bound; each tumbles to its square and thunks into the soil; then his ladder (what
 *   each count of carrots wins on his spin) for 2.5 s.
 * - **A carrot pulled** (his, as your turn begins after his move; yours, as your move lands, while he thinks): it pops
 *   out of the soil and the puller's token goes in the square's corner by the dug hole. The dock counts them
 *   (RaceBadge).
 * - **His spin** (the race over, as your turn begins after his move): the race won or lost, then the reel, a row of
 *   prize cards sliding past a line in the board's middle, stopping on what he rolled; the prize pieces drop onto their
 *   squares. His fifth carrot: the battle is his, no spin.
 * - **Turf** (Nov 27; everywhere but the Battle Tower): his squares carry Chirp's print pair, yours the crowned pawn, both faint,
 *   under everything else on the board (turfLayer); the count and his three holds in the boss bar (TurfBar: tap a hold for what it
 *   does); every few turns his hop-around (Chirp hops on his squares and lands on one he claims) on a screen of its own before his
 *   move; under his third hold, Double hop's banner as his second move lands.
 * The board shows the position as it was until each piece moves (hopperFen).
 */

type Orientation = "white" | "black";
type Pt = { x: number; y: number };
const B = HOPPER_BEATS;
const COLOR = { w: "white", b: "black" } as const;
const other = (side: "w" | "b") => (side === "w" ? "b" : "w");
const r2 = (v: number) => Math.round(v * 100) / 100;
/** A square's middle in % of the board. */
const centreOf = (square: string, o: Orientation): Pt => {
  const { x, y } = squareXY(square, o);
  return { x: x / 8, y: y / 8 };
};
const find = (moments: readonly Moment[], kind: Moment["kind"]) => moments.find((m) => m.kind === kind) ?? null;

/** The dock's line for the cast (his whole turn: no move to show). */
export const CAST_LINE = `${HOPPER_NAME} spent their turn planting carrots.`;

/**
 * Where his casting figure stands (the board's top-left corner, in % of the board: CSS .pm-by-hopper) and where each
 * carrot leaves Chub's paw at its toss (frame pixels 15.6, 23.5 of his 84 x 84 frame, measured on the cast's toss frames).
 */
export const HOPPER_CASTER = { left: -6, top: -17, width: 30 } as const;
const PAW = { x: 15.6, y: 23.5 } as const;

/** When each prize piece drops (ms after the spin's prizeAt, one after another) and how long it falls. */
export const PRIZE_DROP = { stagger: 160, fallMs: 450 } as const;

// ---------------- The board under his moments ----------------

/**
 * The position the board shows during his moments (each moment draws its own pieces on their way): the hop's pawn on
 * its own square until it takes off, then in the air (none on the board) until it lands, and so the Pawn Bounce's (your
 * pawn); his spin's prize pieces only once each has dropped. Null with none of his (the plain position: Boss.tsx).
 */
export function hopperFen(boss: BossView, moments: readonly Moment[], now: number, fen: string): string | null {
  const p = boss.powers;
  if (!p || boss.id !== "hopper") return null;
  let out: string | null = null;
  const hop = find(moments, "hop");
  if (hop && p.hop && now < hop.at + hop.ms) {
    const t = now - hop.at;
    out = fen;
    if (t < B.hop.landAt) out = withoutPiece(out, p.hop.to);
    if (t < B.hop.liftAt) out = withPiece(out, p.hop.from, { color: other(boss.crowdSide), type: "p" });
  }
  const bounce = find(moments, "pawnBounce");
  if (bounce && p.pawnBounce && now < bounce.at + bounce.ms) {
    const t = now - bounce.at;
    out ??= fen;
    if (t < B.pawnBounce.landAt) out = withoutPiece(out, p.pawnBounce.to);
    if (t < B.pawnBounce.liftAt) out = withPiece(out, p.pawnBounce.from, { color: boss.crowdSide, type: "p" });
  }
  const spin = find(moments, "carrotSpin");
  const squares = p.carrots?.spin?.squares ?? [];
  if (spin && squares.length && now < spin.at + spin.ms) {
    out ??= fen;
    squares.forEach((sq, i) => {
      if (now < spin.at + B.carrotSpin.prizeAt + i * PRIZE_DROP.stagger + PRIZE_DROP.fallMs) out = withoutPiece(out!, sq);
    });
  }
  return out;
}

// ---------------- The pulls you make (while he thinks) ----------------

/** When this device first saw each pull of yours (a screen drawn again carries on; it doesn't start over). */
const pullSeen = new Map<string, number>();

/**
 * The carrot your move just pulled, as a moment of his thinking screen (from when this device first saw it): its pop
 * and token, and his line. None when the move pulled nothing.
 */
export function yourPulls(boss: BossView, now = Date.now()): Moment[] {
  const p = boss.powers;
  if (boss.id !== "hopper" || !p?.carrots) return [];
  return p.events
    .filter((e) => e.kind === "carrot" && e.by === "crowd" && e.turn === p.turn)
    .map((e): Moment => {
      const key = `${boss.id}:carrot:${e.turn}:crowd:${e.square}`;
      let at = pullSeen.get(`${boss.startMove}:${key}`);
      if (at === undefined) {
        pullSeen.set(`${boss.startMove}:${key}`, (at = now));
        if (pullSeen.size > 20) pullSeen.delete(pullSeen.keys().next().value!);
      }
      return { kind: "carrot", key, at, ms: POWER_FX.carrot, square: e.square, by: "crowd" };
    });
}

// ---------------- The carrots on the board ----------------

/** A carrot's sway, offset by its square, so the planted ones don't all sway as one. */
const swayFrom = (square: string) => (hash(square) % 8) * 160;

/**
 * Every carrot on the board as `now` (under the pieces, on the board's canvas): none until the cast plants it (its
 * flight lands), then planted (its leaves swaying) until a piece pulls it; then it pops out as its moment plays (his
 * pull, his hop's landing, yours) and the puller's token stays in the square's corner by the dug hole. Once the race is
 * over and its last moments have played, none: the board is clear again.
 */
export function carrotItems(boss: BossView, moments: readonly Moment[], now: number): BoardItem[] {
  const c = boss.powers?.carrots;
  if (!c) return [];
  // (The race over, its last pull and his spin played: the patch is cleared, every carrot and token with it. Eric,
  // Oct 18: a carrot left in the ground after his spin looked like a bug.)
  const playing = (kind: Moment["kind"]) => moments.some((m) => m.kind === kind && now < m.at + m.ms);
  if (c.over && !playing("carrot") && !playing("carrotSpin") && !playing("hop")) return [];
  const cast = find(moments, "carrots");
  const hop = find(moments, "hop");
  const hopTo = boss.powers?.hop?.to;
  const token = (by: "crowd" | "boss") => ((by === "crowd" ? boss.crowdSide : other(boss.crowdSide)) === "w" ? "W" : "B");
  const out: BoardItem[] = [];
  c.squares.forEach((sq, i) => {
    const plantAt = cast && now < cast.at + cast.ms ? cast.at + B.carrots.tosses[i]! + B.carrots.flightMs : null;
    if (plantAt !== null && now < plantAt) return;
    // (Its planting quiet: the thunk is the cast's own cue, `plant<n>`.)
    const planted: BoardItem = plantAt !== null ? { square: sq, name: "carrotPatch", anim: "plant", then: "planted", since: plantAt, quiet: true } : { square: sq, name: "carrotPatch", anim: "planted", since: swayFrom(sq) };
    const by = c.by[i];
    if (!by) {
      out.push(planted);
      return;
    }
    // (When it's pulled on screen: its own moment, or his hop landing on it; neither, it's simply claimed.)
    const m = moments.find((x) => x.kind === "carrot" && x.square === sq);
    const pullAt = m ? m.at + B.carrot.popAt : hop && hopTo === sq && now < hop.at + hop.ms ? hop.at + B.hop.landAt : null;
    if (pullAt !== null && now < pullAt) {
      out.push(planted);
      return;
    }
    const side = token(by);
    out.push(pullAt !== null ? { square: sq, name: "carrotPatch", anim: `pull${side}`, then: `claimed${side}`, since: pullAt } : { square: sq, name: "carrotPatch", anim: `claimed${side}`, since: 0 });
  });
  return out;
}

// ---------------- Turf ----------------

/** His short name in the count ("Chub 26 · You 21 · Open 17"). */
export const TURF_HIS = "Chub";
/** The town ride's print color (riding-chirp.tsx's SOIL); the bar's cream for the count's marks (the bar is dark). */
const SOIL = "#3b3a1a";
const CREAM = "#f3ece0";
/** Your squares' mark: the app's logo, the crowned pawn (public/icons/icon.svg's <g> paths, no background), in its 512 box. */
const LOGO_PATHS = ["M150 190 L176 110 L216 160 L256 92 L296 160 L336 110 L362 190 Z", "M226 300 H286 L300 360 H212 Z"] as const;
const LogoMark = ({ fill }: { fill: string }) => (
  <g fill={fill}>
    <path d={LOGO_PATHS[0]} />
    <rect x="150" y="196" width="212" height="22" rx="6" />
    <circle cx="256" cy="262" r="40" />
    <path d={LOGO_PATHS[1]} />
    <rect x="176" y="362" width="160" height="34" rx="10" />
  </g>
);
/** One of Chirp's three-toed prints pointing along +x (as the town ride's trail draws it: riding-chirp.tsx's printD). */
const toes = (x: number, y: number) => [[5.2, -2.6], [6.2, 0], [5.2, 2.6]].map(([tx, ty]) => `M ${x + 1.2} ${y} L ${x + tx!} ${y + ty!}`).join(" ");
/** His print pair, in a box -12 to 12, pointing along +x before it turns (the round-2 mockup's). */
const PrintPair = ({ color, w }: { color: string; w: number }) => (
  <>
    {[[-3.2, -5], [-1.6, 1.8]].map(([x, y]) => (
      <g key={x}>
        <path d={toes(x!, y!)} fill="none" stroke={color} stroke-linecap="round" stroke-width={w} />
        <ellipse cx={x! - 0.6} cy={y} rx={2.2} ry={1.8} fill={color} />
      </g>
    ))}
  </>
);

const TH = B.turfHop;

/**
 * When each square of his last hop-around gets its print on screen (ms, wall clock): as Chirp lands on it in the hop-around's
 * moment (the square he claims has none until then); 0 outside it. Null: not part of a hop-around playing.
 */
function hopLandsAt(boss: BossView, moments: readonly Moment[], square: string): number | null {
  const h = boss.powers?.turf?.hop;
  const m = find(moments, "turfHop");
  if (!h || !m) return null;
  const i = [...h.hops, h.to].indexOf(square);
  return i < 0 ? null : m.at + TH.dropAt + i * TH.legMs + TH.landAt;
}

/**
 * The Turf on the board, under everything else (the board's colors as they are; Eric, Nov 22): his squares Chirp's print pair at 0.32
 * (his last hop-around's 0.62 through that turn), yours the crowned pawn at 46% of the square, #1b1d22 at 0.16, open nothing. Drawn
 * again only when the squares, the board's way up or the hop-around's landings change.
 */
function TurfLayer({ boss, orientation, moments, now }: { boss: BossView; orientation: Orientation; moments: readonly Moment[]; now: number }) {
  const t = boss.powers?.turf;
  const h = t?.hop;
  const fresh = h && h.at === boss.crowdMoves ? [...h.hops, h.to] : [];
  // (While his hop-around plays: a square of it shows its fresh print once he has landed on it; the one he claims, none before.)
  const landed = fresh.map((sq) => { const at = hopLandsAt(boss, moments, sq); return at === null || now >= at ? "1" : "0"; }).join("");
  return useMemo(() => {
    if (!t) return null;
    const yours: preact.JSX.Element[] = [];
    const his: preact.JSX.Element[] = [];
    for (let i = 0; i < 64; i++) {
      const mark = t.owner[i];
      if (mark === ".") continue;
      const sq = turfSquare(i);
      const { x, y } = squareXY(sq, orientation);
      const left = x / 100 - 0.5;
      const top = y / 100 - 0.5;
      if (mark === "c") {
        yours.push(
          <g key={sq} transform={`translate(${r2(left + 0.27)} ${r2(top + 0.27)}) scale(${0.46 / 512})`} data-square={sq}>
            <LogoMark fill="#1b1d22" />
          </g>,
        );
        continue;
      }
      const k = fresh.indexOf(sq);
      if (k >= 0 && landed[k] === "0" && sq === h!.to) continue;
      his.push(
        <g key={sq} transform={`translate(${r2(left + 0.5)} ${r2(top + 0.5)}) scale(0.03) rotate(${90 + ((hash(sq) % 41) - 20)})`} opacity={k >= 0 && landed[k] === "1" ? 0.62 : 0.32} data-square={sq}>
          <PrintPair color={SOIL} w={1.6} />
        </g>,
      );
    }
    return (
      <svg class="hp-turf" viewBox="0 0 8 8" aria-hidden="true" data-his={turfCount(t.owner, "b")} data-yours={turfCount(t.owner, "c")}>
        <g class="hp-turf-yours" opacity="0.16">
          {yours}
        </g>
        <g class="hp-turf-his">{his}</g>
      </svg>
    );
  }, [t?.owner, orientation, fresh.join(), landed]);
}

/** A hold's words: its name, its short name on the pill, and what it does (its tap text). */
export const TURF_HOLD_WORDS: Record<TurfHold, { name: string; short: string; does: string }> = {
  legs: { name: "Long legs", short: "Legs", does: "their pawns step 2 from any square, 3 from their start (never capturing or promoting that way)" },
  fuse: { name: "Short fuse", short: "Fuse", does: `your move's time is cut by a third` },
  double: { name: "Double hop", short: "Hop", does: "they move twice each turn (the second a quiet move)" },
};

/** A hold's tap text: on or off, what it does, and how to switch it off. */
export function holdText(hold: TurfHold, on: boolean, his: number): string {
  const i = TURF_HOLDS.indexOf(hold);
  const w = TURF_HOLD_WORDS[hold];
  const at = BOSS_POWERS.turfHolds[i]!;
  return on
    ? `${w.name} is on. ${TURF_HIS} holds ${his} squares (${at}+): ${w.does}. Take squares back to switch it off.`
    : `${w.name} at ${at} squares: ${w.does}. ${TURF_HIS} holds ${his}.`;
}

const HOLD_ICON: Record<TurfHold, preact.JSX.Element> = {
  legs: <path d="M3 7 L6 4 L9 7 M3 10.5 L6 7.5 L9 10.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />,
  fuse: (
    <>
      <circle cx="6" cy="6.8" r="4.3" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M6 4.3 V6.9 L7.7 8 M4.6 1.2 H7.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </>
  ),
  double: <path d="M1 9.5 Q3.3 3 5.6 9.5 M6.4 9.5 Q8.7 3 11 9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />,
};

/** His holds on for the turn under way (his turn after the crowd move they were set at, and your turn after it). */
export const holdsNow = (boss: Pick<BossView, "crowdMoves" | "result"> & { powers?: { turf?: TurfView | null } | null }): number => {
  const t = boss.powers?.turf;
  return t && !boss.result && t.holdsAt === boss.crowdMoves ? t.holds : 0;
};

/**
 * The boss bar's Turf (its prop slot): the count with each side's mark ("Chub 26 · You 21 · Open 17") and his three holds as pills,
 * greyed with their threshold until he holds them, lit while he does (nothing hidden). A tap on a pill (a hover on a computer: its
 * title) opens what it does under the bar, over the board, pushing nothing; another tap, or 6 s, closes it.
 */
export function TurfBar({ boss }: { boss: BossView }) {
  const t = boss.powers?.turf;
  const [open, setOpen] = useState<TurfHold | null>(null);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setOpen(null), 6000);
    return () => clearTimeout(id);
  }, [open]);
  if (!t) return null;
  const his = turfCount(t.owner, "b");
  const yours = turfCount(t.owner, "c");
  const free = 64 - his - yours;
  const held = holdsNow(boss);
  const said = `Squares: ${TURF_HIS} ${his}, you ${yours}, open ${free}.`;
  return (
    <span class="hp-turfbar" data-holds={held}>
      <span class="hp-holds">
        {TURF_HOLDS.map((h, i) => {
          const on = held > i;
          const text = holdText(h, on, his);
          return (
            <button key={h} type="button" class={`hp-hold${on ? " on" : ""}${open === h ? " open" : ""}`} data-hold={h} aria-pressed={open === h} aria-label={text} title={text} onClick={() => setOpen(open === h ? null : h)}>
              <svg viewBox="0 0 12 12" aria-hidden="true">
                {HOLD_ICON[h]}
              </svg>
              <span class="hp-hold-name">{TURF_HOLD_WORDS[h].short}</span>
              <span class="hp-hold-at">{BOSS_POWERS.turfHolds[i]}</span>
            </button>
          );
        })}
      </span>
      <span class="hp-count" role="status" aria-label={said} title={said} data-his={his} data-yours={yours} data-open={free}>
        <span class="hp-count-n">
          <svg class="hp-count-mark" viewBox="-9 -9 18 18" aria-hidden="true">
            <g transform="rotate(90)">
              <PrintPair color={CREAM} w={2.2} />
            </g>
          </svg>
          {TURF_HIS} <b>{his}</b>
        </span>
        <span class="hp-count-n">
          <svg class="hp-count-mark" viewBox="146 88 220 312" aria-hidden="true">
            <LogoMark fill={CREAM} />
          </svg>
          You <b>{yours}</b>
        </span>
        <span class="hp-count-n">
          Open <b>{free}</b>
        </span>
      </span>
      {open && (
        <span class="hp-hold-tip" role="note">
          {holdText(open, held > TURF_HOLDS.indexOf(open), his)}
        </span>
      )}
    </span>
  );
}

// ---------------- His moments ----------------

/** A piece the moment draws over the board (hopping, dropping), in % of the board: drawn as the board draws pieces. */
function AirPiece({ code, at, square, scale = 1, opacity = 1 }: { code: string; at: Pt; square: string; scale?: number; opacity?: number }) {
  return <piece class={`hp-piece ${code}`} style={{ left: `${r2(at.x - 6.25)}%`, top: `${r2(at.y - 6.25)}%`, scale: String(r2(scale)), opacity: String(r2(opacity)) }} data-square={square} />;
}

/** His figure at the board's corner playing `anim` from `since` (the race won or lost, his fifth carrot's cheer). */
function Caster({ boss, anim, since, then }: { boss: BossView; anim: string; since: number; then?: string }) {
  // (Where he stands on a computer: Cast. Drawn from the moment's start, as before: `now` is the time it begins.)
  return <Cast boss={boss.name} anim={anim} since={since} now={Math.max(Date.now(), since)} then={then} runKey={`hopper:${anim}:${since}`} class="pm-by-hopper" />;
}

/**
 * A pawn's arc on the hop's beats (Leapfrog's hop, the Pawn Bounce): its banner until `liftAt`, Chirp's hop at the corner (his
 * `leapfrog`, its `takeoff` at `liftAt`), the pawn (`side`'s) on `step.from` until `liftAt`, in the air until `landAt` (`lift`: the
 * arc's height, % of the board), then on `step.to` (the board's: hopperFen).
 */
function pawnArc({ t, orientation, banner, cast }: MomentProps, o: { cls: string; title: string; sub?: string; step: { from: string; to: string } | null | undefined; side: "w" | "b"; beats: typeof B.hop; lift: number }) {
  const { step: h, beats } = o;
  const flying = !!h && t >= beats.liftAt && t < beats.landAt;
  const u = flying ? (t - beats.liftAt) / (beats.landAt - beats.liftAt) : 0;
  const from = h ? centreOf(h.from, orientation) : null;
  const to = h ? centreOf(h.to, orientation) : null;
  return (
    <div class={`power-moment ${o.cls}`}>
      {banner(o.title, o.sub, "carrot", beats.liftAt)}
      {cast("takeoff", beats.liftAt)}
      <div class="hb-pieces hp-layer" aria-hidden="true" data-hop={!h ? "none" : t < beats.liftAt ? "ready" : t < beats.landAt ? "air" : "landed"}>
        {flying && from && to && (
          <AirPiece code={`${COLOR[o.side]} pawn`} square={h!.to} at={{ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u - o.lift * Math.sin(Math.PI * u) }} scale={1 + 0.18 * Math.sin(Math.PI * u)} />
        )}
      </div>
    </div>
  );
}

/** "LEAPFROG!", then the hop: his pawn takes off from its square, arcs over yours and lands beyond it. */
function hopMoment(props: MomentProps) {
  const h = props.boss.powers?.hop;
  return pawnArc(props, { cls: "pm-hop", title: "LEAPFROG!", sub: h ? `Over your pawn on ${h.over}` : undefined, step: h, side: other(props.boss.crowdSide), beats: B.hop, lift: 11 });
}

/** "BOUNCE!", then the Pawn Bounce: your pawn takes off from the square its double push reached and lands one square back. */
function bounceMoment(props: MomentProps) {
  const b = props.boss.powers?.pawnBounce;
  return pawnArc(props, { cls: "pm-pawn-bounce", title: "BOUNCE!", sub: b ? `Your pawn back to ${b.to}` : undefined, step: b, side: props.boss.crowdSide, beats: B.pawnBounce, lift: 9 });
}

/** Where Chirp starts and ends his hop-around: over the board's top-left square, just above the board (% of the board). */
const TURF_CORNER: Pt = { x: 6.25, y: -5 };
/** His figure on the board in the hop-around: its 84 x 84 frame's width (% of the board), his feet this far below a square's middle. */
export const TURF_FIGURE = { width: 24, feet: 4, lift: 10 } as const;

/**
 * Where Chirp is `t` ms into his hop-around (% of the board, his feet) and which leg he's on: from the corner to each square of his he
 * hops on, to the square he claims, and back (TH: each leg on the ground until its `takeoffAt`, in the air until `landAt`, an arc
 * `lift` high, then on the next square). Null before he drops or with no hop-around.
 */
export function turfHopAt(hop: { hops: readonly string[]; to: string } | null | undefined, t: number, orientation: Orientation): { at: Pt; leg: number; right: boolean; air: boolean } | null {
  if (!hop || t < TH.dropAt) return null;
  const pts = [TURF_CORNER, ...[...hop.hops, hop.to].map((sq) => centreOf(sq, orientation)), TURF_CORNER];
  const legs = pts.length - 1;
  const into = t - TH.dropAt;
  const leg = Math.min(legs - 1, Math.floor(into / TH.legMs));
  const u = into - leg * TH.legMs;
  const a = pts[leg]!;
  const b = pts[leg + 1]!;
  const right = b.x > a.x;
  if (u < TH.takeoffAt) return { at: a, leg, right, air: false };
  if (u >= TH.landAt) return { at: b, leg, right, air: false };
  const v = (u - TH.takeoffAt) / (TH.landAt - TH.takeoffAt);
  return { at: { x: a.x + (b.x - a.x) * v, y: a.y + (b.y - a.y) * v - TURF_FIGURE.lift * Math.sin(Math.PI * v) }, leg, right, air: true };
}

/**
 * "TURF HOP!", then the hop-around: Chirp drops off his corner onto the board, hops on his squares (each print fresh as he lands:
 * TurfLayer), lands on the square he claims (its print appears) and hops back. His figure is the board's while it plays (his usual
 * spot empty: styles.css), facing the way he hops, his `leapfrog` once a leg.
 */
function turfHopMoment({ boss, moment, t, orientation, banner, kit }: MomentProps) {
  const h = boss.powers?.turf?.hop;
  const where = turfHopAt(h, t, orientation);
  const ch = kit?.ch;
  const W = TURF_FIGURE.width;
  const fx = ch ? ch.foot[0] / ch.w : 0.5;
  const fy = ch ? ch.foot[1] / ch.h : 1;
  return (
    <div class="power-moment pm-turf-hop">
      {banner("TURF HOP!", h ? `Chirp claims ${h.to}` : undefined, "carrot", TH.dropAt)}
      <div class="hp-layer" aria-hidden="true" data-turf-hop={!where ? "banner" : `${where.leg}:${where.air ? "air" : "ground"}`}>
        {where && ch && (
          <span class={`hp-turf-chirp${where.right ? " right" : ""}`} style={{ left: `${r2(where.at.x - (where.right ? 1 - fx : fx) * W)}%`, top: `${r2(where.at.y + TURF_FIGURE.feet - fy * W)}%`, width: `${W}%` }}>
            <BossMoment key={where.leg} boss={boss.name} anim="leapfrog" since={moment.at + TH.dropAt + where.leg * TH.legMs - TH.animLead} then="idle" />
          </span>
        )}
      </div>
    </div>
  );
}

/** Double hop (his third hold): his banner as his second move lands, his figure where it stands. */
const doubleMoment = ({ banner }: MomentProps) => <div class="power-moment pm-extra pm-double-hop pm-stay">{banner("DOUBLE HOP!", `${HOPPER_NAME} move again`, "carrot")}</div>;

/** The pixel carrot (the dock's icon) as an image, made once. */
let iconUrl: string | null = null;
export function carrotIconUrl(): string {
  if (iconUrl === null) {
    const ch = EFFECTS.carrotIcon.ch;
    const img = renderFrame(ch, ch.anims.icon!.frames[0]!);
    const cv = document.createElement("canvas");
    cv.width = img.w;
    cv.height = img.h;
    cv.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0);
    iconUrl = cv.toDataURL();
  }
  return iconUrl;
}
const CarrotIcon = ({ cls = "" }: { cls?: string }) => <img class={`hp-icon ${cls}`} src={carrotIconUrl()} alt="" aria-hidden="true" />;

/** His ladder: what each count of carrots wins on his spin, in the settings' words (carrot-race.ts), after the cast. */
function Ladder() {
  const rows = useMemo(() => Array.from({ length: BOSS_POWERS.carrotCount + 1 }, (_, n) => ({ n, words: ladderWords(n) })), []);
  return (
    <div class="hp-ladder" role="img" aria-label={`Their spin: ${rows.map((r) => `${r.n} ${r.n === 1 ? "carrot" : "carrots"}, ${r.words}`).join("; ")}`}>
      <div class="hp-ladder-title">What their carrots win</div>
      <ol class="hp-ladder-rows">
        {rows.map((r) => (
          <li key={r.n} class={r.n >= BOSS_POWERS.carrotCount ? "win" : r.n === 0 ? "none" : undefined}>
            <span class="hp-ladder-n">
              <CarrotIcon />
              {r.n}
            </span>
            <span class="hp-ladder-w">{r.words}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** "CARROT PATCH!", then the cast: a carrot tossed each bound, tumbling to its square; then his ladder. */
function castMoment({ boss, moment, t, orientation, banner, cast, kit }: MomentProps) {
  const squares = boss.powers?.carrots?.squares ?? moment.squares ?? [];
  // (His paw as drawn at the corner, turned to face the board or not: casterPoint.)
  const paw: Pt = kit ? casterPoint(kit, HOPPER_CASTER, PAW.x, PAW.y) : { x: HOPPER_CASTER.left, y: HOPPER_CASTER.top };
  return (
    <div class="power-moment pm-carrots">
      {banner("CARROT PATCH!", `${BOSS_POWERS.carrotCount} carrots, ${BOSS_POWERS.carrotMoves} moves each`, "carrot", B.carrots.tosses[0])}
      {t < B.carrots.ladderAt && cast("toss1", B.carrots.tosses[0])}
      <div class="hp-layer" aria-hidden="true" data-cast={t < B.carrots.tosses[0] ? "banner" : t < B.carrots.ladderAt ? "toss" : "ladder"}>
        {squares.map((sq, i) => {
          const t0 = B.carrots.tosses[i]!;
          if (t < t0 || t >= t0 + B.carrots.flightMs) return null;
          const u = (t - t0) / B.carrots.flightMs;
          const end = centreOf(sq, orientation);
          const at = { x: paw.x + (end.x - paw.x) * u, y: paw.y + (end.y - paw.y) * u - 14 * Math.sin(Math.PI * u) };
          return (
            <span key={`fly-${sq}`} class="hp-fly" style={{ left: `${r2(at.x - 6.25)}%`, top: `${r2(at.y - 6.25)}%` }} data-square={sq}>
              <BossEffect name="carrotFly" since={moment.at + t0} id={`fly-${sq}`} />
            </span>
          );
        })}
      </div>
      {t >= B.carrots.ladderAt && <Ladder />}
    </div>
  );
}

/** A carrot pulled: the board pops it (carrotItems); his line where he stands. */
const pullMoment = () => <div class="power-moment pm-carrot pm-stay" />;

/**
 * The race won before his spin (his `raceWon`, a carrot held up) or lost (`raceLost`, his ears drooping): won on 3 or
 * more carrots, lost on 0 or 1 (the art lane's), and on 2 won when he pulled at least as many as you.
 */
export const raceWon = (tier: number, yours: number): boolean => tier >= 3 || (tier === 2 && tier >= yours);

/** A prize card: one picture each kind of piece in it ("×2" for two of a kind; the queen and rook, the jackpot); a blank card none. */
function Card({ prize, side, won = false }: { prize: readonly string[]; side: "w" | "b"; won?: boolean }) {
  const kinds = [...new Set(prize)].sort((a, b) => "qrbnp".indexOf(a) - "qrbnp".indexOf(b));
  return (
    <span class={`hp-card${prize.length ? "" : " blank"}${kinds.length > 1 ? " jackpot" : ""}${won ? " won" : ""}`} data-prize={prizeKey(prize) || "-"}>
      {kinds.map((k) => {
        const n = prize.filter((x) => x === k).length;
        return (
          <span key={k} class="hp-card-p">
            <piece class={`${COLOR[side]} ${PIECE_WORD[k]}`} />
            {n > 1 && <b class="hp-times">×{n}</b>}
          </span>
        );
      })}
    </span>
  );
}

const reelU = (t: number) => (t - B.carrotSpin.reelAt) / (B.carrotSpin.stopAt - B.carrotSpin.reelAt);

/**
 * The reel: one row of prize cards sliding past the line in the board's middle, slowing to a stop on the card he rolled
 * (reelStop). The cards are made once a spin; each frame only moves the row (a CSS transform) and ticks as a card passes
 * the line (at most one tick every 45 ms); the stop has its own sound (spinMoment).
 */
function Reel({ boss, moment, t, rolled, tier }: { boss: BossView; moment: Moment; t: number; rolled: readonly string[]; tier: number }) {
  const side = other(boss.crowdSide);
  const rolledKey = prizeKey(rolled);
  const { strip, stop } = useMemo(() => {
    const s = reelStrip(tier);
    return { strip: s, stop: reelStop(s, rolled, moment.key) };
  }, [moment.key, tier, rolledKey]);
  const done = t >= B.carrotSpin.stopAt;
  const cards = useMemo(() => Array.from({ length: stop.travel + 4 }, (_, i) => <Card key={i} prize={strip[i % strip.length]!} side={side} won={done && i === stop.travel} />), [strip, stop.travel, side, done]);
  const pos = reelAt(stop.travel, reelU(t));
  const passed = Math.round(pos);
  const ticked = useRef({ card: 0, at: 0 });
  useLayoutEffect(() => {
    const now = performance.now();
    if (passed > ticked.current.card && !done && now - ticked.current.at >= 45) {
      ticked.current = { card: passed, at: now };
      play("hopperTick");
    }
  }, [passed]);
  return (
    <div class={`hp-reel${done ? " stopped" : ""}${tier <= 0 ? " empty" : ""}`} aria-hidden="true" data-reel={done ? rolledKey || "-" : "spin"} data-card={stop.card}>
      <div class="hp-reel-label">
        <CarrotIcon />×{tier}
      </div>
      <div class="hp-reel-window">
        <div class="hp-reel-row hb-pieces" style={{ transform: `translateX(calc(${r2(-pos)} * var(--hp-step)))` }}>
          {cards}
        </div>
        <span class="hp-reel-line" />
      </div>
    </div>
  );
}

/** His spin: the race won or lost at the corner, then the reel, then the prize pieces dropping onto their squares. */
function spinMoment({ boss, moment, now, t, orientation }: MomentProps) {
  const c = boss.powers?.carrots;
  const spin = c?.spin;
  const tier = moment.tier ?? spin?.tier ?? 0;
  const prize = spin?.prize ?? moment.prize ?? [];
  const rolled = spin?.rolled ?? prize;
  const squares = spin?.squares ?? [];
  const his = other(boss.crowdSide);
  return (
    <div class="power-moment pm-spin">
      {/* (No carrots: his ears droop and stay drooped; else back to his idle once it's played.) */}
      <Caster boss={boss} anim={raceWon(tier, c?.crowd ?? 0) ? "raceWon" : "raceLost"} since={moment.at} then={tier > 0 ? "idle" : undefined} />
      {t >= B.carrotSpin.reelAt && <Reel boss={boss} moment={moment} t={t} rolled={rolled} tier={tier} />}
      {t >= B.carrotSpin.stopAt && prizeKey(prize) !== prizeKey(rolled) && <div class="hp-reel-note">No room for {prizeWords(rolled)}: {prizeWords(prize)}</div>}
      <SoundAt id={`${moment.key}:${boss.startMove}:stop`} at={moment.at + B.carrotSpin.stopAt} now={now} sound="hopperStop" />
      <div class="hb-pieces hp-layer" aria-hidden="true" data-prize={t < B.carrotSpin.prizeAt ? "waiting" : "dropping"}>
        {squares.map((sq, i) => {
          const t0 = B.carrotSpin.prizeAt + i * PRIZE_DROP.stagger;
          if (t < t0 || t >= t0 + PRIZE_DROP.fallMs) return null;
          const u = (t - t0) / PRIZE_DROP.fallMs;
          const at = centreOf(sq, orientation);
          const type = pieceAt(boss.board.fen, sq)?.type ?? "p";
          return <AirPiece key={`drop-${sq}`} code={`${COLOR[his]} ${PIECE_WORD[type]}`} square={sq} at={{ x: at.x, y: at.y - 40 * (1 - u * u) }} scale={0.7 + 0.3 * u} opacity={Math.min(1, u * 3)} />;
        })}
      </div>
      {squares.map((sq, i) => (
        <SoundAt key={sq} id={`${moment.key}:${boss.startMove}:drop:${sq}`} at={moment.at + B.carrotSpin.prizeAt + i * PRIZE_DROP.stagger + PRIZE_DROP.fallMs} now={now} sound="hopperLand" />
      ))}
    </div>
  );
}

/** His fifth carrot: "FIVE CARROTS!", he cheers, and the battle is his. */
function winMoment({ boss, moment, banner }: MomentProps) {
  const a = bossKit(boss.name)?.ch.anims.raceWon;
  return (
    <div class="power-moment pm-carrot-win">
      {banner("FIVE CARROTS!", `${HOPPER_NAME} win the battle`, "carrot")}
      {a && <Caster boss={boss} anim="raceWon" since={moment.at + B.carrotWin.cheerAt - (cueAt(a, "cheer") ?? 0)} then="idle" />}
    </div>
  );
}

/** A line from his kit's lines for one of his race's own moments (the same for everyone: by the moment's key). */
const raceLine = (beat: "carrotHis" | "carrotYours" | "spinBig" | "spinSmall" | "spinEmpty" | "carrotsAll" | "pawnBounce" | "turfHop" | "doubleHop", kit: ReturnType<typeof bossKit>, key: string): string | null => {
  const lines = kit?.lines[beat];
  return lines?.length ? lines[hash(key) % lines.length]! : null;
};

/**
 * Leapfrog's hop and the Pawn Bounce: at the start of his turn, before his move, on a screen of its own (as Big Boy's bounce:
 * the last thing that happened; the bounce with its own line, the hop's animation). The Carrot Patch's moments come as a crowd turn begins, after his turn: the cast (his whole turn), a
 * carrot his move pulled (yours plays as your move lands: yourPulls), his spin, his last carrot.
 */
const MOMENTS: Record<"hop" | "pawnBounce" | "turfHop" | "doubleHop" | "carrots" | "carrot" | "carrotSpin" | "carrotWin", MomentUi> = {
  hop: { order: 0, kit: "power", own: (boss: BossView) => boss.powers?.events.at(-1)?.kind === "hop" && boss.powers?.hop?.at === boss.crowdMoves, view: hopMoment },
  pawnBounce: {
    order: 0,
    kit: "power",
    line: (kit, m) => raceLine("pawnBounce", kit, m.key),
    own: (boss: BossView) => boss.powers?.events.at(-1)?.kind === "pawnBounce" && boss.powers?.pawnBounce?.at === boss.crowdMoves,
    view: bounceMoment,
  },
  // (Turf's hop-around: a screen of its own before his move, as the hop's. Double hop: after his move, as Hollow's extra move.)
  turfHop: {
    order: 0,
    kit: "power",
    line: (kit, m) => raceLine("turfHop", kit, m.key),
    own: (boss: BossView) => boss.powers?.events.at(-1)?.kind === "turfHop" && boss.powers?.turf?.hop?.at === boss.crowdMoves,
    view: turfHopMoment,
  },
  doubleHop: {
    order: 3,
    kit: "power",
    line: (kit, m) => raceLine("doubleHop", kit, m.key),
    own: (boss: BossView) => boss.powers?.turf?.double === "played" && boss.powers.events.some((e) => e.kind === "doubleHop"),
    view: doubleMoment,
  },
  carrot: { order: 0, kit: "powerHit", line: (kit, m) => raceLine(m.by === "crowd" ? "carrotYours" : "carrotHis", kit, m.key), view: pullMoment },
  carrots: { order: 2, kit: "ultimate", view: castMoment },
  // (His line as the reel starts: on 3 or 4 carrots, on 1 or 2, on none (his count, known already: never the prize). It
  // cuts in over a line still up, the pull's that came just before ("Pulled one!"), so the reel spins under its own.)
  carrotSpin: {
    order: 3,
    kit: "ultimateHit",
    line: (kit, m) => raceLine((m.tier ?? 0) >= 3 ? "spinBig" : (m.tier ?? 0) >= 1 ? "spinSmall" : "spinEmpty", kit, m.key),
    lineAt: B.carrotSpin.reelAt,
    priority: () => CRITICAL,
    view: spinMoment,
  },
  carrotWin: { order: 4, kit: "ultimateHit", line: (kit, m) => raceLine("carrotsAll", kit, m.key), priority: () => CRITICAL, view: winMoment },
};

let warmed = false;
/** Their hop, cast and race drawn ahead as the battle starts, and the carrots' frames. */
export function prewarmHopper(name: string): void {
  const kit = bossKit(name);
  if (!kit || warmed) return;
  warmed = true;
  const frames = (anim: string) => kit.ch.anims[anim]?.frames ?? [];
  prewarmSprite(kit.ch, [...frames("leapfrog"), ...frames("carrotPatch"), ...frames("raceWon"), ...frames("raceLost")]);
  for (const fx of ["carrotPatch", "carrotFly"] as const) prewarm(fx, Object.entries(EFFECTS[fx].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

/**
 * The dock's race count while the race is on, and through the turn of his spin: the pixel carrot, his count and yours
 * (each on a disc of its side's color, as the tokens on the board), and your moves left. Null otherwise. In the status
 * box, or `below` it, at the left of the God King's line (BossDock decides by the room).
 */
export function RaceBadge({ boss, below = false }: { boss: BossView | null | undefined; below?: boolean }) {
  const c = boss?.powers?.carrots;
  if (!boss || boss.id !== "hopper" || !c || (c.spin && c.spin.at < boss.crowdMoves)) return null;
  const his = other(boss.crowdSide);
  const said = `Carrots: ${HOPPER_NAME} ${c.boss}, you ${c.crowd}. ${c.over ? "The race is over." : `${c.crowdLeft} ${c.crowdLeft === 1 ? "move" : "moves"} left.`}`;
  return (
    <span class={`dk-race${below ? " dk-race-below" : ""}`} role="status" aria-label={said} title={said} data-his={c.boss} data-yours={c.crowd} data-left={c.over ? "over" : c.crowdLeft}>
      <span class="dk-race-counts" aria-hidden="true">
        <CarrotIcon cls="dk-race-icon" />
        <b class={`dk-race-n ${his}`}>{c.boss}</b>
        <b class={`dk-race-n ${boss.crowdSide}`}>{c.crowd}</b>
      </span>
      <span class="dk-race-left" aria-hidden="true">
        {c.over ? "over" : `${c.crowdLeft} left`}
      </span>
    </span>
  );
}

export const HOPPER_UI = {
  id: "hopper",
  // (The cast comes at the start of his turn, after your move, as Alfil's Slam.)
  ultimate: { name: "Carrot Patch", when: "After your move" },
  moments: MOMENTS,
  noMove: (boss) => (boss.powers?.carrots && boss.powers.carrots.at === boss.crowdMoves && !boss.lastMove ? CAST_LINE : null),
  // Turf: the prints and your crowned pawns, under everything else; then the carrots: in the ground, popping out as they're pulled,
  // the puller's token after (under the pieces, over the Turf).
  board: ({ boss, orientation, moments, now }) => {
    const items = carrotItems(boss, moments, now);
    return {
      under: (
        <>
          {boss.powers?.turf && <TurfLayer boss={boss} orientation={orientation} moments={moments} now={now} />}
          {items.length > 0 && <BoardEffects items={items} orientation={orientation} class="hp-carrots" />}
        </>
      ),
      over: null,
    };
  },
  // Turf's count and his holds, in the bar's free room.
  barProp: ({ boss }) => <TurfBar boss={boss} />,
} satisfies BossUi;
