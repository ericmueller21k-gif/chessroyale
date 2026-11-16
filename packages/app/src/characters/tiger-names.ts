/**
 * Tiger's balloons by name (out of tiger-bar.ts, his pump's drawing): the pieces, the colors and the pump's animations' names, which the
 * board's balloon show (tiger-show.ts) reads from the first load without his code (Nov 16, the bundle split).
 */

export const BALLOON_PIECES = ["pawn", "knight", "bishop", "rook", "queen"] as const;
export type BalloonPiece = (typeof BALLOON_PIECES)[number];
export type Stage = 1 | 2 | 3 | 4;

/** The colors a balloon can be (Eric's reference: yellow, red, blue, green, purple, pink), three each: dark, round, light. */
export const BALLOON_COLORS = {
  yellow: ["#b88a0a", "#f2c31a", "#ffe566"],
  red: ["#8f0f22", "#dc2433", "#ff6a5e"],
  blue: ["#1a4fa8", "#2f7fe0", "#7cc0ff"],
  green: ["#0f6a3a", "#1fa856", "#6fe08e"],
  purple: ["#5a2a96", "#9150d6", "#c79bf5"],
  pink: ["#b02a6e", "#ec5fa5", "#ffaed6"],
} as const satisfies Record<string, readonly [string, string, string]>;
export type BalloonColor = keyof typeof BALLOON_COLORS;
export const BALLOON_COLOR_NAMES = Object.keys(BALLOON_COLORS) as BalloonColor[];

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** The name of an animation of the pump: `bare`, `put`, `stage` (with the stage), `grow` (into the stage), `pop` (from the stage), `release`. */
export function pumpAnim(kind: "bare" | "put" | "stage" | "grow" | "pop" | "release" | "ready", piece: BalloonPiece, stage: Stage = 4): string {
  if (kind === "bare") return "bare";
  if (kind === "ready") return `ready${cap(piece)}`;
  if (kind === "stage" && stage === 1) return "stage1";
  if (kind === "put") return `put${cap(piece)}`;
  if (kind === "release") return `release${cap(piece)}`;
  return `${kind}${stage}${cap(piece)}`;
}
