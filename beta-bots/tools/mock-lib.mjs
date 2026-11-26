// Mockup injection for the beta-bots design (CSS/DOM over the live screens). Nothing here is product code.
export const BAND_TEXT = "AI players fill matches while we grow. In ranked, HunBots play like people, not like Stockfish.";
export const CSS = `
.mk-tag{display:inline-flex;align-items:center;flex:none;vertical-align:middle;height:16px;padding:0 5px;border-radius:4px;font:800 10px/14px Archivo,system-ui,sans-serif;letter-spacing:.04em;white-space:nowrap}
.mk-bot{color:var(--fd-muted);border:1px solid color-mix(in srgb,var(--fd-muted) 55%,transparent);background:color-mix(in srgb,var(--fd-muted) 12%,transparent)}
.mk-hun{color:#67e8f9;border:1px solid rgba(34,211,238,.55);background:rgba(34,211,238,.14);letter-spacing:.02em}
:root[data-theme="light"] .mk-hun{color:#0e6b85;border-color:rgba(14,116,144,.5);background:#dff7fb}
.mk-tag.big{height:20px;padding:0 7px;font-size:12px;line-height:18px;border-radius:5px}
.mk-band{display:flex;align-items:center;gap:8px;box-sizing:border-box;width:100%;min-height:38px;padding:5px 10px;border-radius:10px;border:1px solid color-mix(in srgb,var(--fd-gold) 45%,transparent);background:color-mix(in srgb,var(--fd-gold) 10%,var(--fd-panel));color:var(--fd-text);font:500 12px/15px Archivo,system-ui,sans-serif;text-align:left;cursor:pointer}
.mk-band .mk-chip{flex:none;padding:2px 6px;border-radius:5px;background:var(--fd-gold);color:var(--fd-gold-ink);font:900 10px/12px Archivo,system-ui,sans-serif;letter-spacing:.08em}
.mk-band .mk-txt{flex:1;min-width:0}
.mk-band .mk-txt b{font-weight:800;color:#67e8f9}
:root[data-theme="light"] .mk-band .mk-txt b{color:#0e6b85}
.mk-band .mk-more{flex:none;color:var(--fd-gold-text);font:800 16px/1 Archivo,system-ui,sans-serif}
.mk-slot{height:62px;margin-bottom:8px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:6px 12px;border-radius:12px;border:1px solid color-mix(in srgb,var(--fd-gold) 45%,transparent);background:color-mix(in srgb,var(--fd-gold) 10%,var(--fd-panel));cursor:pointer}
.mk-slot .mk-h{margin:0;font:800 12px/1.25 Archivo,system-ui,sans-serif;letter-spacing:.1em;color:var(--fd-gold-text);display:flex;align-items:center;gap:6px}
.mk-slot p{margin:0;font:500 12px/15px Archivo,system-ui,sans-serif;color:var(--fd-text)}
.mk-slot p b{font-weight:800;color:#67e8f9}
:root[data-theme="light"] .mk-slot p b{color:#0e6b85}
.mk-heads{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin:0 auto 10px;max-width:340px;padding:8px 12px;border-radius:12px;background:var(--fd-panel);color:var(--fd-sub);font:600 13px/18px Archivo,system-ui,sans-serif;text-align:center}
.mk-heads strong{color:var(--fd-text)}
.mk-note{position:fixed;right:4px;bottom:4px;opacity:.9;z-index:99999;padding:3px 8px;border-radius:6px;background:#e11d48;color:#fff;font:800 9px/14px system-ui,sans-serif;letter-spacing:.04em;pointer-events:none}
`;

/** Adds the style and a small "MOCKUP" label (so a still is never mistaken for the built game). */
export async function base(page, label = "MOCKUP · beta bots design") {
  await page.evaluate(({ css, label }) => {
    if (!document.getElementById("mk-css")) {
      const s = document.createElement("style");
      s.id = "mk-css";
      s.textContent = css;
      document.head.append(s);
    }
    if (!document.querySelector(".mk-note")) {
      const n = document.createElement("div");
      n.className = "mk-note";
      n.textContent = label;
      document.body.append(n);
    }
  }, { css: CSS, label });
}

export const bandHtml = (txt) =>
  `<span class="mk-chip">BETA</span><span class="mk-txt">${txt.replace("HunBots", "<b>HunBots</b>")}</span><span class="mk-more" aria-hidden="true">›</span>`;

