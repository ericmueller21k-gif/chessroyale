import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { BOSS_POWERS, type PowerEventKind } from "@chessroyale/core";
import { POWER_FX, powerMomentMs, pieceAt } from "@chessroyale/chess";
import { bossKit, type BossKit } from "../characters/kits.ts";
import { renderFrame, type Anim, type Character, type Frame } from "../characters/sprite.ts";
import type { BossView } from "../game.ts";
import { BossFace } from "./BossCharacter.tsx";
import { GodKingPortrait, squareXY } from "./GodKing.tsx";

/**
 * Boss powers on screen: what every player sees, from the battle's shared state (NetBoss.powers), so online everyone
 * sees the same ice, the same pie and the same moment at the same time.
 *
 * - The board layer (PowerBoard): ice over a frozen piece (in the blizzard, over every crowd piece but the one still
 *   free to move) and the pie on its square. Drawn over the pieces, never taking a tap.
 * - The moments (momentsOf / PowerMoment): as the turn passes to the crowd, after the boss's move shows, each power
 *   that came with it plays in turn, in the God King's banner style (the boss on the left, the moment in the middle,
 *   the God King on the right), with its board effect. The crowd's clock starts after them.
 * - The rage meter (RageMeter) in the boss bar: it fills as the boss loses material, flashes for the one-turn warning,
 *   and is gone once the ultimate is spent.
 */

/** One power's moment on screen: when it starts (ms, wall clock) and how long it takes. */
export interface Moment {
  kind: PowerEventKind;
  key: string;
  at: number;
  ms: number;
  square?: string;
}

const ORDER: Record<PowerEventKind, number> = { freeze: 0, pie: 0, warn: 1, blizzard: 2, funhouse: 3 };

/**
 * The moments a boss screen plays, ending at `until` (the screen's end: the crowd's clock starts then), one after
 * another. The funhouse has a screen of its own (after the move he plays for the crowd); the rest come after the boss's
 * move, as the turn passes to the crowd.
 */
export function momentsOf(boss: BossView, until: number): Moment[] {
  const p = boss.powers;
  if (!p || !until || !p.events.length) return [];
  const funhouse = !!p.funhouse && p.funhouse.turn === boss.crowdMoves && p.events.some((e) => e.kind === "funhouse");
  const list = p.events.filter((e) => (e.kind === "funhouse") === funhouse).sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  let t = until - powerMomentMs(list);
  return list.map((e) => {
    const m: Moment = { kind: e.kind, key: `${boss.id}:${e.kind}:${e.turn}`, at: t, ms: POWER_FX[e.kind], ...(e.square ? { square: e.square } : {}) };
    t += m.ms;
    return m;
  });
}

/** The moment playing at `now`, if any. */
export const momentAt = (moments: readonly Moment[], now: number) => moments.find((m) => now >= m.at && now < m.at + m.ms) ?? null;

/** The board as the crowd sees it: from its own side, or (after Boingo's funhouse) flipped for a couple of turns. */
export function crowdOrientation(boss: Pick<BossView, "powers"> | null | undefined, side: "w" | "b"): "white" | "black" {
  const s = boss?.powers?.flipped ? (side === "w" ? "b" : "w") : side;
  return s === "w" ? "white" : "black";
}

// ---------------- The funhouse's beats (ms into its moment) ----------------

/** Boingo pogos in, the banner, the board flips (its orientation swaps halfway), his line, the move, he pogos off. */
export const FUNHOUSE = { bannerAt: 250, flipAt: 1900, flipMs: 700, lineAt: 2500, moveAt: 3300, exitAt: 4400 } as const;

/**
 * In the funhouse's moment: whether the board spins (a half turn in its own plane, pieces upside down for a moment),
 * whether it shows flipped yet (the orientation swaps as the spin ends, with nothing transformed, so the board's
 * squares are measured true), and whether the move has been played.
 */
export function funhouseBeat(m: Moment | null, now: number): { flipped: boolean; flipping: boolean; played: boolean } | null {
  if (!m || m.kind !== "funhouse") return null;
  const t = now - m.at;
  const end = FUNHOUSE.flipAt + FUNHOUSE.flipMs;
  return { flipped: t >= end, flipping: t >= FUNHOUSE.flipAt && t < end, played: t >= FUNHOUSE.moveAt };
}

// ---------------- The board layer ----------------

