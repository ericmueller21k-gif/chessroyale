import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { RESIDENTS, mulberry32 } from "@chessroyale/core";
import { ICONS, cleanName } from "../src/accounts.ts";
import { profileOf, profilesFor } from "../../../scripts/residents/profiles.ts";
import { DAY, HOUR, MINUTE, Scheduler, isWeekend, localDay, localHour, planDay, targetAt } from "../../../scripts/residents/schedule.ts";
import { chooseZone, gamePlan, material, materialEdge, shouldResign, thinkMs } from "../../../scripts/residents/play.ts";
import { ACCESS_REFUSED_EXIT, NEW_VERSION_EXIT, drainOver, firstVersion, otherProgram, versionCall } from "../../../scripts/residents/lifecycle.ts";
import { maiaEnv } from "../../sim/src/maia-process.ts";

// The residents' program (scripts/residents; docs/areas/ops.md "Residents"): its names, profiles, schedule and play rules. The program's
// network side is proven by a run against a local server (the PR's proof), not here.

const names = JSON.parse(readFileSync(new URL("../../../scripts/residents/names.json", import.meta.url), "utf8")) as string[];
const profiles = profilesFor(names, RESIDENTS.accounts);
// (A fixed Wednesday, so the tests don't move with the calendar: 2026-11-25.)
const DAY0 = Math.floor(Date.UTC(2026, 10, 25) / DAY);

describe("residents' names", () => {
  it("are 200 handles, all different, each one the server keeps as it is", () => {
    expect(names).toHaveLength(RESIDENTS.accounts);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    for (const n of names) {
      expect(n).toMatch(/^[A-Za-z0-9_]{3,16}$/);
      expect(cleanName(n)).toBe(n);
    }
  });

  it("never say what they are", () => {
    for (const n of names) expect(n.toLowerCase()).not.toMatch(/bot|resident|npc|fake/);
  });

  it("use icons from the free set every account may pick", () => {
    for (const i of RESIDENTS.icons) expect(ICONS as readonly string[]).toContain(i);
  });
});

describe("residents' profiles", () => {
  it("are fixed by the name", () => {
    expect(profileOf("quietrook", 2)).toEqual(profileOf("quietrook", 2));
    expect(profilesFor(names, 5).map((p) => p.name)).toEqual(names.slice(0, 5));
  });

  it("rate along the bots' bell curve: 600 to 2200 in steps of 100, around 1150", () => {
    const r = profiles.map((p) => p.rating);
    for (const x of r) {
      expect(x % 100).toBe(0);
      expect(x).toBeGreaterThanOrEqual(600);
      expect(x).toBeLessThanOrEqual(2200);
    }
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    expect(mean).toBeGreaterThan(1050);
    expect(mean).toBeLessThan(1250);
  });

  it("live mostly in the Americas, then Europe, then Asia and Oceania", () => {
    const by = (name: string) => profiles.filter((p) => p.region === name).length;
    expect(by("americas")).toBeGreaterThan(by("europe"));
    expect(by("europe")).toBeGreaterThan(by("elsewhere"));
    for (const p of profiles) expect(RESIDENTS.regions.find((r) => r.name === p.region)!.offsets).toContain(p.utcOffset);
  });

  it("are mostly normal, with every other behavior present, and keen between 0.3 and 0.9", () => {
    const n = (b: string) => profiles.filter((p) => p.behavior === b).length;
    expect(n("normal")).toBeGreaterThan(120);
    for (const b of Object.keys(RESIDENTS.behaviors)) expect(n(b)).toBeGreaterThan(0);
    for (const p of profiles) {
      expect(p.keenness).toBeGreaterThanOrEqual(0.3);
      expect(p.keenness).toBeLessThanOrEqual(0.9);
      if (p.behavior === "slow") expect(p.zone).toBe("rapid");
    }
  });
});

