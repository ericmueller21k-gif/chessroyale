import { afterEach, describe, expect, it, vi } from "vitest";

// The street town (everyone's since Nov 13), as an admin's (every home): its controls and minimap.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { Press } = await import("../src/town/press.ts");
const { FingerRun, runDir } = await import("../src/town/run.ts");
const { LookAround, Turn, freshView, lockIn, quarterOf, screenStep } = await import("../src/town/turn.ts");
const { STRIPS, baseHeading } = await import("../src/town/strips.ts");
const { hold, isHeld, keyWalk, releaseAll } = await import("../src/town/arrows.ts");
const { Walker } = await import("../src/town/world.ts");
const { N } = await import("../src/town/camera.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");
const { STREET_COLISEUM, STREET_GROUND, STREET_GROUND_KEY, STREET_HOMES, STREET_LOTS, STREET_PARK } = await import("../src/town/street.ts");
const M = await import("../src/town/minimap.ts");

/**
 * The street town's controls and minimap (Nov 5; brief-street-controls-map.md, docs/decisions/2026-11-05-street-controls-map.md): three
 * gestures told apart by the drag threshold and a hold time; a run steered by the finger, which never turns the camera; a look round let
 * go snaps to the nearest quarter (split at 45°) and a tap, a run or an arrow locks it in as the base heading, which the arrows follow; a building's in and
 * out resets it to north; the minimap built from the plan.
 */
const F = TOWN_FEEL;
afterEach(() => releaseAll());

describe("three gestures (Eric, Nov 5: \"if you hold it in the direction … right away … it starts running\"): told apart by time and distance", () => {
  const DRAG = F.dragPx;
  const HOLD = F.streetHoldMs;
  it("the hold time is about 180 ms", () => expect(HOLD).toBe(180));
  it("a quick tap (up before the hold time, never past the threshold) is a walk", () => {
    const p = new Press(DRAG, HOLD);
    p.down(100, 200, "sq:3,4", 1000);
    expect(p.hold(1000 + HOLD - 1)).toBe(false);
    expect(p.move(102, 201, 1000 + HOLD - 1)).toBe(false);
    expect(p.gesture()).toBe("press");
    expect(p.up("sq:3,4")).toBe("walk");
  });
  it("a press that moves past the threshold before the hold time is a look round, and stays one however long it's held", () => {
    const p = new Press(DRAG, HOLD);
    p.down(100, 200, "sq:3,4", 1000);
    expect(p.move(100 + DRAG + 1, 200, 1000 + HOLD - 1)).toBe(true);
    expect(p.gesture()).toBe("look");
    expect(p.hold(1000 + HOLD * 5)).toBe(false);
    expect(p.move(300, 200, 1000 + HOLD * 5)).toBe(true);
    expect(p.up("sq:3,4")).toBe("drag");
  });
  it("a press held still past the hold time is a run (the frame's check says so once); letting go ends it, no walk", () => {
    const p = new Press(DRAG, HOLD);
    p.down(100, 200, "sq:3,4", 1000);
    expect(p.hold(1000 + HOLD - 1)).toBe(false);
    expect(p.hold(1000 + HOLD)).toBe(true);
    expect(p.hold(1000 + HOLD + 16)).toBe(false);
    expect(p.running()).toBe(true);
    expect(p.pressing()).toBe(false);
    expect(p.up("sq:3,4")).toBe("run");
    expect(p.gesture()).toBe("idle");
  });
  it("a move that comes in after the hold time (no frame between) makes it a run, not a look round, however far", () => {
    const p = new Press(DRAG, HOLD);
    p.down(100, 200, "", 0);
    expect(p.move(400, 200, HOLD + 5)).toBe(false);
    expect(p.gesture()).toBe("run");
  });
  it("no rotation while running: a run's finger moving any way, any distance, is never a drag", () => {
    const p = new Press(DRAG, HOLD);
    p.down(100, 200, "sq:3,4", 0);
    p.hold(HOLD);
    for (const [x, y] of [[500, 200], [100, -300], [-200, 900], [100, 200]] as const) {
      expect(p.move(x, y, HOLD + 100)).toBe(false);
      expect(p.dragged()).toBe(false);
      expect(p.gesture()).toBe("run");
    }
  });
  it("today's town has no hold time: a press held still for ever is still a tap", () => {
    const p = new Press(DRAG);
    p.down(100, 200, "sq:3,4", 0);
    expect(p.hold(60_000)).toBe(false);
    expect(p.move(101, 200, 60_000)).toBe(false);
    expect(p.up("sq:3,4")).toBe("walk");
  });
});

