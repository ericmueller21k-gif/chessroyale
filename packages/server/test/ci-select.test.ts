import { describe, expect, it } from "vitest";
import { globToRegExp, MAX_SHARDS, plan, readAreas, readTimings, select, shardCount, specFiles, weigher } from "../../../e2e/ci-select.mjs";

/**
 * CI's e2e plan (e2e/ci-select.mjs, from e2e/areas.json; docs/areas/ops.md, "CI e2e"): a pull request runs the specs of
 * the areas it changes plus the smoke set; a shared foundation, or a path the table doesn't know, runs every spec.
 */

const areas = readAreas();
const all = specFiles();
const smoke = areas.smoke.filter((s) => all.includes(s)).sort();
const pick = (...changed: string[]) => select(changed, areas, all);
const KIT = "e2e/boss-smoke.spec.ts";

describe("globs", () => {
  it("* stays in its folder, **/ is any number of folders (none too), a trailing ** is everything below", () => {
    expect(globToRegExp("packages/*/package.json").test("packages/app/package.json")).toBe(true);
    expect(globToRegExp("packages/*/package.json").test("packages/app/sub/package.json")).toBe(false);
    expect(globToRegExp("**/*.md").test("README.md")).toBe(true);
    expect(globToRegExp("**/*.md").test("docs/areas/ops.md")).toBe(true);
    expect(globToRegExp("docs/**").test("docs/a/b/c.ts")).toBe(true);
    expect(globToRegExp("docs/**").test("docsx/a.ts")).toBe(false);
    expect(globToRegExp("packages/app/src/characters/hopper*.ts").test("packages/app/src/characters/hopper-sounds.ts")).toBe(true);
    // A dot is a dot.
    expect(globToRegExp("package.json").test("packageXjson")).toBe(false);
  });
});

describe("a pull request's specs", () => {
  it("one area's file: that area's specs and the smoke set, nothing else", () => {
    const r = pick("packages/app/src/components/Sawyer.tsx");
    expect(r.full).toBeNull();
    expect(r.specs).toEqual([...new Set([...smoke, "e2e/sawyer.spec.ts", "e2e/king-attack.spec.ts", "e2e/boss-speech.spec.ts"])].sort());
    expect(r.why).toEqual([{ path: "packages/app/src/components/Sawyer.tsx", runs: "Sawyer" }]);
  });

  it("docs, unit tests, reports and tools: the smoke set only", () => {
    const r = pick("docs/areas/ops.md", "CLAUDE.md", "packages/core/test/match.test.ts", "packages/server/test/lobby.test.ts", "reports/playtest.md", "scripts/frames-sawyer.mjs");
    expect(r.full).toBeNull();
    expect(r.specs).toEqual(smoke);
  });

  it("the smoke set proves the app boots, a solo battle plays and a lobby works; the boss kit's smoke joins it once it exists", () => {
    expect(areas.smoke).toEqual([KIT, "e2e/front-door.spec.ts", "e2e/boss-character.spec.ts", "e2e/lobby-chat.spec.ts"]);
    expect(select(["docs/x.md"], areas, [...all, KIT]).specs).toContain(KIT);
    expect(select(["docs/x.md"], areas, all.filter((s) => s !== KIT)).specs).not.toContain(KIT);
  });

  it("files of several areas: every one of their specs", () => {
    const r = pick("packages/app/src/components/Hollow.tsx", "packages/chess/src/squads/match.ts");
    expect(r.full).toBeNull();
    expect(r.specs).toEqual(expect.arrayContaining(["e2e/hollow.spec.ts", "e2e/squads-play.spec.ts", "e2e/squads.spec.ts", ...smoke]));
    expect(r.specs).not.toContain("e2e/recluse.spec.ts");
  });

  it("a changed spec runs itself; a removed one adds nothing; the @perf spec never runs on a pull request", () => {
    expect(pick("e2e/castling.spec.ts").specs).toEqual([...smoke, "e2e/castling.spec.ts"].sort());
    const gone = pick("e2e/no-longer-here.spec.ts");
    expect([gone.full, gone.specs]).toEqual([null, smoke]);
    expect(pick("e2e/perf.spec.ts").specs).not.toContain("e2e/perf.spec.ts");
  });
});

