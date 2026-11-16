import { describe, expect, it } from "vitest";
import { frameKeys, type Character } from "../src/characters/sprite.ts";
import { N } from "../src/town/camera.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { COLISEUM_ART, HOUSES, type HouseArt } from "../src/town/houses/index.ts";
import { PARK_LAMP, PARK_LAMP_HEAD, PARK_LAMP_LIGHTS, PARK_LAMP_POOLS } from "../src/town/houses/park.ts";
import { mixLights, skyOverride, skyWeights } from "../src/town/sky.ts";
import { ALL_HOMES, APRON, HOMES, LAMPS, PROPS, START, STATUES, TABLES, findPath, stepsFrom, stoolAt, tableAt, walkable } from "../src/town/world.ts";

/** The lights at dusk and night (Oct 27): the park's lamps, and the homes and the Colosseum glowing from inside. */

// (The street town's lamps for everyone since Nov 13: on its park's walks and its sidewalks, as its plan has them; town-street.test.ts keeps
// them from a home's frontage.)
describe("town square lights: the lamps", () => {
  it("each stands on a square of its own, solid (walked round), a lamp in the town's things", () => {
    expect(LAMPS.length).toBeGreaterThanOrEqual(8);
    const seen = new Set<number>();
    for (const l of LAMPS) {
      expect(seen.has(l.r * N + l.c), `two lamps on ${l.c},${l.r}`).toBe(false);
      seen.add(l.r * N + l.c);
      expect(walkable(l.c, l.r), `the lamp at ${l.c},${l.r} is walked round`).toBe(false);
      expect(PROPS.filter((p) => p.kind === "lamp" && p.c === l.c && p.r === l.r)).toHaveLength(1);
    }
    expect(PROPS.filter((p) => p.kind === "lamp")).toHaveLength(LAMPS.length);
  });

  it("no lamp stands on a path: not a stool, a table, the fountain, the apron, a statue's square or a home's door square", () => {
    const fountain = PROPS.find((p) => p.kind === "fountain")!;
    for (const l of LAMPS) {
      const at = `${l.c},${l.r}`;
      expect(stoolAt(l.c, l.r), `on a stool at ${at}`).toBeNull();
      expect(tableAt(l.c, l.r), `on a table at ${at}`).toBeNull();
      expect(l.c >= fountain.c && l.c <= fountain.c + 1 && l.r >= fountain.r && l.r <= fountain.r + 1, `on the fountain at ${at}`).toBe(false);
      expect(APRON.some((s) => s.c === l.c && s.r === l.r), `on the apron at ${at}`).toBe(false);
      expect(STATUES.some((s) => s.c === l.c && s.r === l.r), `on a statue's square at ${at}`).toBe(false);
      for (const h of HOMES) expect(h.door.c === l.c && h.door.r === l.r, `on ${h.id}'s door square at ${at}`).toBe(false);
    }
  });

  it("the lamps wall nothing off: every square you can stand on is still reached from your start, every stool too", () => {
    const d = stepsFrom(START);
    let open = 0;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        if (!walkable(c, r)) continue;
        open++;
        expect(d[r * N + c], `${c},${r} cut off`).toBeGreaterThanOrEqual(0);
      }
    // (The street town's lots, gardens and the Colosseum take a little over half its squares.)
    expect(open).toBeGreaterThan(N * N * 0.4);
    for (const t of TABLES) for (const s of t.stools) expect(findPath(START, (c, r) => c === s.c && r === s.r, walkable), `table ${t.i}'s stool`).not.toBeNull();
  });

  it("is a classic park lamp about a pawn and a half tall, its glass lit at dusk and night with a halo, and a pool of light under it", () => {
    const top = frameKeys(PARK_LAMP, PARK_LAMP.anims.idle!.frames[0]!).findIndex((row) => row.some((k) => k !== null && k !== "-" && k !== "+"));
    const tall = (PARK_LAMP.foot[1] - top) / TOWN_FEEL.housePxPerSquare;
    // Your pawn stands youSquares tall, the piece itself from its head (9 of 45) to its foot (39.5 of 45).
    const pawn = (TOWN_FEEL.youSquares * (39.5 - 9)) / 45;
    expect(tall / pawn).toBeGreaterThan(1.3);
    expect(tall / pawn).toBeLessThan(1.8);
    expect(lit(PARK_LAMP, PARK_LAMP_LIGHTS)).toBeGreaterThan(20);
    expect(PARK_LAMP_LIGHTS.some((l) => (l.halo ?? 0) > 0)).toBe(true);
    expect(PARK_LAMP_POOLS).toHaveLength(1);
    // The tests find its light at the middle of its glass.
    const head = PARK_LAMP_LIGHTS[0]!;
    expect(PARK_LAMP_HEAD[0]).toBeGreaterThan(head.x);
    expect(PARK_LAMP_HEAD[0]).toBeLessThan(head.x + head.w);
    expect(PARK_LAMP_HEAD[1]).toBeGreaterThan(head.y);
    expect(PARK_LAMP_HEAD[1]).toBeLessThan(head.y + head.h);
  });
});

