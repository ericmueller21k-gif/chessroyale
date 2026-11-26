import { Fragment, type RefObject } from "preact";
import { useImperativeHandle, useLayoutEffect, useRef } from "preact/hooks";
import { END_SCREEN, coinStripView, type XpGrant } from "@chessroyale/core";
import coinUrl from "../coin/coin.png?url";
import { play, warmSounds } from "../sound.ts";

/**
 * The coin strip (Nov 25; the payments design's section 11, docs/decisions/2026-11-17-payments-design.md; the mockup on
 * `stills/coin-reward-mockup`; docs/decisions/2026-11-25-coin-strip.md): right under the XP box on every end screen, its width, in the
 * FF window style, its height from the first paint. When the XP fill ends (EndScreen's sequence calls `play`), one coin for every
 * END_SCREEN.coins.coinPer drops into a pile at its left, the count rolls up like a gas pump (each digit a column moved by `transform`
 * only), and the parts appear as the count reaches them. No coins: greyed, its why centered in it (no pile).
 *
 * Cheap on the GPU: one small canvas, the coin's spin frames drawn once per size, at most coinsMax `drawImage` a frame for about 1.4 s,
 * then one last frame and the loop stops. A skip (a tap), reduced motion or a screen drawn again after it ran: the end at once
 * (`end`; reduced motion with one clink).
 */

export interface CoinStripApi {
  /** The strip's run (resolves at its end, or at once when there's nothing to count). */
  play(): Promise<void>;
  /** The end at once; `clink`: one coin's clink (reduced motion). */
  end(clink: boolean): void;
}

const C = END_SCREEN.coins;
/** How many coins a total drops. */
const coinCount = (total: number) => Math.max(1, Math.min(C.coinsMax, Math.ceil(total / C.coinPer)));
/** When the last coin lands (ms from the start). */
const endAt = (n: number) => (n - 1) * C.coinGapMs + C.fallMs;
/** The count so far at `t`: it follows the coins, from a little into the first fall to the last landing. */
const countAt = (total: number, n: number, t: number) => {
  const from = C.fallMs * 0.6;
  const to = endAt(n);
  return t >= to ? total : total * Math.min(1, Math.max(0, (t - from) / (to - from)));
};

// ---- The coin's drawing: loaded once, its spin frames drawn once per size ----

let coinImg: Promise<HTMLImageElement | null> | null = null;
function loadCoin(): Promise<HTMLImageElement | null> {
  if (!coinImg)
    coinImg = new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = coinUrl;
    });
  return coinImg;
}
/** The spin's widths (a share of the coin's), its thin ones a little darker: its edge. */
const SPIN = [1, 0.8, 0.45, 0.12, 0.45, 0.8];
const spinCache = new Map<number, HTMLCanvasElement[]>();
function spinFrames(img: HTMLImageElement, px: number): HTMLCanvasElement[] {
  const had = spinCache.get(px);
  if (had) return had;
  const frames = SPIN.map((sx) => {
    const c = document.createElement("canvas");
    c.width = c.height = px;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = px < 40;
    const w = Math.max(2, Math.round(px * sx));
    g.drawImage(img, (px - w) / 2, 0, w, px);
    if (sx < 0.5) {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(120, 70, 0, 0.35)";
      g.fillRect(0, 0, px, px);
    }
    return c;
  });
  spinCache.set(px, frames);
  return frames;
}

/** Where coin `i` rests in the pile (a 4-3-2-1 heap at the strip's left, bottom row first), in the canvas's px; `k` its scale. */
const spot = (i: number, H: number, S: number, k: number) => {
  const row = i < 4 ? 0 : i < 7 ? 1 : i < 9 ? 2 : 3;
  const j = i - [0, 4, 7, 9][row]!;
  return { x: (10 + row * 9 + j * 18) * k, y: H - 6 * k - S - row * 12 * k };
};