describe("the run's way: from your pawn to the finger, snapped to up, down, left or right, changing while held", () => {
  const DEAD = F.streetRunDeadPx;
  it("the nearer of the four ways; a tie goes across; nothing within the dead zone", () => {
    expect(runDir(80, 10, DEAD)).toBe("right");
    expect(runDir(-80, -30, DEAD)).toBe("left");
    expect(runDir(10, -80, DEAD)).toBe("up");
    expect(runDir(-30, 80, DEAD)).toBe("down");
    expect(runDir(50, 50, DEAD)).toBe("right");
    expect(runDir(-50, -50, DEAD)).toBe("left");
    expect(runDir(DEAD - 1, 0, DEAD)).toBeNull();
    expect(runDir(0, 0, DEAD)).toBeNull();
  });
  it("the finger holds one arrow at a time; sliding it round changes the held way; letting go releases it", () => {
    const run = new FingerRun();
    run.steer(5, 3, DEAD);
    expect(run.dir, "within the dead zone: no run yet").toBeNull();
    run.steer(100, 0, DEAD);
    expect([run.dir, isHeld("right")]).toEqual(["right", true]);
    // (Sliding round from the right to above: the way changes once the finger is nearer up than right.)
    run.steer(100, -60, DEAD);
    expect(run.dir).toBe("right");
    run.steer(60, -100, DEAD);
    expect([run.dir, isHeld("right"), isHeld("up")]).toEqual(["up", false, true]);
    // (Back over your pawn: the way it had.)
    run.steer(2, 2, DEAD);
    expect(run.dir).toBe("up");
    run.stop();
    expect([run.dir, isHeld("up"), isHeld("right")]).toEqual([null, false, false]);
  });
  it("the run is the arrows' walk: holding the finger right of your pawn walks on square after square; letting go stops after the step", () => {
    const w = new Walker({ c: 5, r: 5 }, F.youStepMs, true, F.walkEase);
    const k = keyWalk(w, () => true);
    const run = new FingerRun();
    run.steer(120, 0, F.streetRunDeadPx);
    let t = 0;
    for (; t < 700; t += 16) {
      k.start();
      w.update(t);
    }
    expect(w.hereC()).toBeGreaterThanOrEqual(8);
    run.steer(0, -120, F.streetRunDeadPx);
    const c = w.hereC();
    for (; t < 1400; t += 16) {
      k.start();
      w.update(t);
    }
    expect(w.hereR(), "turned up: rows on").toBeGreaterThan(5);
    expect(w.hereC() - c, "at most the step it was on").toBeLessThanOrEqual(1);
    run.stop();
    for (; t < 2400; t += 16) {
      k.start();
      w.update(t);
    }
    expect(w.moving()).toBe(false);
  });
});

/** A look round dragged to `deg` (from the normal view), let go at `now`, with the normal heading `normal`. */
const looked = (deg: number, normal: number, now = 0) => {
  const l = new LookAround();
  l.grab(0);
  l.drag(-(deg / F.streetLookPerWidth) * 390, 390);
  l.release(now, normal);
  return l;
};

