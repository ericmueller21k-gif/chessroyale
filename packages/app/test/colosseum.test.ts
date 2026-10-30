import { describe, expect, it } from "vitest";
import { START_FEN, applyMove } from "@chessroyale/chess";
import { BLACK_VIEW, BOARD_SPHERE, PILLARS, PILLAR_ANGLES, SEAT_VIEWS, STATUE, VIEWS, WHITE_VIEW, fovFor, lookAt, multiply, onAisle, otherSeat, perspective, project, seats, squareXZ, turnLimits, viewFor } from "../src/colosseum/arena.ts";
import { FLOOR, FloorMatch, PLAYERS, clockText, evalText, piecesAfter, piecesOf, resultText, viewersText, type FloorDeps } from "../src/colosseum/match.ts";
import { BOTS } from "../src/town/world.ts";

/** The Colosseum's first look (Oct 30): its layout, its views and the game on its floor (docs/areas/colosseum.md). */

/** Where world points land through a view, on a w × h screen, turned by yaw and pitch. */
function screenOf(v: (typeof VIEWS)[number], w: number, h: number, yaw = 0, pitch = 0) {
  const p = new Float32Array(16);
  const m = new Float32Array(16);
  const vp = new Float32Array(16);
  perspective(p, fovFor(v, w / h), w / h, 0.2, 120);
  lookAt(m, v.eye, v.at, yaw, pitch, new Float32Array(3));
  multiply(vp, p, m);
  return (x: number, y: number, z: number) => project(vp, x, y, z, w, h);
}
const SCREENS = [
  ["phone's arena", 390, 262],
  ["computer", 1440, 848],
] as const;

