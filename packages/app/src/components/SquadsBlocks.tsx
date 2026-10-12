import { useMemo, useState } from "preact/hooks";
import { blockCost, blockTargets, piecesOf, type BlockPiece, type Colour, type SquadsBlock, type TokenUse } from "@chessroyale/chess/squads";
import { blockName, coinText, tokenWords, squadName } from "../squads-view.ts";

/**
 * Squads v2 on the board (docs/areas/squads.md, "The screens"): move blocks drawn as soft arrows that keep drawing
 * themselves with a lock pulsing on them, the block picker (tap their piece, then where it would go), teammates' picks
 * named on the board in the final, the squads' block banks and same-move tokens, and the post-match token breakdown.
 * Everything drawn over the squares is placed in eighths of the board's own size (`--board-size`), as SquareRing is.
 */

/** Where a square is drawn, in eighths of the board (its column and row from the top left). */
export function squareAt(square: string, orientation: "white" | "black") {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: orientation === "white" ? f : 7 - f, y: orientation === "white" ? 7 - r : r };
}

/** The lock (a padlock), drawn in a 24-unit box. */
export function LockIcon({ size }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" class="sq-lock-icon">
      <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
      <rect x="4" y="10" width="16" height="11" rx="2.5" fill="currentColor" />
    </svg>
  );
}

/** A same-move token: two stacked discs. */
function TokenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sq-token-icon">
      <ellipse cx="12" cy="15.5" rx="8" ry="3.6" fill="currentColor" opacity="0.55" />
      <ellipse cx="12" cy="10" rx="8" ry="3.6" fill="currentColor" />
    </svg>
  );
}

/** How long one soft redraw of a block's arrow takes, and its first (normal) draw (ms). Kept in step with styles.css. */
export const BLOCK_DRAW_MS = 450;
export const BLOCK_LOOP_MS = 2600;

/**
 * Every blocked move on a board, as everyone sees it from the moment it's placed until the other squad has moved:
 * an arrow from the piece to the blocked square that draws like a move arrow, then keeps redrawing itself slowly and
 * softly, with the lock fading in and out on it. Each keeps its beat across redraws and screens (`since`: when it
 * was first seen), so nothing restarts when the screen is drawn again.
 */
export function BlockArrows({ blocks, since, orientation }: { blocks: readonly SquadsBlock[]; since: Readonly<Record<string, number>>; orientation: "white" | "black" }) {
  if (!blocks.length) return null;
  return (
    <svg class="sq-block-arrows" viewBox="0 0 8 8" aria-hidden="true">
      {blocks.map((b) => (
        <BlockArrow key={`${b.board}/${b.move}`} move={b.move} since={since[`${b.board}/${b.move}`] ?? null} orientation={orientation} />
      ))}
    </svg>
  );
}

function BlockArrow({ move, since, orientation }: { move: string; since: number | null; orientation: "white" | "black" }) {
  // Its age as it's first drawn sets its animations' phase for good (a later redraw mustn't move them).
  const age = useMemo(() => Math.max(0, Date.now() - (since ?? Date.now())), []);
  const from = squareAt(move.slice(0, 2), orientation);
  const to = squareAt(move.slice(2, 4), orientation);
  const x1 = from.x + 0.5;
  const y1 = from.y + 0.5;
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ux = (to.x - from.x) / len;
  const uy = (to.y - from.y) / len;
  // (The shaft stops short of the target's centre, so the head sits on the square, as the board's arrows do.)
  const x2 = to.x + 0.5 - ux * 0.32;
  const y2 = to.y + 0.5 - uy * 0.32;
  const head = `${x2 + ux * 0.3},${y2 + uy * 0.3} ${x2 - uy * 0.22},${y2 + ux * 0.22} ${x2 + uy * 0.22},${y2 - ux * 0.22}`;
  const style = { "--sq-age": `${-age}ms`, "--sq-age-loop": `${BLOCK_DRAW_MS - age}ms` };
  return (
    <g class="sq-block-arrow" style={style} data-move={move}>
      <path class="sq-block-shaft" d={`M${x1} ${y1}L${x2} ${y2}`} pathLength={1} />
      <polygon class="sq-block-head" points={head} />
      <g class="sq-block-lock" transform={`translate(${(x1 + x2) / 2} ${(y1 + y2) / 2})`}>
        <circle r="0.27" />
        <g transform="translate(-0.174 -0.17) scale(0.0145)">
          <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" />
          <rect x="4" y="10" width="16" height="11" rx="2.5" fill="#fff" />
        </g>
      </g>
    </g>
  );
}

/** A piece of the other squad that can be blocked now: its square, what a block of its moves costs, where it could go. */
interface Blockable {
  square: string;
  piece: BlockPiece;
  cost: number;
  targets: string[];
}

/** The other squad's pieces whose moves can be blocked now (within the bank, not already blocked), with their targets. */
export function blockables(fen: string, them: Colour, bank: number, taken: readonly string[]): Blockable[] {
  const out: Blockable[] = [];
  for (const [square, p] of piecesOf(fen)) {
    if ((p === p.toUpperCase() ? "w" : "b") !== them) continue;
    const piece = p.toLowerCase() as BlockPiece;
    const cost = blockCost(piece);
    if (cost === null || cost > bank) continue;
    const targets = blockTargets(fen, square, them).filter((to) => !taken.includes(square + to));
    if (targets.length) out.push({ square, piece, cost, targets });
  }
  return out;
}

