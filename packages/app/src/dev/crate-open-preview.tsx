import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import "../board/pieces.css";
import "../styles.css";
import "./crate-open-preview.css";
import { TIERS, itemDef, tierInfo, type ItemTier } from "@chessroyale/core";
import { BetaCrateArt, HunchessBoxArt, HunchessCrateArt, ItemArt, PresentArt, SupplyBoxArt, WinterCrateArt } from "../components/Items.tsx";
import { lightSprites } from "../components/recluse-light.ts";
import { finishLine } from "../screens/Crates.tsx";
import { CRATE_SOUND_OPTIONS, renderCrateClip, type CrateSoundOption } from "./crate-open-sounds.ts";
import { LAND_JITTER, OVERSHOOT, STRIP, TIER_POWER, isBig, stripEase, timeline, type Timeline } from "./crate-open-timeline.ts";

/**
 * MOCKUP (claude/crate-open-mockup, Nov 24; dev only, never on main as is): the crate opening overhauled, presentation only.
 * `/crate-open-preview.html` on `npm run dev`. The roll, the odds and the server call are the game's, untouched; this page fakes a
 * result per tier to show it.
 *
 * 1. The strip, with depth: a curved window (its ends in shadow), a glowing center line, a motion-blurred copy of the strip that
 *    fades out as it slows, a cubic slowdown creeping over the last edge, an overshoot that settles back, the winner lifting.
 * 2. The open (Rocket League's idea): the winning box drops into the middle, shakes, its lid bursts off and a beam of light in the
 *    tier's color shoots up (the Hidden Boss's light: recluse-light.ts's own sprites, tinted), the item rising out of it into the
 *    reveal card. Legendary and Mythic: more light, a flash, the stage shaking.
 * Everything moves by CSS transforms and opacity on the compositor (Web Animations, all started together), no frame loop; so a
 * capture can stop the clock anywhere (`window.__seek(ms)`), and the sound (crate-open-sounds.ts) is laid on the same timeline.
 *
 * Query: `tier=`, `sound=spokes|ratchet|reel`, `look=beta|winter|hunchess`, `spin=` (ms; the game's is 6200), `capture=1` (no
 * controls, for the GIF script), `desk=1` (a computer's width).
 */
const q = new URLSearchParams(location.search);
const capture = q.get("capture") === "1";

const LOOKS = {
  beta: { Crate: BetaCrateArt, Box: SupplyBoxArt, lid: 36 },
  winter: { Crate: WinterCrateArt, Box: PresentArt, lid: 46 },
  hunchess: { Crate: HunchessCrateArt, Box: HunchessBoxArt, lid: 38 },
} as const;
type Look = keyof typeof LOOKS;

/** A Beta Crate item per tier, to show (the game's result would be the server's). */
const DEMO: Record<ItemTier, { def: string; color: string; color2?: string; blemish: number }> = {
  common: { def: "wizard-hat", color: "cobalt", blemish: 31 },
  uncommon: { def: "viking-helm", color: "red", blemish: 22 },
  rare: { def: "dark-shades", color: "emerald", blemish: 14 },
  epic: { def: "suit-and-tie", color: "midnight", color2: "red", blemish: 9 },
  legendary: { def: "smiley-face", color: "yellow", blemish: 6 },
  mythic: { def: "tommy-gun", color: "oceanic", color2: "yellow", blemish: 3 },
};

/** The decoys: tiers by the Beta Crate's odds (40/26/18/14/2), seeded so every capture is the same strip. */
function decoys(land: ItemTier): ItemTier[] {
  let s = 12345;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const odds: [ItemTier, number][] = [["common", 40], ["uncommon", 26], ["rare", 18], ["epic", 14], ["legendary", 2]];
  return Array.from({ length: STRIP.tiles }, (_, i) => {
    if (i === STRIP.land) return land;
    let x = r() * 100;
    for (const [t, w] of odds) if ((x -= w) < 0) return t;
    return "common";
  });
}

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as [number, number, number];
const urlOf = (c: HTMLCanvasElement | OffscreenCanvas) => `url(${(c as HTMLCanvasElement).toDataURL()})`;
/**
 * The light's sprites in a tier's color, as CSS backgrounds, made once per color and ahead of the tap (in the game: as the crate's
 * page opens, or as the server's answer comes, a few seconds before the burst). Made on the tap, they cost the strip's first frames.
 */