describe("the arena", () => {
  it("seats some two thousand people, every row full but its aisles", () => {
    const all = seats();
    expect(all.length).toBeGreaterThan(1800);
    for (const s of all) expect(onAisle(Math.atan2(s.x, s.z), Math.hypot(s.x, s.z))).toBe(false);
    // Everyone faces the middle.
    for (const s of all.slice(0, 50)) expect(Math.cos(s.face - Math.atan2(-s.x, -s.z))).toBeCloseTo(1, 6);
  });

  it("has ten views: eight seats at eight angles (lower and higher), then White's and Black's player views", () => {
    expect(VIEWS).toHaveLength(10);
    expect(SEAT_VIEWS).toBe(8);
    const angles = VIEWS.slice(0, 8).map((v) => Math.round((Math.atan2(v.eye[0], v.eye[2]) * 180) / Math.PI + 360) % 360);
    expect(new Set(angles).size).toBe(8);
    const heights = VIEWS.slice(0, 8).map((v) => v.eye[1]);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(3);
    // The player views: about 20 feet (6 m) above the board, behind their own end.
    expect(VIEWS[WHITE_VIEW]!.eye[1]).toBe(6);
    expect(VIEWS[WHITE_VIEW]!.eye[2]).toBeGreaterThan(4);
    expect(VIEWS[BLACK_VIEW]!.eye[2]).toBeLessThan(-4);
    expect(viewFor("white", 3)).toBe(WHITE_VIEW);
    expect(viewFor("black", 3)).toBe(BLACK_VIEW);
    expect(viewFor(null, 3)).toBe(3);
  });

  it("no pillar or statue stands between a seat and the board (each seat's angle half-way between two)", () => {
    for (const v of VIEWS.slice(0, 8)) {
      const a = Math.atan2(v.eye[0], v.eye[2]);
      for (const p of [...PILLAR_ANGLES, ...STATUE.angles]) {
        const d = Math.abs(Math.atan2(Math.sin(a - p), Math.cos(a - p)));
        expect(d).toBeGreaterThan(Math.PI / 8 - 1e-6);
      }
    }
    expect(PILLAR_ANGLES.length + STATUE.angles.length).toBe(PILLARS.places);
  });

  it.each(SCREENS)("every view shows the whole board, turned as far as it may go each way (%s)", (_, w, h) => {
    const lim = { yaw: 0, pitch: 0 };
    for (const v of VIEWS) {
      turnLimits(v, w / h, lim);
      expect(lim.yaw).toBeGreaterThan(0);
      for (const [yaw, pitch] of [[0, 0], [lim.yaw, 0], [-lim.yaw, 0], [0, lim.pitch], [0, -lim.pitch]] as const) {
        const at = screenOf(v, w, h, yaw, pitch);
        // The board's middle stays on screen, and so does at least one of its corners.
        const mid = at(0, 0, 0)!;
        expect(mid[0]).toBeGreaterThan(0);
        expect(mid[0]).toBeLessThan(w);
        expect(mid[1]).toBeGreaterThan(0);
        expect(mid[1]).toBeLessThan(h);
      }
      // Not turned: all four corners.
      const at = screenOf(v, w, h);
      for (const [x, z] of [[-4, -4], [4, -4], [4, 4], [-4, 4]]) {
        const p = at(x!, 0, z!)!;
        expect(p[0]).toBeGreaterThan(-1);
        expect(p[0]).toBeLessThan(w + 1);
        expect(p[1]).toBeGreaterThan(-1);
        expect(p[1]).toBeLessThan(h + 1);
      }
    }
    expect(BOARD_SPHERE).toBeGreaterThan(4);
  });

  it("White's view has White's first rank nearest (lower on screen), Black's the reverse", () => {
    const w = screenOf(VIEWS[WHITE_VIEW]!, 800, 600);
    const b = screenOf(VIEWS[BLACK_VIEW]!, 800, 600);
    const [x1, z1] = squareXZ("e1");
    const [x8, z8] = squareXZ("e8");
    expect(w(x1, 0, z1)![1]).toBeGreaterThan(w(x8, 0, z8)![1]);
    expect(b(x8, 0, z8)![1]).toBeGreaterThan(b(x1, 0, z1)![1]);
    // a-file on White's left.
    expect(w(...([squareXZ("a1")[0], 0, squareXZ("a1")[1]] as const))![0]).toBeLessThan(w(squareXZ("h1")[0], 0, squareXZ("h1")[1])![0]);
  });

  it("Change seat always picks another of the eight seats, each of them in time", () => {
    for (let from = 0; from < 8; from++) {
      const seen = new Set<number>();
      for (let i = 0; i < 70; i++) {
        const to = otherSeat(from, i / 70);
        expect(to).not.toBe(from);
        expect(to).toBeGreaterThanOrEqual(0);
        expect(to).toBeLessThan(8);
        seen.add(to);
      }
      expect(seen.size).toBe(7);
    }
    // From a player view: any seat.
    expect(otherSeat(WHITE_VIEW, 0.99)).toBeLessThan(8);
  });
});

