// A throwaway mockup (not committed): searching, shown in home's own mode rows, for Eric's OK.
import { expect } from "@playwright/test";
import { named, test } from "./helpers.ts";

const OUT = "/tmp/claude-0/-home-user-chessroyale/37426f64-a77b-5541-afaa-1847c6a1f530/scratchpad/banner";

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
    `;
    document.head.appendChild(css);
    // The first row (50 v 50 · 1 v 1 · Squads) becomes the search: same container, its own size.
    const rows = document.querySelectorAll(".fd-ranked .fd-modes, .fd-mode-panel .fd-modes");
    const first = rows[0] as HTMLElement;
    const h = first.getBoundingClientRect().height;
    first.classList.add("mock-search-row");
    first.style.height = `${h}px`;
    first.innerHTML = `<span class="ring"></span><span class="txt"><span class="t1">Searching · 50 v 50</span><span class="t2">Solo queue · 37 of 100 in the lobby</span></span><span class="time">0:42</span>`;
    // The second row (Solo queue · Party · Bots) becomes the actions: the same three buttons, no lines between.
    const second = rows[1] as HTMLElement;
    second.closest('.fd-mode-panel')?.classList.remove('idle');
    second.closest('.fd-mode-panel')?.classList.add('mock-lit');
    const btns = second.querySelectorAll("button");
    const set = (b: Element | undefined, t: string, s: string, cls = "") => {
      if (!b) return;
      b.innerHTML = `${t}<br><span>${s}</span>`;
      b.className = cls;
    };
    set(btns[0], "Start with bots", "play now");
    set(btns[1], "Lobby", "see who's in");
    set(btns[2], "Cancel", "stop searching", "mock-cancel");
    // Greyed: the RANKED label and everything under the two rows. Lit: the top bar, the profile card, the two rows.
    for (const el of document.querySelectorAll(".fd-ranked > .fd-label, .fd-go, .fd-town, .fd-other-label, .rd-pair")) el.classList.add("mock-off");
  });
  await page.screenshot({ path: `${OUT}/rows-${test.info().project.name}.png` });
  // The confirm for "Start with bots".
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.innerHTML = `<div style="position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px">
      <div style="background:var(--fd-panel);border:2px solid var(--fd-line);border-radius:20px;padding:22px 20px 18px;max-width:340px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25)">
        <div style="font-weight:800;font-size:20px;margin-bottom:6px">Play with bots?</div>
        <div style="color:var(--fd-sub);font-size:15px;margin-bottom:18px">This stops your player search and starts a 50 v 50 with bots now.</div>
        <div style="display:flex;gap:10px"><button style="flex:1;height:48px;border-radius:14px;border:2px solid var(--fd-line);background:var(--fd-bg);font-weight:800;font-size:16px">Keep searching</button>
        <button style="flex:1;height:48px;border-radius:14px;border:0;background:var(--fd-green);color:#fff;font-weight:800;font-size:16px">Play with bots</button></div></div></div>`;
    document.body.appendChild(d);
  });
  await page.screenshot({ path: `${OUT}/rows-bots-${test.info().project.name}.png` });
});
