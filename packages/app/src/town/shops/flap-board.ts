/**
 * The split-flap board on the back wall of Birdie's Station (Nov 23; Eric: "real text, by the game in code ... arrival and departure times,
 * destinations = the town's buildings ... make up however it normally looks on a board for those numbers"). The art draws the board with
 * blank flaps (shops/birdie-lobby-art.ts); the game writes on it: a title in its yellow header strip ("DEPARTURES" or "ARRIVALS") and four
 * rows of flaps, each a made-up time, a building of the town by its name and a status ("ON TIME", "DELAYED", "BOARDING" …).
 *
 * Now and then it flips, as a real board does: every `statusMs` one row's status (or its time, when it's late) changes; every `pageMs` the
 * whole board turns to the other page. A changing flap runs through a few letters on its way (`maxSteps`), the flaps of a row one after
 * another (`staggerMs`), each step drawn once into the board's own canvas: nothing is drawn while no flap moves, and only the moving
 * flaps when they do. The board keeps its size (Eric's "nothing shifts"): every row is the same number of flaps, padded with blanks.
 *
 * Never the Hidden Boss or anything of his: his walk-up is never a destination (`boardStops`).
 * The text and its timing are pure (tested in packages/app/test/flap-board.test.ts); `FlapBoard` draws them (a canvas, in the room).
 */
import { SHOP_FEEL } from "../feel.ts";

const F = SHOP_FEEL.flaps;
/** The flaps' letters, in the order a flap runs through them. */
const ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:'&.-";
/** A row: its time (5), a blank, its destination (`DEST`), a blank, its status (`STATUS`). */
const DEST = 14;
const STATUS = 8;
export const FLAP_COLS = 5 + 1 + DEST + 1 + STATUS;
export const FLAP_ROWS = 4;

/**
 * Each building's name as the board writes it (14 flaps at most): its name in the game, shortened the way a board does where it's
 * longer ("Grex's Fireworks": FIREWORKS). Keys are the town's home ids, and the Colosseum's.
 */
export const BOARD_NAMES: Readonly<Record<string, string>> = {
  coliseum: "COLOSSEUM",
  tower: "BATTLE TOWER",
  tiger: "BABUR'S CIRCUS",
  gingerbread: "GINGER IGLOO",
  grex: "FIREWORKS",
  hollow: "HOLLOW PEAK",
  moo: "MOON MEADOW",
  clown: "FUNHOUSE",
  bigboy: "BIG BOY'S CRIB",
  sawyer: "WOODSHED",
  pig: "WRANGLER STALL",
  smudgy: "ART GALLERY",
  hopper: "GRASSLAND",
  gardener: "BOTANIC GARDEN",
  alfil: "PYRAMID",
  folio: "FOLDED HOUSE",
  timber: "LUMBER LODGE",
  dash: "DASH'S KICKS",
  zebra: "ROLLING DOUGH",
  chandy: "CHANDY'S SWAMP",
};
/** Homes never on the board: the Hidden Boss's walk-up (never anything of his), and the station itself. */
const NEVER: ReadonlySet<string> = new Set(["recluse", "birdie"]);

/** The board's stops: the Colosseum, then each home in this town (by id) that has a board name, never the walk-up or the station. */
export const boardStops = (homeIds: readonly string[]): string[] => ["COLOSSEUM", ...homeIds.filter((id) => !NEVER.has(id) && BOARD_NAMES[id]).map((id) => BOARD_NAMES[id]!)];

export type Page = "dep" | "arr";
const STATUSES: Readonly<Record<Page, readonly string[]>> = {
  dep: ["ON TIME", "ON TIME", "BOARDING", "DELAYED", "ON TIME", "CLOSING"],
  arr: ["ON TIME", "ON TIME", "ARRIVED", "DELAYED", "EARLY", "ON TIME"],
};
export const pageTitle = (p: Page): string => (p === "dep" ? "DEPARTURES" : "ARRIVALS");

/** A small steady random (mulberry32): the same seed, the same board. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hhmm = (mins: number): string => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
/** One row of flaps: exactly FLAP_COLS letters. */
export const rowText = (time: string, dest: string, status: string): string => `${time.padEnd(5)} ${dest.slice(0, DEST).padEnd(DEST)} ${status.slice(0, STATUS).padEnd(STATUS)}`;