describe("the schedule", () => {
  it("reads local hours, days and weekends", () => {
    const t = Date.UTC(2026, 10, 25, 23, 30); // Wednesday 23:30 UTC
    expect(localHour(t, 0)).toBe(23);
    expect(localHour(t, 2)).toBe(1);
    expect(localHour(t, -8)).toBe(15);
    expect(localDay(t, 2)).toBe(localDay(t, 0) + 1);
    expect(isWeekend(Date.UTC(2026, 10, 28, 12), 0)).toBe(true); // Saturday
    expect(isWeekend(Date.UTC(2026, 10, 30, 12), 0)).toBe(false); // Monday
    expect(isWeekend(Date.UTC(2026, 10, 27, 23), 2)).toBe(true); // Friday 23:00 UTC is Saturday 01:00 two hours east
  });

  const plan = planDay(profiles, DAY0, 30);

  it("plans the same day the same way (a restart picks up the same sessions)", () => {
    expect(planDay(profiles, DAY0, 30)).toEqual(plan);
    expect(planDay(profiles, DAY0 + 1, 30)).not.toEqual(plan);
  });

  it("gives sessions of 10 to 60 minutes, never two at once for a resident, rested between, at most 6 hours a local day", () => {
    const byResident = new Map<number, typeof plan>();
    for (const s of plan) {
      const min = (s.end - s.start) / MINUTE;
      expect(min).toBeGreaterThan(0);
      expect(min).toBeLessThanOrEqual(RESIDENTS.sessionMinutes.max);
      byResident.set(s.resident, [...(byResident.get(s.resident) ?? []), s]);
    }
    for (const [r, list] of byResident) {
      const sorted = [...list].sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.start - sorted[i - 1]!.end).toBeGreaterThanOrEqual(RESIDENTS.restMinutes * MINUTE);
      const perDay = new Map<number, number>();
      for (const s of sorted) {
        const d = localDay(s.start, profiles[r]!.utcOffset);
        perDay.set(d, (perDay.get(d) ?? 0) + (s.end - s.start) / MINUTE);
      }
      for (const m of perDay.values()) expect(m).toBeLessThanOrEqual(RESIDENTS.maxMinutesPerDay);
    }
  });

  it("keeps about the target online, in waves between half and 1.8 times it", () => {
    const s = new Scheduler(profiles, 30);
    const counts: number[] = [];
    for (let t = DAY0 * DAY; t < (DAY0 + 1) * DAY; t += 10 * MINUTE) counts.push(s.runningAt(t).size);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(mean).toBeGreaterThan(25);
    expect(mean).toBeLessThan(37);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...counts)).toBeLessThanOrEqual(30 * RESIDENTS.wave.max + RESIDENTS.startsPerMinute);
    // (Waves, not a flat line.)
    expect(Math.max(...counts) - Math.min(...counts)).toBeGreaterThanOrEqual(12);
    for (let t = DAY0 * DAY; t < (DAY0 + 1) * DAY; t += HOUR) {
      const want = targetAt(profiles, t, 30);
      expect(want).toBeGreaterThanOrEqual(15);
      expect(want).toBeLessThanOrEqual(54);
    }
  });

  it("joins two days without a gap or a doubling at midnight", () => {
    const s = new Scheduler(profiles, 30);
    const midnight = (DAY0 + 1) * DAY;
    const before = s.runningAt(midnight - MINUTE).size;
    const after = s.runningAt(midnight + 5 * MINUTE).size;
    expect(after).toBeGreaterThanOrEqual(Math.floor(before * 0.6));
    expect(after).toBeLessThanOrEqual(Math.ceil(before * 1.6) + 3);
  });

  it("never asks for more residents than there are", () => {
    const few = profilesFor(names, 10);
    for (const s of planDay(few, DAY0, 30)) expect(s.resident).toBeLessThan(10);
    expect(new Scheduler(few, 30).runningAt(DAY0 * DAY + 20 * HOUR).size).toBeLessThanOrEqual(10);
  });
});

