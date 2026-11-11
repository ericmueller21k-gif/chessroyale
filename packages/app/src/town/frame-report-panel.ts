/**
 * The frame report's two pieces of page (`/town?report`, frame-report.ts): the pill while a run waits or records ("Walk or turn to
 * start" / "● Recording 12 s" with Done), and at the end one panel, the size of the world's box, made to be screenshotted. Made once
 * each (the pill's seconds set at most once a second), never per frame.
 */
import { NP, PART_NAMES, PART_SHORT, type Summary } from "./frame-report.ts";

export interface Device {
  /** The browser and device ("Safari 18.1 · iPhone"). */
  browser: string;
  /** The screen's pixel ratio, and the one the town draws at (capped at 2). */
  ratio: number;
  drawn: number;
  /** The canvas in real pixels. */
  w: number;
  h: number;
  backend: string;
  /** The clock's step (ms). */
  timer: number;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const ms = (x: number) => (x >= 10 ? x.toFixed(0) : x.toFixed(1));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const fps = (x: number) => (x ? Math.round(x).toString() : "–");

/** The panel's text, as HTML (pure but for the strings: the e2e and the stills read it from the page). */
export function panelHtml(s: Summary, d: Device): string {
  const [all, , turn] = s.segs;
  const lines: string[] = [];
  lines.push(`<div class="tfr-head"><b>Town frame report</b><span class="tfr-btns"><button type="button" data-tfr="again">Again</button><button type="button" data-tfr="close">Close</button></span></div>`);
  lines.push(
    `<div class="tfr-dev">${esc(d.browser)} · ratio ${d.ratio} (drawn ${d.drawn}) · ${d.w}×${d.h} px · ${esc(d.backend)} · ${s.refresh ? `~${s.refresh} Hz` : "? Hz"} · timer ${d.timer >= 0.5 ? `${ms(d.timer)} ms` : `${Math.round(d.timer * 1000)} µs`}</div>`,
  );
  lines.push(`<div class="tfr-fps" data-tfr-fps="${Math.round(s.p50)}"><b>${fps(s.p50)}</b> fps median · <b>${fps(s.p5)}</b> 5th % · <b>${fps(s.p1)}</b> 1st % · over 20 ms ${pct(s.over20)} · over 33 ms ${pct(s.over33)}</div>`);
  const part = (k: number, g: { avg: number[] }) => `<b>${esc(PART_NAMES[k]!)}</b> ${ms(g.avg[k]!)}`;
  const most = s.top >= 0 ? `${s.frames} frames in ${s.secs.toFixed(1)} s. Most time: ${part(s.top, all!)} of ${ms(all!.mean)} ms (ours: ${part(s.ours, all!)})` : "No frames recorded";
  const mostTurn = s.topTurn >= 0 ? `. Turning, to ${Math.round(s.maxTurn)}°/s: ${part(s.topTurn, turn!)} of ${ms(turn!.mean)} (ours: ${part(s.oursTurn, turn!)})` : ". No turning";
  lines.push(`<div class="tfr-most">${most}${mostTurn}. ${s.bakes} painted, ${s.uploads} uploads, ${s.resets} atlas resets.</div>`);
  // The parts: the mean ms a frame overall and split, and the worst.
  let t = `<table class="tfr-parts"><thead><tr><th>ms a frame</th>`;
  for (const g of s.segs) t += `<th>${esc(g.name)}</th>`;
  t += `<th>Worst</th></tr><tr class="tfr-sub"><td>frames · fps</td>`;
  for (const g of s.segs) t += `<td>${g.frames} · ${fps(g.fps)}</td>`;
  t += `<td></td></tr></thead><tbody>`;
  for (let k = 0; k < NP; k++) {
    const hot = k === s.top ? " class=\"tfr-hot\"" : "";
    t += `<tr${hot}><td>${esc(PART_NAMES[k]!)}</td>`;
    for (const g of s.segs) t += `<td>${g.frames ? ms(g.avg[k]!) : "–"}</td>`;
    t += `<td>${ms(all!.max[k]!)}</td></tr>`;
  }
  t += `<tr class="tfr-total"><td>Whole frame</td>`;
  for (const g of s.segs) t += `<td>${g.frames ? ms(g.mean) : "–"}</td>`;
  t += `<td>${ms(s.worst[0]?.ms ?? 0)}</td></tr></tbody></table>`;
  lines.push(t);
  let w = `<div class="tfr-worst"><b>Worst 10 frames</b> (ms, when, biggest part, what was happening)<ol>`;
  for (const x of s.worst) w += `<li><b>${ms(x.ms)} ms</b> ${(x.at / 1000).toFixed(1)} s: ${esc(PART_SHORT[x.top]!)} ${ms(x.topMs)} · ${esc(x.what)}</li>`;
  w += `</ol></div>`;
  lines.push(w);
  return lines.join("");
}

/** The pill while a run waits or records; `done` ends the run. */
export function reportPill(parent: HTMLElement, done: () => void): { set(text: string, recording: boolean): void; remove(): void } {
  const el = document.createElement("div");
  el.className = "tfr-pill";
  const label = document.createElement("span");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Done";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    done();
  });
  el.append(label, btn);
  parent.append(el);
  let last = "";
  return {
    set(text, recording) {
      if (text === last) return;
      last = text;
      label.textContent = text;
      el.dataset.state = recording ? "rec" : "wait";
      btn.disabled = !recording;
    },
    remove: () => el.remove(),
  };
}

/** The panel over the world's box; its Again and Close buttons call back. */
export function reportPanel(parent: HTMLElement, s: Summary, d: Device, again: () => void, close: () => void): HTMLElement {
  const el = document.createElement("div");
  el.className = "tfr-panel";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Town frame report");
  el.innerHTML = panelHtml(s, d);
  for (const ev of ["pointerdown", "pointerup", "wheel", "touchstart"]) el.addEventListener(ev, (e) => e.stopPropagation());
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    const k = (e.target as HTMLElement).closest("[data-tfr]")?.getAttribute("data-tfr");
    if (k === "again") again();
    else if (k === "close") close();
  });
  parent.append(el);
  return el;
}