const sprites = new Map<string, Record<string, string>>();
function spritesFor(hex: string) {
  let s = sprites.get(hex);
  if (!s) {
    const L = lightSprites(rgbOf(hex));
    s = { "--ray": urlOf(L.ray), "--ray-tint": urlOf(L.tinted), "--shaft": urlOf(L.shaft), "--core": urlOf(L.core), "--pool": urlOf(L.pool), "--glow": urlOf(L.glow) };
    sprites.set(hex, s);
  }
  return s;
}

function Stage({ tier, look, spinMs, run }: { tier: ItemTier; look: Look; spinMs: number; run: number }) {
  const stage = useRef<HTMLDivElement>(null);
  const t = tierInfo(tier);
  const demo = DEMO[tier];
  const d = itemDef(demo.def)!;
  const tiles = decoys(tier);
  const { Box } = LOOKS[look];
  const big = isBig(tier);
  const power = TIER_POWER[tier];

  // (Ahead of the tap: the sprites, on the stage.)
  useEffect(() => {
    for (const [k, v] of Object.entries(spritesFor(t.color))) stage.current!.style.setProperty(k, v);
  }, [tier]);
  useEffect(() => {
    if (!run) return;
    const root = stage.current!;
    const T = timeline(spinMs);
    const t0 = performance.now();
    const anims = build(root, T, LOOKS[look].lid, big, power);
    (window as unknown as { __buildMs: number }).__buildMs = performance.now() - t0;
    (window as unknown as { __seek: (ms: number) => void }).__seek = (ms: number) => {
      for (const a of anims) {
        a.pause();
        a.currentTime = ms;
      }
    };
    (window as unknown as { __length: number }).__length = T.cardAt + 1400;
    return () => anims.forEach((a) => a.cancel());
  }, [run, tier, look, spinMs]);

  const finish = { def: demo.def, color: demo.color, color2: demo.color2, blemish: demo.blemish, seed: 7 };
  return (
    <div class={`cox-stage${big ? " big" : ""}`} ref={stage} style={{ "--tier": t.color }}>
      <div class="cox-backdrop" />
      {/* The light, behind everything it lights: the rays, the pool, the beam. */}
      <div class="cox-light cox-radiate" />
      <div class="cox-light cox-rays" />
      <div class="cox-light cox-pool" />
      <div class="cox-light cox-beam">
        <div class="cox-beam-shaft" />
        <div class="cox-beam-core" />
        <div class="cox-motes">
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>
      {/* The box: two copies of its own art, the lid and the body, so the lid can fly off. */}
      <div class="cox-box">
        <div class="cox-seam" />
        <div class="cox-box-body">
          <Box color={t.color} />
        </div>
        <div class="cox-box-lid">
          <Box color={t.color} />
        </div>
        <div class="cox-flash" />
      </div>
      {/* The strip. */}
      <div class="cox-reel">
        <div class="cox-reel-window">
          <div class="cox-track sharp">
            {tiles.map((x, i) => (
              <span key={i} class={`spin-tile present cox-tile${i === STRIP.land ? " win" : ""}`} style={{ "--tier": tierInfo(x).color }}>
                <Box color={tierInfo(x).color} />
                <span class="spin-tile-name">{tierInfo(x).name}</span>
              </span>
            ))}
          </div>
          <div class="cox-track blur" aria-hidden="true" hidden={q.get("blur") === "0"}>
            {tiles.map((x, i) => (
              <span key={i} class="spin-tile present cox-tile" style={{ "--tier": tierInfo(x).color }}>
                <Box color={tierInfo(x).color} />
                <span class="spin-tile-name">{tierInfo(x).name}</span>
              </span>
            ))}
          </div>
          <div class="cox-reel-dim" />
          <div class="cox-reel-shade" />
        </div>
        <div class="cox-line">
          <i class="top" />
          <i class="bottom" />
        </div>
        <div class="cox-line-flare" />
      </div>
      {/* The reveal card (the game's own look), forming round the risen item. */}
      <div class="ff-window reveal-card cox-card special">
        <span class="reveal-tier">{t.name}</span>
        <span class="reveal-art cox-card-art" />
        <strong class="reveal-name">{d.name}</strong>
        <span class="reveal-finish">{finishLine(finish)}</span>
        <span class="reveal-desc">{d.description}</span>
        <div class="reveal-actions">
          <button type="button" class="ff-button small">
            ▶ Wear
          </button>
          <button type="button" class="ff-button small">
            ▶ Open another
          </button>
          <button type="button" class="ff-button small">
            ▶ Done
          </button>
        </div>
      </div>
      <div class="cox-item">
        <div class="cox-item-glow" />
        <ItemArt def={demo.def} finish={finish} />
      </div>
      <div class="cox-whiteout" />
    </div>
  );
}