describe("how a resident plays", () => {
  const rng = mulberry32(7);
  const base = { clockMs: 180_000, incrementMs: 2000, inCheck: false, close: false, behavior: "normal" as const };

  it("counts material", () => {
    expect(material("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toEqual({ w: 39, b: 39 });
    expect(materialEdge("4k3/8/8/8/8/8/8/3QK3 w - - 0 1", "w")).toBe(9);
    expect(materialEdge("4k3/8/8/8/8/8/8/3QK3 w - - 0 1", "b")).toBe(-9);
  });

  it("makes its first move well inside the 20 s rule", () => {
    for (let i = 0; i < 200; i++) {
      const ms = thinkMs({ ...base, ply: i % 2 }, rng);
      expect(ms).toBeGreaterThanOrEqual(RESIDENTS.duel.firstMoveMs[0]);
      expect(ms).toBeLessThanOrEqual(RESIDENTS.duel.firstMoveMs[1]);
    }
  });

  it("thinks within its clock, keeping a margin before the flag", () => {
    for (let i = 0; i < 2000; i++) {
      const clockMs = 2000 + rng() * 600_000;
      const ms = thinkMs({ ...base, ply: 2 + (i % 120), clockMs, inCheck: i % 3 === 0, close: i % 5 === 0 }, rng);
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThanOrEqual(Math.max(0, clockMs - RESIDENTS.duel.safetyMs));
    }
  });

  it("spends more of its clock in a long game than a short one, and a slow resident more again", () => {
    const avg = (x: Partial<Parameters<typeof thinkMs>[0]>) => {
      let sum = 0;
      for (let i = 0; i < 3000; i++) sum += thinkMs({ ...base, ply: 30, ...x }, rng);
      return sum / 3000;
    };
    const bullet = avg({ clockMs: 60_000, incrementMs: 1000 });
    const rapid = avg({ clockMs: 600_000, incrementMs: 5000 });
    expect(rapid).toBeGreaterThan(bullet * 3);
    expect(avg({ clockMs: 600_000, incrementMs: 5000, behavior: "slow" })).toBeGreaterThan(rapid * 1.5);
  });

  it("resigns only clearly lost games, late, and later the weaker it is; a rage-quitter sooner (Eric, Nov 25: not so fast)", () => {
    const count = (edge: number, moves: number, behavior: "normal" | "rageQuit", rating: number) => {
      let n = 0;
      for (let i = 0; i < 2000; i++) if (shouldResign(edge, moves, behavior, rating, rng)) n++;
      return n;
    };
    // Never: a small deficit, or early in the game.
    expect(count(-2, 40, "normal", 1800)).toBe(0);
    expect(count(-9, 12, "normal", 1800)).toBe(0);
    expect(count(-9, 19, "normal", 1800)).toBe(0);
    // A 1000 plays on down a rook and more; down a queen and a rook late, now and then.
    expect(count(-12, 40, "normal", 1000)).toBe(0);
    expect(count(-15, 29, "normal", 1000)).toBe(0);
    expect(count(-15, 30, "normal", 1000)).toBeGreaterThan(0);
    // A 1400: down 10 from move 25. A 1800: down 7 from move 20.
    expect(count(-9, 30, "normal", 1400)).toBe(0);
    expect(count(-10, 25, "normal", 1400)).toBeGreaterThan(0);
    expect(count(-7, 20, "normal", 1800)).toBeGreaterThan(0);
    // The weaker the resident, the rarer at the same spot.
    expect(count(-15, 40, "normal", 1000)).toBeLessThan(count(-15, 40, "normal", 1800));
    // A rage-quitter: down 6 from move 12.
    expect(count(-6, 11, "rageQuit", 1000)).toBe(0);
    expect(count(-6, 12, "rageQuit", 1000)).toBeGreaterThan(0);
  });

  it("votes for its favorite time control most of the time", () => {
    const p = profiles.find((x) => x.zone === "rapid")!;
    let same = 0;
    for (let i = 0; i < 1000; i++) if (chooseZone(p, rng) === "rapid") same++;
    expect(same).toBeGreaterThan(800);
  });

  it("acts out its behavior: only AFK residents skip moves, only leavers walk away", () => {
    const tally = { noShow: 0, stall: 0, leave: 0, drop: 0 };
    for (const b of ["normal", "slow", "chatty", "rageQuit"] as const) {
      for (let i = 0; i < 500; i++) {
        const g = gamePlan(b, rng);
        expect(g.noShow || g.stallAfter !== null || g.leaveAfter !== null).toBe(false);
        if (g.dropAfter !== null) tally.drop++;
      }
    }
    for (let i = 0; i < 2000; i++) {
      const afk = gamePlan("afk", rng);
      if (afk.noShow) tally.noShow++;
      if (afk.stallAfter !== null) tally.stall++;
      if (gamePlan("leaver", rng).leaveAfter !== null) tally.leave++;
    }
    expect(tally.noShow / 2000).toBeGreaterThan(0.04);
    expect(tally.noShow / 2000).toBeLessThan(0.13);
    expect(tally.stall).toBeGreaterThan(0);
    expect(tally.leave / 2000).toBeGreaterThan(0.06);
    expect(tally.leave / 2000).toBeLessThan(0.14);
    expect(tally.drop / 2000).toBeGreaterThan(0.005);
    expect(tally.drop / 2000).toBeLessThan(0.04);
  });
});

describe("the program on the host (lifecycle.ts)", () => {
  const OLD = "aaaaaaaaaaaa";
  const OWN = "bbbbbbbbbbbb";
  const NEXT = "cccccccccccc";

  it("exit codes start.sh acts on: 75 a new version (start over), 78 Access refused (end the container)", () => {
    expect([NEW_VERSION_EXIT, ACCESS_REFUSED_EXIT]).toEqual([75, 78]);
  });

  it("a new version live: drain; the same one, or no answer: nothing", () => {
    expect(versionCall(OLD, null, NEXT)).toEqual({ start: OLD, drainTo: NEXT });
    expect(versionCall(OLD, null, OLD)).toEqual({ start: OLD, drainTo: null });
    expect(versionCall(OLD, OWN, null)).toEqual({ start: OLD, drainTo: null });
    // (Off the host, no version read yet: the first one read is the start.)
    expect(versionCall(null, null, OLD)).toEqual({ start: OLD, drainTo: null });
  });

  it("its own commit going live (main was ahead of the live version at its start): no drain, and that's its start now (the review's m1)", () => {
    expect(versionCall(OLD, OWN, OWN)).toEqual({ start: OWN, drainTo: null });
    expect(versionCall(OWN, OWN, NEXT)).toEqual({ start: OWN, drainTo: NEXT });
  });

  it("the start version: the live one, or its own commit when that first read fails", () => {
    expect(firstVersion(OLD, OWN)).toBe(OLD);
    expect(firstVersion(null, OWN)).toBe(OWN);
    expect(firstVersion(null, null)).toBeNull();
  });

  it("the drain ends once no resident is busy, or when drainMinutes are up", () => {
    const since = 1_000_000;
    expect(drainOver(since, since + 1000, false, 20)).toBe("finished");
    expect(drainOver(since, since + 19 * 60_000, true, 20)).toBeNull();
    expect(drainOver(since, since + 20 * 60_000, true, 20)).toBe("time up");
  });

  it("another program: a beat within 2 x beatSeconds that didn't say it stopped (two would sign each other's residents out: M3)", () => {
    const now = 10_000_000;
    const beat = (ago: number, extra: object = {}) => ({ at: now - ago, by: "access:test", beat: { instance: "1a2b3c4d", ...extra } });
    expect(otherProgram(beat(30_000), now, 60)).toBe("instance 1a2b3c4d (by access:test) sent a heartbeat 30 s ago");
    expect(otherProgram(beat(119_000), now, 60)).not.toBeNull();
    expect(otherProgram(beat(120_000), now, 60)).toBeNull();
    // (A clean stop's last beat says so: the host's restart after a deploy starts at once.)
    expect(otherProgram(beat(5_000, { stopped: true }), now, 60)).toBeNull();
    expect(otherProgram(beat(5_000, { stopped: false }), now, 60)).not.toBeNull();
    // (A beat from before instance ids: still another program.)
    expect(otherProgram({ at: now - 5_000, by: "access:residents", beat: {} }, now, 60)).toMatch(/^instance unknown \(by access:residents\)/);
    expect(otherProgram(null, now, 60)).toBeNull();
  });

  it("Maia's process gets no secret (the residents' token), and the rest of the environment", () => {
    const env = maiaEnv({ PATH: "/usr/bin", HOME: "/home/node", CF_ACCESS_CLIENT_ID: "id.access", CF_ACCESS_CLIENT_SECRET: "not-real", CF_ACCESS_CLIENT_SECRET2: "x", CLOUDFLARE_API_TOKEN: "y" });
    expect(env).toEqual({ PATH: "/usr/bin", HOME: "/home/node", CF_ACCESS_CLIENT_ID: "id.access" });
  });
});
