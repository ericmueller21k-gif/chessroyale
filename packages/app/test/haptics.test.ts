import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAPTICS } from "@chessroyale/core";
import { pickedUp, type Press } from "../src/board/logic.ts";

/** A device: its storage, its navigator, and (an iPhone) the page's hidden switch, counting its ticks. */
function device(opts: { vibrate?: boolean; touches?: number; ua?: string; switchInput?: boolean; stored?: Record<string, string> } = {}) {
  const m = new Map(Object.entries(opts.stored ?? {}));
  vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)) });
  const vibrate = vi.fn(() => true);
  vi.stubGlobal("navigator", { ...(opts.vibrate === false ? {} : { vibrate }), maxTouchPoints: opts.touches ?? 5, userAgent: opts.ua ?? "Mozilla/5.0 (Linux; Android 14; Pixel 8)" });
  vi.stubGlobal("HTMLInputElement", { prototype: opts.switchInput ? { switch: false } : {} });
  const ticks = { n: 0 };
  const el = () => ({ style: {}, setAttribute: () => undefined, append: () => undefined, addEventListener: () => undefined, click: () => void ticks.n++ });
  const on = new Map<string, () => void>();
  vi.stubGlobal("document", { hidden: false, createElement: el, body: { append: () => undefined }, addEventListener: (t: string, f: () => void) => void on.set(t, f) });
  /** The page handling an event of this type (window.event), and its listeners hearing it. */
  const fire = (type: string) => {
    vi.stubGlobal("event", { type });
    on.get(type)?.();
  };
  return { vibrate, ticks, stored: m, fire };
}
const load = async () => {
  vi.resetModules();
  return import("../src/haptics.ts");
};

