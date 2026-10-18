import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_ROSTER, isPlayable, type PowerEventKind, type PowerId } from "@chessroyale/core";
import { asAdmin, openBossRaid, submitMove, test } from "./helpers.ts";

/**
 * The shared boss test kit's smoke test (Oct 18; docs/decisions/2026-10-18-boss-test-kit.md): every playable boss in
 * the roster (a new one is covered once he's playable), on a phone: his tile on the Boss raid screen, a battle through
 * the test switches (Boss alone, ?boss=, his passive switched on early with ?power=), his passive at work and his
 * ultimate brought by the admins' trigger, and no page errors. The computer runs the first boss only. Each boss's own
 * spec tests his powers in depth; this only proves that each one starts, works and doesn't break the page.
 */

/** The events that show each passive at work (a boss's passive that isn't here fails the test: add it). */
const PASSIVE_EVENTS: Partial<Record<PowerId, PowerEventKind[]>> = {
  freeze: ["freeze"],
  pie: ["pie"],
  sparkler: ["spark"],
  dark: ["dark"],
  blocks: ["block"],
  cuts: ["cut"],
  drag: ["drag"],
  tusks: ["tusks"],
  leapfrog: ["hop"],
};

const PLAYABLE = BOSS_ROSTER.filter(isPlayable);
const desktop = () => test.info().project.name === "desktop";
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");

/** What the page's boss view has shown, watched every frame from the battle's start: event kinds, ultimates, phases. */
async function watchPowers(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    const t0 = Date.now();
    w.__smoke = { kinds: [] as string[], ults: 0, phases: [] as string[] };
    const look = () => {
      const m = w.match;
      const p = m?.boss?.powers;
      for (const e of p?.events ?? []) if (!w.__smoke.kinds.includes(e.kind)) w.__smoke.kinds.push(e.kind);
      w.__smoke.ults = Math.max(w.__smoke.ults, p?.ults ?? 0);
      const k = m?.phase?.kind;
      if (k && !w.__smoke.phases.at(-1)?.startsWith(`${k}@`)) w.__smoke.phases.push(`${k}@${((Date.now() - t0) / 1000).toFixed(1)}`);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
const seen = (page: Page) => page.evaluate(() => (window as any).__smoke as { kinds: string[]; ults: number; phases: string[] });

/** Your move: a knight to an empty square when it may (the battle lasts), else the first move allowed. */
async function playOne(page: Page) {
  const s = await page.evaluate(() => {
    const m = (window as any).match;
    return m.phase.kind === "play" && Date.now() >= m.phase.startsAt + 300 ? { fen: m.phase.board.fen as string, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null } : null;
  });
  if (!s) return;
  const chess = new Chess(s.fen);
  const legal = chess.moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), knight: m.piece === "n" && !m.captured }));
  const ok = legal.filter((m) => !s.allowed || s.allowed.includes(m.uci)).sort((a, b) => (a.uci < b.uci ? -1 : 1));
  await submitMove(page, (ok.find((m) => m.knight) ?? ok[0])?.uci, s.fen);
}

PLAYABLE.forEach((def, i) => {
  test(`${def.name} (${def.id}): his tile, a battle, his passive and his ultimate, no page errors`, async ({ page }) => {
    test.skip(desktop() && i > 0, "the computer runs the first boss only");
    test.setTimeout(90_000);
    const powers = def.powers!;
    const passive = PASSIVE_EVENTS[powers.passive];
    expect(passive, `add ${def.id}'s passive (${powers.passive}) to PASSIVE_EVENTS in boss-smoke.spec.ts`).toBeTruthy();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await asAdmin(page);
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${def.id}&power=${powers.passive}`);
    // His tile on the Boss raid screen.
    await openBossRaid(page);
    await expect(page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name: def.name, exact: true })).toBeVisible();
    // The battle, through the test switches.
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await expect.poll(() => phase(page), { timeout: 45_000 }).toBe("play");
    await watchPowers(page);
    expect(await page.evaluate(() => (window as any).match.boss.id)).toBe(def.id);
    // His ultimate: the admins' trigger (it comes as the next turn begins, or at the start of his turn).
    const trigger = page.locator(".ult-test");
    await expect(trigger).toBeEnabled();
    await trigger.click();
    // Play on until both have shown.
    const done = async () => {
      const s = await seen(page);
      return s.ults >= 1 && s.kinds.some((k) => passive!.includes(k as PowerEventKind));
    };
    const deadline = Date.now() + 70_000;
    while (!(await done()) && Date.now() < deadline) {
      if ((await phase(page)) === "play") await playOne(page);
      await page.waitForTimeout(250);
    }
    const s = await seen(page);
    if (process.env.SMOKE_DEBUG) console.log(def.id, JSON.stringify(s));
    expect({ passive: s.kinds.some((k) => passive!.includes(k as PowerEventKind)), ultimate: s.ults >= 1, kinds: s.kinds, phases: s.phases }).toMatchObject({ passive: true, ultimate: true });
    // (A moment for anything the last power's moment would throw.)
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });
});
