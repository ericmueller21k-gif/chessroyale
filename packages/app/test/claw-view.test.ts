import { describe, expect, it } from "vitest";
import { CLAW } from "@chessroyale/core";
import { CHUTE, CHUTE_MS, COIN_MS, HOME_MS, PILE, clawPose, clawStage, lossOf, newPose, pickCrate, type ClawPlay } from "../src/claw/view.ts";
import type { ClawStage } from "../src/claw/flow.ts";

/**
 * The claw machine as Boingo's Funhouse draws it (Eric, Nov 6: "the real claw machine in the room"): its claw's pose from the play
 * (claw/view.ts), always the server's answer: a win lifts the crate, carries it to the chute and it drops out into the tray; a loss
 * never carries it, and the crate goes back on the pile (or never leaves it). docs/decisions/2026-11-06-boingo-home.md.
 */
const play = (won: boolean | null, request = "claw-test"): ClawPlay => ({ stage: "insert", at: 0, roamAt: 0, dropAt: 0, won, request, open: true });
/** Runs a play through its stages at their real times (the controls' timers), sampling the pose every 20 ms. */
function run(won: boolean, request: string, stopAfter = 2000) {
  const p = play(null, request);
  const out = newPose();
  const seen: { stage: ClawStage; held: boolean; fall: string | null; inTray: boolean; x: number; z: number; down: number }[] = [];
  let t = 0;
  const go = (stage: ClawStage, ms: number) => {
    clawStage(p, stage, t, stage === "coin" ? null : won, request);
    for (let k = 0; k < ms; k += 20) {
      clawPose(p, t + k, out);
      seen.push({ stage, held: out.held, fall: out.fall?.into ?? null, inTray: out.inTray, x: out.x, z: out.z, down: out.down });
    }
    t += ms;
  };
  go("coin", COIN_MS);
  go("roam", stopAfter);
  go("drop", CLAW.dropMs);
  go("lift", CLAW.liftMs);
  if (won) {
    go("carry", CLAW.carryMs);
    go("won", 1000);
  } else go("lost", HOME_MS + 400);
  return seen;
}

describe("the in-room claw follows the server's answer", () => {
  it("a win: it drops, grabs, lifts, carries the crate to the chute, which drops it into the tray", () => {
    const s = run(true, "claw-a");
    expect(s.filter((x) => x.stage === "lift").every((x) => x.held)).toBe(true);
    expect(s.filter((x) => x.stage === "carry").every((x) => x.held)).toBe(true);
    const end = s.filter((x) => x.stage === "carry").at(-1)!;
    expect([end.x, end.z].map((v) => Math.round(v * 100) / 100)).toEqual([CHUTE.x, CHUTE.z]);
    const won = s.filter((x) => x.stage === "won");
    expect(won.some((x) => x.fall === "chute")).toBe(true);
    expect(won.at(-1)!.inTray).toBe(true);
    // (It reached down to the pile first.)
    expect(Math.max(...s.filter((x) => x.stage === "drop").map((x) => x.down))).toBeGreaterThan(0.99);
  });

  it("a loss never carries the crate nor fills the tray: it drops back on the pile partway up, or slips; the claw goes home", () => {
    let drops = 0;
    let slips = 0;
    for (let i = 0; i < 40; i++) {
      const id = `claw-${i}`;
      const s = run(false, id);
      expect(s.some((x) => x.stage === "carry" || x.inTray || x.fall === "chute")).toBe(false);
      const lift = s.filter((x) => x.stage === "lift");
      if (lossOf(id).kind === "slip") {
        slips++;
        expect(lift.some((x) => x.held)).toBe(false);
      } else {
        drops++;
        // Held at first, let go partway up, and it falls back onto the pile.
        expect(lift[0]!.held).toBe(true);
        expect(lift.at(-1)!.held).toBe(false);
        expect(s.some((x) => x.fall === "pile")).toBe(true);
      }
      const home = s.at(-1)!;
      expect([home.x, home.z]).toEqual([CHUTE.x, CHUTE.z]);
    }
    // Usually a drop, sometimes a slip (Eric: "usually drop it").
    expect(drops).toBeGreaterThan(slips);
    expect(slips).toBeGreaterThan(0);
  });

  it("STOP only changes where it drops: the same answer lands the same way wherever it stops", () => {
    for (const stop of [300, 1500, 4000, CLAW.roamSeconds * 1000]) {
      const s = run(true, "claw-b", stop);
      expect(s.filter((x) => x.stage === "won").at(-1)!.inTray).toBe(true);
      const l = run(false, "claw-c", stop);
      expect(l.some((x) => x.inTray)).toBe(false);
    }
  });

  it("the claw stays inside the glass, and goes for a crate of the pile wherever it drops", () => {
    const s = run(true, "claw-d", CLAW.roamSeconds * 1000);
    for (const x of s) expect(x.x >= 0 && x.x <= 1 && x.z >= 0 && x.z <= 1).toBe(true);
    for (let x = 0; x <= 1; x += 0.1) for (let z = 0; z <= 1; z += 0.1) expect(pickCrate(x, z)).toBeLessThan(PILE.length);
    // (The pile keeps clear of the chute's corner.)
    for (const [x, z] of PILE) expect(Math.hypot(x - CHUTE.x, z - CHUTE.z)).toBeGreaterThan(0.25);
  });

  it("the coin drops into the slot while the server answers, and the chute's drop takes CHUTE_MS", () => {
    const p = play(null);
    clawStage(p, "coin", 100, null, "claw-e");
    const o = newPose();
    expect(clawPose(p, 100, o).coin).toBe(0);
    expect(clawPose(p, 100 + COIN_MS, o).coin).toBe(1);
    clawStage(p, "won", 5000, true, "claw-e");
    expect(clawPose(p, 5000 + CHUTE_MS / 2, o).fall?.into).toBe("chute");
    expect(clawPose(p, 5000 + CHUTE_MS + 1, o).inTray).toBe(true);
  });
});