describe("locking a new view (Eric, Nov 5: \"… and then you tap … it locks in\"; Nov 6: \"about like 45 degrees … it should snap to the new direction\")", () => {
  it("let go, the view eases to the nearest quarter exactly (about 0.16 s) and it's snapped; the base isn't changed yet", () => {
    expect(F.streetSnapDeg).toBe(45);
    for (const [deg, q] of [[95, 90], [81, 90], [54, 90], [-50, 270], [-99, 270], [172, 180], [-185, 180]] as const) {
      const l = looked(deg, 0, 1000);
      expect(l.snapped, `${deg}°`).toBe(q);
      expect(l.at(1000 + F.streetSnapMs), `${deg}° eased to the quarter`).toBeCloseTo(deg < -100 ? -180 : deg < 0 ? -90 : q, 6);
    }
  });
  it("from a base of east: the quarters are the world's (a look 84° left of east snaps to north)", () => {
    const l = looked(-84, 90, 0);
    expect(l.snapped).toBe(0);
    expect(l.at(1000)).toBeCloseTo(-90, 6);
  });
  it("past 45° it snaps to the next quarter: 50° left of north snaps to west, -90", () => {
    const l = looked(-50, 0, 0);
    expect(l.snapped).toBe(270);
    expect(l.at(1000)).toBeCloseTo(-90, 6);
    const m = looked(54, 0, 0);
    expect(m.snapped).toBe(90);
    expect(m.at(1000)).toBeCloseTo(90, 6);
  });
  it("a look that lets go on the normal heading's own quarter isn't snapped: it eases there, not snapped", () => {
    const n = looked(6, 0, 0);
    expect(n.snapped, "the normal heading's own quarter").toBeNull();
    expect(n.at(1000)).toBe(0);
  });
  it("a tap or a run next locks it in: the new base heading, the camera not moving (even mid-snap)", () => {
    for (const lockAt of [F.streetSnapMs / 2, F.streetSnapMs * 3]) {
      const turn = new Turn(0);
      const look = looked(95, 0, 0);
      const before = turn.at(lockAt) + look.at(lockAt);
      expect(lockIn(turn, look, lockAt)).toBe(90);
      expect(turn.to).toBe(90);
      expect(look.at(lockAt)).toBe(0);
      expect(turn.at(lockAt) + look.at(lockAt), "the camera stays").toBeCloseTo(before, 6);
      expect(turn.at(lockAt + 1000)).toBe(90);
      expect(look.snapped).toBeNull();
    }
  });
  it("a lock the short way round: from east, a snap to north turns the camera's heading to 0, not 360", () => {
    const turn = new Turn(90);
    const look = looked(-90, 90, 0);
    expect(lockIn(turn, look, 1000)).toBe(0);
    expect(turn.at(5000)).toBe(0);
  });
  it("no lock when nothing snapped (the nearest quarter is the normal heading's): nothing changes, and your first step eases the view back", () => {
    const turn = new Turn(90);
    const look = looked(-20, 90, 0);
    expect(lockIn(turn, look, 500)).toBeNull();
    expect(turn.to).toBe(90);
    look.back(500);
    expect(look.at(500 + F.streetLookBackMs)).toBe(0);
  });
  it("an arrow step locks in the snapped quarter, through the same path as a tap: the base is 90, the view doesn't ease back", () => {
    const turn = new Turn(0);
    const look = looked(95, 0, 0);
    // (The frame's step: lockIn first; `back` only when nothing snapped.)
    expect(lockIn(turn, look, 400)).toBe(90);
    expect(turn.at(1000)).toBe(90);
    expect(look.at(400)).toBe(0);
    expect(look.snapped).toBeNull();
  });
  it("a new drag forgets the last snap until it's let go", () => {
    const look = looked(95, 0, 0);
    look.grab(500);
    expect(look.snapped).toBeNull();
    expect(lockIn(new Turn(0), look, 500)).toBeNull();
  });
  it("into a building and out (and the town opening): north again, the look round and any snap gone, no easing", () => {
    const turn = new Turn(0);
    const look = looked(95, 0, 0);
    let base = lockIn(turn, look, 500)!;
    expect(base).toBe(90);
    // (Out of the building, on a plain square: baseHeading(c, r, 0) is north.)
    const [c, r] = [8, 28];
    base = freshView(turn, look, baseHeading(c, r, 0));
    expect(base).toBe(0);
    expect([turn.from, turn.to, turn.at(500), look.at(500), look.snapped]).toEqual([0, 0, 0, 0, null]);
    // (A second look round snaps afresh.)
    const l2 = looked(-95, 0, 0);
    expect(l2.snapped).toBe(270);
  });
  it("a home's strip leaves the base alone: on its strip the camera faces its front; off it, the base heading", () => {
    const s = STRIPS.find((x) => x.heading === 0 && x.squares.length)!;
    const q = s.squares[0]!;
    for (const base of [0, 90, 180, 270]) {
      expect(baseHeading(q.c, q.r, base), `on the strip at ${base}`).toBe(s.heading);
      expect(baseHeading(8, 28, base), `off it at ${base}`).toBe(base);
    }
    const t = STRIPS.find((x) => x.heading !== 0 && x.squares.length);
    if (t) expect(baseHeading(t.squares[0]!.c, t.squares[0]!.r, 90)).toBe(t.heading);
  });
});

