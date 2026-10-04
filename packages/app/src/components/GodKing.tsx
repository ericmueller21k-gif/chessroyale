import { useEffect } from "preact/hooks";
import { useFrameNow } from "./Countdown.tsx";
import { pieceAt } from "@chessroyale/chess";
import { play, type SoundName } from "../sound.ts";

/**
 * The God King: a chess piece of our own, drawn in parts so he can move. A
 * crowned, visored knight-king on a three-tier chess base, a sword held point
 * down in front of him. Drawn in the crowd's colour, outlined like the board's
 * pieces, with gold for the crown and the hilt.
 */
export function GodKingSprite({ side, raised = false, class: cls = "" }: { side: "w" | "b"; raised?: boolean; class?: string }) {
  const fill = side === "w" ? "#f7f7f5" : "#1d1d1f";
  const line = side === "w" ? "#1d1d1f" : "#f7f7f5";
  const gold = "#f2c14e";
  return (
    <svg class={`god-king ${cls}`} viewBox="0 0 100 150" aria-hidden="true">
      <g class="gk-body" stroke={line} stroke-width="3" stroke-linejoin="round">
        {/* Base: three tiers, like every piece on the board. */}
        <rect x="14" y="132" width="72" height="12" rx="3" fill={fill} />
        <path d="M22 132 Q22 122 30 119 L70 119 Q78 122 78 132 Z" fill={fill} />
        <rect x="24" y="111" width="52" height="8" rx="3" fill={fill} />
        {/* Armour: shoulders, chest and the skirt down to the base. */}
        <path d="M18 66 Q20 52 36 50 L64 50 Q80 52 82 66 L84 84 L74 86 L72 111 L28 111 L26 86 L16 84 Z" fill={fill} />
        <path d="M36 52 L50 66 L64 52" fill="none" />
        <path d="M28 86 L72 86" fill="none" />
        {/* Helmet with a visor. */}
        <path d="M34 26 Q50 20 66 26 L65 46 Q50 56 35 46 Z" fill={fill} />
        <path d="M38 32 L62 32" fill="none" />
        <g stroke={line} stroke-width="2.5">
          <line x1="42" y1="35" x2="42" y2="43" />
          <line x1="46" y1="35" x2="46" y2="45" />
          <line x1="54" y1="35" x2="54" y2="45" />
          <line x1="58" y1="35" x2="58" y2="43" />
        </g>
      </g>
      {/* Crown and cross. */}
      <g class="gk-crown" fill={gold} stroke={line} stroke-width="2" stroke-linejoin="round">
        <path d="M32 24 L30 8 L40 15 L45 5 L50 13 L55 5 L60 15 L70 8 L68 24 Q50 19 32 24 Z" />
        <path d="M48 0 h4 v3 h3 v4 h-3 v4 h-4 v-4 h-3 v-4 h3 Z" />
      </g>
      {/* The sword, point down in front of him; it lifts when he commands. */}
      <g class={`gk-sword${raised ? " raised" : ""}`} stroke={line} stroke-width="2" stroke-linejoin="round">
        <path d="M47.5 92 L52.5 92 L52.5 126 L50 131 L47.5 126 Z" fill="#dfe6ee" />
        <rect x="36" y="88" width="28" height="5" rx="2.5" fill={gold} />
        <rect x="47" y="70" width="6" height="18" rx="2" fill={gold} />
        <circle cx="50" cy="67" r="5" fill={gold} />
        {/* His fist on the grip. */}
        <rect x="42" y="74" width="16" height="10" rx="4" fill={fill} stroke={line} />
      </g>
    </svg>
  );
}

/** Centre of a square on the board in a 0-800 coordinate space, from the given side. */
function squareXY(square: string, orientation: "white" | "black") {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const col = orientation === "white" ? f : 7 - f;
  const row = orientation === "white" ? 7 - r : r;
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

/** A thin jagged bolt from (x1, y1) to (x2, y2). */
function boltPath(x1: number, y1: number, x2: number, y2: number, seed: number) {
  const steps = 6;
  let d = `M${x1} ${y1}`;
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const jitter = (((seed * 9301 + i * 49297) % 233280) / 233280 - 0.5) * 46 * (1 - t * 0.6);
    d += ` L${x1 + (x2 - x1) * t + (nx / len) * jitter} ${y1 + (y2 - y1) * t + (ny / len) * jitter}`;
  }
  return `${d} L${x2} ${y2}`;
}

/** The square a side's king stands on. */
export function kingSquare(fen: string, side: "w" | "b"): string | null {
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
    const p = pieceAt(fen, `${f}${r}`);
    if (p?.type === "k" && p.color === side) return `${f}${r}`;
  }
  return null;
}

/** Where the converging bolts start: points around the board's edge. */
const EDGE = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + 0.3;
  return { x: 400 + Math.cos(a) * 560, y: 400 + Math.sin(a) * 560 };
});

/**
 * Summoning the God King on your king's square. A dozen thin bolts converge on
 * the square, a beam of light, a flash, and the God King stands there in your
 * king's place (the real king is hidden while he's on the board). He raises his
 * sword and a thin bolt strikes `target`: the piece he moves ("move", which then
 * plays at `moveAt`), or the boss's king ("strike", with a floating "-N HP").
 * At `exitAt` (the round ending) holy light takes him away on whatever square
 * he's on, and the plain king drops back there. All times are Date.now() values.
 */