/** When a square's ice or pie appears during a moment (ms, wall clock); 0: it's simply there. */
function appearAt(square: string, moments: readonly Moment[], orientation: "white" | "black"): number {
  for (const m of moments) {
    if (m.kind === "freeze" && m.square === square) return m.at + FREEZE.iceAt;
    if (m.kind === "pie" && m.square === square) return m.at + PIE.landAt;
    // The blizzard's sweep crosses the board left to right; each piece ices over as it passes.
    if (m.kind === "blizzard") return m.at + BLIZZARD.sweepAt + (squareXY(square, orientation).x / 800) * BLIZZARD.sweepMs;
  }
  return 0;
}

/** A freeze's beats: the banner, then (once it has gone, so nothing hides it) a cold burst and the ice forming. */
export const FREEZE = { frostAt: 1400, iceAt: 1600 } as const;
/** The pie's beats: the banner, then the pie flies in from the boss's side and splats on its square. */
export const PIE = { flyAt: 1250, landAt: 1800 } as const;
/** The blizzard's beats: the banner, then the sweep across the board, then the God King's line. */
export const BLIZZARD = { sweepAt: 1200, sweepMs: 1500, lineAt: 2800 } as const;

const at = (square: string, orientation: "white" | "black") => {
  const { x, y } = squareXY(square, orientation);
  return { left: `${(x - 50) / 8}%`, top: `${(y - 50) / 8}%` };
};

/** Ice over frozen pieces and the pie on its square (over the board, under any banner; never takes a tap). */
export function PowerBoard({ boss, orientation, moments = [], now = Date.now(), fen }: { boss: BossView; orientation: "white" | "black"; moments?: readonly Moment[]; now?: number; fen?: string }) {
  const p = boss.powers;
  if (!p) return null;
  const board = fen ?? boss.board.fen;
  const iced = p.iced.filter((sq) => pieceAt(board, sq)?.color === boss.crowdSide);
  const pie = p.pie?.square;
  const show = (sq: string) => {
    const t = appearAt(sq, moments, orientation);
    return { on: now >= t, fresh: t > 0 && now - t < 450 };
  };
  return (
    <div class="power-board" aria-hidden="true">
      {pie &&
        show(pie).on &&
        (() => {
          const s = show(pie);
          return (
            <span key={`pie-${pie}`} class={`pw-pie${s.fresh ? " fresh" : ""}`} style={at(pie, orientation)}>
              <PieArt />
            </span>
          );
        })()}
      {iced.map((sq) => {
        const s = show(sq);
        return s.on ? (
          <span key={`ice-${sq}`} class={`pw-ice${s.fresh ? " fresh" : ""}`} style={at(sq, orientation)}>
            <IceArt />
          </span>
        ) : null;
      })}
    </div>
  );
}

/** A block of ice over a piece: pale blue, see-through, with frost on its edges and a glint. */
function IceArt() {
  return (
    <svg class="pw-ice-art" viewBox="0 0 16 16" shape-rendering="crispEdges">
      <rect x="1" y="1" width="14" height="14" fill="rgba(186, 230, 253, 0.42)" />
      <path d="M1 1h14v1H1zM1 14h14v1H1zM1 2h1v12H1zM14 2h1v12h-1z" fill="rgba(240, 249, 255, 0.95)" />
      <path d="M3 3h3v1H3zM3 4h1v2H3zM11 12h2v1h-2zM12 10h1v2h-1zM2 8h1v1H2zM13 5h1v1h-1z" fill="#fff" />
      <path d="M5 11h1v1H5zM9 3h1v1H9zM7 7h1v1H7z" fill="rgba(125, 211, 252, 0.9)" />
    </svg>
  );
}

/** A cream pie, splatted: crust, cream, a cherry. */
function PieArt() {
  return (
    <svg class="pw-pie-art" viewBox="0 0 16 16" shape-rendering="crispEdges">
      <path d="M2 9h12v1h1v2h-1v1H2v-1H1v-2h1z" fill="#c2853a" />
      <path d="M3 10h10v2H3z" fill="#e0a85a" />
      <path d="M2 7h1V6h2V5h6v1h2v1h1v2H2z" fill="#fff8e7" />
      <path d="M1 8h1v1H1zM14 8h1v2h-1zM4 4h1v1H4zM12 4h1v1h-1zM0 10h1v1H0zM15 6h1v1h-1z" fill="#fff8e7" />
      <path d="M7 3h2v2H7z" fill="#e11d48" />
      <path d="M7 3h1v1H7z" fill="#fb7185" />
    </svg>
  );
}

// ---------------- The moments ----------------