/** One entry: its time in minutes from midnight, its stop, its status. */
export interface Entry {
  mins: number;
  dest: string;
  status: string;
}
/** A page's entries: FLAP_ROWS stops (no stop twice), their times rising in steps of 5 minutes from a morning hour. */
export function pageEntries(page: Page, stops: readonly string[], r: () => number): Entry[] {
  const pool = [...stops];
  let mins = (9 + Math.floor(r() * 3)) * 60 + 5 * Math.floor(r() * 12);
  const out: Entry[] = [];
  for (let i = 0; i < FLAP_ROWS; i++) {
    const dest = pool.length ? pool.splice(Math.floor(r() * pool.length), 1)[0]! : "";
    const list = STATUSES[page];
    out.push({ mins, dest, status: list[Math.floor(r() * list.length)]! });
    mins += 5 * (1 + Math.floor(r() * 4));
  }
  return out;
}
/** A page's rows as the board writes them. */
export const pageRows = (page: Page, entries: readonly Entry[]): string[] => entries.map((e) => rowText(hhmm(e.mins), e.dest, e.status));
/** A status change on one row (the board's "now and then"): a delay pushes its time back 5 to 15 minutes. */
export function nextStatus(page: Page, e: Entry, r: () => number): Entry {
  const list = STATUSES[page].filter((s) => s !== e.status);
  const status = list[Math.floor(r() * list.length)]!;
  return { ...e, status, mins: status === "DELAYED" ? e.mins + 5 * (1 + Math.floor(r() * 3)) : e.mins };
}

/** The letters a flap shows on its way from `a` to `b`: at most `max`, ending on `b` (none: it's there). */
export function flapSteps(a: string, b: string, max: number = F.maxSteps): string[] {
  if (a === b) return [];
  const i = Math.max(0, ALPHABET.indexOf(a));
  const j = Math.max(0, ALPHABET.indexOf(b));
  const n = (j - i + ALPHABET.length) % ALPHABET.length || ALPHABET.length;
  const k = Math.min(max, n);
  // (Evenly along the run, the last one `b`.)
  return Array.from({ length: k }, (_, s) => ALPHABET[(i + Math.round(((s + 1) * n) / k)) % ALPHABET.length]!);
}

/** The board's state: the page, its entries, and when the next change comes. Pure: `step` moves it on to `now`. */
export interface BoardState {
  page: Page;
  entries: Entry[];
  nextStatus: number;
  nextPage: number;
}
export function newBoard(stops: readonly string[], r: () => number, now: number): BoardState {
  return { page: "dep", entries: pageEntries("dep", stops, r), nextStatus: now + F.statusMs, nextPage: now + F.pageMs };
}
/** The board at `now`: a new page when its time has come, else a status changed when that has. True if it changed. */
export function stepBoard(b: BoardState, stops: readonly string[], r: () => number, now: number): boolean {
  if (now >= b.nextPage) {
    b.page = b.page === "dep" ? "arr" : "dep";
    b.entries = pageEntries(b.page, stops, r);
    b.nextPage = now + F.pageMs;
    b.nextStatus = now + F.statusMs;
    return true;
  }
  if (now >= b.nextStatus) {
    const i = Math.floor(r() * b.entries.length);
    b.entries[i] = nextStatus(b.page, b.entries[i]!, r);
    b.nextStatus = now + F.statusMs;
    return true;
  }
  return false;
}

/** The colors it's drawn in (the art's palette: the flaps' charcoal, the header's yellow). */
export interface FlapInk {
  flap: string;
  flapLit: string;
  split: string;
  letter: string;
  status: string;
  header: string;
  headerInk: string;
}

/**
 * The board drawn (in the room, ShopRoom's `flaps`): a canvas `scale` times the art's pixels over its header strip and its flaps, kept
 * as the flaps stand; `tick(now)` moves it on and redraws only the flaps that move. Its box in the board's picture is the art's.
 */
