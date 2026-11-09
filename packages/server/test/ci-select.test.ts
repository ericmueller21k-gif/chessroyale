import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assign,
  globToRegExp,
  makespan,
  MAX_SHARDS,
  plan,
  projectWeigher,
  readAreas,
  readLiveTimings,
  readModule,
  readTimings,
  select,
  shardCount,
  specFiles,
  traceModule,
  weigher,
} from "../../../e2e/ci-select.mjs";

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
    "e2e/helpers.ts",
    "packages/core/src/crates.ts",
    "packages/server/src/accounts.ts",
    "packages/server/src/ledger.ts",
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

  it.each([".github/workflows/e2e.yml", "e2e/ci-select.mjs", "e2e/ci-shard.mjs", "e2e/ci-summary.ts", "e2e/ci-summary-merge.mjs"])(
    "a CI-only change (%s): the smoke set, not every spec (ci-select's unit tests run in check; main runs everything)",
    (path) => {
      const r = pick(path, "docs/x.md");
      expect(r.full).toBeNull();
      expect(r.specs).toEqual(smoke);
    },
  );

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
  const timings = readTimings(undefined, "");
  const weight = weigher(timings);

  it("as few as the specs need, at least 1, at most 15 (Eric, Nov 6: the repo is public, so more runners cost nothing; 15 since Nov 9), never more than the files", () => {
    expect(shardCount(smoke, () => 100)).toBe(1);
    expect(shardCount(smoke, () => 200)).toBe(2);
    expect(shardCount(["e2e/formats.spec.ts"], () => 5000)).toBe(1);
    expect(shardCount(all, weight)).toBe(MAX_SHARDS);
    expect(MAX_SHARDS).toBe(15);
  });

  it("every spec: 15 shards, each with its own files (every spec file exactly once); otherwise the pull request's files", () => {
    const full = plan({ full: "this is a push run, which tests everything", specs: [], why: [] }, timings, all);
    expect(full.outputs).toMatchObject({ specs: "", total: "15", shards: "[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]" });
    expect(full.outputs.note).toBe(`Every spec file (${all.length}) on 15 shards: this is a push run, which tests everything.`);
    const filters: string[] = JSON.parse(full.outputs.assignment).flatMap((s: string) => s.split(" "));
    expect(filters.sort()).toEqual(all.map((f) => `${f.replaceAll(".", "\\.")}$`).sort());
    const one = plan(pick("packages/app/src/components/Sawyer.tsx"), timings, all);
    expect(one.outputs.specs.split(" ")).toContain("e2e/sawyer.spec.ts");
    expect(JSON.parse(one.outputs.shards)).toEqual(Array.from({ length: Number(one.outputs.total) }, (_, i) => i + 1));
    expect(JSON.parse(one.outputs.assignment).join(" ").split(" ").length).toBe(one.outputs.specs.split(" ").length);
    expect(one.md).toContain("full-e2e");
  });

  it("a file the timings don't know counts as each project's median; an old single number splits evenly", () => {
    const t = projectWeigher({ "e2e/a.spec.ts": { phone: 10, desktop: 0 }, "e2e/b.spec.ts": { phone: 20, desktop: 4 }, "e2e/c.spec.ts": 300 });
    expect([t("e2e/new.spec.ts", "phone"), t("e2e/new.spec.ts", "desktop")]).toEqual([20, 4]);
    expect(t("e2e/c.spec.ts", "desktop")).toBe(150);
    expect(weigher({ "e2e/a.spec.ts": 10, "e2e/b.spec.ts": 20, "e2e/c.spec.ts": 300 })("e2e/new.spec.ts")).toBe(20);
  });

  it("a shard's clock time follows Playwright's order: project by project, files by name, the next job to the first free worker", () => {
    const t = projectWeigher({ "e2e/a.spec.ts": { phone: 10, desktop: 10 }, "e2e/b.spec.ts": { phone: 10, desktop: 10 }, "e2e/z.spec.ts": { phone: 60, desktop: 60 } });
    // Phone: a and b side by side, z after a (70); desktop: a, b and z on the other worker (10 + 10 + 10 + 60 = 90),
    // not the 80 that half the sum would say.
    expect(makespan(["e2e/z.spec.ts", "e2e/a.spec.ts", "e2e/b.spec.ts"], t)).toBe(90);
    expect(makespan(["e2e/a.spec.ts"], t)).toBe(10);
  });

  it("spreads files so the slowest shard ends soonest: on the measured times, within 3% of a perfect split, every file once", () => {
    const time = projectWeigher(timings);
    const shards = assign(all, time, MAX_SHARDS);
    expect(shards.flatMap((s) => s.files).sort()).toEqual([...all].sort());
    const ideal = all.reduce((sum, f) => sum + weight(f), 0) / MAX_SHARDS / 2;
    for (const s of shards) expect(s.seconds).toBeLessThanOrEqual(ideal * 1.03);
    for (const s of shards) expect(s.seconds).toBe(makespan(s.files, time));
    expect(assign(all, time, MAX_SHARDS)).toEqual(shards);
  });

  it("main's last green run's records overlay the committed times, file by file; older records (no projects) are skipped", () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-live-"));
    try {
      mkdirSync(join(dir, "e2e-summary-1"));
      mkdirSync(join(dir, "e2e-summary-2"));
      writeFileSync(join(dir, "e2e-summary-1", "shard-1.json"), JSON.stringify({ projects: { "e2e/sawyer.spec.ts": { phone: 7, desktop: 3 } } }));
      writeFileSync(join(dir, "e2e-summary-2", "shard-2.json"), JSON.stringify({ timings: { "e2e/shop.spec.ts": 5 } }));
      writeFileSync(join(dir, "e2e-summary-2", "shard-2.flaky"), "");
      expect(readLiveTimings(dir)).toEqual({ "e2e/sawyer.spec.ts": { phone: 7, desktop: 3 } });
      const merged = readTimings(undefined, dir);
      expect(merged["e2e/sawyer.spec.ts"]).toEqual({ phone: 7, desktop: 3 });
      expect(merged["e2e/shop.spec.ts"]).toEqual(timings["e2e/shop.spec.ts"]);
      expect(readLiveTimings(join(dir, "missing"))).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("traced modules (areas.json, `traced`): a change followed through the code", () => {
  // A small repo in memory: each file's text before and after the pull request (null: not there).
  const repo = (files: Record<string, [string | null, string | null]>) => ({
    before: (p: string) => files[p]?.[0] ?? null,
    after: (p: string) => files[p]?.[1] ?? null,
    grep: (words: string[]) => Object.keys(files).filter((p) => words.some((w) => new RegExp(`\\b${w}\\b`).test(files[p]?.[1] ?? ""))),
  });
  const same = (text: string): [string, string] => [text, text];
  const SETTINGS = "packages/core/src/settings.ts";
  const settings = (chat: number, autochess: number) =>
    `// Every tunable.\nexport const QUICK_CHAT = { gapMs: ${chat} };\n\nexport const AUTOCHESS = {\n  /** Rounds. */\n  rounds: ${autochess},\n};\n\nexport type Settings = { a: number };\n`;
  const base = {
    "packages/core/package.json": same(JSON.stringify({ name: "@chessroyale/core", exports: { ".": "./src/index.ts" } })),
    "packages/core/src/index.ts": same(`export * from "./settings.ts";\n`),
    // Auto chess's own file reads AUTOCHESS; the lobby (a shared foundation) reads QUICK_CHAT, as does a unit test.
    "packages/app/src/autochess/fight.ts": same(`import { AUTOCHESS } from "@chessroyale/core";\nexport const rounds = () => AUTOCHESS.rounds;\n`),
    "packages/server/src/lobby.ts": same(`import { QUICK_CHAT, type Settings } from "@chessroyale/core";\nexport const gap = () => QUICK_CHAT.gapMs;\n// AUTOCHESS is named here only in a comment.\n`),
    "packages/core/test/chat.test.ts": same(`import { QUICK_CHAT } from "../src/settings.ts";\nexport const x = QUICK_CHAT;\n`),
  };
  const autochess = ["e2e/autochess.spec.ts", "e2e/home-layout.spec.ts"];

  it("a settings key: the specs of the areas whose files read it, plus the smoke set", () => {
    const r = select([SETTINGS], areas, all, repo({ ...base, [SETTINGS]: [settings(3000, 5), settings(3000, 6)] }));
    expect(r.full).toBeNull();
    expect(r.specs).toEqual([...new Set([...smoke, ...autochess])].sort());
    expect(r.why).toEqual([{ path: SETTINGS, runs: "changes AUTOCHESS; used by `packages/app/src/autochess/fight.ts` (AUTOCHESS): Auto chess, the demo" }]);
  });

  it("a settings key a shared foundation reads (or a file in no area): every spec, and the run says which", () => {
    const r = select([SETTINGS], areas, all, repo({ ...base, [SETTINGS]: [settings(3000, 5), settings(3001, 5)] }));
    expect(r.full).toBe("`packages/core/src/settings.ts` changes QUICK_CHAT, which `packages/server/src/lobby.ts` uses: a shared foundation");
    const unknown = { ...base, "packages/app/src/brand-new.ts": same(`import { AUTOCHESS } from "@chessroyale/core";\nexport const n = AUTOCHESS;\n`) };
    expect(select([SETTINGS], areas, all, repo({ ...unknown, [SETTINGS]: [settings(3000, 5), settings(3000, 6)] })).full).toMatch(/brand-new\.ts` uses: not in e2e\/areas\.json$/);
  });

  it("comments and types only: nothing runs but the smoke set", () => {
    const after = settings(3000, 5).replace("/** Rounds. */", "/** Rounds a match lasts. */").replace("a: number", "a: number; b?: string");
    const r = select([SETTINGS], areas, all, repo({ ...base, [SETTINGS]: [settings(3000, 5), after] }));
    expect([r.full, r.specs]).toEqual([null, smoke]);
    expect(r.why[0]?.runs).toBe("changes nothing that runs (comments, types); nothing else uses that");
  });

  it("a change it can't place runs everything: code outside a declaration, a module that doesn't read cleanly, or no diff to read", () => {
    const loose = settings(3000, 5) + "QUICK_CHAT.gapMs = 1;\n";
    expect(select([SETTINGS], areas, all, repo({ ...base, [SETTINGS]: [settings(3000, 5), loose] })).full).toMatch(/code outside any declaration changed/);
    const broken = settings(3000, 6) + "export const S = `never closed;\n";
    expect(select([SETTINGS], areas, all, repo({ ...base, [SETTINGS]: [settings(3000, 5), broken] })).full).toMatch(/doesn't read cleanly/);
    expect(select([SETTINGS], areas, all, repo({ ...base, [SETTINGS]: [null, settings(3000, 5)] })).full).toMatch(/it's new/);
    // (Without the repo, e.g. no base to diff: a shared foundation, as before.)
    expect(select([SETTINGS], areas, all).full).toBe("`packages/core/src/settings.ts` is a shared foundation");
  });

  it("a helper in e2e/helpers.ts: the specs that call it (directly or through another helper), plus the smoke set", () => {
    const HELPERS = "e2e/helpers.ts";
    const helpers = (wait: number) =>
      `import { expect, type Page } from "@playwright/test";\n\nexport async function openTown(page: Page) {\n  await page.goto("/town");\n  await page.waitForTimeout(${wait});\n}\n\nexport async function townAndChat(page: Page) {\n  await openTown(page);\n}\n\nexport const pickMode = async (page: Page) => expect(page).toBeTruthy();\n`;
    const r = select(
      [HELPERS],
      areas,
      all,
      repo({
        [HELPERS]: [helpers(100), helpers(200)],
        "e2e/town.spec.ts": same(`import { openTown } from "./helpers.ts";\ntest("t", async ({ page }) => openTown(page));\n`),
        "e2e/town-chat.spec.ts": same(`import { townAndChat as go } from "./helpers";\ntest("t", async ({ page }) => go(page));\n`),
        "e2e/solo.spec.ts": same(`import { pickMode } from "./helpers.ts";\ntest("t", async ({ page }) => pickMode(page));\n`),
      }),
    );
    expect(r.full).toBeNull();
    expect(r.specs).toEqual([...new Set([...smoke, "e2e/town.spec.ts", "e2e/town-chat.spec.ts"])].sort());
    expect(r.specs).not.toContain("e2e/solo.spec.ts");
  });

  it("a shared module (net.ts): the areas of the files that import what changed; one App.tsx imports runs everything", () => {
    const NET = "packages/app/src/net.ts";
    const net = (ms: number) =>
      `import { crumb } from "./problems.ts";\n\nexport async function lobbyStatus(code: string) {\n  return fetch("/api/lobby/" + code, { signal: AbortSignal.timeout(${ms}) });\n}\n\nexport class NetMatch {\n  open() { crumb("open"); }\n}\n`;
    const files = {
      [NET]: [net(5000), net(4000)] as [string, string],
      "packages/app/src/screens/Lobby.tsx": same(`import { lobbyStatus } from "../net.ts";\nexport const L = () => lobbyStatus("A");\n`),
      "packages/app/src/App.tsx": same(`import { NetMatch } from "./net.ts";\nexport const m = () => new NetMatch();\n`),
    };
    const r = select([NET], areas, all, repo(files));
    expect(r.full).toBeNull();
    expect(r.specs).toEqual(expect.arrayContaining(["e2e/multiplayer.spec.ts", "e2e/lobby-close.spec.ts", ...smoke]));
    expect(r.specs).not.toContain("e2e/home-layout.spec.ts");
    const changedClass = net(5000).replace('crumb("open")', 'crumb("opened")');
    expect(select([NET], areas, all, repo({ ...files, [NET]: [net(5000), changedClass] })).full).toBe(
      "`packages/app/src/net.ts` changes NetMatch, which `packages/app/src/App.tsx` uses: it hands what it gets to every screen (areas.json, `traced.hubs`)",
    );
  });

  it("a changed function's module state is changed too (what reads it, and who uses that)", () => {
    const before = `let current = 0;\nexport function setCurrent(n: number) {\n  current = n;\n}\nexport function getCurrent() {\n  return current;\n}\nexport const LIMIT = 3;\n`;
    expect(traceModule(before, before.replace("current = n;", "current = n + 1;")).names).toEqual(["getCurrent", "setCurrent"]);
    expect(traceModule(before, before.replace("LIMIT = 3", "LIMIT = 4")).names).toEqual(["LIMIT"]);
  });

  it("a constant holding a plain value isn't state: a changed function that names it doesn't change its other readers", () => {
    // (prefs.ts' pattern, Nov 2: each setting a key's name, read by its getter and written to by its setter.)
    const before = `const KEY = "brc.a";\nconst OTHER = "brc.b";\nconst listeners = new Set<() => void>();\nexport function a() {\n  return localStorage.getItem(KEY);\n}\nexport function setA(v: string) {\n  localStorage.setItem(KEY, v);\n}\nexport function b() {\n  return localStorage.getItem(OTHER);\n}\nexport const MAX = 3;\nexport function setB(v: string) {\n  if (v.length < MAX) localStorage.setItem(OTHER, v);\n  listeners.forEach((l) => l());\n}\nexport function onChange(l: () => void) {\n  listeners.add(l);\n}\n`;
    // setA's change: only setA (KEY is a plain string: a(), which reads it, is the same).
    expect(traceModule(before, before.replace("setItem(KEY, v)", "setItem(KEY, v.trim())")).names).toEqual(["setA"]);
    // setB's change: setB, and onChange, which shares the set it might write (a Set isn't a plain value); never a() or b().
    expect(traceModule(before, before.replace("v.length < MAX", "v.length <= MAX")).names).toEqual(["onChange", "setB"]);
    // A plain value changed itself is still followed to what reads it.
    expect(traceModule(before, before.replace('"brc.a"', '"brc.a2"')).names).toEqual(["a", "setA"]);
  });

  it("reads modules as code: strings, templates, regular expressions and JSX don't hide or invent a change", () => {
    const src = `const URL = "https://example.com"; // a comment\nexport const RE = /\\/\\/[a-z]+/g;\nexport const T = \`a \${URL} // not a comment\nexport const NOT_A_DECL = 1\n\`;\nexport const f = (x: number[]) => x[0]! / 2;\n`;
    const m = readModule(src)!;
    expect(m.map((s) => s.kind === "decl" && s.names[0])).toEqual(["URL", "RE", "T", "f"]);
    expect(m[0]?.text).toBe('const URL = "https://example.com";');
    // A change inside the template's text is the template's, not a new declaration's.
    expect(traceModule(src, src.replace("NOT_A_DECL = 1", "NOT_A_DECL = 2")).names).toEqual(["T"]);
    const tsx = `export function A() {\n  return (\n    <p>\n      Don't go to https://x.y/z <b>{n}</b>\n    </p>\n  );\n}\n// Next.\nexport const B = 1;\n`;
    expect(readModule(tsx, "x.tsx")!.map((s) => s.kind === "decl" && s.names[0])).toEqual(["A", "B"]);
    expect(traceModule(tsx, tsx.replace("https://x.y/z", "https://x.y/w"), "x.tsx").names).toEqual(["A"]);
  });

  it("the traced modules are shared foundations too, so without a diff they still run everything", () => {
    const full = areas.full.map(globToRegExp);
    for (const m of areas.traced!.modules) expect(full.some((re) => re.test(m)), m).toBe(true);
    for (const h of areas.traced!.hubs ?? []) expect(full.some((re) => re.test(h)), h).toBe(false);
  });
});
