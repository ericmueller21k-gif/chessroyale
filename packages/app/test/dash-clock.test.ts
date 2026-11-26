import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DASH_HANG_ON } from "@chessroyale/core";
import { DASH_FX, fenAtPly, hangOnTimeline } from "@chessroyale/chess";
import { DASH_FIT_LINES, DASH_HANG_ON_LINES, DASH_LINE_MAX, DASH_LOVE_LINES, DASH_POPOFF_LINES } from "../src/characters/dash-lines.ts";
import { DASH_UI, hangOnAt, hangOnFen, popOffMoments } from "../src/components/Dash.tsx";
import { DASH_FIGURE, DASH_HANG, HANG_SECTION } from "../src/characters/dash-figure.ts";
import { renderFrame } from "../src/characters/sprite.ts";
import { holdDashAway } from "../src/components/DashStall.tsx";

/** Dash's clock lines (Eric, Nov 7; docs/decisions/2026-11-07-dash-clock.md): the multi-hit's, the pop-off's two beats. */
describe("Dash's clock lines (Eric, Nov 7)", () => {
  it("the multi-hit's lines: the five he had, and ten more about the clock (8 to 12 new)", () => {
    const added = DASH_FIT_LINES.length - 5;
    expect(added).toBeGreaterThanOrEqual(8);
    expect(added).toBeLessThanOrEqual(12);
  });

  it("two or three pop-off lines and two or three love-the-clock lines", () => {
    expect(DASH_POPOFF_LINES.length).toBeGreaterThanOrEqual(2);
    expect(DASH_POPOFF_LINES.length).toBeLessThanOrEqual(3);
    expect(DASH_LOVE_LINES.length).toBeGreaterThanOrEqual(2);
    expect(DASH_LOVE_LINES.length).toBeLessThanOrEqual(3);
    expect(DASH_POPOFF_LINES.join(" ")).toMatch(/pop off/);
  });

  it("every line fits the two-row bubble (at most DASH_LINE_MAX characters), none empty, none repeated", () => {
    const all = [...DASH_FIT_LINES, ...DASH_POPOFF_LINES, ...DASH_LOVE_LINES];
    for (const line of all) {
      expect(line.length, line).toBeGreaterThan(0);
      expect(line.length, line).toBeLessThanOrEqual(DASH_LINE_MAX);
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it("a clock line each time his multi-hit comes, the same on every screen by the moment's key", () => {
    const line = DASH_UI.moments.clockFit!.line!;
    for (let i = 0; i < 50; i++) {
      const m = { kind: "clockFit" as const, key: `dash:clockFit:${i * 4}`, at: 0, ms: DASH_FX.clockFit };
      const text = line(null, m as never);
      expect(DASH_FIT_LINES).toContain(text);
      expect(line(null, m as never)).toBe(text);
    }
  });

  it("the pop-off's beats: the pop-off line, then the love line, each its own moment, the whole 4 to 6 s", () => {
    // (While he thinks after your move of turn 9: your move counted, crowdMoves 9.)
    const boss = { id: "dash", crowdMoves: 9, startMove: 1, powers: { turn: 9, dash: { popOff: { at: 9 } } } };
    const [a, b] = popOffMoments(boss as never, 1000);
    expect(popOffMoments({ ...boss, crowdMoves: 10, powers: { ...boss.powers, turn: 10 } } as never, 1000)).toEqual([]);
    // (Nor while he thinks for his extra move after a failed Scramble Rush, before your move of that turn: Nov 26.)
    expect(popOffMoments({ ...boss, crowdMoves: 8 } as never, 1000)).toEqual([]);
    expect(a).toMatchObject({ kind: "popOff", at: 1000, ms: BOSS_POWERS.dashPopOff.popMs });
    expect(b).toMatchObject({ kind: "popOffFast", at: 1000 + BOSS_POWERS.dashPopOff.popMs, ms: BOSS_POWERS.dashPopOff.loveMs });
    // (A screen drawn again carries on: the same start.)
    expect(popOffMoments(boss as never, 5000)[0]!.at).toBe(1000);
    expect(DASH_UI.moments.popOff!.line!(null, a as never)).toBeTruthy();
    expect(DASH_POPOFF_LINES).toContain(DASH_UI.moments.popOff!.line!(null, a as never));
    expect(DASH_LOVE_LINES).toContain(DASH_UI.moments.popOffFast!.line!(null, b as never));
  });
});

/**
 * His "Hang on" (Eric, Nov 26; docs/decisions/2026-11-26-dash-hang-on.md), in the second pop-off's place: its four beats while he
 * thinks, a line each in Eric's order, your piece slid back and home on screen only.
 */
describe("Dash's \"Hang on\" on screen (Eric, Nov 26)", () => {
  // (After 1. e4 e5 2. Nf3: your move, White's, the board's last; he thinks.)
  const history = ["e2e4", "e7e5", "g1f3"];
  const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
  const boss = { id: "dash", name: "Dash", crowdSide: "w", crowdMoves: 14, startMove: 1, board: { fen, history, bases: null }, powers: { turn: 14, events: [], dash: { popOff: { at: 14, hangOn: true } } } };

  it("four moments from when the screen first saw it, at the timeline's beats, a line each in order (his words), all fitting the bubble", () => {
    const tl = hangOnTimeline();
    const ms = popOffMoments(boss as never, 50_000);
    expect(ms.map((m) => [m.kind, m.at - 50_000])).toEqual([["hangOn", 0], ["hangOnFast", tl.cheetahAt], ["hangOnAlmost", tl.almostAt], ["hangOnSorry", tl.windAt]]);
    expect(ms.at(-1)!.at + ms.at(-1)!.ms - 50_000).toBe(tl.total);
    // (A screen drawn again carries on from the same start.)
    expect(popOffMoments(boss as never, 53_000)[0]!.at).toBe(50_000);
    const lines = ms.map((m) => DASH_UI.moments[m.kind]!.line!(null, m as never));
    expect(lines).toEqual([DASH_HANG_ON_LINES.start, DASH_HANG_ON_LINES.cheetah, DASH_HANG_ON_LINES.almost, DASH_HANG_ON_LINES.sorry]);
    expect(lines).toEqual(["Hang on, one second.", "Time for cheetah speed!", "Almost done, bro.", "Sorry about that, bro. Here's your time back."]);
    for (const l of lines) expect(l!.length, l!).toBeLessThanOrEqual(DASH_LINE_MAX);
    // (The sorry as the wind-up ends.)
    expect(DASH_UI.moments.hangOnSorry!.lineAt).toBe(tl.sorryAt - tl.windAt);
    // (The first pop-off is still the pop-off.)
    expect(popOffMoments({ ...boss, powers: { ...boss.powers, dash: { popOff: { at: 14 } } } } as never, 50_000).map((m) => m.kind)).toEqual(["popOff", "popOffFast"]);
  });

  it("the board: your move taken back from backAt until returnAt (the position before it, his move before yours the last), then as it is; never the game's board", () => {
    const tl = hangOnTimeline();
    const ms = popOffMoments({ ...boss, startMove: 2 } as never, 10_000);
    const b = { ...boss, startMove: 2 } as never;
    expect(hangOnFen(b, ms, 10_000 + tl.backAt - 1)).toBeNull();
    for (const t of [tl.backAt, tl.cheetahAt, tl.sorryAt, tl.returnAt - 1]) {
      expect(hangOnFen(b, ms, 10_000 + t)).toEqual({ fen: fenAtPly(history, 2), lastMove: "e7e5" });
    }
    expect(hangOnFen(b, ms, 10_000 + tl.returnAt)).toBeNull();
    expect(hangOnAt(ms, 10_000 + tl.total - 1)).toBe(10_000);
    expect(hangOnAt(ms, 10_000 + tl.total)).toBeUndefined();
    // (The board's last move his, not yours: nothing taken back.)
    const his = { ...boss, startMove: 3, crowdSide: "b" } as never;
    expect(hangOnFen(his, popOffMoments({ ...boss, startMove: 3 } as never, 10_000), 10_000 + tl.cheetahAt)).toBeNull();
    // (No Hang on: nothing.)
    expect(hangOnAt(popOffMoments({ ...boss, powers: { ...boss.powers, dash: { popOff: { at: 14 } } } } as never, 10_000), 10_500)).toBeUndefined();
  });
});

/** Round 2 (Eric, Nov 26: "he wasn't pressing it ... a ridiculous speed"): his routine on the board's middle, and his fastest smacks. */
describe("Dash's \"Hang on\" routine (round 2)", () => {
  /** The shortest time from one smack to the next in an animation (its click or slam cues), ms; Infinity with one or none. */
  const gap = (a: { frames: readonly { ms: number; cue?: string }[] }) => {
    let t = 0;
    let last = -Infinity;
    let min = Infinity;
    for (const f of a.frames) {
      if (f.cue === "click" || f.cue === "slam") {
        min = Math.min(min, t - last);
        last = t;
      }
      t += f.ms;
    }
    return min;
  };
  const length = (a: { frames: readonly { ms: number }[] }) => a.frames.reduce((s, f) => s + f.ms, 0);

  it("one run as long as the gag, its sections in order: the jump, the slow smacks from his landing, cheetah speed, the wind-up, the sorry and the zip", () => {
    const tl = hangOnTimeline();
    const a = DASH_HANG.anims;
    expect(length(a.hangOn!)).toBe(tl.total);
    expect(length(a.hangJump!)).toBe(tl.landAt);
    expect(length(a.hangJump!) + length(a.hangSlow!)).toBe(tl.cheetahAt);
    expect(length(a.hangFast!)).toBe(tl.windAt - tl.cheetahAt);
    const order = a.hangOn!.frames.map((f) => HANG_SECTION.get(f)).filter((s, i, all) => s !== all[i - 1]);
    expect(order).toEqual(["hangJump", "hangSlow", "hangFast", "hangWind", "hangSorry"]);
    // (Each slow smack lands on the button: a click; the zip back ends it.)
    expect(a.hangSlow!.frames.filter((f) => f.cue === "click").length).toBeGreaterThanOrEqual(10);
    expect(a.hangOn!.frames.at(-1)!.cue).toBe("zip");
  });

  it("cheetah speed's smack is the quickest of every clock smack he has (the pop-off's fit10, the multi-hits, the stall slam, the Clock Slap, his move's press)", () => {
    const fast = gap(DASH_HANG.anims.hangFast!);
    expect(fast).toBe(DASH_HANG_ON.hitMs);
    for (const name of ["fit3", "fit4", "fit5", "fit10", "slam", "clockSlap", "move"]) expect(fast, name).toBeLessThan(gap(DASH_FIGURE.anims[name]!));
    expect(fast).toBeLessThan(gap(DASH_HANG.anims.hangSlow!));
  });

  it("each drawing in the run is one Frame object, drawn once (frameImage caches by the object): no copies, cheetah speed's 3", () => {
    const a = DASH_HANG.anims;
    const sections = [a.hangJump!, a.hangSlow!, a.hangFast!, a.hangWind!, a.hangSorry!];
    expect(new Set(a.hangOn!.frames).size).toBe(sections.reduce((n, s) => n + new Set(s.frames).size, 0));
    for (const f of a.hangOn!.frames) expect(sections.some((s) => s.frames.includes(f))).toBe(true);
    const fast = new Set(a.hangOn!.frames.filter((f) => HANG_SECTION.get(f) === "hangFast"));
    expect(fast.size).toBe(new Set(a.hangFast!.frames).size);
    expect(fast.size).toBe(3);
  });

  it("his spot's figure stays away while either his clock tap or his \"Hang on\" holds it: the tap ending mid-gag leaves the gag's hold", () => {
    const had = (globalThis as { document?: unknown }).document;
    const classes = new Set<string>();
    (globalThis as { document?: unknown }).document = { body: { classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } } };
    try {
      const tap = holdDashAway(); // (He lies down for your clock tap on the "Hang on" turn,)
      const gag = holdDashAway(); // (then you move and the gag starts.)
      tap(); // (The tap's figure gets up mid-gag.)
      expect(classes.has("dash-away")).toBe(true);
      tap(); // (A second release does nothing.)
      expect(classes.has("dash-away")).toBe(true);
      gag(); // (The gag ends: his spot's figure back.)
      expect(classes.has("dash-away")).toBe(false);
    } finally {
      (globalThis as { document?: unknown }).document = had;
    }
  });

  it("his routine's figure is his own, nothing cut off at its frame's edge (its runs never play where he stands: his bar's and side's fits unchanged)", () => {
    for (const [name, a] of Object.entries(DASH_HANG.anims))
      for (const [i, f] of a.frames.entries()) {
        const img = renderFrame(DASH_HANG, f);
        const at = (x: number, y: number) => img.data[(y * img.w + x) * 4 + 3]!;
        for (let x = 0; x < img.w; x++) expect(at(x, 0) + at(x, img.h - 1), `${name} ${i}`).toBe(0);
        for (let y = 0; y < img.h; y++) expect(at(0, y) + at(img.w - 1, y), `${name} ${i}`).toBe(0);
      }
  });
});
