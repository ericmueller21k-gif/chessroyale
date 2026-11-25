import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The residents host's start.sh (scripts/residents/container; docs/areas/ops.md, "Residents, the host"), run for real by bash
 * against a local repository, with stand-ins for `node` (the program: exits with the codes it's given), `npm` and `sleep` (both
 * write down how they were called; sleep returns at once). The review's m5: exit 75 starts over at once, other exits back off, 78
 * ends the container, SIGTERM reaches the program, and the token's secret reaches node but never npm.
 */

const START = fileURLToPath(new URL("../../../scripts/residents/container/start.sh", import.meta.url));
const SECRET = "not-a-real-secret-for-the-test";
const realSleep = execFileSync("bash", ["-c", "command -v sleep"]).toString().trim();

const STANDINS: Record<string, string> = {
  // The program: each run writes down what it got and exits with the next code in $T/codes ("hang": waits for SIGTERM). Past the
  // last code it stops start.sh itself (SIGTERM to its parent), so a script that should have ended fails the test, never loops.
  node: `#!/bin/bash
n=$(( $(cat "$T/runs" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$T/runs"
echo "node secret=\${CF_ACCESS_CLIENT_SECRET:-unset} commit=\${RESIDENTS_COMMIT:-none} args=$*" >> "$T/log"
code=$(sed -n "\${n}p" "$T/codes")
if [ -z "$code" ]; then echo "node: no more codes" >> "$T/log"; kill -TERM "$PPID"; exit 0; fi
if [ "$code" = hang ]; then
  trap 'echo "node got TERM" >> "$T/log"; exit 0' TERM
  echo ready > "$T/ready"
  while :; do "$REAL_SLEEP" 0.05; done
fi
exit "$code"
`,
  // The install: fails once while $T/npm-fail exists.
  npm: `#!/bin/bash
echo "npm secret=\${CF_ACCESS_CLIENT_SECRET:-unset}" >> "$T/log"
if [ -e "$T/npm-fail" ]; then rm -f "$T/npm-fail"; exit 1; fi
mkdir -p node_modules
`,
  sleep: `#!/bin/bash
echo "sleep $1" >> "$T/log"
`,
};

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** A world for one run: the repository (main, with a lockfile), the stand-ins, a home, and the exit codes the program gives. */
function world(codes: (number | "hang")[]) {
  const T = mkdtempSync(join(tmpdir(), "residents-start-"));
  dirs.push(T);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: join(T, "src"), env: { PATH: process.env.PATH, HOME: T, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" } });
  mkdirSync(join(T, "src"));
  mkdirSync(join(T, "home"));
  mkdirSync(join(T, "bin"));
  writeFileSync(join(T, "src", "package-lock.json"), "{}\n");
  writeFileSync(join(T, "src", ".gitignore"), "node_modules\n");
  git("init", "-q", "-b", "main");
  git("add", ".");
  git("commit", "-qm", "main");
  const commit = git("rev-parse", "HEAD").toString().trim();
  for (const [name, text] of Object.entries(STANDINS)) {
    writeFileSync(join(T, "bin", name), text);
    chmodSync(join(T, "bin", name), 0o755);
  }
  writeFileSync(join(T, "codes"), codes.join("\n") + "\n");
  const env = {
    PATH: `${join(T, "bin")}:${process.env.PATH}`,
    HOME: join(T, "home"),
    T,
    REAL_SLEEP: realSleep,
    RESIDENTS_REPO: `file://${join(T, "src")}`,
    RESIDENTS_ARGS: "--follow-deploys",
    CF_ACCESS_CLIENT_SECRET: SECRET,
  };
  const log = () => (existsSync(join(T, "log")) ? readFileSync(join(T, "log"), "utf8").trim().split("\n") : []);
  return { T, env, commit, log };
}

/** Runs start.sh to its end: its exit code and output (`during` runs once it has started, with its process). */
function run(env: Record<string, string>, during?: (pid: number) => Promise<void>): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [START], { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    // (However it goes wrong, it's gone within 20 s.)
    const limit = setTimeout(() => child.kill("SIGKILL"), 20_000);
    child.stdout.on("data", (b: Buffer) => (out += b.toString()));
    child.stderr.on("data", (b: Buffer) => (out += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(limit);
      resolve({ code, out });
    });
    if (during) void during(child.pid!).catch(reject);
  });
}

describe("the residents host's start.sh", () => {
  it("75 starts over at once, other exits wait 60 s doubling to 15 min, 78 ends it; the secret reaches node, never npm", async () => {
    const { env, commit, log } = world([1, 1, 75, 1, 1, 1, 1, 1, 1, 78]);
    const { code, out } = await run(env);
    expect(code).toBe(78);
    const lines = log();
    expect(lines.filter((l) => l.startsWith("sleep"))).toEqual(["sleep 60", "sleep 120", "sleep 60", "sleep 120", "sleep 240", "sleep 480", "sleep 900", "sleep 900"]);
    const runs = lines.filter((l) => l.startsWith("node"));
    expect(runs).toHaveLength(10);
    for (const r of runs) expect(r).toBe(`node secret=${SECRET} commit=${commit} args=--import tsx scripts/residents/run.ts --follow-deploys`);
    // (Installed once: the lockfile didn't change. npm never had the secret.)
    expect(lines.filter((l) => l.startsWith("npm"))).toEqual(["npm secret=unset"]);
    expect(out).toContain("a new version is live: starting over");
    expect(out).toContain("the program exited with 1: again in 60 s");
    expect(out).toContain("Access turned the token away: ending the container");
    expect(out).not.toContain(SECRET);
  }, 30_000);

  it("a failed fetch or install says so (not \"the program exited\"), and tries again on the same schedule", async () => {
    const { T, env, log } = world([78]);
    writeFileSync(join(T, "npm-fail"), "");
    const { code, out } = await run(env);
    expect(code).toBe(78);
    expect(out).toContain("couldn't fetch or install main: again in 60 s");
    expect(out).not.toContain("the program exited");
    expect(log()).toEqual(["npm secret=unset", "sleep 60", "npm secret=unset", expect.stringMatching(/^node secret=/)]);
  }, 30_000);

  it("SIGTERM (the Worker stopping it) goes to the program, which ends its games; then it exits 0", async () => {
    const { T, env, log } = world(["hang"]);
    const { code, out } = await run(env, async (pid) => {
      for (let i = 0; i < 200 && !existsSync(join(T, "ready")); i++) await new Promise((r) => setTimeout(r, 50));
      process.kill(pid, "SIGTERM");
    });
    expect(code).toBe(0);
    expect(out).toContain("host: stopping");
    expect(log()).toContain("node got TERM");
    expect(log().some((l) => l.startsWith("sleep"))).toBe(false);
  }, 30_000);
});
