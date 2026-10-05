import { useEffect } from "preact/hooks";
import { useFrameNow } from "./Countdown.tsx";
import { pieceAt } from "@chessroyale/chess";
import { play, type SoundName } from "../sound.ts";
import { equippedLook } from "@chessroyale/core";
import { account } from "../account.ts";

/** Your equipped God King effect (from the shop) as CSS colours for his bolts, beam and glow. */
export function kingEffectStyle(): Record<string, string> {
  const look = equippedLook(account().profile?.shop, "king");
  return { "--ks-bolt": look.bolt!, "--ks-glow": look.glow!, "--ks-beam": look.beam! };
}

/** His colours: armour in the crowd's colour, outlined like the board's pieces; gold for the crown and hilt. */
function kingColours(side: "w" | "b") {
  return { fill: side === "w" ? "#f7f7f5" : "#1d1d1f", line: side === "w" ? "#1d1d1f" : "#f7f7f5", gold: "#f2c14e" };
}

/** His body: the three-tier base, the armour and the visored helm (in a 100 × 150 box, standing). */
function KingBody({ fill, line }: { fill: string; line: string }) {
  return (
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
  );
}

/** His crown and its cross. */
function KingCrown({ line, gold }: { line: string; gold: string }) {
  return (
    <g class="gk-crown" fill={gold} stroke={line} stroke-width="2" stroke-linejoin="round">
      <path d="M32 24 L30 8 L40 15 L45 5 L50 13 L55 5 L60 15 L70 8 L68 24 Q50 19 32 24 Z" />
      <path d="M48 0 h4 v3 h3 v4 h-3 v4 h-4 v-4 h-3 v-4 h3 Z" />
    </g>
  );
}

/** His sword, point down in front of him, his fist on the grip (`fist`: with his hand on it). */
function KingSword({ fill, line, gold, fist = true, raised = false }: { fill: string; line: string; gold: string; fist?: boolean; raised?: boolean }) {
  return (
    <g class={`gk-sword${raised ? " raised" : ""}`} stroke={line} stroke-width="2" stroke-linejoin="round">
      <path d="M47.5 92 L52.5 92 L52.5 126 L50 131 L47.5 126 Z" fill="#dfe6ee" />
      <rect x="36" y="88" width="28" height="5" rx="2.5" fill={gold} />
      <rect x="47" y="70" width="6" height="18" rx="2" fill={gold} />
      <circle cx="50" cy="67" r="5" fill={gold} />
      {fist && <rect x="42" y="74" width="16" height="10" rx="4" fill={fill} stroke={line} />}
    </g>
  );
}

/**
 * Cracks in his armour (his Last Stand), worse at each level 1 to 3: a split across the helm, then the chest
 * and a shoulder, then the skirt and the base. Each is a dark jagged line with a bright chipped edge beside it.
 */
const CRACKS: string[][] = [
  ["M57 25 L54 31 L58 36 L55 42", "M38 28 L42 33 L39 38"],
  ["M64 54 L58 61 L62 67 L56 74 L59 80", "M22 62 L28 67 L25 73", "M45 56 L49 60"],
  ["M34 88 L39 95 L35 101 L40 108", "M66 90 L61 97 L65 104", "M30 121 L36 126 L33 131", "M70 134 L64 139"],
];
function KingCracks({ level, line }: { level: number; line: string }) {
  if (level <= 0) return null;
  const paths = CRACKS.slice(0, level).flat();
  return (
    <g class="gk-cracks" fill="none" stroke-linejoin="round" stroke-linecap="round">
      {paths.map((d) => (
        <g key={d}>
          <path d={d} stroke="#fff6d8" stroke-width="2" transform="translate(1.6 0.6)" opacity="0.85" />
          <path d={d} stroke={line} stroke-width="2.6" />
        </g>
      ))}
    </g>
  );
}

/**
 * The God King: a chess piece of our own, drawn in parts so he can move. A
 * crowned, visored knight-king on a three-tier chess base, a sword held point
 * down in front of him. Drawn in the crowd's colour, outlined like the board's
 * pieces, with gold for the crown and the hilt. `cracks` (1 to 3): his armour
 * cracking under the blows of his Last Stand.
 */
export function GodKingSprite({ side, raised = false, cracks = 0, class: cls = "" }: { side: "w" | "b"; raised?: boolean; cracks?: number; class?: string }) {
  const { fill, line, gold } = kingColours(side);
  return (
    <svg class={`god-king ${cls}`} viewBox="0 0 100 150" aria-hidden="true">
      <KingBody fill={fill} line={line} />
      <KingCracks level={cracks} line={line} />
      <KingCrown line={line} gold={gold} />
      <KingSword fill={fill} line={line} gold={gold} raised={raised} />
    </svg>
  );
}