const PIECE_WORD: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const ULT_NAME: Record<string, string> = { blizzard: "the Blizzard", funhouse: "the Funhouse" };

/** A small, stable hash, for picking a line the same everywhere. */
const hash = (s: string) => [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Boingo's line in his funhouse (his kit's, if it has some; these otherwise), the same on every screen. */
export const FUNHOUSE_LINES = ["Let me get that for you!", "Welcome to the funhouse!", "Your move? Mine now!", "Honk! I'll drive."];
export function funhouseLine(kit: BossKit | null, key: string): string {
  const own = (kit?.lines as Partial<Record<string, readonly string[]>> | undefined)?.funhouse;
  const lines = own?.length ? own : FUNHOUSE_LINES;
  return lines[hash(key) % lines.length]!;
}

/**
 * The moment playing now, over the board: its banner (boss left, moment middle, God King right) and its effect on
 * the board. The ice and the pie themselves are the board layer's (PowerBoard), timed to land with the effect.
 */
export function PowerMoment({ boss, moment, now, orientation, side }: { boss: BossView; moment: Moment | null; now: number; orientation: "white" | "black"; side: "w" | "b" }) {
  if (!moment) return null;
  const t = now - moment.at;
  const kit = bossKit(boss.name);
  const banner = (text: string, sub?: string, tone = "") => <PowerBanner key={moment.key} boss={boss} side={side} text={text} sub={sub} tone={tone} />;
  switch (moment.kind) {
    case "freeze": {
      const piece = moment.square ? pieceAt(boss.board.fen, moment.square) : null;
      return (
        <div class="power-moment pm-freeze">
          {t < 1500 && banner("FREEZE!", piece ? `Your ${PIECE_WORD[piece.type]} is frozen` : undefined, "cold")}
          {moment.square && t >= FREEZE.frostAt && t < FREEZE.frostAt + 1050 && <span class="pw-frost" style={{ ...at(moment.square, orientation), animationDelay: `${FREEZE.frostAt - t}ms` }} />}
          <CastSprite kit={kit} anim="freezeCast" since={moment.at} />
        </div>
      );
    }
    case "pie":
      return (
        <div class="power-moment pm-pie">
          {t < 1500 && banner("PIE!", moment.square ? `Splat on ${moment.square}` : undefined)}
          {moment.square && t >= PIE.flyAt && t < PIE.landAt && <span class="pw-pie-fly" style={{ ...flyStyle(moment.square, orientation), animationDelay: `${PIE.flyAt - t}ms` }} />}
          {moment.square && t >= PIE.landAt && t < PIE.landAt + 550 && <span class="pw-splat" style={{ ...at(moment.square, orientation), animationDelay: `${PIE.landAt - t}ms` }} />}
          <CastSprite kit={kit} anim="pieThrow" since={moment.at} />
        </div>
      );
    case "warn": {
      const ult = boss.powers?.ultimate ?? "";
      return <div class="power-moment pm-warn">{t < 1600 && banner("RAGE!", `Next turn: ${ULT_NAME[ult] ?? "its ultimate"}`, "rage")}</div>;
    }
    case "blizzard":
      return (
        <div class="power-moment pm-blizzard">
          {t < 1500 && banner("BLIZZARD!", undefined, "cold")}
          {t >= BLIZZARD.sweepAt - 100 && t < BLIZZARD.sweepAt + BLIZZARD.sweepMs + 400 && (
            <span class="pw-clip">
              <span class="pw-sweep" style={{ animationDelay: `${BLIZZARD.sweepAt - 100 - t}ms` }} />
            </span>
          )}
          <CastSprite kit={kit} anim="blizzard" since={moment.at} />
        </div>
      );
    case "funhouse": {
      const line = funhouseLine(kit, moment.key);
      return (
        <div class="power-moment pm-funhouse">
          {kit && <PogoClown kit={kit} t={t} />}
          {t >= FUNHOUSE.bannerAt && t < FUNHOUSE.bannerAt + 1500 && banner("FUNHOUSE!", undefined, "fun")}
          {t >= FUNHOUSE.lineAt && t < FUNHOUSE.exitAt && (
            <div class="pm-line" role="status" aria-label={line}>
              {line.slice(0, Math.min(line.length, Math.floor((t - FUNHOUSE.lineAt) / 28) + 1))}
            </div>
          )}
        </div>
      );
    }
  }
}