/**
 * Choosing a block: each of their pieces that can be blocked is ringed with its cost; tap one, then a square it could
 * go to (a dot): that move is blocked. Tap the piece again to let it go. Taps between buttons fall through.
 */
export function BlockPicker({ fen, them, bank, taken, orientation, onBlock }: { fen: string; them: Colour; bank: number; taken: readonly string[]; orientation: "white" | "black"; onBlock: (move: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const list = useMemo(() => blockables(fen, them, bank, taken), [fen, them, bank, taken.join()]);
  const chosen = list.find((b) => b.square === sel) ?? null;
  const at = (sq: string) => {
    const p = squareAt(sq, orientation);
    return { "--sq-x": String(p.x), "--sq-y": String(p.y) };
  };
  return (
    <div class="sq-block-picker" role="group" aria-label="Block a move: tap their piece, then where it would go">
      {list.map((b) => (
        <button
          type="button"
          key={b.square}
          class={`sq-bp-piece${sel === b.square ? " on" : ""}`}
          style={at(b.square)}
          aria-label={`Block a move of the ${b.piece === "k" ? "king (castling)" : b.square} piece, ${b.cost} ${b.cost === 1 ? "point" : "points"}`}
          aria-pressed={sel === b.square}
          data-square={b.square}
          onClick={() => setSel(sel === b.square ? null : b.square)}
        >
          <span class="sq-bp-cost">{b.cost}</span>
        </button>
      ))}
      {chosen?.targets.map((to) => (
        <button
          type="button"
          key={`${chosen.square}${to}`}
          class="sq-bp-target"
          style={at(to)}
          data-square={to}
          aria-label={`Block ${blockName({ move: chosen.square + to, piece: chosen.piece })}`}
          onClick={() => {
            setSel(null);
            onBlock(chosen.square + to);
          }}
        />
      ))}
    </div>
  );
}

/** The final: teammates' picks named where they land (their arrows are the board's), stacked when several agree. */
export function PickTags({ picks, orientation }: { picks: readonly { move: string; names: string[]; you: boolean }[]; orientation: "white" | "black" }) {
  if (!picks.length) return null;
  return (
    <div class="sq-pick-tags" aria-hidden="true">
      {picks.map((p) => {
        const sq = squareAt(p.move.slice(2, 4), orientation);
        return (
          <span key={p.move} class={`sq-pick-tag${p.you ? " you" : ""}`} style={{ "--sq-x": String(sq.x), "--sq-y": String(sq.y) }}>
            {p.names.join(" · ")}
          </span>
        );
      })}
    </div>
  );
}

/** A coin (Mercenary), for prices and wallets. */
export function CoinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg class="mc-coin" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <circle cx="8" cy="8" r="4.3" fill="none" stroke="var(--mc-coin-ring, rgba(0,0,0,0.28))" stroke-width="1.6" />
    </svg>
  );
}

/** "1,240" with a coin (Mercenary). */
export function Coins({ n, class: cls = "" }: { n: number; class?: string }) {
  return (
    <span class={`mc-coins ${cls}`} aria-label={`${coinText(n)} coins`}>
      <CoinIcon />
      {coinText(n)}
    </span>
  );
}

/**
 * Each squad's block bank (a lock and the points left; none in Classic) and, in Pairs, its same-move tokens (×N), shown
 * under the board beside the clocks for both squads at all times.
 */
export function SquadResources({ bank, tokens, you }: { bank: number | null; tokens: number | null; you?: boolean }) {
  if (bank === null && tokens === null) return null;
  return (
    <span class={`sq-res${you ? " you" : ""}`}>
      {bank !== null && (
        <span class="sq-res-bank" title={`Block points left: ${bank}`} aria-label={`${bank} block points`}>
          <LockIcon />
          {bank}
        </span>
      )}
      {tokens !== null && (
        <span class={`sq-res-tokens${tokens ? "" : " none"}`} title={`Same-move tokens left: ${tokens}`} aria-label={`${tokens} same-move tokens`}>
          <TokenIcon />×{tokens}
        </span>
      )}
    </span>
  );
}

/**
 * The post-match breakdown of a Pairs match's same-move tokens: every use, squad by squad, with its move, whether it
 * was refunded, and why, in plain words with numbers.
 */
export function TokenBreakdown({ log, sides, mine }: { log: readonly TokenUse[]; sides: readonly { squadId: number }[]; mine: number | null }) {
  if (!log.length) return null;
  return (
    <div class="sq-card sq-tokens">
      <div class="sq-card-title">Same-move tokens</div>
      <ul class="sq-token-list">
        {log.map((u, i) => (
          <li key={i} class={`${u.verdict?.refunded ? "refunded" : u.verdict ? "kept" : "pending"}${u.side === mine ? " ours" : ""}`}>
            <span class="sq-token-who">{squadName(sides[u.side]?.squadId)}</span>
            <span>{tokenWords(u)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