describe("the arrows follow the base heading (and #502's rowsUp): up is always up the screen", () => {
  const AHEAD: Record<number, [number, number]> = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] };
  it("screenStep at each base: up is the camera's ahead, right its right", () => {
    const o = { dc: 0, dr: 0 };
    for (const base of [0, 90, 180, 270]) {
      screenStep(0, 1, quarterOf(base), o);
      expect([o.dc, o.dr], `up at ${base}`).toEqual(AHEAD[base]);
      screenStep(1, 0, quarterOf(base), o);
      expect([o.dc, o.dr], `right at ${base}`).toEqual(AHEAD[(base + 90) % 360]);
    }
  });
  it("a held up arrow (or a finger's run up) walks the town's way the base faces, through keyWalk and rowsUp", () => {
    for (const base of [0, 90, 180, 270]) {
      const w = new Walker({ c: 10, r: 10 }, F.youStepMs, true, F.walkEase);
      expect(w.rowsUp).toBe(1);
      const out = { dc: 0, dr: 0 };
      const k = keyWalk(w, () => true, undefined, (c, r, dc, dr) => {
        screenStep(dc, dr, quarterOf(base), out);
        return { c: c + out.dc, r: r + out.dr };
      });
      hold("up", true);
      for (let t = 0; t < 400; t += 16) {
        k.start();
        w.update(t);
      }
      hold("up", false);
      for (let t = 400; t < 1400; t += 16) w.update(t);
      expect([Math.sign(w.hereC() - 10), Math.sign(w.hereR() - 10)], `up at ${base}`).toEqual(AHEAD[base]);
    }
  });
});

