import { describe, expect, it } from "vitest";
import { aboutTarget, pickPrevious, whyNotHere, type Deployment, type VersionInfo } from "../../../scripts/rollback-pick.ts";

/**
 * `npm run rollback -- previous` (scripts/rollback.ts): the version that was live just before the live code went out,
 * never the bad code under a settings change (saving a variable in the dashboard makes a new version of the same code).
 */

const v = (number: number, trigger = "upload"): VersionInfo => ({ id: `v${number}`, number, at: `2026-10-15T${String(number).padStart(2, "0")}:00:00Z`, trigger });
const deployed = (...vs: VersionInfo[]): Deployment[] => vs.map((x, i) => ({ at: `2026-10-15T${String(i).padStart(2, "0")}:30:00Z`, versions: [{ id: x.id, percentage: 100 }] }));
const lookup = (...vs: VersionInfo[]) => (id: string) => vs.find((x) => x.id === id);

describe("rollback: previous", () => {
  it("bad code (#20), then a pause set to contain it (#21): back to #19, never #20", () => {
    const [a, bad, pause] = [v(19), v(20), v(21, "secret")];
    const c = pickPrevious(deployed(a, bad, pause), lookup(a, bad, pause));
    expect(c.ok && c.target.number).toBe(19);
    expect(c.ok && c.liveCode.number).toBe(20);
    expect(c.ok && c.notes.join(" ")).toMatch(/#21 is a settings change \(secret\) on the code uploaded as #20/);
    expect(c.ok && c.notes.join(" ")).toMatch(/Settings changed since \(#21\) aren't in #19/);
  });

  it("the live version is the latest upload: the one live before it", () => {
    const vs = [v(17), v(18), v(19)];
    const c = pickPrevious(deployed(...vs), lookup(...vs));
    expect(c.ok && c.target.number).toBe(18);
  });

  it("the state just before the bad code went out, even when that was itself a settings change (said so)", () => {
    const vs = [v(17), v(18, "secret"), v(19)];
    const c = pickPrevious(deployed(...vs), lookup(...vs));
    expect(c.ok && c.target.number).toBe(18);
    expect(c.ok && c.notes.join(" ")).toMatch(/#18 is itself a settings change/);
  });

  it("after a rollback (the live version is old code again): the code before that, not the bad one rolled back from", () => {
    const [a, b, bad] = [v(17), v(18), v(20)];
    // #18 live, #20 out, rolled back to #18.
    const c = pickPrevious(deployed(a, b, bad, b), lookup(a, b, bad));
    expect(c.ok && c.target.number).toBe(17);
  });

  it("a settings change after a rollback is still that older code", () => {
    const [a, b, bad, pause] = [v(17), v(18), v(20), v(21, "secret")];
    const c = pickPrevious(deployed(a, b, bad, b, pause), lookup(a, b, bad, pause));
    expect(c.ok && c.liveCode.number).toBe(18);
    expect(c.ok && c.target.number).toBe(17);
  });

  it("nothing to go back to, or an unknown version: says so instead of guessing", () => {
    const one = [v(19)];
    expect(pickPrevious(deployed(...one), lookup(...one)).ok).toBe(false);
    const settingsOnly = [v(19, "secret"), v(20, "secret")];
    expect(pickPrevious(deployed(...settingsOnly), lookup(...settingsOnly))).toEqual({ ok: false, why: expect.stringMatching(/name a version by its id/) });
    expect(pickPrevious(deployed(v(19), v(20)), lookup(v(19))).ok).toBe(false);
    expect(pickPrevious([], lookup()).ok).toBe(false);
  });

  it("a version named by id: a warning if it was never live, or is a settings change", () => {
    const vs = [v(18), v(19)];
    expect(aboutTarget(v(15), deployed(...vs)).join(" ")).toMatch(/#15 wasn't live/);
    expect(aboutTarget(v(18, "secret"), deployed(...vs)).join(" ")).toMatch(/settings change/);
    expect(aboutTarget(v(18), deployed(...vs))).toHaveLength(1);
  });
});

describe("rollback: where a real one may run", () => {
  const tty = { stdin: true, stdout: true };
  it("a plain terminal: yes", () => {
    expect(whyNotHere(tty, {})).toBeNull();
    expect(whyNotHere(tty, { CI: "false" })).toBeNull();
    expect(whyNotHere(tty, { CI: "false", BUILD_ID: "7" })).toBeNull();
  });
  it("not a terminal, or one with CI set (wrangler would answer its own questions yes): no, with the dashboard named", () => {
    expect(whyNotHere({ stdin: false, stdout: true }, {})).toMatch(/^Not a terminal: .*dashboard/);
    expect(whyNotHere({ stdin: true, stdout: false }, {})).toMatch(/^Not a terminal/);
    for (const CI of ["1", "true", "0", "yes"]) expect(whyNotHere(tty, { CI })).toMatch(/^CI is set \(wrangler takes this for CI\): .*dashboard/);
    expect(whyNotHere(tty, { BUILD_NUMBER: "12" })).toMatch(/^BUILD_NUMBER is set/);
    expect(whyNotHere(tty, { CI: "" })).toBeNull();
  });
});