/** A phone's home: the band in the live line's slot (the online count gone). */
export async function phoneHome(page) {
  await base(page);
  await page.evaluate((html) => {
    const live = document.querySelector(".fd-live");
    if (!live) throw new Error("no live line");
    const b = document.createElement("button");
    b.className = "mk-band";
    b.innerHTML = html;
    live.replaceWith(b);
  }, bandHtml(BAND_TEXT));
}

/** A computer's right column: the band in the empty top slot; the live line as activity, no online count. */
export async function computerColumn(page) {
  await base(page);
  await page.evaluate((txt) => {
    const slot = document.querySelector(".rc-slot");
    if (!slot) throw new Error("no slot");
    const d = document.createElement("div");
    d.className = "mk-slot";
    d.innerHTML = `<h2 class="mk-h"><span class="mk-band" style="all:unset"><span class="mk-chip" style="padding:2px 6px;border-radius:5px;background:var(--fd-gold);color:var(--fd-gold-ink);font:900 10px/12px Archivo,system-ui,sans-serif;letter-spacing:.08em">BETA</span></span>About the bots ›</h2><p>${txt.replace("HunBots", "<b>HunBots</b>")}</p>`;
    slot.replaceWith(d);
    const on = document.querySelector(".rc-online");
    if (on) on.innerHTML = `<span class="fd-dot"></span><b>1,284 games</b> in the last 24 h · 9 on now`;
  }, BAND_TEXT);
}

/** The 1 v 1 search: the band under the stage's head; the HunBot heads-up in the room kept for "Few players online". */
export async function stageSearch(page, phone) {
  await base(page);
  await page.evaluate(({ html, phone }) => {
    if (phone) {
      const head = document.querySelector(".dv-st-head");
      const b = document.createElement("button");
      b.className = "mk-band";
      b.style.margin = "6px 0 0";
      b.innerHTML = html;
      head.after(b);
    }
    const foot = document.querySelector(".dv-st-foot");
    const few = foot.querySelector(".dv-few");
    if (few) few.remove();
    const p = document.createElement("div");
    p.className = "mk-heads";
    p.innerHTML = `<span>No one near your level yet.</span> <span>A <span class="mk-tag mk-hun">HunBot</span> steps in at <strong>0:30</strong></span>`;
    foot.prepend(p);
  }, { html: bandHtml(BAND_TEXT), phone });
}

/** The versus moment and the board's strip: the opponent a HunBot (its name, the tag in the rank pill's place). */
export async function hunbotOpponent(page, name = "Velvet Knight") {
  await base(page);
  await page.evaluate((name) => {
    for (const el of document.querySelectorAll(".dv-st-them .dv-st-name, .dv-strip.dv-them .dv-name")) el.textContent = name;
    for (const el of document.querySelectorAll(".dv-st-them .dv-st-rank, .dv-strip.dv-them .dv-rank, .dv-st-them .mk-tag, .dv-strip.dv-them .mk-tag")) {
      const big = el.classList.contains("dv-st-rank") || el.classList.contains("big");
      el.className = `mk-tag mk-hun${big ? " big" : ""}`;
      el.removeAttribute("style");
      el.textContent = "HunBot";
    }
  }, name);
}

