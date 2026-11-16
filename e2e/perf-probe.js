// What the perf checks measure in the page (e2e/perf.spec.ts and scripts/perf-boss.mjs). Plain JS: the script runs
// under Node without TypeScript.

/**
 * Installed before the app's own scripts (page.addInitScript): counts rAF callbacks, pending timers and audio nodes,
 * and records every frame (its length, the rAF callbacks that ran in it, and what was going on) into
 * window.__perf.frames.
 */
export function instrument() {
  /** Which boss's effect is on screen, if any: a power's moment (its class, "pm-candle"), Lights out, the funhouse's spin. */
  const fxOn = () => {
    const pm = document.querySelector(".power-moment");
    if (pm) return [...pm.classList].find((c) => c.startsWith("pm-")) ?? "moment";
    if (document.querySelector(".lo-board")) return "lightsout";
    if (document.querySelector(".pw-flipping, .pw-turning-cw, .pw-turning-ccw")) return "spin";
    return document.querySelector(".king-attack") ? "king-attack" : "";
  };
  const P = (window.__perf = { raf: 0, frames: [], tag: "", timeouts: new Set(), intervals: new Set(), tSet: 0, iSet: 0, audio: 0, audioOff: 0, contexts: 0 });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => (P.raf++, cb(t)));
  const st = window.setTimeout.bind(window);
  const ct = window.clearTimeout.bind(window);
  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  window.setTimeout = (fn, ms, ...a) => {
    P.tSet++;
    const id = st((...x) => (P.timeouts.delete(id), typeof fn === "function" ? fn(...x) : undefined), ms, ...a);
    P.timeouts.add(id);
    return id;
  };
  window.setInterval = (fn, ms, ...a) => {
    P.iSet++;
    const id = si(fn, ms, ...a);
    P.intervals.add(id);
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => {
    P.timeouts.delete(id);
    P.intervals.delete(id);
    ct(id);
    ci(id);
  };
  const Ctx = window.BaseAudioContext ?? window.AudioContext;
  if (Ctx) {
    for (const k of Object.getOwnPropertyNames(Ctx.prototype)) {
      if (!k.startsWith("create") || typeof Ctx.prototype[k] !== "function" || k === "createPeriodicWave" || k === "createBuffer") continue;
      const f = Ctx.prototype[k];
      Ctx.prototype[k] = function (...a) {
        P.audio++;
        return f.apply(this, a);
      };
    }
    const dis = AudioNode.prototype.disconnect;
    AudioNode.prototype.disconnect = function (...a) {
      P.audioOff++;
      return dis.apply(this, a);
    };
  }
  // Long tasks (over 50 ms on the main thread), as [start, duration] in page time.
  P.longs = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) P.longs.push([e.startTime, e.duration]);
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // (No long-task timing in this browser.)
  }
  let last = 0;
  let lastRaf = 0;
  const loop = (t) => {
    // Each frame: its length, the rAF callbacks in it, what was going on, when it ended, and the boss's effect on screen.
    if (last && !document.hidden) P.frames.push([t - last, P.raf - lastRaf, P.tag || (window.match?.phase?.kind ?? ""), t, fxOn()]);
    last = t;
    lastRaf = P.raf;
    raf(loop);
  };
  raf(loop);
}

/** The page's counts now (run in the page): DOM elements, running animations, pending timers, canvases. */
export function counts() {
  const P = window.__perf;
  return {
    dom: document.getElementsByTagName("*").length,
    anims: document.getAnimations().length,
    timeouts: P.timeouts.size,
    intervals: P.intervals.size,
    tSet: P.tSet,
    audio: P.audio,
    audioOff: P.audioOff,
    canvases: document.getElementsByTagName("canvas").length,
  };
}

/**
 * Long tasks during some frames (`frames` as instrument records them: [length, rAF, tag, end]): those that started
 * inside one of them: how many, and the longest (ms).
 */
export function longStats(longs, frames) {
  const inside = longs.filter(([start]) => frames.some((f) => start >= f[3] - f[0] && start < f[3]));
  return { n: inside.length, max: inside.length ? Math.round(Math.max(...inside.map((l) => l[1]))) : 0 };
}

/** Frame lengths (ms) as p50, p95, the share over 20 ms (a missed 60 Hz refresh: a dropped frame) and the longest. */
export function frameStats(dts) {
  if (!dts.length) return { n: 0, p50: 0, p95: 0, slow: 0, max: 0 };
  const s = [...dts].sort((a, b) => a - b);
  const q = (x) => s[Math.min(s.length - 1, Math.floor(x * s.length))];
  return { n: s.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), slow: +(s.filter((d) => d > 20).length / s.length).toFixed(3), max: +s[s.length - 1].toFixed(0) };
}
