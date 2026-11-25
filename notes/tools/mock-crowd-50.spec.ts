import { expect, type Page } from "@playwright/test";
import { BOARD_SEL, named, soloFromHome, test } from "./helpers.ts";
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const CSS = `
@media (min-width: 900px) {
  .screen.game.crowd-50 { --bd-room: ${process.env.ROOM ?? 104}px; --crowd-slot: 250px !important; --side-w: ${process.env.RW ?? 300}px !important; --gutter: 14px !important;
    --scr: calc(var(--bd-h) + var(--side-w) + 2 * var(--gutter) + 28px) !important; }
  .arena:not(.sq-arena):has(> .screen.game.crowd-50) > .tower-side { flex: 0 0 ${process.env.LW ?? 340}px !important; }
  .arena:has(> .screen.game.crowd-50) { width: fit-content !important; margin-inline: auto !important; gap: 15px !important; }
  .screen.game.crowd-50 > .hud-row { grid-column: 1 / -1 !important; }
  .screen.game.crowd-50 > .hud-row > .hud { margin: 0 !important; padding: 0 calc(var(--side-w) + 2 * var(--gutter)) 0 0 !important; }
  .screen.game.crowd-50 > .hud-row > .mm { position: absolute !important; right: 0 !important; left: auto !important; }
  .mk-lab { display: inline-flex; flex-direction: column; align-items: center; justify-content: flex-end; line-height: 1.05; margin: 0 14px; }
  .screen.game.crowd-50 > .hud-row > .hud, .screen.game.crowd-50 > .hud-row > .hud .hud-stage, .screen.game.crowd-50 > .hud-row > .hud .hud-stage-text { align-items: flex-end !important; display: flex !important; }
  .screen.game.crowd-50 > .hud-row > .hud .team-chip { align-self: center; }
  .screen.game.crowd-50 > .hud-row > .hud .hud-stage-text > * , .screen.game.crowd-50 > .hud-row > .hud .muted { font-weight: 800; color: inherit; }
  .mk-lab > i { font: 700 10px/1.2 Archivo, system-ui, sans-serif; letter-spacing: .08em; color: var(--fd-sub, #8a8578); font-style: normal; text-transform: uppercase; }
  .screen.game.crowd-50 > .hud-row > .hud { gap: 0 !important; }
  .screen.game.crowd-50 > .hud-row > .hud .hud-dot { display: none; }
  .screen.game.crowd-50 > .hud-row > .hud .hud-cut small { display: none; }
  .mk-pw { display: flex; justify-content: center; margin-bottom: 4px; } .mk-pw .history-nav { width: 100%; }
  .screen.game.crowd-50 .board-area > .opening-name { display: none !important; }
  .screen.game.crowd-50 > .hud-row > .hud .team-chip { display: none !important; }
  .screen.game.crowd-50 { padding-top: 4px !important; margin-top: 0 !important; }
  .screen.game.crowd-50 > .hud-row { margin: 0 0 2px !important; padding: 0 !important; min-height: 0 !important; }
  .arena:not(.sq-arena):has(> .screen.game.crowd-50) > .tower-side { margin-top: 0 !important; }
  .screen.game.crowd-50 > .hud-row { display: flex !important; align-items: flex-end !important; height: 52px !important; overflow: visible !important; margin-bottom: 8px !important; }
  .screen.game.crowd-50 > .hud-row > .hud { flex: 1; align-items: flex-end !important; }
  .mk-lab { height: 40px; justify-content: flex-end !important; }
  .mk-lab > * { line-height: 1 !important; }
  .screen.game.crowd-50 > .hud-row .board-clock { position: static !important; transform: none !important; margin: 0 0 4px 14px !important; align-self: flex-end; }
  .screen.game.crowd-50 > .hud-row > .mm { position: static !important; margin: 0 0 4px 12px !important; align-self: flex-end; }
  .mk-lab { margin: 0 10px !important; }
  .mk-lab > i { white-space: nowrap; font-size: 9px !important; }
  .screen.game.crowd-50 > .hud-row > .hud { font-size: 20px !important; }
  .screen.game.crowd-50 > .hud-row > .hud .hud-score { font-size: 1.15em !important; }
  .screen.game.crowd-50 > .play-footer, .screen.game.crowd-50 > .poll { margin-top: 0 !important; }
  .screen.game.crowd-50 { row-gap: 0 !important; }
  .mk-gear { position: absolute; right: 0; top: 0; }
}`;
for (const [w, h, sc] of [[1536, 730, 1.25], [1920, 960, 1]] as const)
  test(`mock crowd ${w}x${h}`, async ({ browser }) => {
    test.setTimeout(400_000);
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: sc })).newPage();
    await named(page, "Wide Window");
    await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=60&augments=0");
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 120_000 }).toMatch(/^(play|watching)$/);
    await page.waitForTimeout(1500);
    const shot = process.env.SHOTS!;
    await page.screenshot({ path: `${shot}/crowd-${w}x${h}-before.png` });
    await page.addStyleTag({ content: CSS });
    await page.evaluate(() => {
      const nav = document.querySelector(".screen.game.crowd-50 .history-nav");
      const slot = document.querySelector(".screen.game.crowd-50 > .play-footer, .screen.game.crowd-50 > .poll");
      if (nav && slot) { const w = document.createElement("div"); w.className = "mk-pw"; w.appendChild(nav); slot.insertBefore(w, slot.firstChild); }
    });
    await page.evaluate(() => {
      const hud = document.querySelector(".screen.game.crowd-50 > .hud-row > .hud")!;
      const wrap = (el: Element | null, label: string) => { if (!el) return; const w = document.createElement("span"); w.className = "mk-lab"; const i = document.createElement("i"); i.textContent = label; el.parentElement!.insertBefore(w, el); w.append(i, el); };
      let mvWrap: Element | null = null;
      const text = hud.querySelector(".hud-stage-text");
      if (text) { const [mv, nx] = Array.from(text.children) as HTMLElement[]; wrap(mv, "Move"); mvWrap = mv?.parentElement ?? null; if (mv) mv.textContent = mv.textContent!.replace("Move ", ""); wrap(nx, "Next cut"); if (nx) { const long = nx.querySelector(".cd-long")?.textContent; nx.textContent = (long ?? nx.textContent!).replace(/^\s*·\s*/, "").replace(/ next$/, "").replace(/^cut in (\d+)$/, "in $1 moves").replace(/^cut now$/, "now"); } }
      const pc = document.querySelector(".screen.game.crowd-50 .opening-name .pick-count")?.textContent?.replace(" picked", "").trim();
      if (pc && mvWrap) { const v = document.createElement("span"); v.textContent = pc; v.style.fontWeight = "800"; const w = document.createElement("span"); w.className = "mk-lab"; const i = document.createElement("i"); i.textContent = "Picked"; w.append(i, v); mvWrap.after(w); }
      wrap(hud.querySelector(".hud-rank"), "Your place");
      const r = hud.querySelector(".hud-rank"); if (r) r.innerHTML = r.innerHTML.replace(/^P/, "");
      wrap(hud.querySelector(".hud-score"), "Your points");
      wrap(hud.querySelector(".hud-cut"), "Cut line");
      const clk = document.querySelector(".screen.game.crowd-50 .board-clock");
      if (clk) hud.appendChild(clk);
      const mm = document.querySelector(".screen.game.crowd-50 .mm, .gm-tools .mm");
      const slot = document.querySelector(".screen.game.crowd-50 > .play-footer, .screen.game.crowd-50 > .poll") as HTMLElement | null;
      if (mm && slot) { const pw = slot.querySelector(".mk-pw") as HTMLElement | null; if (pw) { pw.style.position = "relative"; pw.style.paddingRight = "44px"; pw.appendChild(mm); (mm as HTMLElement).style.position = "absolute"; (mm as HTMLElement).style.right = "0"; (mm as HTMLElement).style.top = "50%"; (mm as HTMLElement).style.transform = "translateY(-50%)"; } }
      const b = document.querySelector(".board-area .board-row > .board-wrap")!.getBoundingClientRect();
      if (slot) { const st = slot.getBoundingClientRect(); slot.style.marginTop = `${b.top - st.top}px`; }
      const side = document.querySelector(".arena > .tower-side") as HTMLElement | null;
      if (side) { const head = Array.from(side.querySelectorAll("*")).find((e) => /^\s*POS/.test(e.textContent ?? "") && /PLAYER/.test(e.textContent ?? "") && e.getBoundingClientRect().height < 40) as HTMLElement | undefined;
        if (head) { const d = b.top - head.getBoundingClientRect().top; const pt = parseFloat(getComputedStyle(side).paddingTop) || 0; side.style.setProperty("padding-top", `${pt + d}px`, "important"); side.style.setProperty("max-height", `${b.bottom - side.getBoundingClientRect().top}px`, "important"); } }
    });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${shot}/crowd-${w}x${h}-after.png` });
    const m = await page.evaluate((sel) => {
      const cl = document.querySelector(".screen.game.crowd-50 > .play-footer, .screen.game.crowd-50 > .poll")!.getBoundingClientRect();
      const r = (q: string) => document.querySelector(q)?.getBoundingClientRect();
      const b = r(`.board-area .board-row > .board-wrap ${sel}`)!, l = r(".tower-side")!, c = r(".screen.game.crowd-50 > .under-board.side") ?? r(".screen.game.crowd-50 > .play-footer")!;
      return { board: Math.round(b.width), top: Math.round(b.top), foot: Math.round(b.bottom), leftGap: Math.round(b.left - l.right), rightGap: Math.round(cl.left - b.right), pw: Math.round(document.querySelector(".history-nav, .power-row")?.getBoundingClientRect().bottom ?? -1), lTop: Math.round(l.top), lFoot: Math.round(l.bottom), cFoot: Math.round(c.bottom) };
    }, BOARD_SEL.container);
    console.log("MEASURE", w, h, JSON.stringify(m));
  });