/**
 * The God King fallen (after his Last Stand): toppled on his side like a beaten
 * chess piece, his armour cracked, his crown knocked off beside his head and his
 * sword on the ground. Greyed in the dock for the rest of the battle.
 */
export function GodKingFallen({ side, class: cls = "" }: { side: "w" | "b"; class?: string }) {
  const { fill, line, gold } = kingColours(side);
  return (
    <svg class={`god-king fallen ${cls}`} viewBox="0 0 160 100" aria-hidden="true">
      <ellipse class="gk-fallen-shadow" cx="86" cy="94" rx="72" ry="5" />
      {/* His crown, knocked off, on the ground by his head. */}
      <g transform="translate(-8 76) rotate(-24 50 12) scale(0.6)">
        <KingCrown line={line} gold={gold} />
      </g>
      {/* Lying on his side: the standing figure turned a quarter, head to the left, base to the right. */}
      <g transform="translate(12 98) rotate(-90)">
        <KingBody fill={fill} line={line} />
        <KingCracks level={3} line={line} />
      </g>
      {/* His sword, dropped on the ground in front of him. */}
      <g transform="translate(-4 124) rotate(-90) scale(0.7)">
        <KingSword fill={fill} line={line} gold={gold} fist={false} />
      </g>
    </svg>
  );
}

