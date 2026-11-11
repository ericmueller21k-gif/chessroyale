import { describe, expect, it } from "vitest";
import { F, FpsCount, FrameRec, NP, P, PART_NAMES, PART_SHORT, RUN_MS, browserOf, newRun, quantile, refreshOf, summarize, timerStep, whatOf, type RunData } from "../src/town/frame-report.ts";

/** A run of frames: each [ms, flags, parts as { part: ms }, turn deg/s, uploads, pictures painted]. */
function runOf(frames: [number, number, Partial<Record<number, number>>?, number?, number?, number?][]): RunData {
  const r = newRun(64);
  for (const [ms, fl, parts = {}, turn = 0, ups = 0, bakes = 0] of frames) {
    const i = r.n++;
    r.total[i] = ms;
    r.flags[i] = fl;
    r.turn[i] = turn;
    r.ups[i] = ups;
    r.bakes[i] = bakes;
    for (const [k, v] of Object.entries(parts)) r.part[i * NP + Number(k)] = v!;
  }
  return r;
}

describe("the frame report's summary (/town?report, Nov 11)", () => {
  it("every part has a name, the outside part last", () => {
    expect(PART_NAMES).toHaveLength(NP);
    expect(P.outside).toBe(NP - 1);
    expect(PART_NAMES[P.paint]).toBe("New pictures");
    expect(PART_SHORT).toHaveLength(NP);
  });

  it("quantile by nearest rank; the refresh snapped to a usual rate", () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(quantile(xs, 0.5)).toBe(50);
    expect(quantile(xs, 0.95)).toBe(100);
    expect(quantile(xs, 0.1)).toBe(10);
    expect(quantile([], 0.5)).toBe(0);
    expect(refreshOf([16.6, 16.7, 16.7, 16.8, 16.7, 16.7, 33.3, 16.7, 16.6, 16.7])).toBe(60);
    expect(refreshOf(Array(20).fill(8.33))).toBe(120);
    expect(refreshOf([])).toBe(0);
  });

  it("frames a second: median, 5th and 1st percentile (the slow end), the shares over 20 and 33 ms", () => {
    // 64 frames: 54 at 16.7 ms, 6 at 25 ms, 4 at 50 ms.
    const r = runOf([...Array(54).fill([16.7, F.walk]), ...Array(6).fill([25, F.turn]), ...Array(4).fill([50, F.turn])]);
    const s = summarize(r);
    expect(s.frames).toBe(64);
    expect(Math.round(s.p50)).toBe(60);
    expect(s.p5).toBe(20); // the 95th percentile frame: 50 ms
    expect(s.p1).toBe(20);
    expect(s.over20).toBeCloseTo(10 / 64, 6);
    expect(s.over33).toBeCloseTo(4 / 64, 6);
    expect(s.secs).toBeCloseTo((54 * 16.7 + 6 * 25 + 4 * 50) / 1000, 6);
  });

  it("the parts: mean and worst, overall and split by walking, turning and loading; where the most time went", () => {
    const r = runOf([
      [16, F.walk, { [P.buildings]: 4, [P.ground]: 1 }],
      [18, F.walk, { [P.buildings]: 6, [P.ground]: 1 }],
      [30, F.turn | F.load, { [P.paint]: 12, [P.buildings]: 2 }, 120, 3, 2],
      [26, F.turn, { [P.paint]: 8, [P.buildings]: 2 }, 90],
    ]);
    const s = summarize(r);
    const [all, walk, turn, load] = s.segs;
    expect(s.segs.map((g) => [g.name, g.frames])).toEqual([["All", 4], ["Walk", 2], ["Turn", 2], ["Load", 1], ["Room", 0], ["In/out", 0]]);
    expect(all!.avg[P.buildings]).toBe(3.5);
    expect(all!.max[P.paint]).toBe(12);
    expect(walk!.avg[P.buildings]).toBe(5);
    expect(turn!.avg[P.paint]).toBe(10);
    expect(load!.avg[P.paint]).toBe(12);
    expect(turn!.mean).toBe(28);
    // (Most overall: new pictures, 5 ms a frame against the buildings' 3.5; while turning too.)
    expect(s.top).toBe(P.paint);
    expect(s.topTurn).toBe(P.paint);
    expect([s.ours, s.oursTurn]).toEqual([P.paint, P.paint]);
    expect(s.maxTurn).toBe(120);
    expect([s.uploads, s.bakes]).toEqual([3, 2]);
  });

  it("the worst frames: slowest first, each with when, what was happening and its biggest part", () => {
    const r = runOf([
      [16, F.walk, { [P.buildings]: 4 }],
      [40, F.turn | F.load | F.upload, { [P.paint]: 20 }, 140, 5, 3],
      [16, 0],
      [60, F.gap, { [P.outside]: 55 }],
      [20, F.walk | F.zoom | F.sight | F.load, { [P.sight]: 2 }],
      [25, F.reset | F.load, { [P.uploads]: 9 }],
    ]);
    const s = summarize(r);
    expect(s.worst.map((w) => w.ms)).toEqual([60, 40, 25, 20, 16, 16]);
    expect(s.worst[0]).toMatchObject({ i: 3, at: 72, what: "gap", top: P.outside, topMs: 55 });
    // (Of our own parts, the outside part left out: the pictures painted, 20 in one frame.)
    expect(s.top).toBe(P.outside);
    expect(s.ours).toBe(P.paint);
    expect(s.worst[1]).toMatchObject({ i: 1, at: 16, what: "turning 140°/s · 3 painted · 5 uploads", top: P.paint, topMs: 20 });
    expect(whatOf(r, 4)).toBe("walking · zoom · sight lines");
    expect(whatOf(r, 5)).toBe("atlas reset");
    expect(whatOf(r, 2)).toBe("standing");
    expect(s.resets).toBe(1);
  });

  it("loading is pictures painted, sight lines or an atlas reset; a plain upload (a tag drawn again) isn't", () => {
    const s = summarize(runOf([[16, F.upload, {}, 0, 2], [16, F.load | F.upload, {}, 0, 1, 1], [16, F.load | F.sight], [16, F.load | F.reset]]));
    expect(s.segs[3]!.frames).toBe(3);
  });

  it("an empty run says so (no frames: nothing to divide by)", () => {
    const s = summarize(newRun(4));
    expect([s.frames, s.meanFps, s.p50, s.top, s.topTurn, s.ours, s.worst.length]).toEqual([0, 0, 0, -1, -1, -1, 0]);
  });
});