export class FlapBoard {
  readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly r: () => number;
  private readonly state: BoardState;
  /** Each flap: what it shows, where it's going, the letters on its way, when it next moves. */
  private readonly shown: string[];
  private readonly queue: string[][];
  private readonly at: number[];
  private moving = 0;
  private title = "";
  private readonly cw: number;
  private readonly ch: number;
  private readonly top: number;
  constructor(
    /** The box in the art's pixels: its width, the header strip's height and the gap under it, the flaps' height. */
    private readonly box: { readonly w: number; readonly header: number; readonly gap: number; readonly h: number },
    private readonly ink: FlapInk,
    private readonly stops: readonly string[],
    seed: number,
    now: number,
    private readonly scale: number = F.scale,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(box.w * scale);
    this.top = (box.header + box.gap) * scale;
    this.canvas.height = Math.round(this.top + box.h * scale);
    this.g = this.canvas.getContext("2d")!;
    this.cw = (box.w * scale) / FLAP_COLS;
    this.ch = (box.h * scale) / FLAP_ROWS;
    this.r = rng(seed);
    this.state = newBoard(stops, this.r, now);
    const rows = pageRows(this.state.page, this.state.entries);
    this.shown = rows.join("").split("");
    this.queue = this.shown.map(() => []);
    this.at = this.shown.map(() => 0);
    this.drawTitle(pageTitle(this.state.page));
    for (let i = 0; i < this.shown.length; i++) this.drawFlap(i, false);
  }
  /** What the board says now (its title and rows, as they'll stand once the moving flaps land): the test hook. */
  text(): { title: string; rows: string[] } {
    return { title: pageTitle(this.state.page), rows: pageRows(this.state.page, this.state.entries) };
  }
  /** Moves it on to `now`; true if anything was drawn. */
  tick(now: number): boolean {
    if (stepBoard(this.state, this.stops, this.r, now)) this.retarget(now);
    if (!this.moving) return false;
    let drawn = false;
    for (let i = 0; i < this.shown.length; i++) {
      const q = this.queue[i]!;
      if (!q.length || now < this.at[i]!) continue;
      this.shown[i] = q.shift()!;
      this.at[i] = now + F.stepMs;
      if (!q.length) this.moving--;
      this.drawFlap(i, q.length > 0);
      drawn = true;
    }
    return drawn;
  }
  private retarget(now: number) {
    const want = pageRows(this.state.page, this.state.entries).join("");
    const t = pageTitle(this.state.page);
    if (t !== this.title) this.drawTitle(t);
    for (let i = 0; i < want.length; i++) {
      const from = this.queue[i]!.length ? this.queue[i]![this.queue[i]!.length - 1]! : this.shown[i]!;
      const steps = flapSteps(from, want[i]!);
      if (!steps.length) continue;
      if (!this.queue[i]!.length) this.moving++;
      this.queue[i]!.push(...steps);
      // (Row by row, left to right: a ripple across the board.)
      this.at[i] = Math.max(this.at[i]!, now + (i % FLAP_COLS) * F.staggerMs);
    }
  }
  private drawTitle(t: string) {
    this.title = t;
    const { g, scale: k } = this;
    const h = this.box.header * k;
    // (Over the strip's middle, clear of the art's little train at its left and its clock at its right.)
    const x0 = 10 * k;
    const x1 = (this.box.w - 10) * k;
    g.clearRect(0, 0, this.canvas.width, h);
    g.fillStyle = this.ink.header;
    g.fillRect(x0, 0, x1 - x0, h);
    g.fillStyle = this.ink.headerInk;
    g.font = `800 ${Math.round(h * 0.8)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(t, (x0 + x1) / 2, h / 2 + k * 0.3);
  }
  private drawFlap(i: number, turning: boolean) {
    const { g, cw, ch } = this;
    const col = i % FLAP_COLS;
    const row = Math.floor(i / FLAP_COLS);
    const x = col * cw;
    const y = this.top + row * ch;
    const pad = Math.max(1, cw * 0.06);
    g.clearRect(x, y, cw, ch);
    // The flap: its upper half a shade lighter, a dark split across its middle.
    g.fillStyle = this.ink.flap;
    g.fillRect(x + pad, y + pad, cw - 2 * pad, ch - 2 * pad);
    g.fillStyle = this.ink.flapLit;
    g.fillRect(x + pad, y + pad, cw - 2 * pad, ch / 2 - pad);
    const c = this.shown[i]!;
    if (c !== " ") {
      g.fillStyle = col >= FLAP_COLS - STATUS ? this.ink.status : this.ink.letter;
      g.font = `800 ${Math.min(ch * 0.7, cw * 1.45)}px "Courier New", ui-monospace, monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(c, x + cw / 2, y + ch / 2 + ch * 0.04);
    }
    // (Mid-turn: the old flap falling over its lower half, dark.)
    if (turning) {
      g.fillStyle = this.ink.split;
      g.globalAlpha = 0.6;
      g.fillRect(x + pad, y + ch / 2, cw - 2 * pad, ch / 2 - pad);
      g.globalAlpha = 1;
    }
    g.fillStyle = this.ink.split;
    g.fillRect(x + pad, y + ch / 2 - Math.max(1, ch * 0.03), cw - 2 * pad, Math.max(1, ch * 0.06));
  }
}
