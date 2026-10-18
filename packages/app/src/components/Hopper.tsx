import { useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { BOSS_POWERS, HOPPER_NAME } from "@chessroyale/core";
import { HOPPER_BEATS, POWER_FX, pieceAt, withPiece, withoutPiece } from "@chessroyale/chess";
import { bossKit } from "../characters/kits.ts";
import { EFFECTS, cueAt } from "../characters/power-art.ts";
import { renderFrame } from "../characters/sprite.ts";
import { ladderWords, prizeKey, prizeWords, reelAt, reelStop, reelStrip } from "../carrot-race.ts";
import type { BossView } from "../game.ts";
import { play } from "../sound.ts";
import { CRITICAL } from "../speech.tsx";
import { BoardEffects, BossEffect, BossMoment, prewarm, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { PIECE_WORD, SoundAt, hash, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Chub & Chirp's powers on screen (the code id: hopper; their rules: packages/chess/src/bosses/hopper.ts and carrots.ts;
 * the beats: HOPPER_BEATS, on their animations' cues), all from the shared state and each moment's start, so everyone
 * online sees the same thing (docs/decisions/2026-10-18-hopper-wired.md):
 * - **Leapfrog** (its own screen at the start of his turn, before his move): "LEAPFROG!", then Chirp hops at the
 *   board's corner and his pawn, still on its square until then, takes off, arcs over yours and lands beyond it.
 * - **The Carrot Patch** (the cast: his whole turn, as your turn begins): "CARROT PATCH!", then Chirp bounds five times
 *   while Chub tosses a carrot each bound; each tumbles to its square and thunks into the soil; then his ladder (what
 *   each count of carrots wins on his spin) for 2.5 s.
 * - **A carrot pulled** (his, as your turn begins after his move; yours, as your move lands, while he thinks): it pops
 *   out of the soil and the puller's token goes in the square's corner by the dug hole. The dock counts them
 *   (RaceBadge).
 * - **His spin** (the race over, as your turn begins after his move): the race won or lost, then the reel, a row of
 *   prize cards sliding past a line in the board's middle, stopping on what he rolled; the prize pieces drop onto their
 *   squares. His fifth carrot: the battle is his, no spin.
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
const PAW: Pt = { x: HOPPER_CASTER.left + (HOPPER_CASTER.width * 15.6) / 84, y: HOPPER_CASTER.top + (HOPPER_CASTER.width * 23.5) / 84 };

/** When each prize piece drops (ms after the spin's prizeAt, one after another) and how long it falls. */
export const PRIZE_DROP = { stagger: 160, fallMs: 450 } as const;

// ---------------- The board under his moments ----------------

/**
 * The position the board shows during his moments (each moment draws its own pieces on their way): the hop's pawn on
 * its own square until it takes off, then in the air (none on the board) until it lands; his spin's prize pieces only
 * once each has dropped. Null with none of his (the plain position: Boss.tsx).
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
 * pull, his hop's landing, yours) and the puller's token stays in the square's corner by the dug hole.
 */
export function carrotItems(boss: BossView, moments: readonly Moment[], now: number): BoardItem[] {
  const c = boss.powers?.carrots;
  if (!c) return [];
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

// ---------------- His moments ----------------

/** A piece the moment draws over the board (hopping, dropping), in % of the board: drawn as the board draws pieces. */
function AirPiece({ code, at, square, scale = 1, opacity = 1 }: { code: string; at: Pt; square: string; scale?: number; opacity?: number }) {
  return <piece class={`hp-piece ${code}`} style={{ left: `${r2(at.x - 6.25)}%`, top: `${r2(at.y - 6.25)}%`, scale: String(r2(scale)), opacity: String(r2(opacity)) }} data-square={square} />;
}

/** His figure at the board's corner playing `anim` from `since` (the race won or lost, his fifth carrot's cheer). */
function Caster({ boss, anim, since, then }: { boss: BossView; anim: string; since: number; then?: string }) {
  return (
    <span class="pm-caster pm-by-hopper">
      <BossMoment boss={boss.name} anim={anim} since={since} then={then} />
    </span>
  );
}

/** "LEAPFROG!", then the hop: his pawn takes off from its square, arcs over yours and lands beyond it. */
function hopMoment({ boss, t, orientation, banner, cast }: MomentProps) {
  const h = boss.powers?.hop;
  const flying = !!h && t >= B.hop.liftAt && t < B.hop.landAt;
  const u = flying ? (t - B.hop.liftAt) / (B.hop.landAt - B.hop.liftAt) : 0;
  const from = h ? centreOf(h.from, orientation) : null;
  const to = h ? centreOf(h.to, orientation) : null;
  return (
    <div class="power-moment pm-hop">
      {banner("LEAPFROG!", h ? `Over your pawn on ${h.over}` : undefined, "carrot", B.hop.liftAt)}
      {cast("takeoff", B.hop.liftAt)}
      <div class="hb-pieces hp-layer" aria-hidden="true" data-hop={!h ? "none" : t < B.hop.liftAt ? "ready" : t < B.hop.landAt ? "air" : "landed"}>
        {flying && from && to && (
          <AirPiece code={`${COLOR[other(boss.crowdSide)]} pawn`} square={h!.to} at={{ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u - 11 * Math.sin(Math.PI * u) }} scale={1 + 0.18 * Math.sin(Math.PI * u)} />
        )}
      </div>
    </div>
  );
}

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
function castMoment({ boss, moment, t, orientation, banner, cast }: MomentProps) {
  const squares = boss.powers?.carrots?.squares ?? moment.squares ?? [];
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
          const at = { x: PAW.x + (end.x - PAW.x) * u, y: PAW.y + (end.y - PAW.y) * u - 14 * Math.sin(Math.PI * u) };
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
const raceLine = (beat: "carrotHis" | "carrotYours" | "spinBig" | "spinSmall" | "spinEmpty" | "carrotsAll", kit: ReturnType<typeof bossKit>, key: string): string | null => {
  const lines = kit?.lines[beat];
  return lines?.length ? lines[hash(key) % lines.length]! : null;
};

/**
 * Leapfrog's hop: at the start of his turn, before his move, on a screen of its own (as Big Boy's bounce: the last thing
 * that happened). The Carrot Patch's moments come as a crowd turn begins, after his turn: the cast (his whole turn), a
 * carrot his move pulled (yours plays as your move lands: yourPulls), his spin, his last carrot.
 */
const MOMENTS: Record<"hop" | "carrots" | "carrot" | "carrotSpin" | "carrotWin", MomentUi> = {
  hop: { order: 0, kit: "power", own: (boss: BossView) => boss.powers?.events.at(-1)?.kind === "hop" && boss.powers?.hop?.at === boss.crowdMoves, view: hopMoment },
  carrot: { order: 0, kit: "powerHit", line: (kit, m) => raceLine(m.by === "crowd" ? "carrotYours" : "carrotHis", kit, m.key), view: pullMoment },
  carrots: { order: 2, kit: "ultimate", view: castMoment },
  // (His line as the reel stops: on 3 or 4 carrots, on 1 or 2, on none.)
  carrotSpin: {
    order: 3,
    kit: "ultimateHit",
    line: (kit, m) => raceLine((m.tier ?? 0) >= 3 ? "spinBig" : (m.tier ?? 0) >= 1 ? "spinSmall" : "spinEmpty", kit, m.key),
    lineAt: B.carrotSpin.stopAt,
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
  // The carrots: in the ground, popping out as they're pulled, the puller's token after (under the pieces).
  board: ({ boss, orientation, moments, now }) => {
    const items = carrotItems(boss, moments, now);
    return { under: items.length > 0 ? <BoardEffects items={items} orientation={orientation} class="hp-carrots" /> : null, over: null };
  },
} satisfies BossUi;