describe("the minimap, built from the plan (street-plan.json): north up, the Colosseum a band on the top edge", () => {
  it("its body covers every home, the park and the walls' rows; its width is the town's", () => {
    expect(M.MAP_W).toBe(N);
    for (const l of STREET_HOMES) expect(l.r0 + (l.facing === "S" || l.facing === "N" ? l.d : l.w), l.id).toBeLessThanOrEqual(M.MAP_TOP);
    expect(STREET_PARK.r1).toBeLessThan(M.MAP_TOP);
    // (Nothing but the grove and the Colosseum's ground past the top.)
    for (let r = M.MAP_TOP; r < N; r++)
      for (let c = 0; c < N; c++) expect([STREET_GROUND_KEY.g, STREET_GROUND_KEY.A], `${c},${r}`).toContain(STREET_GROUND[r * N + c]);
    expect(M.MAP_BAND.c0).toBe(STREET_COLISEUM.c0);
    expect(M.MAP_BAND.w).toBe(STREET_COLISEUM.size);
    expect(M.MAP_H).toBeCloseTo(M.MAP_TOP + M.MAP_BAND.sq, 6);
  });
  it("plan to map pixels: a square's middle is across from the left, rows down from the top under the band; east-west wraps; the north is held on the edge", () => {
    const s = 4;
    const p = { x: 0, y: 0 };
    M.mapPoint(0, 0, s, p);
    expect([p.x, p.y]).toEqual([0.5 * s, (M.MAP_BAND.sq + M.MAP_TOP - 0.5) * s]);
    M.mapPoint(10, 20, s, p);
    expect(p.x).toBeCloseTo(10.5 * s, 6);
    expect(p.y).toBeCloseTo((M.MAP_BAND.sq + M.MAP_TOP - 20.5) * s, 6);
    const y20 = p.y;
    M.mapPoint(10, 21, s, p);
    expect(y20 - p.y, "a row north is a square up the map").toBeCloseTo(s, 6);
    M.mapPoint(-1, 20, s, p);
    expect(p.x, "west of the first column wraps to the last").toBeCloseTo((N - 0.5) * s, 6);
    M.mapPoint(10, N + 5, s, p);
    expect(p.y, "past the top: on the band's edge").toBe(M.MAP_BAND.sq * s);
    expect(M.mapScale(4 * N)).toBeCloseTo(4, 6);
    expect(M.mapHeight(4 * N)).toBe(Math.round(4 * M.MAP_H));
  });
  it("the park and the Colosseum's icons: the park's middle; the band's middle", () => {
    const s = 5;
    const p = { x: 0, y: 0 };
    M.parkPoint(s, p);
    expect(p.x).toBeCloseTo((STREET_PARK.c0 + STREET_PARK.w / 2) * s, 6);
    const q = { x: 0, y: 0 };
    M.mapPoint(0, STREET_PARK.r1, s, q);
    expect(p.y).toBeGreaterThan(q.y);
    M.colosseumPoint(s, p);
    expect([p.x, p.y]).toEqual([(STREET_COLISEUM.c0 + STREET_COLISEUM.size / 2) * s, (M.MAP_BAND.sq * s) / 2]);
  });
  it("the walls are the plan's (each one drawn as a line), and the homes its lots", () => {
    expect(STREET_LOTS.filter((l) => l.kind === "wall").length).toBeGreaterThan(0);
    const calls: string[] = [];
    const g = new Proxy({} as Record<string, unknown>, {
      get: (o, k: string) => (k in o ? o[k] : (...a: unknown[]) => void calls.push(`${k}:${a.length}`)),
      set: (o, k: string, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    M.drawMap(g, 3);
    expect(calls.filter((c) => c.startsWith("lineTo")).length, "a line a wall").toBe(STREET_LOTS.filter((l) => l.kind === "wall").length);
    expect(calls.filter((c) => c.startsWith("closePath")).length, "a block a home").toBe(STREET_HOMES.length);
  });
  it("your dot and its arrow: placed where you are, turned the camera's way; set only when it moves a quarter pixel or turns half a degree", () => {
    const el = { style: { transform: "" } } as unknown as HTMLElement;
    const d = new M.MapDot(el, 4);
    d.place(8, 20, 0);
    const p = { x: 0, y: 0 };
    M.mapPoint(8, 20, 4, p);
    expect(el.style.transform).toBe(`translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(0deg)`);
    el.style.transform = "";
    d.place(8.03, 20, 0.2);
    expect(el.style.transform, "too small a change: left alone").toBe("");
    d.place(8, 20, 90);
    expect(el.style.transform).toMatch(/rotate\(90deg\)$/);
    d.place(8, 20, -90);
    expect(el.style.transform, "headings brought into 0..360").toMatch(/rotate\(270deg\)$/);
    d.place(9, 20, 270);
    M.mapPoint(9, 20, 4, p);
    expect(el.style.transform).toContain(`translate3d(${p.x.toFixed(1)}px`);
    // (Every dot showing moves with the frame.)
    M.MAP_DOTS.add(d);
    M.mapFrame(14, 15, 180);
    M.MAP_DOTS.delete(d);
    M.mapPoint(14, 15, 4, p);
    expect(el.style.transform).toBe(`translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(180deg)`);
  });
  it("on by default; the button's choice is stored on this device and read back", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    M.resetMapOn();
    expect(M.mapOn(), "nothing stored: on").toBe(true);
    const told = vi.fn();
    const off = M.onMapOn(told);
    M.setMapOn(false);
    expect([M.mapOn(), store.get(M.MAP_KEY), told.mock.calls.length]).toEqual([false, "0", 1]);
    M.resetMapOn();
    expect(M.mapOn(), "read back off").toBe(false);
    M.setMapOn(true);
    expect(store.get(M.MAP_KEY)).toBe("1");
    M.resetMapOn();
    expect(M.mapOn()).toBe(true);
    off();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } });
    M.resetMapOn();
    expect(M.mapOn(), "a storage that won't answer: on").toBe(true);
    M.setMapOn(false);
    expect(M.mapOn(), "the choice lasts the page").toBe(false);
    vi.unstubAllGlobals();
    M.resetMapOn();
  });
});
