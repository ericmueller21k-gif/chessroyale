import { expect, type Page } from "@playwright/test";
import { SPEECH } from "@chessroyale/core";
import { engineTop, test } from "./helpers.ts";

/**
 * Speech stays up long enough to read (Eric, Oct 10: Ginger froze his queen, and her text box came and went at once).
 * For one power moment of every boss, alone (solo) on a phone and a computer: the boss's line for it shows in its text
 * box beside it as the moment plays, and stays there, whole and in view, for its full time by the shared rule (2.2 s
 * plus 35 ms a character once typed, at most 4.5 s: SPEECH in settings.ts, read here, so the numbers can change
 * without this test), through the end of the boss's turn and into yours.
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

type Segment = { text: string; ok: boolean; why: string; from: number; to: number; before: number };
type Speech = { boss: Segment[]; king: Segment[]; banners: Record<string, number>; gaps: [number, number][] };

/**
 * Watches every frame from the first: each speech box's line (the boss's text box, the God King's bubble) as segments
 * of frames alike (the same text, and whole on screen or not, with why not), and when each power banner first showed.
 * A frame the browser was too busy to paint doesn't split a segment (nothing changed on screen), but is noted.
 */
async function watchSpeech(page: Page) {
  await page.addInitScript(() => {
    const out: Speech = ((window as unknown as { __speech: Speech }).__speech = { boss: [], king: [], banners: {}, gaps: [] });
    const look = (selector: string): { text: string; ok: boolean; why: string } => {
      for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const text = el.getAttribute("aria-label") ?? "";
        const why =
          getComputedStyle(el).visibility !== "visible" ? "hidden"
          : r.top < 0 || r.left < 0 || r.right > innerWidth || r.bottom > innerHeight ? `off screen ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`
          : el.classList.contains("leaving") ? "fading"
          : "";
        return { text, ok: !why, why };
      }
      return { text: "", ok: false, why: "none" };
    };
    let prev = 0;
    const track = (list: Segment[], seen: { text: string; ok: boolean; why: string }, now: number) => {
      const last = list[list.length - 1];
      if (last && last.text === seen.text && last.ok === seen.ok) last.to = now;
      else list.push({ ...seen, from: now, to: now, before: prev || now });
    };
    const frame = () => {
      const now = Date.now();
      if (prev && now - prev > 150) out.gaps.push([prev, now - prev]);
      track(out.boss, look(".bc-bubble"), now);
      track(out.king, look(".gk-bubble"), now);
      for (const b of document.querySelectorAll(".fight-banner.power-cut .kc-text")) out.banners[b.textContent ?? ""] ??= now;
      prev = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return () => page.evaluate(() => (window as unknown as { __speech: Speech }).__speech);
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

/**
 * How long `text` first stayed whole on screen without a break: from its first such frame to the first frame it
 * wasn't (or the last seen), and what came next. A stretch the browser painted nothing just before it showed counts
 * (nothing could be on screen then, the line included: a busy machine, not the app).
 */
function held(list: Segment[], text: string) {
  const i = list.findIndex((s) => s.text === text && s.ok);
  if (i < 0) return null;
  const s = list[i]!;
  const next = list[i + 1];
  const unpainted = Math.max(0, s.from - s.before - 20);
  return { from: s.from, ms: (next?.from ?? s.to) - s.from + unpainted, next: next ? `then ${next.why || "ok"} "${next.text}"` : "still up" };
}
/** The frames the browser didn't paint for a while (ms) between `from` and `to`. */
const gapsIn = (s: Speech, from: number, to: number) => s.gaps.filter(([at]) => at >= from && at <= to).map(([, ms]) => ms);

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
    // The boss's line for the moment: the first line in its text box from the moment on (it may wait its turn behind a
    // line already up, never longer than SPEECH.waitMs).
    await expect.poll(async () => (await speech()).boss.find((s) => s.from >= bannerAt - 100 && s.ok)?.text ?? null, { timeout: 15_000 }).not.toBeNull();
    const line = (await speech()).boss.find((s) => s.from >= bannerAt - 100 && s.ok)!.text;
    const shown = held((await speech()).boss, line)!;
    expect(shown.from - bannerAt).toBeLessThan(SPEECH.waitMs);
    // Its whole time, in view on every frame (nothing replaced or hid it), with your clock running for most of it:
    // the old line was gone with its moment (2.3 s for a freeze), or never left the dock.
    const need = minOnScreen(line);
    await page.waitForTimeout(Math.max(0, shown.from + need + 1200 - Date.now()));
    const end = await speech();
    const after = held(end.boss, line)!;
    expect(after.ms, `"${line}" was up whole and in view for ${after.ms} ms of ${need}, ${after.next} (unpainted: ${gapsIn(end, after.from, after.from + after.ms + 500)})`).toBeGreaterThanOrEqual(need - 120);
    expect(after.ms).toBeGreaterThanOrEqual(2000);
    // …and not much longer (Eric: "a few seconds… not that long"): it starts to fade, or gives way, on time.
    expect(after.ms, `"${line}" was still up whole after ${after.ms} ms (its time: ${need}), ${after.next}`).toBeLessThanOrEqual(need + 1000);
    // The God King's opening line (said as your first move began): its full time too, whole and in view.
    const first = (await speech()).king.find((s) => s.ok);
    expect(first, "the God King spoke").toBeTruthy();
    await page.waitForTimeout(Math.max(0, first!.from + minOnScreen(first!.text) + 400 - Date.now()));
    const now = await speech();
    const kingHeld = held(now.king, first!.text)!;
    expect(kingHeld.ms, `"${first!.text}" was up whole and in view for ${kingHeld.ms} ms of ${minOnScreen(first!.text)}, ${kingHeld.next} (unpainted: ${gapsIn(now, kingHeld.from, kingHeld.from + kingHeld.ms + 500)})`).toBeGreaterThanOrEqual(minOnScreen(first!.text) - 120);
  });
}