/** The two marks side by side: today's bot marks unified as BOT, and the new HunBot tag; each in its places. */
export async function marksSheet(page) {
  await base(page);
  await page.evaluate(() => {
    const bot = `<span class="mk-tag mk-bot">BOT</span>`;
    const hun = `<span class="mk-tag mk-hun">HunBot</span>`;
    const pawn = `<span style="display:inline-block;width:14px;text-align:center;color:var(--fd-text)">♟</span>`;
    const row = (inner, note = "") => `<div style="display:flex;align-items:center;gap:8px;min-height:30px;padding:4px 10px;border-radius:8px;background:var(--fd-panel-2);font:600 13px/18px Archivo,system-ui,sans-serif;color:var(--fd-text)">${inner}${note ? `<span style="margin-left:auto;font:500 11px/14px Archivo,system-ui,sans-serif;color:var(--fd-muted);text-align:right">${note}</span>` : ""}</div>`;
    const where = (items) => `<ul style="margin:0;padding-left:16px;font:500 12px/17px Archivo,system-ui,sans-serif;color:var(--fd-sub)">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    const col = (head, blurb, samples, places) => `<section style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:14px;background:var(--fd-panel);border:1px solid var(--fd-line)">
      <div style="display:flex;align-items:center;gap:10px">${head}</div>
      <p style="margin:0;font:500 12px/17px Archivo,system-ui,sans-serif;color:var(--fd-sub)">${blurb}</p>
      <div style="display:flex;flex-direction:column;gap:6px">${samples}</div>
      <h3 style="margin:4px 0 0;font:800 11px/14px Archivo,system-ui,sans-serif;letter-spacing:.1em;color:var(--fd-muted)">WHERE IT APPEARS</h3>${where(places)}</section>`;
    const left = col(
      `<span class="mk-tag mk-bot big">BOT</span><strong style="font:800 15px/20px Archivo,system-ui,sans-serif;color:var(--fd-text)">Today's lobby bots</strong>`,
      "Fill empty seats. Pick from the engine's top lines at a rating's spread (not Maia). Chess-pun names. One mark replaces today's four (🤖 in Squads, BOT in the chat, the Bot pill on a profile, \"Unranked\" on the bot game's strip).",
      [
        row(`<span style="width:18px;color:var(--fd-muted)">7</span>${pawn}Rookie Ray ${bot}`, "50 v 50 scoreboard"),
        row(`${pawn}Gambit Gus ${bot}`, "Squads list · was 🤖"),
        row(`<b style="color:var(--fd-muted);font-weight:800">Pawnstar</b> ${bot}<span style="color:var(--fd-dim);font-size:11px">2m</span> Good luck, all!`, "Global chat · was BOT"),
        row(`${pawn}Bot ${bot}<span style="margin-left:8px;padding:1px 8px;border:1px solid var(--fd-line);border-radius:6px;font-variant-numeric:tabular-nums">3:00</span>`, "Play a bot (unranked)"),
      ].join(""),
      ["50 v 50, Squads and raid seats (online and Solo)", "Boss Battle's crowd, Chess Town's tables", "1 v 1's Play a bot (unranked)", "the global chat's bot lines, a bot's profile card", "the live window's BOT MATCH (as today)"],
    );
    const right = col(
      `<span class="mk-tag mk-hun big">HunBot</span><strong style="font:800 15px/20px Archivo,system-ui,sans-serif;color:var(--fd-text)">Ranked 1 v 1's beta opponents</strong>`,
      "Maia-3, trained on people's games, run on our server near your level. Steps in after 30 s with no one found. Shown before the game starts. Never on the ladder or a leaderboard.",
      [
        row(`<span style="color:var(--fd-sub)">No one near your level yet. A</span> ${hun} <span style="color:var(--fd-sub)">steps in at <b style="color:var(--fd-text)">0:30</b></span>`, "the search"),
        row(`<span style="display:flex;flex-direction:column;align-items:center;gap:3px;width:100%"><b style="font-size:15px">Velvet Knight</b><span class="mk-tag mk-hun big">HunBot</span></span>`, "versus"),
        row(`${pawn}Velvet Knight ${hun}<span style="margin-left:8px;padding:1px 8px;border:1px solid var(--fd-line);border-radius:6px;font-variant-numeric:tabular-nums">3:00</span>`, "the board's strip"),
        row(`<b style="color:#4ade80">Win</b> vs Velvet Knight ${hun} <span style="color:var(--fd-sub)">+19 · 2h ago</span>`, "your recent games"),
      ].join(""),
      ["the 1 v 1 search (the heads-up), the versus moment", "the board's strip, the end screen's line", "your recent games and its profile card (Report not offered)", "never: the ladder, leaderboards, friends, search, the global chat"],
    );
    const o = document.createElement("div");
    o.id = "mk-sheet";
    o.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--fd-scrim)";
    o.innerHTML = `<div style="width:min(980px,100%);display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:18px;background:var(--fd-bg);border:1px solid var(--fd-line);box-shadow:0 10px 40px rgba(0,0,0,.5)">
      <h2 style="margin:0;font:900 18px/22px Archivo,system-ui,sans-serif;color:var(--fd-text)">Two marks: <span class="mk-tag mk-bot big">BOT</span> and <span class="mk-tag mk-hun big">HunBot</span></h2>
      <div style="display:flex;gap:12px;align-items:stretch">${left}${right}</div></div>`;
    document.body.append(o);
  });
}