/** Centre of a square on the board in a 0-800 coordinate space, from the given side. */
export function squareXY(square: string, orientation: "white" | "black") {
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

/** His cut-in banner: from when he raises his sword, for this long; his bolt and slashes come after it. */
export const KING_CUT_AT = 1550;
export const KING_CUT_MS = 1500;
/** The strike's three slashes: when each lands (ms after the summon starts). */
export const SLASH_AT = [1800 + KING_CUT_MS, 2250 + KING_CUT_MS, 2700 + KING_CUT_MS] as const;
/** His bolt to the piece he moves (ms after the summon starts). */
const BOLT_AT = 1750 + KING_CUT_MS;

/** `hp` in three slashes (10: 3, 3, 4). */
export function slashes(hp: number): number[] {
  const each = Math.floor(hp / 3);
  return [each, each, hp - 2 * each];
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
 * sword, then either a thin bolt strikes the piece he moves ("move", which then
 * plays at `moveAt`), or he slashes the boss's king three times ("strike", each
 * with its own sound and a yellow "−N" adding up to `hp`). At `exitAt` holy
 * light takes him away on whatever square he's on, and the plain king drops
 * back there. All times are Date.now() values.
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
  san,
  piece,
  bossIcon,
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
  /** For the cut-in: the move in SAN and the piece he moves, or the boss's face for a strike. */
  san?: string;
  piece?: "p" | "n" | "b" | "r" | "q" | "k";
  bossIcon?: string;
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
  const strike = mode === "strike";
  const hits = slashes(hp ?? 10);
  // His sounds, in time with the animation.
  useEffect(() => {
    const cues: [SoundName, number][] = [
      ["gkSummon", startAt],
      ["gkAppear", startAt + 1250],
      ["gkHyuah", startAt + 1550],
      ["gkCutIn", startAt + KING_CUT_AT + 60],
      ...(strike
        ? SLASH_AT.map((at, i) => [i === 2 ? "gkHit" : "gkSlash", startAt + at - 20] as [SoundName, number])
        : tg
          ? ([["gkBolt", startAt + BOLT_AT + 10]] as [SoundName, number][])
          : []),
      ...(strike ? ([["gkSlash", startAt + SLASH_AT[2] - 40]] as [SoundName, number][]) : []),
      ["gkLeave", exitAt],
    ];
    // Cues already past (a screen shown partway through) stay silent.
    const timers = cues.filter(([, at]) => at > Date.now() - 300).map(([name, at]) => setTimeout(() => play(name), Math.max(0, at - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, []);
  if (out > 900) return null;
  const pct = (v: number) => `${v / 8}%`;
  const hideClass = present ? ` hide-king-${side}` : "";
  return (
    <div class={`king-summon ${mode}${hideClass}`} style={kingEffectStyle()} aria-label={mode === "move" ? "The God King plays the move" : "The God King strikes the boss"}>
      <svg class="ks-fx" viewBox="0 0 800 800" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="ks-glow">
            <stop offset="0" stop-color="#fffbe6" stop-opacity="1" />
            <stop offset="1" style={{ stopColor: "var(--ks-glow, #ffe08a)" }} stop-opacity="0" />
          </radialGradient>
          <linearGradient id="ks-beam" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#fffbe6" stop-opacity="0" />
            <stop offset="1" style={{ stopColor: "var(--ks-beam, #fff3c4)" }} stop-opacity="0.95" />
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
        {/* His bolt to the piece he moves. */}
        {!strike && tg && t >= BOLT_AT && t < BOLT_AT + 300 && <path class="ks-bolt strike" d={boltPath(k0.x, k0.y - 30, tg.x, tg.y, 13)} style={{ opacity: t < BOLT_AT + 150 ? 1 : (BOLT_AT + 300 - t) / 150 }} />}
        {!strike && tg && t >= BOLT_AT + 50 && t < BOLT_AT + 450 && <circle class="ks-hit" cx={tg.x} cy={tg.y} r={20 + (t - BOLT_AT - 50) / 8} style={{ opacity: 1 - (t - BOLT_AT - 50) / 400 }} />}
        {/* The strike: three quick slashes on the boss's king, each a flash of his bolt and a cut across the square. */}
        {strike &&
          tg &&
          SLASH_AT.map((at, i) => {
            const age = t - at;
            if (age < -60 || age > 380) return null;
            // Alternate the cut's direction: \, /, then straight across.
            const dir = [
              [-1, -1, 1, 1],
              [1, -1, -1, 1],
              [-1, 0, 1, 0],
            ][i]!;
            const r = 46;
            const sweep = Math.min(1, Math.max(0, (age + 60) / 110));
            const x1 = tg.x + dir[0]! * r;
            const y1 = tg.y + dir[1]! * r;
            const x2 = x1 + (tg.x + dir[2]! * r - x1) * sweep;
            const y2 = y1 + (tg.y + dir[3]! * r - y1) * sweep;
            const fade = age < 160 ? 1 : Math.max(0, 1 - (age - 160) / 220);
            return (
              <g key={i}>
                {age < 120 && <path class="ks-bolt strike" d={boltPath(k0.x, k0.y - 30, tg.x, tg.y, 21 + i)} style={{ opacity: age < 0 ? 0.6 : 1 - age / 120 }} />}
                <line class="ks-slash" x1={x1} y1={y1} x2={x2} y2={y2} style={{ opacity: fade }} />
                {age >= 0 && <circle class="ks-hit" cx={tg.x} cy={tg.y} r={18 + age / 7} style={{ opacity: Math.max(0, 1 - age / 380) }} />}
              </g>
            );
          })}
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
      {t >= KING_CUT_AT && t < KING_CUT_AT + KING_CUT_MS && <KingCutIn mode={mode} side={side} san={san} piece={piece} bossIcon={bossIcon} />}
      {strike &&
        tg &&
        SLASH_AT.map((at, i) =>
          t >= at && t < at + 1000 ? (
            <span key={i} class="ks-hp" style={{ left: pct(tg.x + (i - 1) * 34), top: pct(tg.y - 10 + i * 6) }}>
              −{hits[i]}
            </span>
          ) : null,
        )}
    </div>
  );
}

/**
 * The God King's pixel portrait for his cut-in: a holy armoured king with a
 * spiked gold crown, burning gold eyes in his visor, gold-trimmed pauldrons and
 * the king's cross on his chest. A 64 × 60 pixel image (generated by
 * scripts/god-king-portrait.py), scaled up with crisp pixels; his armour in
 * the crowd's colour (the same picture recoloured for Black).
 */
export function GodKingPortrait({ side, hurt = false }: { side: "w" | "b"; hurt?: boolean }) {
  const name = hurt ? "god-king-portrait-hurt" : "god-king-portrait";
  return <img class="gk-portrait" src={`/sprites/${name}-${side}.png`} alt="" width={64} height={60} draggable={false} />;
}

const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const;

/**
 * The God King's cut-in, like a Fire Emblem critical: as he raises his sword a
 * band sweeps across the board with his portrait on the left, what he's doing
 * in the middle (the move, or STRIKE!) and its target on the right (the piece
 * he moves, or the boss's face).
 */
export function KingCutIn({
  mode,
  side,
  san,
  piece,
  bossIcon,
}: {
  mode: "move" | "strike";
  side: "w" | "b";
  san?: string;
  piece?: keyof typeof PIECE_NAMES;
  bossIcon?: string;
}) {
  return (
    <div class="fight-banner king-cut" role="alert" aria-label={mode === "move" ? `The God King plays ${san}` : "The God King strikes"}>
      <div class="fb-flash" />
      <div class="fb-band">
        <div class="fb-lines" />
        <span class="kc-portrait">
          <GodKingPortrait side={side} />
        </span>
        <span class="fb-words kc-words">
          <span class="kc-label">God King</span>
          <span class="fb-text kc-text">{mode === "move" ? san : "STRIKE!"}</span>
        </span>
        {mode === "move" && piece ? (
          <span class="kc-target cg-wrap">
            <piece class={`${side === "w" ? "white" : "black"} ${PIECE_NAMES[piece]}`} />
          </span>
        ) : (
          <span class="kc-target kc-boss">{bossIcon}</span>
        )}
      </div>
    </div>
  );
}