describe("the game on the floor", () => {
  it("reads a position's pieces, and a move's slide, capture, castling and en passant", () => {
    expect(piecesOf(START_FEN)).toHaveLength(32);
    const a = piecesAfter(START_FEN, "e2e4", applyMove(START_FEN, "e2e4"));
    expect(a.took).toBeNull();
    expect(a.pieces.find((p) => p.sq === "e4")).toMatchObject({ key: "wp", from: "e2" });
    expect(a.pieces.filter((p) => p.from)).toHaveLength(1);
    const castle = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const c = piecesAfter(castle, "e1g1", applyMove(castle, "e1g1"));
    expect(c.pieces.find((p) => p.sq === "f1")).toMatchObject({ key: "wr", from: "h1" });
    expect(c.pieces.find((p) => p.sq === "g1")).toMatchObject({ key: "wk", from: "e1" });
    const ep = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2";
    const e = piecesAfter(ep, "e5d6", applyMove(ep, "e5d6"));
    expect(e.took).toBe("p");
    expect(e.pieces.find((p) => p.taken)).toMatchObject({ key: "bp", sq: "d5" });
    const qx = "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1";
    const q = piecesAfter(qx, "e4d5", applyMove(qx, "e4d5"));
    expect(q.took).toBe("q");
    expect(q.pieces.find((p) => p.taken)).toMatchObject({ key: "bq", sq: "d5" });
  });

  it("says clocks, evals, viewers and results the overlay's way", () => {
    expect(clockText(180_000)).toBe("3:00");
    expect(clockText(61_001)).toBe("1:02");
    expect(clockText(9_400)).toBe("0:09.4");
    expect(evalText(0.5, null)).toBe("0.0");
    expect(evalText(0.53, null)).toMatch(/^\+0\.\d$/);
    expect(evalText(0.2, null)).toMatch(/^−\d\.\d$/);
    expect(evalText(0.9, 3)).toBe("M3");
    expect(evalText(0.1, -2)).toBe("−M2");
    expect(viewersText(2103)).toBe("2.1K");
    expect(viewersText(950)).toBe("950");
    expect(resultText({ result: "1-0", reason: "checkmate" })).toBe("White wins by checkmate");
    expect(resultText({ result: "0-1", reason: "time" })).toBe("Black wins on time");
    expect(resultText({ result: "1/2-1/2", reason: "repetition" })).toBe("Draw by repetition");
  });

  it("plays only town bots Stockfish can play at their rating", () => {
    expect(PLAYERS.length).toBeGreaterThan(6);
    for (const i of PLAYERS) expect(BOTS[i]!.rating).toBeGreaterThanOrEqual(1300);
  });

  it("plays a game to its end (fool's mate), the queen's capture marked, then starts the next with two new clocks", async () => {
    let t = 0;
    const line = ["f2f3", "e7e5", "g2g4", "d8h4"];
    const seen: { game: number; status: string; plies: number }[] = [];
    let jumps = 0;
    const deps: FloorDeps = {
      move: async (fen) => line[fen.includes(" w ") ? (fen.split(" ")[5] === "1" ? 0 : 2) : fen.split(" ")[5] === "1" ? 1 : 3]!,
      evaluate: async () => ({ white: 0.4, mate: null }),
      now: () => t,
      random: () => 0.3,
      wait: async (ms) => {
        t += ms;
        return seen.filter((s) => s.status === "waiting").length < 3;
      },
      think: () => 1000,
      nextMs: () => 2000,
    };
    const m = new FloorMatch(deps, (s) => {
      seen.push({ game: s.game, status: s.status, plies: s.moves.length });
      if (s.queenTaken) jumps++;
    });
    await m.run();
    const over = seen.find((s) => s.status === "over")!;
    expect(over).toMatchObject({ game: 1, plies: 4 });
    expect(seen.some((s) => s.game === 2 && s.status === "waiting")).toBe(true);
    expect(jumps).toBe(0);
    // Each side's clock: 3 minutes, less a second a move, plus the 2-second increment.
    expect(FLOOR.baseMs).toBe(180_000);
    expect(FLOOR.incMs).toBe(2_000);
  });

  it("flags the side to move (the e2e's way to end a game at once) and calls a flag a loss on time", () => {
    const m = new FloorMatch({ move: () => new Promise(() => {}), evaluate: async () => null, now: () => 0, random: () => 0.5, wait: async () => true }, () => {});
    m.state.status = "playing";
    m.flag();
    expect(m.state).toMatchObject({ status: "over", result: "0-1", reason: "time" });
  });
});