/** How many of a picture's pixels its lights light up (their keys in their boxes), and checks each lights some. */
function lit(ch: Character, lights: HouseArt["lights"]): number {
  const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
  let n = 0;
  for (const l of lights) {
    let mine = 0;
    for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) if (keys[y]?.[x] && (l.keys === undefined || l.keys.includes(keys[y]![x]!))) mine++;
    expect(mine, `${ch.id}: a light at ${l.x},${l.y} lights nothing`).toBeGreaterThanOrEqual(4);
    n += mine;
  }
  return n;
}

describe("town square lights: the homes and the Colosseum glow from inside", () => {
  const all: [string, HouseArt][] = [...Object.entries(HOUSES), ["coliseum", COLISEUM_ART]];

  it("every home and the Colosseum has its lights, each inside its picture, lighting some of its pixels, warm (Ginger's cold) and of a sensible strength", () => {
    // Every home's art, admins-first ones included: HOUSES holds them all, HOMES only the ones players see.
    expect(all).toHaveLength(ALL_HOMES.length + 1);
    for (const [id, art] of all) {
      const { ch } = art;
      expect(art.lights.length, `${id} has lights`).toBeGreaterThan(0);
      for (const l of art.lights) {
        expect(l.x >= 0 && l.y >= 0 && l.x + l.w <= ch.w && l.y + l.h <= ch.h, `${id}: a light at ${l.x},${l.y} (${l.w} x ${l.h}) lies inside its ${ch.w} x ${ch.h} picture`).toBe(true);
        expect(l.color).toMatch(/^#[0-9a-f]{6}$/);
        expect(l.strength).toBeGreaterThan(0);
        expect(l.strength).toBeLessThanOrEqual(1);
        if (l.halo !== undefined) expect(l.halo).toBeGreaterThan(0);
      }
      expect(lit(ch, art.lights), id).toBeGreaterThan(10);
      // A pool of light lies on the ground in front, under the picture's foot line, within its width.
      for (const p of art.pools) {
        expect(p.x > 0 && p.x < ch.w, `${id}: its pool`).toBe(true);
        expect(Math.abs(p.y - ch.foot[1]), `${id}: its pool at its foot`).toBeLessThanOrEqual(4);
      }
    }
  });

  it("no light falls on a home's sign (its name stays as easy to read), and Hollow Peak's green window is left as it is", () => {
    for (const [id, art] of all) {
      const keys = frameKeys(art.ch, art.ch.anims.idle!.frames[0]!);
      const s = art.sign;
      for (const l of art.lights)
        for (let y = l.y; y < l.y + l.h; y++)
          for (let x = l.x; x < l.x + l.w; x++) {
            const on = keys[y]?.[x] && (l.keys === undefined || l.keys.includes(keys[y]![x]!));
            if (on) expect(x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h, `${id}: a lit pixel on its sign at ${x},${y}`).toBe(false);
          }
    }
    // Hollow's own window glows green in its idle; its lights don't touch those keys.
    for (const l of HOUSES.hollow.lights) expect(l.keys ?? "", "Hollow's lights").not.toMatch(/[gG]/);
  });
});

describe("town square lights: when they shine", () => {
  it("off at dawn and day, on at dusk and night, night stronger; ?sky= shows them; they follow the sky's blend", () => {
    const k = (l: string) => mixLights(skyOverride(l)!);
    expect(k("dawn")).toBe(0);
    expect(k("day")).toBe(0);
    expect(k("dusk")).toBeGreaterThan(0.3);
    expect(k("night")).toBeGreaterThan(k("dusk"));
    // Over the half hour from dusk into night (19:15 to 19:45), they brighten step by step, never jumping.
    const { night } = TOWN_FEEL.skyHours;
    let last = k("dusk");
    for (let m = night - 15; m <= night + 15; m++) {
      const v = mixLights(skyWeights(m));
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      expect(v - last).toBeLessThan(0.05);
      last = v;
    }
    expect(last).toBeCloseTo(k("night"), 5);
    // At noon nothing; at midnight full.
    expect(mixLights(skyWeights(12 * 60))).toBe(0);
    expect(mixLights(skyWeights(0))).toBeCloseTo(k("night"), 5);
  });
});