/** Every moving part, as Web Animations all starting now (so `currentTime` on each is the same clock). */
function build(root: HTMLElement, T: Timeline, lidCut: number, big: boolean, power: number): Animation[] {
  const $ = (s: string) => root.querySelector(s) as HTMLElement;
  const $$ = (s: string) => [...root.querySelectorAll(s)] as HTMLElement[];
  const out: Animation[] = [];
  const at = (el: Element, kf: Keyframe[], start: number, dur: number, o: KeyframeAnimationOptions = {}) =>
    out.push(el.animate(kf, { delay: start, duration: dur, fill: "both", easing: "linear", ...o }));

  root.style.setProperty("--lid", String(lidCut / 100));
  root.style.setProperty("--power", String(power));
  // The rays: built here, as many as the tier's light.
  const rays = $(".cox-rays");
  rays.replaceChildren();
  const n = Math.round(8 + 10 * power);
  for (let i = 0; i < n; i++) {
    const r = document.createElement("i");
    const a = (i / n) * 360 + ((i * 37) % 11) - 5;
    r.style.setProperty("--a", `${a}deg`);
    r.style.setProperty("--len", `${0.55 + 0.45 * (((i * 53) % 10) / 10)}`);
    rays.append(r);
  }
  const radiate = $(".cox-radiate");
  radiate.replaceChildren();
  if (big)
    for (let i = 0; i < 14; i++) {
      const r = document.createElement("i");
      r.style.setProperty("--a", `${(i / 14) * 360 + 7}deg`);
      radiate.append(r);
    }

  // ---- 1. The strip.
  const win = $(".cox-reel-window");
  const width = win.offsetWidth;
  const step = STRIP.tile + STRIP.gap;
  const target = STRIP.land * step + step / 2 - width / 2 + LAND_JITTER * step;
  const peak = target + OVERSHOOT;
  const kf: Keyframe[] = [];
  const total = T.spinMs + T.settleMs;
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    kf.push({ transform: `translate3d(${-peak * stripEase(u)}px,0,0)`, offset: (u * T.spinMs) / total });
  }
  // (The settle: back onto the stop, eased.)
  for (let i = 1; i <= 6; i++) {
    const v = i / 6;
    const e = v * v * (3 - 2 * v);
    kf.push({ transform: `translate3d(${-(peak - OVERSHOOT * e)}px,0,0)`, offset: (T.spinMs + v * T.settleMs) / total });
  }
  for (const tr of $$(".cox-track")) at(tr, kf, 0, total);
  // The blurred copy over it, fading as it slows (gone by 45% of the spin), the sharp one under it always.
  at($(".cox-track.blur"), [{ opacity: 0.95 }, { opacity: 0.95, offset: 0.12 }, { opacity: 0 }], 0, T.spinMs * 0.45);
  // The line glows harder while it's fast; it flares at the stop.
  at($(".cox-line"), [{ opacity: 0.85 }, { opacity: 1 }], 0, T.spinMs);
  at($(".cox-line-flare"), [{ opacity: 0, transform: "scaleY(0.6)" }, { opacity: 1, transform: "scaleY(1.15)", offset: 0.25 }, { opacity: 0, transform: "scaleY(1)" }], T.stop - 40, 420);
  // The winner lifts, the others dim round it.
  const winner = $(".cox-track.sharp .win");
  at(winner, [{ transform: "none" }, { transform: "translateY(-7px) scale(1.12)" }], T.stop - 60, 200, { easing: "cubic-bezier(.2,1.6,.4,1)" });
  at($(".cox-reel-dim"), [{ opacity: 0 }, { opacity: 1 }], T.stop - 60, 200);
  // Then the strip falls back and fades as the box drops.
  at($(".cox-reel"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(18px) scale(0.94)" }], T.dropAt + 40, 260, { easing: "ease-in" });

  // ---- 2. The box: drops, lands (a squash), shakes harder and harder, the lid bursts off.
  const box = $(".cox-box");
  at(box, [{ opacity: 0 }, { opacity: 1 }], T.dropAt, 60);
  at(
    box,
    [
      { transform: "translateY(-340px) scale(0.9)" },
      { transform: "translateY(0) scale(1.08, 0.86)", offset: T.dropMs / (T.dropMs + 160), easing: "cubic-bezier(.3,1.5,.5,1)" },
      { transform: "translateY(0) scale(1)" },
    ],
    T.dropAt,
    T.dropMs + 160,
    { easing: "cubic-bezier(.55,0,1,.45)", composite: "replace" },
  );
  // The shake, on the box's inner parts (so it adds to the drop): faster and wider to the burst.
  const shake: Keyframe[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const amp = 2 + 9 * u * u;
    const side = i % 2 ? 1 : -1;
    // (Each swing shorter than the last: the offsets bunch up toward the end.)
    shake.push({ transform: i === steps ? "none" : `translate(${side * amp * 0.35}px, ${-Math.abs(amp) * 0.25}px) rotate(${side * amp}deg)`, offset: 1 - (1 - u) ** 1.5 });
  }
  for (const part of [$(".cox-box-body"), $(".cox-box-lid")]) at(part, shake, T.landAt, T.shakeMs);
  // Light leaking from the lid's seam and glowing behind the box, building to the burst.
  const seam = $(".cox-seam");
  seam.style.top = `${lidCut}%`;
  at(seam, [{ opacity: 0, transform: "scaleX(0.4)" }, { opacity: 0.5, offset: 0.5 }, { opacity: 1, transform: "scaleX(1.1)" }], T.landAt + 80, T.shakeMs - 80, { easing: "ease-in" });
  at(seam, [{ opacity: 1 }, { opacity: 0 }], T.burstAt, 200, { fill: "forwards" });
  // The lid flies off, turning; the body stays and sinks away behind the card.
  const lid = $(".cox-box-lid");
  lid.style.clipPath = `inset(0 0 ${100 - lidCut}% 0)`;
  $(".cox-box-body").style.clipPath = `inset(${lidCut}% 0 0 0)`;
  out.push(
    lid.animate(
      [
        { transform: "translate(0,0) rotate(0)" },
        { transform: `translate(-46px, -${220 + 80 * power}px) rotate(-38deg)`, offset: 0.7 },
        { transform: `translate(-60px, -${250 + 90 * power}px) rotate(-52deg)` },
      ],
      { delay: T.burstAt, duration: 640, fill: "forwards", easing: "cubic-bezier(.15,.8,.3,1)", composite: "add" },
    ),
  );
  // (Its fade on its own: an added animation adds its opacity too.)
  at(lid, [{ opacity: 1 }, { opacity: 0 }], T.burstAt + 380, 260, { fill: "forwards" });
  at($(".cox-box-body"), [{ opacity: 1 }, { opacity: 0 }], T.cardAt + 100, 300);
  at($(".cox-flash"), [{ opacity: 0, transform: "scale(0.4)" }, { opacity: 1, transform: "scale(1.2)", offset: 0.2 }, { opacity: 0, transform: "scale(1.9)" }], T.burstAt, big ? 520 : 380);

  // ---- 3. The light: the beam shooting up from the box's mouth, the rays fanning out behind it, the pool on the floor, motes.
  const beam = $(".cox-beam");
  at(beam, [{ transform: "scaleY(0) scaleX(0.5)", opacity: 1 }, { transform: "scaleY(1.04) scaleX(1.15)", opacity: 1, offset: 0.55 }, { transform: "scaleY(1) scaleX(1)", opacity: 1 }], T.burstAt, 320, { easing: "cubic-bezier(.1,.9,.3,1)" });
  // (It flickers a little as it holds, then sinks to a glow behind the card.)
  at($(".cox-beam-shaft"), [{ opacity: 0.85 }, { opacity: 1 }, { opacity: 0.8 }, { opacity: 1 }, { opacity: 0.9 }], T.burstAt, 900, { iterations: Infinity });
  at(beam, [{ opacity: 1 }, { opacity: 0.35 }], T.cardAt, 500, { fill: "forwards", easing: "ease-out" });
  at(rays, [{ opacity: 0, transform: "scale(0.2) rotate(0deg)" }, { opacity: 1, transform: "scale(1) rotate(8deg)", offset: 0.12 }, { opacity: 0.55, transform: "scale(1.06) rotate(40deg)" }], T.burstAt + 30, 3400, { easing: "cubic-bezier(.2,.8,.4,1)" });
  at($(".cox-pool"), [{ opacity: 0, transform: "scale(0.3)" }, { opacity: 1, transform: "scale(1)" }], T.landAt + 100, T.burstAt - T.landAt, { easing: "ease-in" });
  $$(".cox-motes i").forEach((m, i) => {
    m.style.left = `${8 + ((i * 41) % 84)}%`;
    at(m, [{ transform: "translateY(0)", opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translateY(-${180 + ((i * 29) % 160)}px)`, opacity: 0 }], T.burstAt + 60 + ((i * 97) % 700), 900 + ((i * 131) % 700), { iterations: Infinity });
  });
  if (big) {
    // Legendary and Mythic: the light over the whole stage (the Hidden Boss's radiate), a flash and the stage shaking.
    at(radiate, [{ opacity: 0, transform: "scale(0.3) rotate(0deg)" }, { opacity: 0.9, transform: "scale(1) rotate(6deg)", offset: 0.15 }, { opacity: 0.4, transform: "scale(1.05) rotate(30deg)" }], T.burstAt, 3000, { easing: "cubic-bezier(.2,.8,.4,1)" });
    at($(".cox-whiteout"), [{ opacity: 0 }, { opacity: 0.85, offset: 0.12 }, { opacity: 0 }], T.burstAt - 20, 560, { easing: "ease-out" });
    const jolt: Keyframe[] = [0, -6, 5, -4, 3, -2, 1, 0].map((x, i) => ({ transform: `translate(${x}px, ${i % 2 ? -x / 2 : x / 2}px)` }));
    at(root, jolt, T.burstAt, 380);
  }

  // ---- 4. The item rises out of the box into the card's art spot; the card forms round it.
  const item = $(".cox-item");
  const sr = root.getBoundingClientRect();
  const br = box.getBoundingClientRect();
  const ar = $(".cox-card-art").getBoundingClientRect();
  const from = { x: br.left + br.width / 2 - sr.left, y: br.top + br.height * (lidCut / 100) - sr.top };
  const to = { x: ar.left + ar.width / 2 - sr.left, y: ar.top + ar.height / 2 - sr.top };
  item.style.left = `${to.x}px`;
  item.style.top = `${to.y}px`;
  at(
    item,
    [
      { transform: `translate(-50%,-50%) translate(${from.x - to.x}px, ${from.y - to.y}px) scale(0.25)`, opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: "translate(-50%,-50%) translateY(-10px) scale(1.06)", offset: 0.8 },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
    ],
    T.riseAt,
    T.riseMs,
    { easing: "cubic-bezier(.2,.7,.3,1)" },
  );
  at($(".cox-item-glow"), [{ opacity: 0.9, transform: "scale(1.4)" }, { opacity: 0.55, transform: "scale(1)" }], T.riseAt, T.riseMs + 300);
  at($(".cox-card"), [{ opacity: 0, transform: "scale(0.86)" }, { opacity: 1, transform: "scale(1)" }], T.cardAt, 340, { easing: "cubic-bezier(.2,1.3,.4,1)" });
  return out;
}

let audio: AudioContext | null = null;
async function playSound(option: CrateSoundOption, tier: ItemTier, spinMs: number, width: number) {
  audio ??= new AudioContext();
  await audio.resume();
  const x = renderCrateClip(audio.sampleRate, { option, tier, spinMs, width });
  const b = audio.createBuffer(1, x.length, audio.sampleRate);
  b.getChannelData(0).set(x);
  const s = audio.createBufferSource();
  s.buffer = b;
  s.connect(audio.destination);
  s.start(audio.currentTime + Math.max(0, audio.outputLatency || 0));
  return s;
}

function Page() {
  const [tier, setTier] = useState<ItemTier>((q.get("tier") as ItemTier) ?? "legendary");
  const [sound, setSound] = useState<CrateSoundOption>((q.get("sound") as CrateSoundOption) ?? "spokes");
  const [look, setLook] = useState<Look>((q.get("look") as Look) ?? "beta");
  const [spinMs, setSpin] = useState(Number(q.get("spin") ?? 2700));
  const [run, setRun] = useState(capture ? 1 : 0);
  const [muted, setMuted] = useState(false);
  const go = async () => {
    const w = document.querySelector(".cox-reel-window") as HTMLElement | null;
    if (!muted) await playSound(sound, tier, spinMs, w?.offsetWidth ?? 360);
    setRun((r) => r + 1);
  };
  return (
    <div class={`cox-page${q.get("desk") === "1" ? " desk" : ""}${capture ? " capture" : ""}`}>
      {!capture && (
        <div class="cox-controls">
          <h1 class="ff-title">Crate opening · mockup</h1>
          <div class="cox-row">
            {TIERS.map((x) => (
              <button type="button" class={`cox-chip${x.id === tier ? " on" : ""}`} style={{ "--tier": x.color }} onClick={() => setTier(x.id)}>
                {x.name}
              </button>
            ))}
          </div>
          <div class="cox-row">
            {CRATE_SOUND_OPTIONS.map((o) => (
              <button type="button" class={`cox-chip${o.id === sound ? " on" : ""}`} title={o.blurb} onClick={() => setSound(o.id)}>
                {o.letter} · {o.name}
              </button>
            ))}
            <button type="button" class={`cox-chip${muted ? " on" : ""}`} onClick={() => setMuted(!muted)}>
              Mute
            </button>
          </div>
          <div class="cox-row">
            {(["beta", "winter", "hunchess"] as Look[]).map((l) => (
              <button type="button" class={`cox-chip${l === look ? " on" : ""}`} onClick={() => setLook(l)}>
                {l}
              </button>
            ))}
            {[2700, 4000, 6200].map((ms) => (
              <button type="button" class={`cox-chip${ms === spinMs ? " on" : ""}`} onClick={() => setSpin(ms)}>
                {ms === 6200 ? "6.2 s (today)" : `${ms / 1000} s`}
              </button>
            ))}
          </div>
          <button type="button" class="ff-button cox-play" onClick={() => void go()}>
            ▶ Open
          </button>
        </div>
      )}
      <Stage key={`${tier}-${look}-${spinMs}`} tier={tier} look={look} spinMs={spinMs} run={run} />
    </div>
  );
}

render(<Page />, document.getElementById("app")!);