describe("the bosses in the crowd (Eric, Oct 30)", () => {
  it("each boss with a sidekick sits once, its sidekick beside it, in rows 1 to 3, at the same seats whatever the view, never covering the board", async () => {
    const { buildCrowd } = await import("../src/colosseum/arena-gl.ts");
    const { bossSeats, coversBoard, rowY, seatR } = await import("../src/colosseum/arena.ts");
    const homes = BOTS.flatMap((b) => ("sprite" in b.look && b.boss ? [b.boss] : []));
    expect(homes.length).toBeGreaterThan(10);
    const r = { u0: 0, v0: 0, u1: 1, v1: 1 };
    // A crowd's cells as crowdArt makes them: pawns, the sidekicks, the bosses (each cell's u0 marks which it is).
    const cells = [
      ...[0, 1, 2].map((i) => ({ rect: { ...r, u0: i / 100 }, foot: 1, meters: 0.6, kind: "pawn" as const })),
      ...homes.map((h, i) => ({ rect: { ...r, u0: 0.2 + i / 100 }, foot: 1, meters: 0.64, kind: "sidekick" as const, home: h })),
      ...homes.map((h, i) => ({ rect: { ...r, u0: 0.5 + i / 100 }, foot: 1, meters: 1.4, kind: "boss" as const, home: h })),
    ];
    const a = buildCrowd({ cells });
    expect(buildCrowd({ cells }), "the same seats on every build").toEqual(a);
    const at = (u0: number) => {
      const out: { x: number; y: number; z: number }[] = [];
      for (let o = 0; o < a.length; o += 20) if (Math.abs(a[o + 4]! - u0) < 1e-6) out.push({ x: a[o]!, y: a[o + 1]!, z: a[o + 2]! });
      return out;
    };
    homes.forEach((_, i) => {
      const kid = at(0.2 + i / 100);
      const boss = at(0.5 + i / 100);
      expect(kid.length, "each sidekick once").toBe(1);
      expect(boss.length, "each boss once").toBe(1);
      expect(Math.hypot(kid[0]!.x - boss[0]!.x, kid[0]!.z - boss[0]!.z), "side by side").toBeLessThan(1.3);
      expect(kid[0]!.y).toBe(boss[0]!.y);
      expect(boss[0]!.y, "rows 1 to 3").toBeLessThanOrEqual(rowY(2) + 1e-6);
    });
    // The seats come from the layout alone (no view goes in), and none covers the board from any of the ten views.
    const seatsNow = bossSeats(homes.length);
    expect(seatsNow).toEqual(bossSeats(homes.length));
    for (const v of VIEWS) for (const p of seatsNow) expect(coversBoard(v, p.boss, 0.8, 1.75)).toBe(false);
    // (And the check does catch one: a boss two rows straight in front of the first seat would cover it.)
    expect(coversBoard(VIEWS[0]!, { x: 0, y: rowY(1), z: seatR(1) }, 0.8, 1.75)).toBe(true);
  });
});

describe("the 3D pieces (the gear's 3D pieces; pieces3d.ts)", () => {
  it("six meshes, built once: whole triangles, unit normals, standing on the board, sized to a square, the king tallest", async () => {
    const { KINDS, MAT, PV, pieceMeshes, triangulate, KNIGHT_OUTLINE } = await import("../src/colosseum/pieces3d.ts");
    const all = pieceMeshes();
    let verts = 0;
    for (const k of KINDS) {
      const m = all[k];
      const n = m.verts.length / PV;
      verts += n;
      expect(m.index.length % 3, k).toBe(0);
      expect(Math.max(...m.index), k).toBeLessThan(n);
      let minY = Infinity;
      let maxR = 0;
      for (let i = 0; i < m.verts.length; i += PV) {
        const [x, y, z, nx, ny, nz, mat] = m.verts.subarray(i, i + PV);
        expect(Math.hypot(nx!, ny!, nz!)).toBeCloseTo(1, 4);
        if (mat === MAT.shadow) continue;
        minY = Math.min(minY, y!);
        maxR = Math.max(maxR, Math.hypot(x!, z!));
      }
      expect(minY, `${k} stands on the board`).toBeCloseTo(0, 5);
      expect(maxR, `${k} fits its square`).toBeLessThan(0.5);
    }
    // (All six in one 16-bit index buffer.)
    expect(verts).toBeLessThan(65536);
    const h = Object.fromEntries(KINDS.map((k) => [k, all[k].height]));
    expect(h.k).toBeGreaterThan(h.q!);
    expect(h.q).toBeGreaterThan(h.b!);
    expect(h.p).toBeLessThan(Math.min(h.n!, h.b!, h.r!));
    // (The tallest stays within what the views keep on screen: the board and a piece about 1.6 m tall over it.)
    expect(h.k).toBeLessThan(1.7);
    // The knight's head: its outline cut into whole triangles.
    expect(triangulate(KNIGHT_OUTLINE).length).toBe((KNIGHT_OUTLINE.length - 2) * 3);
  });
});
