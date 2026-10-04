import { useEffect } from "preact/hooks";
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

/** A jagged bolt from (x1, y1) to (x2, y2). */
function boltPath(x1: number, y1: number, x2: number, y2: number, seed: number) {
  const steps = 7;
  let d = `M${x1} ${y1}`;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const jitter = (((seed * 9301 + i * 49297) % 233280) / 233280 - 0.5) * 60;
    // Offset sideways from the line, alternating.
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
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

/**
 * Summoning the God King, over the board (about 3.6 s, all CSS timings):
 * three slow bolts converge on the centre, a beam of light, a flash, and the
 * God King stands there with his sword. He raises it and a thin bolt strikes
 * `target`: the piece he moves ("move"), or the boss's king ("strike", with a
 * floating "−N HP"). Then holy light takes him away and the plain king drops in.
 */
export function KingSummon({
  side,
  orientation,
  target,
  mode,
  hp,
}: {
  side: "w" | "b";
  orientation: "white" | "black";
  target: string | null;
  mode: "move" | "strike";
  /** Strike: the points the boss loses, shown as HP. */
  hp?: number;
}) {
  const t = target ? squareXY(target, orientation) : { x: 400, y: 400 };
  // His sounds, in time with the animation (the CSS timings below).
  useEffect(() => {
    const cues: [SoundName, number][] = [
      ["gkSummon", 0],
      ["gkAppear", 1350],
      ["gkHyuah", 1820],
      ["gkBolt", 2060],
      ...(mode === "strike" ? ([["gkHit", 2260]] as [SoundName, number][]) : []),
      ["gkLeave", 2950],
    ];
    const timers = cues.map(([name, at]) => setTimeout(() => play(name), at));
    return () => timers.forEach(clearTimeout);
  }, []);
  const corners = [
    [0, 0],
    [800, 120],
    [120, 800],
  ];
  return (
    <div class={`king-summon ${mode}`} role="alert" aria-label={mode === "move" ? "The God King plays the move" : "The God King strikes the boss"}>
      <svg class="ks-fx" viewBox="0 0 800 800" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="ks-flash">
            <stop offset="0" stop-color="#fffbe6" stop-opacity="1" />
            <stop offset="1" stop-color="#ffe9a3" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="ks-beam" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#fffbe6" stop-opacity="0.95" />
            <stop offset="1" stop-color="#ffe08a" stop-opacity="0.15" />
          </linearGradient>
        </defs>
        {/* Converging bolts, slow, one after another. */}
        {corners.map(([x, y], i) => (
          <path key={i} class={`ks-bolt ks-converge c${i}`} d={boltPath(x!, y!, 400, 380, i + 3)} />
        ))}
        <rect class="ks-beam" x="340" y="0" width="120" height="460" fill="url(#ks-beam)" />
        <circle class="ks-flash" cx="400" cy="400" r="420" fill="url(#ks-flash)" />
        {/* His strike: from the sword's point to the target square. */}
        <path class="ks-bolt ks-strike" d={boltPath(400, 300, t.x, t.y, 11)} />
        <circle class="ks-hit" cx={t.x} cy={t.y} r="46" />
        {/* Leaving: holy light. */}
        <rect class="ks-exit" x="330" y="0" width="140" height="800" fill="url(#ks-beam)" />
      </svg>
      <div class="ks-king">
        <GodKingSprite side={side} />
      </div>
      <div class="ks-king raised">
        <GodKingSprite side={side} raised />
      </div>
      <span class={`ks-plain cg-wrap`} aria-hidden="true">
        <piece class={`${side === "w" ? "white" : "black"} king`} />
      </span>
      {mode === "strike" && (
        <span class="ks-hp" style={{ left: `${t.x / 8}%`, top: `${t.y / 8}%` }}>
          −{hp ?? 10} HP
        </span>
      )}
    </div>
  );
}