export function CoinStrip({ xp, none, api }: { xp: XpGrant | null | undefined; none?: string; api: RefObject<CoinStripApi> }) {
  const view = xp === undefined ? null : coinStripView(xp, none);
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const cols = useRef<(HTMLSpanElement | null)[]>([]);
  const partsRef = useRef<HTMLSpanElement>(null);
  /** The time drawn last (ms from the run's start; -1 nothing; Infinity the end), for a redraw at a new size. */
  const drawn = useRef(-1);
  const run = useRef<{ stop: () => void } | null>(null);
  const total = view?.total ?? 0;
  const n = coinCount(total);
  const digits = String(total).length;
  // (Each part shows from where the count enters it: the parts' running sums.)
  const starts = (view?.parts ?? []).reduce<number[]>((a, p, i) => [...a, i ? a[i - 1]! + view!.parts[i - 1]!.coins : 0], []);

  /** The canvas at `t`: the falling coins and the pile; past the end, the pile and a sparkle. (A greyed strip draws nothing.) */
  const paint = (t: number, img: HTMLImageElement | null) => {
    const c = cv.current;
    const b = box.current;
    if (!c || !b || !img) return;
    drawn.current = t;
    const W = b.clientWidth;
    const H = b.clientHeight;
    // (The device's pixels per CSS px, a zoomed column's too (a computer's boss result on a short window): coins drawn crisp, not scaled.)
    const dpr = Math.min(3, (devicePixelRatio || 1) * (b.getBoundingClientRect().height / H || 1));
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const k = H / 72;
    const S = Math.round(24 * k);
    const frames = spinFrames(img, Math.round(S * dpr));
    if (view?.why) return;
    for (let i = 0; i < n; i++) {
      const s = t - i * C.coinGapMs;
      if (s < 0) continue;
      const p = spot(i, H, S, k);
      if (s >= C.fallMs) {
        g.drawImage(frames[0]!, p.x, p.y, S, S);
        continue;
      }
      // (An ease-in fall from above the strip, a small bounce at the end; spinning.)
      const q = s / C.fallMs;
      const y0 = -S;
      const y = q < 0.85 ? y0 + (p.y - y0) * (q / 0.85) ** 2 : p.y - Math.sin(((q - 0.85) / 0.15) * Math.PI) * 5 * k;
      g.drawImage(frames[Math.floor(s / 60) % frames.length]!, p.x, y, S, S);
    }
    if (t >= endAt(n)) {
      g.fillStyle = "#fff";
      for (const [x, y] of [
        [76, 12],
        [6, 26],
      ] as const) {
        g.fillRect(x * k, (y - 3) * k, 2 * k, 8 * k);
        g.fillRect((x - 3) * k, y * k, 8 * k, 2 * k);
      }
    }
  };

  /** The count at `v` (0 to the total): each digit's column rolled (a gas pump: a digit turns as the one under it rolls past 9). */
  const setCount = (v: number) => {
    for (let d = 0; d < digits; d++) {
      const col = cols.current[d];
      if (!col) continue;
      const unit = 10 ** d;
      const under = v % unit;
      const at = Math.floor(v / unit) % 10;
      // (The last digit rolls with the count; a higher one only while the digits under it roll from 9 to 0.)
      const frac = d === 0 ? v - Math.floor(v) : Math.max(0, under - (unit - 1));
      col.style.transform = `translateY(${(-(at + frac) * 100) / 11}%)`;
    }
    for (const [i, el] of [...(partsRef.current?.children ?? [])].entries()) el.classList.toggle("on", v > starts[i]! || (i === 0 && v > 0));
  };

  const finish = (clink: boolean) => {
    run.current?.stop();
    run.current = null;
    const b = box.current;
    if (!b || !view || view.why) return;
    setCount(total);
    b.setAttribute("data-cs", "done");
    b.setAttribute("aria-label", `+${total} coins`);
    if (clink) play("clawCoin");
    void loadCoin().then((img) => paint(Infinity, img));
  };

  useImperativeHandle(api, () => ({
    end: (clink: boolean) => finish(clink),
    play: () =>
      new Promise<void>((resolve) => {
        const b = box.current;
        if (!b || !view || view.why || total <= 0) return resolve();
        warmSounds(["clawCoin", "sell"]);
        void loadCoin().then((img) => {
          if (b.getAttribute("data-cs") === "done") return resolve();
          b.setAttribute("data-cs", "run");
          const start = performance.now();
          const end = endAt(n);
          const landed = new Array<boolean>(n).fill(false);
          let lastClink = -Infinity;
          let shown = -1;
          let raf = 0;
          let live = true;
          run.current = {
            stop: () => {
              live = false;
              cancelAnimationFrame(raf);
              resolve();
            },
          };
          const frame = (now: number) => {
            if (!live) return;
            const t = now - start;
            paint(Math.min(t, end), img);
            const v = countAt(total, n, t);
            if (v !== shown) {
              shown = v;
              setCount(v);
            }
            // (A clink as each coin lands, at most every clinkGapMs: a frame can pass several landings.)
            for (let i = 0; i < n; i++) {
              if (landed[i] || t < i * C.coinGapMs + C.fallMs) continue;
              landed[i] = true;
              if (now - lastClink >= C.clinkGapMs) {
                lastClink = now;
                play("clawCoin");
              }
            }
            if (t < end) {
              raf = requestAnimationFrame(frame);
              return;
            }
            live = false;
            run.current = null;
            paint(Infinity, img);
            setCount(total);
            b.setAttribute("data-cs", "done");
            b.setAttribute("aria-label", `+${total} coins`);
            play("sell");
            resolve();
          };
          raf = requestAnimationFrame(frame);
        });
      }),
  }));

  // (Drawn as the strip first shows (a layout effect: no blank first frame); again at a new size, as it last was.)
  useLayoutEffect(() => {
    const b = box.current;
    if (!b) return;
    if (drawn.current >= 0) void loadCoin().then((img) => paint(drawn.current, img));
    const ro = new ResizeObserver(() => {
      if (drawn.current >= 0 && !run.current) void loadCoin().then((img) => paint(drawn.current, img));
    });
    ro.observe(b);
    return () => ro.disconnect();
  }, [view?.why, total]);
  useLayoutEffect(() => () => run.current?.stop(), []);

  const state = xp === undefined ? "wait" : view!.why ? "none" : "ready";
  return (
    <div class={`es-coin-strip ff-window${view?.why ? " es-cs-off" : ""}`} ref={box} data-testid="es-coin-strip" data-cs={state} data-total={total}>
      <canvas class="es-cs-pile" ref={cv} aria-hidden="true" />
      {/* (Keyed: the counting state is a new element, never the waiting line's reused.) */}
      {!view ? (
        <p class="es-cs-why es-cs-waiting" key="wait">
          Counting your coins…
        </p>
      ) : view.why ? (
        <p class="es-cs-why" key="why" data-testid="es-cs-why">
          {view.why}
        </p>
      ) : (
        <div class="es-cs-text" key="text">
          <span class="es-cs-row">
            <span class="es-cs-pump" aria-hidden="true">
              <span class="es-cs-plus">+</span>
              {Array.from({ length: digits }, (_, i) => digits - 1 - i).map((d) => (
                <span class="es-cs-d" key={d}>
                  <span class="es-cs-col" ref={(el) => void (cols.current[d] = el)}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((x, j) => (
                      <i key={j}>{x}</i>
                    ))}
                  </span>
                </span>
              ))}
            </span>
            <span class="es-cs-label">COINS</span>
            {/* (The coin boost, Nov 26: its badge in the count's row (a fixed 24 px row: nothing moves), the minutes left under it.) */}
            {view.boost && (
              <span class="es-cs-boost" data-testid="es-cs-boost">
                <b>{view.boost.times} BOOST</b>
                <span>{view.boost.left > 0 ? `${view.boost.left} MIN LEFT` : "ALL USED"}</span>
              </span>
            )}
          </span>
          <span class="es-cs-today" data-testid="es-cs-today">
            {view.today}
          </span>
          <span class="es-cs-parts" ref={partsRef} data-testid="es-cs-parts">
            {/* (A space between the parts, outside them: a narrow phone wraps there, each part whole; its "·" shows with it.) */}
            {view.parts.map((p, i) => (
              <Fragment key={p.label}>
                {i ? " " : ""}
                <span class="es-cs-part">
                  {i ? "· " : ""}
                  {p.label} <b>+{p.coins}</b>
                </span>
              </Fragment>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
