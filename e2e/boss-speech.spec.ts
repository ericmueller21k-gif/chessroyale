import { expect, type Page } from "@playwright/test";
import { SPEECH } from "@chessroyale/core";
import { engineTop, test } from "./helpers.ts";

/**
 * Speech stays up long enough to read (Eric, Oct 10: Ginger froze his queen, and her text box came and went at once).
 * For one power moment of every boss, alone (solo) on a phone and a computer: the boss's line for it shows in its text
 * box beside it as the moment plays, and stays there, whole and in view, for its full time by the shared rule (about
 * 2.5 s plus 50 ms a character once typed: SPEECH in settings.ts), through the end of the boss's turn and into yours.
 * The God King's opening line is held to the same rule. Every frame is watched, from before the page loads.
 */

/** How long a line must stay fully on screen: typed, then readable (its fade after that isn't counted). */
const minOnScreen = (text: string) => text.length * SPEECH.typeMs + Math.min(SPEECH.maxReadMs, SPEECH.readMs + SPEECH.perCharMs * text.length);

const BOSSES = [
  { id: "gingerbread", name: "Ginger", banner: "FREEZE!" },
  { id: "clown", name: "Boingo", banner: "PIE!" },
  { id: "grex", name: "G-REX", banner: "SPARKLER!" },
  { id: "hollow", name: "Hollow", banner: "DARKNESS!" },
  { id: "bigboy", name: "Big Boy", banner: "TOY BLOCK!" },
] as const;

type Segment = { text: string; inView: boolean; from: number; to: number };

/**
 * Watches every frame from the first: each speech box's line (the boss's text box, the God King's bubble) as segments
 * of frames with the same text, seen whole and in view or not; and when each power banner first showed.
 */
async function watchSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __speech: { boss: Segment[]; king: Segment[]; banners: Record<string, number> } };
    const out = (w.__speech = { boss: [] as Segment[], king: [] as Segment[], banners: {} as Record<string, number> });
    const look = (selector: string) => {
      for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const s = getComputedStyle(el);
        const inView = s.visibility === "visible" && Number(s.opacity) > 0.5 && r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        return { text: el.getAttribute("aria-label") ?? "", inView };
      }
      return null;
    };
    const track = (list: Segment[], seen: { text: string; inView: boolean } | null, now: number) => {
      const last = list[list.length - 1];
      if (seen && last && last.text === seen.text && last.inView === seen.inView && now - last.to < 250) last.to = now;
      else if (seen) list.push({ ...seen, from: now, to: now });
    };
    const frame = () => {
      const now = Date.now();
      track(out.boss, look(".bc-bubble"), now);
      track(out.king, look(".gk-bubble"), now);
      for (const b of document.querySelectorAll(".fight-banner.power-cut .kc-text")) {
        const t = b.textContent ?? "";
        out.banners[t] ??= now;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return () => page.evaluate(() => (window as unknown as { __speech: { boss: Segment[]; king: Segment[]; banners: Record<string, number> } }).__speech);
}

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** Waits for your move, then plays the engine's best allowed move. */
async function playBest(page: Page) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.waitForTimeout(300);
  const { top } = await engineTop(page);
  const move = top[0]?.move ?? null;
  await page.evaluate((mv) => {
    const m = (window as any).match;
    if (m.phase.kind === "play" && mv) m.submit(mv);
  }, move);
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
}

/** The segment where `text` first showed whole and in view, and how long it stayed so without a break. */
function held(list: Segment[], text: string) {
  const i = list.findIndex((s) => s.text === text && s.inView);
  return i < 0 ? null : { from: list[i]!.from, ms: list[i]!.to - list[i]!.from };
}

for (const boss of BOSSES) {
  test(`${boss.name}'s line for its ${boss.banner} stays in its text box, whole and in view, for its full time; so does the God King's`, async ({ page }) => {
    test.setTimeout(4 * 60_000);
    const speech = await watchSpeech(page);
    await page.goto(`/?debug&clock=60&boss=${boss.id}`);
    await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
    await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
    // Best moves until the moment comes (Ginger, Boingo, G-REX and Big Boy as your second turn begins; Hollow after his
    // first move).
    for (let i = 0; i < 4 && !(await speech()).banners[boss.banner]; i++) {
      await playBest(page);
      await expect.poll(async () => !!(await speech()).banners[boss.banner] || (await phase(page)) === "play", { timeout: 60_000 }).toBe(true);
    }
    const bannerAt = (await speech()).banners[boss.banner]!;
    expect(bannerAt, `${boss.banner} showed`).toBeTruthy();
    // The God King's opening line (said as your first move began, long done by now): its full time, whole and in view.
    const king = (await speech()).king.find((s) => s.inView);
    expect(king, "the God King spoke").toBeTruthy();
    const kingHeld = held((await speech()).king, king!.text)!;
    expect(kingHeld.ms, `"${king!.text}" was up whole and in view for ${kingHeld.ms} ms of ${minOnScreen(king!.text)}`).toBeGreaterThanOrEqual(minOnScreen(king!.text) - 120);
    // The boss's line for the moment: the first line in its text box from the moment on (it may wait its turn behind a
    // line already up, never longer than SPEECH.waitMs).
    await expect.poll(async () => (await speech()).boss.find((s) => s.from >= bannerAt - 100 && s.inView)?.text ?? null, { timeout: 15_000 }).not.toBeNull();
    const line = (await speech()).boss.find((s) => s.from >= bannerAt - 100 && s.inView)!.text;
    const first = held((await speech()).boss, line)!;
    expect(first.from - bannerAt).toBeLessThan(SPEECH.waitMs);
    // Its whole time, in view on every frame (nothing replaced or hid it), with your clock running for most of it:
    // the old line was gone with its moment (2.3 s for a freeze), or never left the dock.
    const need = minOnScreen(line);
    await page.waitForTimeout(Math.max(0, first.from + need + 400 - Date.now()));
    const after = held((await speech()).boss, line)!;
    expect(after.ms, `"${line}" was up whole and in view for ${after.ms} ms of ${need}`).toBeGreaterThanOrEqual(need - 120);
    expect(after.ms).toBeGreaterThanOrEqual(2000);
  });
}
