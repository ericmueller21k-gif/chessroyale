// A throwaway mockup (not committed): searching, shown in home's own mode rows, for Eric's OK.
import { expect } from "@playwright/test";
import { named, test } from "./helpers.ts";

const OUT = "/tmp/claude-0/-home-user-chessroyale/37426f64-a77b-5541-afaa-1847c6a1f530/scratchpad/banner2";

test("mock: searching in the mode rows", async ({ page }) => {
  await named(page, "Eric");
  await page.goto("/");
  await expect(page.locator(".fd-hero")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const css = document.createElement("style");
    css.textContent = `
      .mock-off { opacity: .38; filter: grayscale(1); pointer-events: none; }
      .mock-search-row { display: flex !important; align-items: center; gap: 12px; padding: 0 16px !important; justify-content: flex-start !important; }
      .mock-search-row .ring { width: 26px; height: 26px; border-radius: 50%; border: 4px solid color-mix(in srgb, var(--fd-green) 25%, transparent);
        border-top-color: var(--fd-green); flex: none; }
      .mock-search-row .txt { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; flex: 1; text-align: left; }
      .mock-search-row .t1 { font-weight: 800; font-size: 1.15em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mock-search-row .t2 { font-size: .85em; color: var(--fd-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mock-lit, .mock-lit button { opacity: 1 !important; color: var(--fd-ink, #1d1d1f) !important; }
      .mock-lit .mock-cancel { color: #dc2626 !important; }
      .mock-lit button span { color: var(--fd-sub) !important; }
      .mock-search-row .time { font-weight: 800; font-size: 1.4em; color: var(--fd-green); font-variant-numeric: tabular-nums; }
      .mock-cancel { color: #dc2626 !important; }
      .mock-lit .mock-ask { font-weight: 800; }
      .mock-lit .mock-yes { color: #dc2626 !important; font-weight: 800; }
      .mock-lit .mock-yes-go { color: var(--fd-green) !important; font-weight: 800; }
    `;
    document.head.appendChild(css);
    // The first row (50 v 50 · 1 v 1 · Squads) becomes the search: same container, its own size.
    const rows = document.querySelectorAll(".fd-ranked .fd-modes, .fd-mode-panel .fd-modes");
    const first = rows[0] as HTMLElement;
    const h = first.getBoundingClientRect().height;
    first.classList.add("mock-search-row");
    first.style.height = `${h}px`;
    first.innerHTML = `<span class="ring"></span><span class="txt"><span class="t1">Searching · 50 v 50</span><span class="t2">Solo queue · 37 of 100 in the lobby</span></span><span class="time">0:42</span>`;
    // The second row (Solo queue · Party · Bots) becomes: Cancel (left) · Lobby · Start with bots. No lines between.
    const second = rows[1] as HTMLElement;
    second.closest('.fd-mode-panel')?.classList.remove('idle');
    second.closest('.fd-mode-panel')?.classList.add('mock-lit');
    const btns = second.querySelectorAll("button");
    const set = (i: number, t: string, s: string, cls = "") => {
      const b = btns[i];
      if (!b) return;
      b.innerHTML = `${t}<br><span>${s}</span>`;
      b.className = cls;
    };
    (window as any).mockSet = set;
    set(0, "Cancel", "stop searching", "mock-cancel");
    set(1, "Lobby", "see who's in");
    set(2, "Start with bots", "play now");
    for (const el of document.querySelectorAll(".fd-ranked > .fd-label, .fd-go, .fd-town, .fd-other-label, .rd-pair")) el.classList.add("mock-off");
  });
  const shot = (n: string) => page.screenshot({ path: `${OUT}/${n}-${test.info().project.name}.png` });
  await shot("rows2");
  // Tap Cancel: the same three slots ask the question.
  await page.evaluate(() => {
    const set = (window as any).mockSet;
    set(0, "Stop search?", "are you sure", "mock-ask");
    set(1, "Yes", "stop", "mock-yes");
    set(2, "No", "keep searching", "mock-no");
  });
  await shot("rows2-cancel");
  // Tap Start with bots: the same pattern.
  await page.evaluate(() => {
    const set = (window as any).mockSet;
    set(0, "Play bots?", "ends your search", "mock-ask");
    set(1, "Yes", "play now", "mock-yes-go");
    set(2, "No", "keep searching", "mock-no");
  });
  await shot("rows2-bots");
});