describe("the recorder", () => {
  /** A recorder on a clock the test moves. */
  function rig() {
    let t = 0;
    const rec = new FrameRec(() => t);
    return { rec, at: (x: number) => (t = x) };
  }

  it("waits for the first move, then records each frame's parts; work timed inside a part is taken out of it", () => {
    const { rec, at } = rig();
    // Standing: nothing recorded.
    at(0);
    rec.begin(0);
    rec.mark(P.logic);
    rec.end(false, 0, 2);
    expect([rec.state, rec.run.n]).toEqual(["wait", 0]);
    // You set off: recording starts (that frame's time is the wait's).
    at(16.7);
    rec.begin(16.7);
    rec.end(true, 0, 2);
    expect([rec.state, rec.run.n]).toEqual(["rec", 0]);
    // A frame: 1 ms of logic, 5 of buildings with 2 ms of a picture painted inside, 1 of submit.
    at(33.4);
    rec.begin(33.4);
    at(34.4);
    rec.mark(P.logic);
    rec.paint(2);
    at(39.4);
    rec.mark(P.buildings);
    at(40.4);
    rec.mark(P.submit);
    rec.end(true, 0, 2);
    const r = rec.run;
    expect(r.n).toBe(1);
    expect(r.total[0]).toBeCloseTo(16.7, 3);
    const part = (k: number) => r.part[k]!;
    expect(part(P.logic)).toBeCloseTo(1, 6);
    expect(part(P.buildings)).toBeCloseTo(3, 6);
    expect(part(P.paint)).toBeCloseTo(2, 6);
    expect(part(P.submit)).toBeCloseTo(1, 6);
    // (The frame's time less our 7 ms: outside our code.)
    expect(part(P.outside)).toBeCloseTo(16.7 - 7, 3);
    expect(r.flags[0]! & F.walk).toBeTruthy();
    expect(r.bakes[0]).toBe(1);
  });

  it("a turn's speed in degrees a second, across north (359° to 1°: 2°, not 358°); a zoom; a long gap", () => {
    const { rec, at } = rig();
    at(0);
    rec.begin(0);
    rec.end(false, 355, 2);
    at(10);
    rec.begin(10);
    rec.end(false, 359, 2); // starts: turning 400°/s
    at(20);
    rec.begin(20);
    rec.end(false, 1, 2);
    expect(rec.run.turn[0]).toBeCloseTo(200, 3);
    expect(rec.run.flags[0]! & F.turn).toBeTruthy();
    at(30);
    rec.begin(30);
    rec.end(false, 1, 2.5);
    expect(rec.run.flags[1]! & F.zoom).toBeTruthy();
    expect(rec.run.flags[1]! & F.turn).toBeFalsy();
    at(100);
    rec.begin(100);
    rec.end(false, 1, 2.5);
    expect(rec.run.flags[2]! & F.gap).toBeTruthy();
  });

  it("a pause (a hidden tab, a test's hold) isn't a frame: the first frame after it isn't recorded", () => {
    const { rec, at } = rig();
    for (const t of [0, 16.7, 33.4]) {
      at(t);
      rec.begin(t);
      rec.end(true, 0, 2);
    }
    // (The first frame starts the run: two recorded.)
    expect(rec.run.n).toBe(2);
    rec.pause();
    for (const t of [9000, 9016.7]) {
      at(t);
      rec.begin(t);
      rec.end(true, 0, 2);
    }
    expect(rec.run.n).toBe(3);
    expect(Array.from(rec.run.total.subarray(0, 3)).map((x) => +x.toFixed(1))).toEqual([16.7, 16.7, 16.7]);
  });

  it("stops after 30 s (onDone once); Again starts an empty run that waits again", () => {
    const { rec, at } = rig();
    let done = 0;
    rec.onDone = () => done++;
    let t = 0;
    for (; t <= RUN_MS + 100; t += 16.7) {
      at(t);
      rec.begin(t);
      rec.end(true, 0, 2);
    }
    expect(rec.state).toBe("done");
    expect(done).toBe(1);
    expect(rec.run.n).toBeGreaterThan(1700);
    expect(rec.run.n).toBeLessThan(1810);
    rec.again();
    expect([rec.state, rec.run.n]).toEqual(["wait", 0]);
    rec.finish();
    rec.finish();
    expect(done).toBe(2);
  });
});