export function KingSummon({
  side,
  orientation,
  kingBefore,
  kingAfter,
  target,
  mode,
  hp,
  startAt,
  moveAt,
  exitAt,
}: {
  side: "w" | "b";
  orientation: "white" | "black";
  /** Your king's square when he arrives, and after the move (the same unless the king itself moves). */
  kingBefore: string;
  kingAfter: string;
  target: string | null;
  mode: "move" | "strike";
  hp?: number;
  startAt: number;
  moveAt: number;
  exitAt: number;
}) {
  const now = useFrameNow();
  const t = now - startAt;
  const out = now - exitAt;
  const square = now >= moveAt ? kingAfter : kingBefore;
  const k = squareXY(square, orientation);
  const k0 = squareXY(kingBefore, orientation);
  const tg = target ? squareXY(target, orientation) : null;
  const present = t >= 1300 && out < 700;
  const raised = t >= 1550;
  // His sounds, in time with the animation.
  useEffect(() => {
    const cues: [SoundName, number][] = [
      ["gkSummon", startAt],
      ["gkAppear", startAt + 1250],
      ["gkHyuah", startAt + 1550],
      ...(tg ? ([["gkBolt", startAt + 1760]] as [SoundName, number][]) : []),
      ...(mode === "strike" ? ([["gkHit", startAt + 1980]] as [SoundName, number][]) : []),
      ["gkLeave", exitAt],
    ];
    const timers = cues.map(([name, at]) => setTimeout(() => play(name), Math.max(0, at - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, []);
  if (out > 900) return null;
  const pct = (v: number) => `${v / 8}%`;
  const hideClass = present ? ` hide-king-${side}` : "";
  return (
    <div class={`king-summon ${mode}${hideClass}`} aria-label={mode === "move" ? "The God King plays the move" : "The God King strikes the boss"}>
      <svg class="ks-fx" viewBox="0 0 800 800" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="ks-glow">
            <stop offset="0" stop-color="#fffbe6" stop-opacity="1" />
            <stop offset="1" stop-color="#ffe08a" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="ks-beam" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#fffbe6" stop-opacity="0" />
            <stop offset="1" stop-color="#fff3c4" stop-opacity="0.95" />
          </linearGradient>
        </defs>
        {/* A dozen thin bolts converging on your king, faster and faster. */}
        {t < 1250 &&
          EDGE.map((e, i) => {
            const at = 950 * (1 - Math.pow(1 - i / EDGE.length, 1.6));
            const age = t - at;
            if (age < 0 || age > 170) return null;
            return <path key={i} class="ks-bolt" d={boltPath(e.x, e.y, k0.x, k0.y, i + 7)} style={{ opacity: 1 - age / 170 }} />;
          })}
        {/* The beam down onto the square, then the flash. */}
        {t >= 900 && t < 1300 && <rect x={k0.x - 26} y={0} width={52} height={k0.y + 40} fill="url(#ks-beam)" style={{ opacity: Math.min(1, (t - 900) / 150) * (t > 1200 ? (1300 - t) / 100 : 1) }} />}
        {t >= 1200 && t < 1550 && <circle cx={k0.x} cy={k0.y} r={70 + (t - 1200) / 4} fill="url(#ks-glow)" style={{ opacity: 1 - (t - 1200) / 350 }} />}
        {/* His bolt: from his square to the piece he moves, or to the boss's king. */}
        {tg && t >= 1750 && t < 2050 && <path class="ks-bolt strike" d={boltPath(k0.x, k0.y - 30, tg.x, tg.y, 13)} style={{ opacity: t < 1900 ? 1 : (2050 - t) / 150 }} />}
        {tg && t >= 1800 && t < 2200 && <circle class="ks-hit" cx={tg.x} cy={tg.y} r={20 + (t - 1800) / 8} style={{ opacity: 1 - (t - 1800) / 400 }} />}
        {/* Leaving: a column of holy light on his square. */}
        {out >= 0 && out < 500 && <rect x={k.x - 40} y={0} width={80} height={k.y + 50} fill="url(#ks-beam)" style={{ opacity: out < 150 ? out / 150 : (500 - out) / 350 }} />}
      </svg>
      {present && (
        <div
          class={`ks-god${raised ? " raised" : ""}${out >= 0 ? " leaving" : ""}`}
          style={{ left: pct(k.x - 50), top: pct(k.y - 50), opacity: out >= 0 ? Math.max(0, 1 - out / 400) : Math.min(1, (t - 1300) / 150) }}
        >
          <GodKingSprite side={side} raised={raised} />
        </div>
      )}
      {out >= 350 && out < 900 && (
        <span class="ks-plain cg-wrap" style={{ left: pct(k.x - 50), top: pct(k.y - 50) }} aria-hidden="true">
          <piece class={`${side === "w" ? "white" : "black"} king`} />
        </span>
      )}
      {mode === "strike" && tg && t >= 1950 && t < 3000 && (
        <span class="ks-hp" style={{ left: pct(tg.x), top: pct(tg.y) }}>
          −{hp ?? 10} HP
        </span>
      )}
    </div>
  );
}