/** From the boss's side of the board (its top corner) to the square: the pie's flight, as CSS variables. */
function flyStyle(square: string, orientation: "white" | "black") {
  const { x, y } = squareXY(square, orientation);
  return { "--fx": `${x / 8}%`, "--fy": `${y / 8}%`, left: "8%", top: "-6%" } as Record<string, string>;
}

/** The power's banner: the God King's cut-in style, the boss on the left and the God King on the right. */
export function PowerBanner({ boss, side, text, sub, tone = "" }: { boss: BossView; side: "w" | "b"; text: string; sub?: string; tone?: string }) {
  return (
    <div class={`fight-banner king-cut power-cut ${tone}`} role="alert" aria-label={sub ? `${boss.name}: ${text} ${sub}` : `${boss.name}: ${text}`}>
      <div class="fb-flash" />
      <div class="fb-band">
        <div class="fb-lines" />
        <span class="kc-portrait pc-boss">
          <BossFace boss={boss} />
        </span>
        <span class="fb-words kc-words">
          <span class="kc-label">{boss.name.replace(/^The /, "")}</span>
          <span class="fb-text kc-text">{text}</span>
          {sub && <span class="fb-sub">{sub}</span>}
        </span>
        <span class="kc-target pc-king">
          <GodKingPortrait side={side} />
        </span>
      </div>
    </div>
  );
}

// ---------------- Sprites ----------------

const images = new WeakMap<Frame, ImageData>();
function frameImage(ch: Character, frame: Frame): ImageData {
  let img = images.get(frame);
  if (!img) {
    const r = renderFrame(ch, frame);
    img = new ImageData(new Uint8ClampedArray(r.data), r.w, r.h);
    images.set(frame, img);
  }
  return img;
}
const lengthOf = (a: Anim) => a.frames.reduce((s, f) => s + f.ms, 0);
function frameAt(a: Anim, t: number): number {
  const total = lengthOf(a);
  const tt = a.loop ? ((t % total) + total) % total : t;
  let acc = 0;
  for (let i = 0; i < a.frames.length; i++) if (tt < (acc += a.frames[i]!.ms)) return i;
  return a.frames.length - 1;
}

/** One of a kit's animations on a canvas, from `since` (wall clock), drawn before the paint and every frame after. */
export function KitAnim({ kit, anim, since, class: cls = "" }: { kit: BossKit; anim: string; since: number; class?: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const a = kit.ch.anims[anim] ?? kit.ch.anims.idle!;
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    let raf = 0;
    let last = -1;
    const draw = () => {
      const i = frameAt(a, Date.now() - since);
      if (i !== last) {
        last = i;
        g.putImageData(frameImage(kit.ch, a.frames[i]!), 0, 0);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [kit, anim, since]);
  return <canvas ref={cv} class={`kit-anim ${cls}`} width={kit.ch.w} height={kit.ch.h} aria-hidden="true" />;
}

/** The boss casting, by the board's top-left corner (its side), when its kit has the moment's animation. */
function CastSprite({ kit, anim, since }: { kit: BossKit | null; anim: string; since: number }) {
  if (!kit?.ch.anims[anim]) return null;
  return (
    <span class="pm-caster">
      <KitAnim kit={kit} anim={anim} since={since} />
    </span>
  );
}

/** Boingo's funhouse: he pogos onto the board from his side, bounces in the middle while it flips, then pogos off. */
function PogoClown({ kit, t }: { kit: BossKit; t: number }) {
  const phase = t < 700 ? "in" : t < FUNHOUSE.exitAt ? "bounce" : "out";
  const anim = kit.ch.anims.funhouse ? "funhouse" : "idle";
  const since = useRef(Date.now() - t).current;
  return (
    <span class={`pm-pogo ${phase}`}>
      <KitAnim kit={kit} anim={anim} since={since} />
    </span>
  );
}

// ---------------- The rage meter ----------------

/** The boss bar's rage meter: fills as the boss loses material; full, it flashes (the warning); spent, it's gone. */
export function RageMeter({ boss }: { boss: BossView }): ComponentChildren {
  const p = boss.powers;
  if (!p || p.rage === null || boss.result) return null;
  // (Warned or unleashed, it's full: the test switch can bring the ultimate before the boss has lost anything.)
  const pct = p.warned || p.ultAt !== null ? 100 : Math.round(p.rage * 100);
  return (
    <span class={`rage-meter${p.warned ? " warned" : ""}${p.ultAt !== null ? " now" : ""}`} role="meter" aria-label={`Rage ${pct}%`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} title={`Rage: its ultimate comes when it has lost ${BOSS_POWERS.rageFull} points of material`}>
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}
