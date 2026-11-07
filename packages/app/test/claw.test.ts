import { describe, expect, it } from "vitest";
import { CLAW, clawWonLine } from "@chessroyale/core";
import { CLAW_START, clawStep, newRequestId, roamX, type ClawEvent, type ClawState } from "../src/claw/flow.ts";
import { CLAW_SOUNDS, clawSound } from "../src/claw/sounds.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";

/**
 * Boingo's claw machine on the device (claw/flow.ts; Eric, Nov 6): the server's answer comes first and drives the claw; the stop tap
 * changes when it drops, never what it brings up; a win shows only when the server granted one. And its sounds (claw/sounds.ts).
 */

const run = (events: ClawEvent[], from: ClawState = CLAW_START) => events.reduce((s, e) => clawStep(s, e), from);
const stages = (events: ClawEvent[]) => {
  const out: string[] = [];
  let s = CLAW_START;
  for (const e of events) {
    s = clawStep(s, e);
    if (out[out.length - 1] !== s.stage) out.push(s.stage);
  }
  return out;
};
const WIN = { kind: "answer", answer: { won: true, crate: "boss-folio", boss: "folio" } } as const;
const LOSS = { kind: "answer", answer: { won: false, boss: "folio" } } as const;
const PICK = { kind: "pick", boss: "folio", request: "claw-0123456789" } as const;

describe("the claw machine's flow", () => {
  it("a win from the server: insert, the coin, the claw roams, STOP, it drops, lifts, carries to the chute, and the win", () => {
    expect(stages([PICK, WIN, { kind: "coinIn" }, { kind: "stop" }, { kind: "next" }, { kind: "next" }, { kind: "next" }])).toEqual([
      "coin",
      "roam",
      "drop",
      "lift",
      "carry",
      "won",
    ]);
    const s = run([PICK, WIN, { kind: "coinIn" }, { kind: "stop" }, { kind: "next" }, { kind: "next" }, { kind: "next" }]);
    expect(s.answer).toEqual({ won: true, crate: "boss-folio", boss: "folio" });
    expect(clawWonLine("Folio's Boss Crate")).toBe("You won Folio's Boss Crate!");
    // Open now: the crate's own opening; then back to the start.
    expect(clawStep(s, { kind: "open" }).stage).toBe("opening");
    expect(clawStep(clawStep(s, { kind: "open" }), { kind: "again" })).toEqual(CLAW_START);
  });

  it("a loss from the server: it lifts and slips at the top (no carry, no win), then Try again starts over", () => {
    const evs: ClawEvent[] = [PICK, { kind: "coinIn" }, LOSS, { kind: "stop" }, { kind: "next" }, { kind: "next" }, { kind: "next" }];
    expect(stages(evs)).toEqual(["coin", "roam", "drop", "lift", "lost"]);
    const s = run(evs);
    expect(s.stage).toBe("lost");
    expect(clawStep(s, { kind: "open" }).stage).toBe("lost");
    expect(clawStep(s, { kind: "again" })).toEqual(CLAW_START);
  });

  it("the server's answer comes first: the claw doesn't come out until the server has answered (and the coin dropped)", () => {
    const coin = run([PICK, { kind: "coinIn" }]);
    expect(coin.stage).toBe("coin");
    // STOP before the claw is out does nothing.
    expect(clawStep(coin, { kind: "stop" }).stage).toBe("coin");
    expect(clawStep(coin, LOSS).stage).toBe("roam");
    // The answer before the coin's in: still the coin.
    expect(run([PICK, WIN]).stage).toBe("coin");
  });

  it("never a win the server didn't grant: whatever the taps and timers, a loss never reaches the carry or the win", () => {
    const evs: ClawEvent[] = [PICK, LOSS, { kind: "coinIn" }];
    let s = run(evs);
    for (const e of [{ kind: "stop" }, { kind: "stop" }, { kind: "next" }, { kind: "open" }, { kind: "next" }, { kind: "next" }, { kind: "next" }] as ClawEvent[]) {
      s = clawStep(s, e);
      expect(["carry", "won", "opening"]).not.toContain(s.stage);
    }
    // A second answer (a stale one, a win) changes nothing once the first is in.
    expect(clawStep(run([PICK, LOSS]), WIN).answer).toEqual(LOSS.answer);
  });

  it("the stop tap is for show: it changes when the claw drops, not the outcome; with no tap the roam ends anyway (CLAW.roamSeconds)", () => {
    const tapped = run([PICK, WIN, { kind: "coinIn" }, { kind: "stop" }]);
    const timedOut = run([PICK, WIN, { kind: "coinIn" }, { kind: "stop" }]);
    expect(tapped).toEqual(timedOut);
    expect(CLAW.roamSeconds).toBeGreaterThan(0);
  });

  it("refused by the server (no token, a guest, the shop resting): its words, nothing played, and back to the picker", () => {
    const s = run([PICK, { kind: "refused", message: "You need a Folio token." }]);
    expect([s.stage, s.message]).toEqual(["refused", "You need a Folio token."]);
    expect(clawStep(s, { kind: "stop" }).stage).toBe("refused");
    expect(clawStep(s, { kind: "again" })).toEqual(CLAW_START);
    // A refusal after the answer (impossible from one request) changes nothing.
    expect(clawStep(run([PICK, WIN]), { kind: "refused", message: "x" }).stage).toBe("coin");
  });

  it("one play per coin: a pick while a play is on does nothing; each play's id is new", () => {
    const s = run([PICK, WIN]);
    expect(clawStep(s, { kind: "pick", boss: "tiger", request: "claw-other00000" })).toBe(s);
    const ids = new Set(Array.from({ length: 50 }, newRequestId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("the claw roams inside the glass", () => {
    for (let ms = 0; ms < 20_000; ms += 37) {
      const x = roamX(ms);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });
});

describe("the claw machine's sounds", () => {
  it("the coin, the whir, the grab and the thud: numbers only, the same every time, a little under a move's loudness, at phones' and computers' rates", () => {
    expect(CLAW_SOUNDS).toEqual(["coin", "whir", "grab", "thud"]);
    for (const rate of [24000, 44100, 48000]) {
      for (const name of CLAW_SOUNDS) {
        const s = clawSound(name, rate);
        let peak = 0;
        let sum = 0;
        let bad = 0;
        for (const v of s) {
          if (!Number.isFinite(v)) bad++;
          peak = Math.max(peak, Math.abs(v));
          sum += v * v;
        }
        expect(bad, `${name}@${rate}: samples that aren't numbers`).toBe(0);
        expect(clawSound(name, rate), `${name} is the same every time`).toBe(s);
        expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
        const db = 10 * Math.log10(sum / s.length);
        expect(db, name).toBeLessThan(MOVE_MEAN_DB - 2);
        expect(db, name).toBeGreaterThan(MOVE_MEAN_DB - 8);
        expect(s.length).toBeLessThan(rate);
      }
    }
  });
});