describe("every spec (fail-safe)", () => {
  it.each([
    "package.json",
    "package-lock.json",
    "packages/app/package.json",
    "playwright.config.ts",
    "wrangler.jsonc",
    ".github/workflows/e2e.yml",
    "e2e/ci-select.mjs",
    "e2e/helpers.ts",
    "packages/core/src/settings.ts",
    "packages/chess/src/runner.ts",
    "packages/chess/src/protocol.ts",
    "packages/app/src/board/OwnBoard.tsx",
    "packages/app/src/net.ts",
    "packages/server/src/lobby.ts",
    "packages/server/src/fairplay-schema.ts",
  ])("a shared foundation: %s", (path) => {
    const r = pick("packages/app/src/components/Sawyer.tsx", path, "docs/x.md");
    expect(r.full).toBe(`\`${path}\` is a shared foundation`);
    expect(r.specs).toEqual([]);
  });

  it.each(["packages/app/src/brand-new.ts", "packages/app/src/components/NewBoss.tsx", "packages/chess/src/bosses/newboss.ts", "somewhere/new.txt", "e2e/new-helper.ts"])(
    "a path the table doesn't know: %s",
    (path) => {
      const r = pick("packages/app/src/components/Sawyer.tsx", path);
      expect(r.full).toBe(`\`${path}\` isn't in e2e/areas.json`);
      expect(r.why.find((w) => w.path === path)?.runs).toBe("every spec: no area in areas.json has it");
    },
  );
});

describe("the table (e2e/areas.json)", () => {
  it("names only spec files that exist (the boss kit's smoke may still be on its way)", () => {
    const named = [...areas.smoke, ...(areas.leftOut ?? []), ...Object.values(areas.areas).flatMap((a) => a.specs)];
    expect([...new Set(named.filter((s) => !all.includes(s)))].filter((s) => s !== KIT)).toEqual([]);
  });

  it("gives every spec file an area or the smoke set, so a change can run it on a pull request (the @perf ones aside)", () => {
    const reachable = new Set([...areas.smoke, ...(areas.leftOut ?? []), ...Object.values(areas.areas).flatMap((a) => a.specs)]);
    expect(all.filter((s) => !reachable.has(s))).toEqual([]);
  });

  it("every area has paths and specs, and none of its paths is also a shared foundation (that path would run everything)", () => {
    const full = areas.full.map(globToRegExp);
    for (const [name, a] of Object.entries(areas.areas)) {
      expect(a.paths.length, name).toBeGreaterThan(0);
      expect(a.specs.length, name).toBeGreaterThan(0);
      for (const p of a.paths.filter((p) => !p.includes("*"))) expect(full.some((re) => re.test(p)), `${name}: ${p}`).toBe(false);
    }
  });
});

describe("shards", () => {
  const weight = weigher(readTimings());

  it("as few as the specs need, at least 1, at most 5, never more than the files", () => {
    expect(shardCount(smoke, weight)).toBe(1);
    expect(shardCount(["e2e/formats.spec.ts"], () => 5000)).toBe(1);
    expect(shardCount(all, weight)).toBe(MAX_SHARDS);
    expect(MAX_SHARDS).toBe(5);
  });

  it("every spec: 5 shards and no file list (each shard spreads every spec file); otherwise the files", () => {
    const full = plan({ full: "this is a push run, which tests everything", specs: [], why: [] }, weight, all);
    expect(full.outputs).toMatchObject({ specs: "", total: "5", shards: "[1,2,3,4,5]" });
    expect(full.outputs.note).toBe(`Every spec file (${all.length}) on 5 shards: this is a push run, which tests everything.`);
    const one = plan(pick("packages/app/src/components/Sawyer.tsx"), weight, all);
    expect(one.outputs.specs.split(" ")).toContain("e2e/sawyer.spec.ts");
    expect(JSON.parse(one.outputs.shards)).toEqual(Array.from({ length: Number(one.outputs.total) }, (_, i) => i + 1));
    expect(one.md).toContain("full-e2e");
  });

  it("a file the timings don't know counts as their median", () => {
    const w = weigher({ "e2e/a.spec.ts": 10, "e2e/b.spec.ts": 20, "e2e/c.spec.ts": 300 });
    expect(w("e2e/new.spec.ts")).toBe(20);
  });
});
