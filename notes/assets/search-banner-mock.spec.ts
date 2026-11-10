// A throwaway mockup (not committed): the "searching" banner over home, for Eric's OK. Run: npx playwright test -c pw-local.config.ts e2e/zz-mock-banner.spec.ts
import { expect } from "@playwright/test";
import { named, test } from "./helpers.ts";

const OUT = "/tmp/claude-0/-home-user-chessroyale/37426f64-a77b-5541-afaa-1847c6a1f530/scratchpad/banner";

test("mock: the searching banner", async ({ page }) => {
  await named(page, "Eric");
  await page.goto("/");
  await expect(page.locator(".fd-hero")).toBeVisible();
  await page.waitForTimeout(1500);
  const phone = test.info().project.name === "phone";
  await page.evaluate((phone) => {
    const live = document.querySelector(".fd-home .fd-live") as HTMLElement | null;
    const hero = document.querySelector(".fd-hero") as HTMLElement;
    const h = hero.getBoundingClientRect();
    const l = (live ?? hero).getBoundingClientRect();
    const top = phone ? l.top - 8 : h.top - 76;
    const bottom = phone ? h.top + 22 : h.top + 22;
    const css = document.createElement("style");
    css.textContent = `
      .mock-search { position: fixed; z-index: 50; display: flex; align-items: center; gap: 12px; padding: 0 12px 0 16px;
        background: var(--fd-panel); border: 2px solid var(--fd-line); border-radius: 18px; box-shadow: 0 6px 18px rgba(0,0,0,.12);
        font-family: inherit; color: var(--fd-ink, #1d1d1f); }
      .mock-search .ring { width: 26px; height: 26px; border-radius: 50%; border: 4px solid color-mix(in srgb, var(--fd-green) 25%, transparent);
        border-top-color: var(--fd-green); flex: none; }
      .mock-search .txt { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; flex: 1; }
      .mock-search .t1 { font-weight: 800; font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mock-search .t1 b { font-variant-numeric: tabular-nums; color: var(--fd-green); }
      .mock-search .t2 { font-size: 14px; color: var(--fd-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mock-search .time { font-weight: 800; font-size: 20px; font-variant-numeric: tabular-nums; }
      .mock-search .x { flex: none; height: 44px; padding: 0 16px; border-radius: 14px; border: 2px solid var(--fd-line);
        background: var(--fd-bg); font-weight: 800; font-size: 15px; color: inherit; }
      .mock-off { opacity: .38; filter: grayscale(1); }
    `;
    document.head.appendChild(css);
    const b = document.createElement("div");
    b.className = "mock-search";
    if (phone) {
      b.style.left = `${h.left}px`;
      b.style.width = `${h.width}px`;
      b.style.top = `${top}px`;
      b.style.height = `${bottom - top}px`;
    } else {
      // A computer: across the top of the two middle columns, over their top edge.
      const right = Math.max(...[...document.querySelectorAll(".fd-play-col, .fd-livewin, .fd-ranked")].map((e) => e.getBoundingClientRect().right));
      b.style.left = `${h.left}px`;
      b.style.width = `${right - h.left}px`;
      b.style.top = `14px`;
      b.style.height = `66px`;
    }
    b.innerHTML = `<span class="ring"></span><span class="txt"><span class="t1">50 v 50 · <b>0:42</b></span><span class="t2">Searching · solo queue</span></span><button class="x">Cancel</button>`;
    document.body.appendChild(b);
    // While queued: the other modes greyed (still in place), the top icons and the shop untouched.
    for (const el of document.querySelectorAll(".fd-modes button, .fd-play, .fd-town, .rd-card, .fd-mode-panel")) el.classList.add("mock-off");
  }, phone);
  await page.screenshot({ path: `${OUT}/banner-${test.info().project.name}.png` });
  // The pop-up when a greyed mode is tapped (Chess Town).
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.innerHTML = `<div style="position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px">
      <div style="background:var(--fd-panel);border:2px solid var(--fd-line);border-radius:20px;padding:22px 20px 18px;max-width:340px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25)">
        <div style="font-weight:800;font-size:20px;margin-bottom:6px">You're in a queue</div>
        <div style="color:var(--fd-sub);font-size:15px;margin-bottom:18px">You're searching for a 50 v 50 game. Cancel the search to go to Chess Town?</div>
        <div style="display:flex;gap:10px"><button style="flex:1;height:48px;border-radius:14px;border:2px solid var(--fd-line);background:var(--fd-bg);font-weight:800;font-size:16px">Keep searching</button>
        <button style="flex:1;height:48px;border-radius:14px;border:0;background:#dc2626;color:#fff;font-weight:800;font-size:16px">Cancel search</button></div></div></div>`;
    document.body.appendChild(d);
  });
  await page.screenshot({ path: `${OUT}/popup-${test.info().project.name}.png` });
});
