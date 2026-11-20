/**
 * The Battle Tower's floor room as a scene (PR 11b, Nov 19; the flow's timing: tower-floor.ts): its side walls with the floor's number
 * (one surface each, as the lobby's), the table and its two stools on the battle circle (the town's park table in HunChess's colors:
 * the art's palettes), the floor's bosses coming out of the elevator one after another to their marks (each his town figure, as the
 * challenge draws him), the pieces coming up on the board, and the elevator's doors open while they come out and after a win. Loaded
 * with the room, given to it as its `fx` (Town.tsx). One canvas, the room's; nothing made a frame.
 */
import type { Character } from "../../characters/sprite.ts";
import { spriteCanvas } from "../../characters/sprite-kit.ts";
import { proj, newPt } from "../camera.ts";
import { TOWN_FEEL } from "../feel.ts";
import { PARK_TABLE } from "../houses/park.ts";
import { BOSS_ART } from "../render.ts";
import type { TownBossId } from "../world.ts";
import { paintTable, third } from "./intro.ts";
import type { FxDraw, RoomFx } from "./ShopRoom.tsx";
import { sideWalls } from "./side-walls.ts";
import { SHOP_TOWER_FLOOR_N, SHOP_TOWER_FLOOR_STOOL_PALETTE, SHOP_TOWER_FLOOR_TABLE_PALETTE, SHOP_TOWER_FLOOR_WALL_H, towerFloorWallGrid } from "./tower-floor-art.ts";
import { BOSS_ZEBRA } from "./zebra-don.ts";
import { FLOOR_TABLE, bossAt, mateAt, piecesAt, type BossNow, type FloorMode, type FloorTimes } from "./tower-floor.ts";
import { PAWN_FOOT, pawnImage } from "../render.ts";
import { PARTY_COLORS } from "../../board/logic.ts";
import type { RunKind } from "../../tower.ts";
import type { PartyFloorEntry } from "../../tower-party.ts";

const SQ = 37;

/** What the town tells the scene as the floor goes (the room's own clock: `t0`, its first frame; null until then). */
export interface FloorScript {
  floor: number;
  mode: FloorMode;
  /** The floor's bosses in turn order (fight), or none. */
  bosses: readonly string[];
  times: FloorTimes | null;
  t0: number | null;
  /** Where the table's board is on screen now (the room's box), for the zoom into it; null until drawn. */
  board: { x: number; y: number } | null;
  /** Which of your runs this floor is (your solo run, or your party copy played alone; Nov 20). */
  kind?: RunKind;
  /** A party's floor (Nov 20): its match room to join after the walk-in. */
  party?: PartyFloorEntry;
  /** The others in your party, in seat order (their pawns in their seat colors walk in after you, to their marks beside yours). */
  mates?: readonly { seat: number }[];
}

/** A boss's town figure (his own; Don Dough's, met in his back room, his intro's), or null: a boss this app doesn't draw (drawn safely: not at all). */
const figureOf = (id: string): Character | null => (id === "zebra" ? BOSS_ZEBRA : ((BOSS_ART as Partial<Record<string, Character>>)[id as TownBossId] ?? null));

interface Fig {
  ch: Character;
  frames: HTMLCanvasElement[];
  ends: number[];
  loop: number;
  squares: number;
}
const figs = new Map<string, Fig | null>();
function figOf(id: string): Fig | null {
  if (figs.has(id)) return figs.get(id)!;
  const ch = figureOf(id);
  let f: Fig | null = null;
  if (ch?.anims.idle) {
    let t = 0;
    const ends = ch.anims.idle.frames.map((fr) => (t += Math.max(16, fr.ms)));
    f = { ch, frames: ch.anims.idle.frames.map((_, i) => spriteCanvas(ch, "idle", i)), ends, loop: t, squares: TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale[id] ?? 1) };
  }
  figs.set(id, f);
  return f;
}

/** The park table in the art's slate and gold: its leg and a stool, cut from its picture as the challenge's are. */
let table: { ch: Character; leg: HTMLCanvasElement; stool: HTMLCanvasElement } | null = null;
function tableArt() {
  if (table) return table;
  const ch: Character = { ...PARK_TABLE, id: "tower-floor-table", palette: { ...PARK_TABLE.palette, ...SHOP_TOWER_FLOOR_STOOL_PALETTE } };
  const img = spriteCanvas(ch, "idle", 0);
  return (table = { ch, leg: third(img, 1), stool: third(img, 0) });
}

const pt = newPt();
const at = (d: FxDraw, c: number, r: number) => proj(d.v, c - d.camX, d.camY - r, 0, pt);
const now1: BossNow = { c: 0, r: 0, a: 0, walking: false };

