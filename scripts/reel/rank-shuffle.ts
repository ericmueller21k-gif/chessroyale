/**
 * The landing reel's run up the ranks (Eric, Nov 11: "shuffle through all the ranked symbols and names"): every tier's emblem, from
 * the game's own sheet (packages/app/src/emblems/rank-emblems.png, each tier's top division), its name in its own color (core's
 * RANKED_1V1), Wood to Pearlescent quicker and quicker, then Transcendent lands: a flash, its glow and its own loop.
 */
import { readFileSync } from "node:fs";
import { RANKED_1V1 } from "../../packages/core/src/settings.ts";
import { emblemId } from "../../packages/core/src/ranked.ts";
import {
  EMBLEMS,
  EMBLEM_SIZE,
} from "../../packages/app/src/emblems/rank-emblems.ts";

export type ShuffleStep = {
  name: string;
  color: string;
  x: number;
  y: number;
  frames: number;
  ms: number;
  hold: number;
};

/** The steps in order and how long each shows (ms; the last, Transcendent, holds). */
export function shuffleSteps(): {
  sheet: string;
  size: number;
  steps: ShuffleStep[];
} {
  const holds = [380, 320, 270, 230, 200, 180, 170, 230];
  const tiers = [
    ...RANKED_1V1.tiers.map((t) => ({ ...t, id: emblemId(t.name, 1) })),
    ...RANKED_1V1.topTiers.map((t) => ({ ...t, id: emblemId(t.name, null) })),
  ];
  const steps = tiers.map((t, i) => {
    const cell = EMBLEMS[t.id]!;
    return {
      name: t.name,
      color: t.color,
      x: cell.x,
      y: cell.y,
      frames: cell.frames,
      ms: cell.ms,
      hold: holds[i] ?? 4000,
    };
  });
  const sheet = `data:image/png;base64,${readFileSync("packages/app/src/emblems/rank-emblems.png").toString("base64")}`;
  return { sheet, size: EMBLEM_SIZE, steps };
}

/** Runs in the page (page.evaluate): self-contained. Replaces the page with the run up the ranks, from now. */
export async function drawRankShuffle(arg: {
  sheet: string;
  size: number;
  steps: ShuffleStep[];
  wide?: boolean;
}) {
  const { sheet, size, steps, wide = false } = arg;
  const img = new Image();
  img.src = sheet;
  await img.decode();
  await document.fonts.load("22px 'Press Start 2P'");
  document.body.innerHTML = "";
  document.body.style.cssText = "margin:0;background:#101217;overflow:hidden";
  const dpr = devicePixelRatio;
  // The phone's top 700 CSS px, or a computer's 1920 × 1080 (everything in it scaled by K).
  const CSS_W = wide ? 1920 : 390;
  const CSS_H = wide ? 1080 : 700;
  const K = wide ? 1.9 : 1;
  const view = document.createElement("canvas");
  view.width = Math.round(CSS_W * dpr);
  view.height = Math.round(CSS_H * dpr);
  view.style.cssText = `position:fixed;left:0;top:0;width:${CSS_W}px;height:${CSS_H}px`;
  document.body.append(view);
  const c = view.getContext("2d")!;
  const S = dpr * K;
  const EM = 5; // the emblem drawn 5 × its 48 px (times K), in CSS px
  const cx = CSS_W / 2 / K;
  const cy = wide ? 225 : 270;
  const start = performance.now();
  // When each step starts (ms from the start).
  const at: number[] = [];
  steps.reduce((t, s) => (at.push(t), t + s.hold), 0);
  const last = steps.length - 1;
  function frame(now: number) {
    const t = now - start;
    let i = 0;
    while (i < last && t >= at[i + 1]!) i++;
    const step = steps[i]!;
    const since = t - at[i]!;
    const landed = i === last;
    c.setTransform(1, 0, 0, 1, 0, 0);
    // The stage: a dark room with a soft light behind the emblem in its tier's color.
    const bg = c.createRadialGradient(
      cx * S,
      cy * S,
      0,
      cx * S,
      cy * S,
      (wide ? 600 : 330) * S,
    );
    bg.addColorStop(0, "#1d2029");
    bg.addColorStop(1, "#0b0c10");
    c.fillStyle = bg;
    c.fillRect(0, 0, view.width, view.height);
    const glowR = landed ? 170 + 14 * Math.sin(since / 260) : 120;
    const glowA = landed ? 0.75 : 0.35;
    const g = c.createRadialGradient(
      cx * S,
      cy * S,
      0,
      cx * S,
      cy * S,
      glowR * S,
    );
    g.addColorStop(
      0,
      step.color +
        Math.round(glowA * 255)
          .toString(16)
          .padStart(2, "0"),
    );
    g.addColorStop(1, step.color + "00");
    c.fillStyle = g;
    c.fillRect(0, 0, view.width, view.height);
    // Rays turning slowly behind Transcendent.
    if (landed) {
      c.save();
      c.translate(cx * S, cy * S);
      c.rotate(since / 3000);
      c.fillStyle = step.color + "2a";
      for (let k = 0; k < 12; k++) {
        c.rotate((Math.PI * 2) / 12);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(-18 * S, -(wide ? 600 : 300) * S);
        c.lineTo(18 * S, -(wide ? 600 : 300) * S);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    // The emblem: a pop as each one comes in (bigger on the last), its own loop's frame, pixels kept crisp.
    const pop = landed
      ? 1 + 0.35 * Math.max(0, 1 - since / 260)
      : 1 + 0.12 * Math.max(0, 1 - since / 120);
    const fr = step.frames > 1 ? Math.floor(since / step.ms) % step.frames : 0;
    const d = size * EM * pop;
    c.imageSmoothingEnabled = false;
    c.drawImage(
      img,
      step.x + fr * size,
      step.y,
      size,
      size,
      (cx - d / 2) * S,
      (cy - d / 2) * S,
      d * S,
      d * S,
    );
    // Its name, in its tier's color, outlined dark.
    c.font = `${(landed ? 24 : 22) * S}px 'Press Start 2P'`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const ny = (cy + (wide ? 160 : 170)) * S;
    c.lineWidth = 6 * S;
    c.strokeStyle = "#0b0c10";
    c.lineJoin = "round";
    c.strokeText(step.name.toUpperCase(), cx * S, ny);
    c.fillStyle = step.color;
    c.fillText(step.name.toUpperCase(), cx * S, ny);
    // The flash as Transcendent lands.
    if (landed && since < 320) {
      c.fillStyle = `rgba(255,255,255,${0.7 * (1 - since / 320)})`;
      c.fillRect(0, 0, view.width, view.height);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