describe("haptics (Eric, Nov 9): a tick on a tap and a move, a few boss moments", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("picks the way: the Vibration API on a touch screen, else an iPhone's switch, else none", async () => {
    const { pickWay } = await load();
    expect(pickWay({ vibrate: true, touch: true, ios: false, switchInput: false })).toBe("vibrate");
    // (A computer's Chrome has navigator.vibrate and nothing to shake.)
    expect(pickWay({ vibrate: true, touch: false, ios: false, switchInput: false })).toBe(null);
    expect(pickWay({ vibrate: false, touch: true, ios: true, switchInput: true })).toBe("ios");
    // (An iPhone before the switch: nothing.)
    expect(pickWay({ vibrate: false, touch: true, ios: true, switchInput: false })).toBe(null);
    expect(pickWay({ vibrate: false, touch: false, ios: false, switchInput: true })).toBe(null);
  });

  it("reads the device: an iPhone, an iPad that says it's a Mac, a phone, a computer", async () => {
    device({ vibrate: false, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)", switchInput: true });
    expect((await load()).hapticWay()).toBe("ios");
    device({ vibrate: false, ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", touches: 5, switchInput: true });
    expect((await load()).hapticWay()).toBe("ios");
    device({ vibrate: false, ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", touches: 0, switchInput: true });
    expect((await load()).hapticWay()).toBe(null);
    device();
    expect((await load()).hapticWay()).toBe("vibrate");
    device({ touches: 0 });
    expect((await load()).hapticWay()).toBe(null);
  });

  it("plays each kind's pattern from HAPTICS, as it is", async () => {
    const { vibrate } = device();
    const { haptic } = await load();
    haptic("select");
    haptic("move");
    haptic("bigboyBounce");
    expect(vibrate.mock.calls).toEqual([[HAPTICS.patterns.select], [HAPTICS.patterns.move], [[...HAPTICS.patterns.bigboyBounce]]]);
  });

  it("Vibration off: nothing at all (and a device that can't: nothing, no error)", async () => {
    const { vibrate } = device({ stored: { "brc.vibration": "0" } });
    const { haptic, hapticOnce, cueHaptic } = await load();
    haptic("move");
    hapticOnce("x", "queenSlain");
    cueHaptic("tigerPump", "pop", "pop");
    expect(vibrate).not.toHaveBeenCalled();
    device({ vibrate: false, touches: 0 });
    const none = await load();
    expect(() => none.haptic("move")).not.toThrow();
  });

  it("never throws, whatever the browser does", async () => {
    const { vibrate } = device();
    vibrate.mockImplementation(() => {
      throw new Error("blocked");
    });
    const { haptic } = await load();
    expect(() => haptic("move")).not.toThrow();
  });

  it("an iPhone: one tick per pulse, at most HAPTICS.iosTicks", async () => {
    vi.useFakeTimers();
    const { ticks } = device({ vibrate: false, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)", switchInput: true });
    const { haptic, pulses } = await load();
    haptic("select");
    expect(ticks.n).toBe(1);
    haptic("bigboyBounce");
    vi.runAllTimers();
    expect(ticks.n).toBe(1 + Math.min(pulses(HAPTICS.patterns.bigboyBounce), HAPTICS.iosTicks));
    expect(pulses([30, 60, 30, 60, 30])).toBe(3);
    expect(pulses(25)).toBe(1);
  });

  it("an iPhone: a tap-move's tick (made as the press goes down) plays at the lift, same finger and square, within holdMs", async () => {
    const { ticks } = device({ vibrate: false, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)", switchInput: true });
    const { hapticAtPress, hapticAtLift } = await load();
    // The press goes down: nothing yet (WebKit wouldn't play it there).
    const t = hapticAtPress("move", 7, "e4", 1000);
    expect(ticks.n).toBe(0);
    expect(t).toEqual({ pointer: 7, square: "e4", at: 1000, kind: "move" });
    // The finger lifts on e4: the tick.
    hapticAtLift(t, 7, "e4", 1080);
    expect(ticks.n).toBe(1);
    // Another finger, another square, off the board (a cancel), held past holdMs, or nothing kept: no tick.
    hapticAtLift(t, 8, "e4", 1080);
    hapticAtLift(t, 7, "e5", 1080);
    hapticAtLift(t, 7, null, 1080);
    hapticAtLift(t, 7, "e4", 1000 + HAPTICS.holdMs);
    hapticAtLift(null, 7, "e4", 1080);
    expect(ticks.n).toBe(1);
  });

  it("an iPhone: a tick asked for in a pointer event waits for the tap's touchend (a gesture to WebKit); in a click, at once", async () => {
    const { ticks, fire } = device({ vibrate: false, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)", switchInput: true });
    const { haptic } = await load();
    vi.stubGlobal("event", { type: "pointerup" });
    haptic("select");
    expect(ticks.n).toBe(0);
    fire("touchend");
    expect(ticks.n).toBe(1);
    // (Played once: a later touchend plays nothing more.)
    fire("touchend");
    expect(ticks.n).toBe(1);
    vi.stubGlobal("event", { type: "click" });
    haptic("move");
    expect(ticks.n).toBe(2);
  });

  it("Android: a press-down's tick plays at once, nothing kept for the lift", async () => {
    const { vibrate } = device();
    const { hapticAtPress, hapticAtLift } = await load();
    const t = hapticAtPress("move", 7, "e4", 1000);
    expect(t).toBe(null);
    expect(vibrate.mock.calls).toEqual([[HAPTICS.patterns.move]]);
    hapticAtLift(t, 7, "e4", 1080);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("the boss moments: each art cue in HAPTICS.cues, its animation where named; a moment once for its key", async () => {
    const { vibrate } = device();
    const { cueHaptic, hapticOnce } = await load();
    cueHaptic("toy-block", "landA", "clack");
    cueHaptic("bigboy", "bigBounce", "crash");
    cueHaptic("tigerPump", "popQ4", "pop");
    cueHaptic("ice-overlay", "freeze", "crackle");
    cueHaptic("pie-splat", "splat", "splat");
    // (Not these: Ginger's ice cracking as it thaws, a cue no table names.)
    cueHaptic("ice-overlay", "crack", "crackle");
    cueHaptic("bigboy", "bigBounce", "boing");
    hapticOnce("slain:1", "queenSlain");
    hapticOnce("slain:1", "queenSlain");
    const p = HAPTICS.patterns;
    const want = [p.bigboyBlock, p.bigboyBounce, p.baburPop, p.gingerFreeze, p.boingoPie, p.queenSlain].map((x) => [typeof x === "number" ? x : [...x]]);
    expect(vibrate.mock.calls).toEqual(want);
    // Every cue names a kind with a pattern.
    for (const k of Object.values(HAPTICS.cues)) expect(HAPTICS.patterns[k]).toBeDefined();
  });
});

describe("the board's select tick: a tap that picks a piece up, not a hold or a drag", () => {
  const press = (o: Partial<Press> = {}): Press => ({ from: "e2", x0: 0, y0: 0, x: 0, y: 0, started: false, left: false, before: null, ...o });
  it("a tap on a new piece: yes", () => {
    expect(pickedUp(press(), "e2", "e2", 80)).toBe(true);
    expect(pickedUp(press({ before: "d2" }), "e2", "e2", 80)).toBe(true);
  });
  it("held, dragged, let go elsewhere, or the piece already picked up (it's put down): no", () => {
    expect(pickedUp(press(), "e2", "e2", HAPTICS.holdMs)).toBe(false);
    expect(pickedUp(press({ started: true }), "e2", "e2", 80)).toBe(false);
    expect(pickedUp(press(), "e2", null, 80)).toBe(false);
    expect(pickedUp(press({ before: "e2" }), null, "e2", 80)).toBe(false);
    expect(pickedUp(press(), null, "e2", 80)).toBe(false);
  });
});