/** The floor room's scene for `floor` (its walls' number), driven by `s`. */
export function towerFloorFx(s: FloorScript): RoomFx {
  const walls = { z: 0.01, draw: sideWalls((west, run) => towerFloorWallGrid(west, run, s.floor), SHOP_TOWER_FLOOR_N, SHOP_TOWER_FLOOR_WALL_H) };
  const t = (now: number) => (s.t0 === null ? 0 : now - s.t0);
  const T = tableArt();
  const stool = (r: number) => ({
    z: r,
    draw: (d: FxDraw) => {
      if (!at(d, FLOOR_TABLE.c, r)) return;
      const k = pt.k / SQ;
      d.g.imageSmoothingEnabled = false;
      d.g.drawImage(T.stool, pt.x - (T.stool.width / 2) * k, pt.y - T.ch.foot[1] * k, T.stool.width * k, T.stool.height * k);
    },
  });
  const north = stool(FLOOR_TABLE.r - 1);
  const south = stool(FLOOR_TABLE.r + 1);
  const desk = {
    z: FLOOR_TABLE.r,
    draw: (d: FxDraw, now: number) => {
      if (!at(d, FLOOR_TABLE.c, FLOOR_TABLE.r)) return;
      const k = pt.k / SQ;
      d.g.imageSmoothingEnabled = false;
      d.g.drawImage(T.leg, pt.x - (T.ch.foot[0] - T.leg.width) * k, pt.y - T.ch.foot[1] * k, T.leg.width * k, T.leg.height * k);
      s.board = { x: pt.x, y: pt.y - (T.ch.foot[1] - 8) * k };
      // (The pieces come up as everyone's on their marks; after a match the board's set again.)
      const pieces = s.mode === "fight" && s.times ? piecesAt(t(now), s.times) : 1;
      paintTable(d.g, d.v, FLOOR_TABLE.c - d.camX, d.camY - FLOOR_TABLE.r, SHOP_TOWER_FLOOR_TABLE_PALETTE, "facing", 1, pieces);
    },
  };
  /** Boss `i`'s figure this frame (none: not out yet, or a boss this app doesn't draw). */
  const bossFig = (i: number) => ({
    z: 0,
    draw: (d: FxDraw, now: number) => {
      const f = figOf(s.bosses[i]!);
      if (!f || !s.times) return;
      const b = bossAt(i, s.bosses.length, t(now), s.times, now1);
      if (b.a <= 0 || !at(d, b.c, b.r)) return;
      const u = now % f.loop;
      let j = 0;
      while (j < f.ends.length - 1 && u >= f.ends[j]!) j++;
      const img = f.frames[j]!;
      const h = f.squares * pt.k;
      const w = (h * f.ch.w) / f.ch.h;
      // (A step's little lift as he walks, the town walkers' bob.)
      const hop = b.walking ? Math.abs(Math.sin((now / TOWN_FEEL.youStepMs) * Math.PI)) * 0.06 * pt.k : 0;
      const g = d.g;
      g.save();
      g.globalAlpha = b.a;
      g.fillStyle = "rgba(14,16,20,0.28)";
      g.beginPath();
      g.ellipse(pt.x, pt.y, w * 0.28, pt.k * 0.12, 0, 0, Math.PI * 2);
      g.fill();
      g.imageSmoothingEnabled = false;
      g.drawImage(img, pt.x - (f.ch.foot[0] / f.ch.w) * w, pt.y - (f.ch.foot[1] / f.ch.h) * h - hop, w, h);
      g.restore();
    },
  });
  const bosses = [0, 1, 2].map(bossFig);
  /** Party member `i`'s pawn this frame (Nov 20): the plain pawn in their seat's color, walking in after you to their mark. */
  const mateFig = (i: number) => ({
    z: 0,
    draw: (d: FxDraw, now: number) => {
      const m = s.mates?.[i];
      if (!m) return;
      const b = mateAt(i, s.mode === "fight" ? (s.times ?? null) : null, t(now), now1);
      if (b.a <= 0 || !at(d, b.c, b.r)) return;
      const img = pawnImage("light", PARTY_COLORS[m.seat] ?? PARTY_COLORS[0]);
      const h = TOWN_FEEL.youSquares * pt.k;
      const hop = b.walking ? Math.abs(Math.sin((now / TOWN_FEEL.youStepMs) * Math.PI)) * 0.06 * pt.k : 0;
      const g = d.g;
      g.save();
      g.fillStyle = "rgba(14,16,20,0.28)";
      g.beginPath();
      g.ellipse(pt.x, pt.y, h * 0.22, pt.k * 0.1, 0, 0, Math.PI * 2);
      g.fill();
      g.imageSmoothingEnabled = true;
      g.drawImage(img, pt.x - h / 2, pt.y - h * PAWN_FOOT - hop, h, h);
      g.restore();
    },
  });
  const mates = [0, 1, 2].map(mateFig);
  const list: { z: number; draw: (d: FxDraw, now: number) => void }[] = [];
  return {
    figures: (now) => {
      list.length = 0;
      list.push(walls, north, desk, south);
      if (s.mode === "fight" && s.times)
        for (let i = 0; i < s.bosses.length && i < 3; i++) {
          const b = bossAt(i, s.bosses.length, t(now), s.times, now1);
          bosses[i]!.z = b.r;
          list.push(bosses[i]!);
        }
      for (let i = 0; i < (s.mates?.length ?? 0) && i < 3; i++) {
        mates[i]!.z = mateAt(i, s.mode === "fight" ? (s.times ?? null) : null, t(now), now1).r;
        list.push(mates[i]!);
      }
      return list;
    },
    // (The elevator's doors: open while the bosses come out, and after a win (the way up); shut otherwise.)
    swap: (name) => {
      if (name !== "elevator") return null;
      if (s.mode === "won") return "elevator-open";
      if (s.mode === "fight" && s.times && s.t0 !== null) {
        const tt = performance.now() - s.t0;
        if (tt >= s.times.doorsOpen && tt < s.times.doorsShut) return "elevator-open";
      }
      return null;
    },
  };
}
