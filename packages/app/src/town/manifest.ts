/**
 * The baked town's manifest (Nov 28, the town's structure, phase 1: docs/decisions/2026-11-28-town-bake.md, 2026-11-28-town-load-baked.md):
 * what the build's bake writes beside its picture files (scripts/bake-town.ts) and the app reads to load them (town/baked.ts on the
 * town's loading screen, town/baked-files.ts from home). Types and plain checks only: no town code, so the main bundle can read it.
 */

/** Where the build serves the baked town from (under the app's public folder). */
export const TOWN_PICTURES_DIR = "town-pictures";
export const TOWNS = ["player", "admin"] as const;
/** Whose town: a player's, or an admin's (the homes of the bosses in the game for admins first: admin-town.ts). */
export type TownKind = (typeof TOWNS)[number];

export interface TownFile {
  /** Its name under /town-pictures/: its group (and the one town that draws it, if only one does), then its contents' hash. */
  name: string;
  /** `home:<id>`, `row:<street>:<facing>`, `park`, `colosseum`, `props`, or `sidekick:<id>` (a sheet as it is, not a page). */
  group: string;
  /** The towns that draw something on it. */
  towns: TownKind[];
  w: number;
  h: number;
  bytes: number;
}
export interface TownManifest {
  v: 1;
  files: TownFile[];
  /** Each picture by name: its file (an index in `files`), x, y, width and height there. Names with the same pixels share a place. */
  pictures: Record<string, [file: number, x: number, y: number, w: number, h: number]>;
  /** Each roof painted (`roof:<box>:<painting>`): its faces, each its whole then its triangles, seven numbers a piece (its sheet, the
   * roof's `/<n>` picture; sx, sy, w, h there; ox, oy: where its texture's (0, 0) lies on the sheet). */
  roofs: Record<string, number[][]>;
  /** Each glow (`glow:<art>`): seven numbers a piece (sx, sy, w, h on its sheet, the picture of its name; x, y in its art's pixels; 1 if
   * it flickers). None: no light, and no picture. */
  glows: Record<string, number[]>;
  /** Each animated art's frames' times (ms a frame), by the art's id: how many frames it has, with no animation built to count them. */
  anims: Record<string, number[]>;
  /** Each box's solid top (boxes.ts `solidTop`), by its art's id. */
  tops: Record<string, number>;
  /** Each sidekick's sheet (its name in the app's SIDEKICK_SHEETS): its file. */
  sheets: Record<string, number>;
}

/** A baked file's name: letters, digits, dots and dashes, then its contents' hash (12 hex) and its kind. Nothing that leaves the folder. */
export const BAKED_NAME = /^[a-z0-9][a-z0-9.-]*\.[0-9a-f]{12}\.(png|json)$/;
/** A baked file's path on the site, by the same test: the service worker's (sw-template.js TOWN_FILE, filled in from this by the build). */
export const TOWN_FILE_PATH = new RegExp(`^/${TOWN_PICTURES_DIR}/${BAKED_NAME.source.slice(1)}`);

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const nums = (x: unknown): x is number[] => Array.isArray(x) && x.every((v) => typeof v === "number" && Number.isFinite(v));

/**
 * `x` as a manifest, every file named as the bake names one and every picture on its file; null for anything else (a page sent for a
 * file the server no longer has, a cut-off answer). The town then paints on the device, as before.
 */
export function manifestFrom(x: unknown): TownManifest | null {
  if (!isRec(x) || x.v !== 1 || !Array.isArray(x.files) || !isRec(x.pictures) || !isRec(x.roofs) || !isRec(x.glows) || !isRec(x.anims) || !isRec(x.tops) || !isRec(x.sheets)) return null;
  const files = x.files as Partial<TownFile>[];
  for (const f of files)
    if (!isRec(f) || typeof f.name !== "string" || !BAKED_NAME.test(f.name) || !isInt(f.w) || !isInt(f.h) || !f.w || !f.h || !isInt(f.bytes) || !Array.isArray(f.towns) || !f.towns.every((t) => (TOWNS as readonly string[]).includes(t))) return null;
  for (const p of Object.values(x.pictures)) {
    if (!Array.isArray(p) || p.length !== 5 || !p.every(isInt)) return null;
    const [f, px, py, w, h] = p as [number, number, number, number, number];
    const on = files[f];
    if (!on || !w || !h || px + w > on.w! || py + h > on.h!) return null;
  }
  for (const r of Object.values(x.roofs)) if (!Array.isArray(r) || !r.every((f) => nums(f) && f.length > 0 && f.length % 7 === 0)) return null;
  for (const g of Object.values(x.glows)) if (!nums(g) || g.length % 7) return null;
  for (const a of Object.values(x.anims)) if (!nums(a) || !a.length) return null;
  for (const t of Object.values(x.tops)) if (typeof t !== "number" || !Number.isFinite(t)) return null;
  for (const s of Object.values(x.sheets)) if (!isInt(s) || !files[s]) return null;
  return x as unknown as TownManifest;
}

/**
 * The pages of pictures a town of this kind draws from: their indexes in the manifest's `files`. (Not the sidekicks' sheets: the town
 * still cuts each sidekick's frames from the copy its own code names, render.ts `SHEET_URL`.)
 */
export function filesOf(m: TownManifest, kind: TownKind): number[] {
  const sheets = new Set(Object.values(m.sheets));
  return m.files.flatMap((f, i) => (f.towns.includes(kind) && !sheets.has(i) ? [i] : []));
}