describe("rooms, and going in and out (Nov 11: Eric's iPhone, inside shop rooms and out of them)", () => {
  it("a room's frames go into the run marked; the frames going in and out are marked; the town's columns leave them out", () => {
    let t = 0;
    const rec = new FrameRec(() => t);
    const frame = (dt: number, walking: boolean, heading: number, zoom: number, more = 0) => {
      t += dt;
      rec.begin(t);
      rec.end(walking, heading, zoom, more);
    };
    frame(0, true, 90, 2); // starts
    frame(16.7, true, 90, 2); // the town, walking
    rec.door = F.goIn;
    frame(16.7, false, 90, 2); // the town zooms in on the door
    // The room's first frame: after the black (its wait is seen, not a pause); no heading or zoom in a room, so no turn from the town's 90°.
    frame(400, false, NaN, NaN, F.room);
    rec.door = 0;
    frame(16.7, false, NaN, NaN, F.room);
    frame(16.7, true, NaN, NaN, F.room);
    rec.door = F.goOut;
    frame(16.7, false, NaN, NaN, F.room); // the room fades out
    frame(20, false, 0, 2); // the town again, north
    rec.door = 0;
    frame(16.7, true, 0, 2);
    const r = rec.run;
    expect(r.n).toBe(8);
    expect(Array.from(r.flags.subarray(0, r.n)).map((f) => f & ~(F.gap | F.walk))).toEqual([0, F.goIn, F.goIn | F.room, F.room, F.room, F.goOut | F.room, F.goOut, 0]);
    expect(Array.from(r.flags.subarray(0, r.n)).some((f) => f & (F.turn | F.zoom))).toBe(false);
    expect(r.total[2]).toBeCloseTo(400, 3);
    expect(whatOf(r, 2)).toContain("in a room · going in");
    const s = summarize(r);
    expect(s.segs.map((g) => [g.name, g.frames])).toEqual([
      ["All", 8],
      ["Walk", 2],
      ["Turn", 0],
      ["Load", 0],
      ["Room", 2],
      ["In/out", 4],
    ]);
  });

  it("the ?fps pill counts every frame it's given (the town's and a room's), twice a second; a restart never spans the pause", () => {
    const el = { textContent: "" as string | null, dataset: {} as DOMStringMap };
    const fps = new FpsCount(el);
    let t = 0;
    for (let i = 0; i <= 60; i++) fps.tick((t = i * 16.7));
    expect(el.textContent).toMatch(/^\d+ fps · \d+\.\d ms$/);
    expect(Math.abs(Number(el.dataset.fps) - 60)).toBeLessThanOrEqual(4);
    // A hidden tab for 9 s: restarted, so the next readings are the frames since, not 60 frames over 9 s.
    fps.restart();
    t += 9000;
    for (let i = 0; i <= 60; i++) fps.tick(t + i * 16.7);
    expect(Math.abs(Number(el.dataset.fps) - 60)).toBeLessThanOrEqual(4);
    // (Without the restart, as before Nov 11 when the town's frames stopped inside a room: "2 fps", for two readings.)
    const old = new FpsCount(el);
    for (let i = 0; i <= 60; i++) old.tick(i * 16.7);
    old.tick(10_000);
    expect(Number(el.dataset.fps)).toBeLessThan(10);
  });
});

describe("the device line", () => {
  it("names the browser and the device from a user agent", () => {
    expect(browserOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1")).toBe("Safari 18.1 · iPhone");
    expect(browserOf("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36")).toBe("Chrome 131 · Android");
    expect(browserOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1")).toBe("Chrome 131 · iPhone");
    expect(browserOf("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36")).toBe("Headless Chrome 140 · Linux");
    expect(browserOf("")).toBe("unknown browser");
  });
  it("the clock's step: Safari's whole milliseconds, or finer", () => {
    let t = 0;
    let n = 0;
    expect(timerStep(() => (n++ % 7 === 0 ? (t += 1) : t))).toBe(1);
    let u = 0;
    expect(timerStep(() => (u += 0.005))).toBeCloseTo(0.005, 9);
  });
});
