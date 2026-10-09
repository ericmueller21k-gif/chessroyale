import { useEffect, useState } from "preact/hooks";
import { cueAt, animLength, darkItem, lightsOutSmashes, lightsOutSpot, nightItems, nightWarmList, type NightState, type SquareItem } from "../characters/power-art.ts";
import { HOLLOW_CAST_FROM, bulbsLook, findLine } from "../characters/hollow.ts";
import { wipKit, wipLook } from "../characters/kits.ts";
import { pickLine } from "../characters/boss-beats.ts";
import { BoardEffects, BossEffect, BossMoment, prewarm } from "./BossEffect.tsx";

/**
 * Test links only: a boss's moments previewed over a real board before its power rules exist, the way a power test link
 * (`?power=`) brings one at once for a playable boss. `?wip=1&kit=Hollow&power=<moment>` shows Hollow in every boss's
 * place and plays the moment over and over:
 *   dark       dark squares: forming, dark, thinning, clearing, and a miss on one
 *   cast       his cast: the darkness pours from his chest onto a square
 *   bulbs      the countdown: a bulb out per move (on his strand and the strip), the cast, the relight
 *   lightsout  the whole ultimate: he leaves his corner, smashes the bulbs (the board dims a step each), two rounds of
 *              the test (a find, a miss, the answers), the lights back
 *   test       the test alone, in the night
 *   back       the lights coming back
 *   claim      claiming the dark side (the intro)
 * Nothing here decides anything: the rules PR plays the same art from the shared state.
 */
const MOMENTS = ["dark", "cast", "bulbs", "lightsout", "test", "back", "claim"] as const;
type Moment = (typeof MOMENTS)[number];

export function wipPower(): Moment | null {
  try {
    const q = new URLSearchParams(location.search);
    const p = q.get("power");
    return q.get("wip") === "1" && wipKit()?.ch.id === "hollow" && MOMENTS.includes(p as Moment) ? (p as Moment) : null;
  } catch {
    return null;
  }
}

/** The preview's clock: from when this page first showed it, so a new screen carries on. */
let start = 0;

const BOSS = "Hollow";
const FILES = "abcdefgh";
/** The squares holding a side's pieces of a kind ("q"), from a FEN. */
function squaresOf(fen: string, side: "w" | "b", kinds: string): string[] {
  const out: string[] = [];
  fen.split(" ")[0]!.split("/").forEach((row, r) => {
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) f += Number(c);
      else {
        if ((c === c.toUpperCase()) === (side === "w") && kinds.includes(c.toLowerCase())) out.push(`${FILES[f]}${8 - r}`);
        f++;
      }
    }
  });
  return out;
}
const emptySquares = (fen: string) => {
  const taken = new Set(squaresOf(fen, "w", "pnbrqk").concat(squaresOf(fen, "b", "pnbrqk")));
  return FILES.split("").flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).filter((s) => !taken.has(s));
};
/** A square's middle in % of the board. */
const pct = (square: string, orientation: "white" | "black") => {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: ((orientation === "white" ? f : 7 - f) + 0.5) * 12.5, y: ((orientation === "white" ? 7 - r : r) + 0.5) * 12.5 };
};

/** His line in the pixel text box above the board. */
const Line = ({ text, at, now, above = false }: { text: string; at: number; now: number; above?: boolean }) =>
  now >= at && now < at + 2600 ? (
    <div class="pm-line" role="status" aria-label={text} style={above ? { top: "auto", bottom: "101%", left: "2%", translate: "0 0", maxWidth: "34%", zIndex: 11 } : undefined}>
      {text.slice(0, Math.min(text.length, Math.floor((now - at) / 28) + 1))}
    </div>
  ) : null;

export function WipPreview({ fen, orientation, crowd }: { fen: string; orientation: "white" | "black"; crowd: "w" | "b" }) {
  const moment = wipPower();
  const [now, setNow] = useState(Date.now());
  // (A test page: a tenth of a second is fine for the timeline; the sprites animate themselves on the shared loop.)
  useEffect(() => {
    if (!moment) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [moment]);
  const kit = wipKit();
  useEffect(() => {
    if (moment !== "bulbs") return;
    // His own strand counts down with the strip.
    wipLook.now = () => bulbsLook(bulbsAt(Date.now() - start).lit);
    return () => void (wipLook.now = null);
  }, [moment]);
  // The night drawn ahead, a slice a frame, from the start (the rules do it as he drops in).
  useEffect(() => (moment === "lightsout" || moment === "test" || moment === "back" ? prewarm("nightSquare", nightWarmList()) : undefined), [moment]);
  if (!moment || !kit) return null;
  if (!start) start = now;
  const him = crowd === "w" ? "b" : "w";
  const t = now - start;
  const caster = { left: "-9%", top: "-27%", width: "30%", aspectRatio: `${kit.ch.w} / ${kit.ch.h}` };
  // The darkness leaves his chest: where that is on the board (his frame in the caster's box).
  const from = { x: -9 + (HOLLOW_CAST_FROM[0] / kit.ch.w) * 30, y: -27 + (HOLLOW_CAST_FROM[1] / kit.ch.h) * 30 * (kit.ch.h / kit.ch.w) };
  const items: SquareItem[] = [];
  /** Effects over the others on their squares (a miss over the night). */
  const over: SquareItem[] = [];
  const parts = [] as preact.JSX.Element[];

  if (moment === "dark") {
    const loop = 7000;
    const k = Math.floor(t / loop);
    const t0 = start + k * loop;
    const sq = [...squaresOf(fen, crowd, "nbrq"), ...squaresOf(fen, him, "nbrq")];
    const [a, b, c, d] = [sq[0], sq[sq.length - 1], sq[1], sq[sq.length - 2]];
    if (a) items.push(darkItem(a, "new", t0 + 300));
    if (b) items.push(darkItem(b, "dark", 0));
    if (c) items.push(t < k * loop + 4000 ? darkItem(c, "thin", 0) : darkItem(c, "clear", t0 + 4000));
    if (d) items.push(darkItem(d, "dark", 0));
    if (b && t - k * loop > 2500 && t - k * loop < 3400) items.push({ square: b, name: "darkMiss", anim: "miss", since: t0 + 2500 });
  }

  if (moment === "cast" || moment === "bulbs") {
    const loop = moment === "cast" ? 5000 : 10000;
    const k = Math.floor(t / loop);
    const t0 = start + k * loop;
    const castAt = moment === "cast" ? 300 : 6000;
    const target = squaresOf(fen, crowd, "nb")[k % 2] ?? squaresOf(fen, crowd, "p")[0]!;
    const cast = kit.ch.anims.darkCast!;
    const hit = t0 + castAt + (cueAt(cast, "cast") ?? 0);
    const land = hit + 380;
    if (now >= t0 + castAt && now < t0 + castAt + animLength(cast) + 200)
      parts.push(
        <div class="power-moment" key="cast">
          <span style={{ position: "absolute", zIndex: 8, pointerEvents: "none", ...caster }}>
            <BossMoment boss={BOSS} anim="darkCast" since={t0 + castAt} then="idle" look={moment === "bulbs" ? "bulbs0" : undefined} />
          </span>
        </div>,
      );
    if (now >= hit && now < land) {
      const to = pct(target, orientation);
      const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
      parts.push(
        <span
          key={`pour-${k}`}
          class="pw-flight darkPour"
          style={{ left: `${from.x - 6.25}%`, top: `${from.y - 6.25}%`, "--fx": `${to.x - 6.25}%`, "--fy": `${to.y - 6.25}%`, animationDuration: `${land - hit}ms`, animationDelay: `${hit - Date.now()}ms`, rotate: `${angle}deg` }}
        >
          <BossEffect name="darkPour" since={hit} />
        </span>,
      );
    }
    if (now >= land) items.push(darkItem(target, "new", land));
    if (moment === "cast") parts.push(<Line key={`l${k}`} text={k % 2 ? (pickLine(kit, "power", `wip:${k}`) ?? "Can you still see it?") : kit.lines.darkFirst![0]!} at={hit} now={now} />);
    if (moment === "bulbs") {
      const b = bulbsAt(t);
      parts.push(
        <span key="strip" style={{ position: "absolute", zIndex: 9, left: "1%", top: "-6.6%", width: "18%", aspectRatio: "44 / 15", pointerEvents: "none" }}>
          <BossEffect name="bulbStrand" anim={b.anim} then={b.then} since={start + b.since} id="wip-strip" />
        </span>,
      );
    }
  }

  if (moment === "claim") {
    const loop = 4500;
    const k = Math.floor(t / loop);
    const t0 = start + k * loop + 300;
    if (now >= t0)
      parts.push(
        <div class="power-moment" key={`claim${k}`}>
          <span style={{ position: "absolute", zIndex: 8, pointerEvents: "none", ...caster }}>
            <BossMoment boss={BOSS} anim="claimDark" since={t0} then="idle" />
          </span>
          <Line text={pickLine(kit, "claim", `wip:${k}`) ?? "The dark side is mine."} at={t0 + 500} now={now} />
        </div>,
      );
  }

  if (moment === "lightsout" || moment === "test" || moment === "back") {
    const out = kit.ch.anims.lightsOut!;
    const back = kit.ch.anims.lightsBack!;
    const smashes = lightsOutSmashes(out);
    // The timeline (ms into the loop): his drop and smashes, two rounds of the test, the lights back.
    const T0 = 300;
    const R1 = moment === "lightsout" ? T0 + animLength(out) + 200 : 300;
    const R2 = R1 + 3000 + 1600;
    const B = moment === "back" ? 1200 : R2 + 4000 + 1600;
    const END = B + animLength(back) + 1600;
    const loop = moment === "test" ? R2 + 4000 + 1400 : END;
    const k = Math.floor(t / loop);
    const t0 = start + k * loop;
    const u = t - k * loop;
    const queen = squaresOf(fen, him, "q")[0] ?? squaresOf(fen, him, "k")[0]!;
    const [rook] = squaresOf(fen, him, "r");
    const [knight] = squaresOf(fen, him, "n");
    const wrong = emptySquares(fen)[20] ?? "e4";
    // His new spot: centred above the board, his feet on its top edge.
    const spot = lightsOutSpot(kit.ch, 36);
    const spotSquare = orientation === "white" ? "d8" : "e1";
    let anim: { name: string; since: number; then?: string } | null = null;
    let step: NightState["step"] | null = null;
    let stepSince = 0;
    const shown: { square: string; at: number; kind: "found" | "answer" }[] = [];
    const closing: { square: string; at: number }[] = [];
    let line: { text: string; at: number } | null = null;
    if (moment === "lightsout") {
      if (u >= T0) anim = { name: "lightsOut", since: t0 + T0, then: "lightsTest" };
      const s = smashes.map((x) => T0 + x);
      if (u >= s[0]!) [step, stepSince] = ["dim1", t0 + s[0]!];
      if (u >= s[1]!) [step, stepSince] = ["dim2", t0 + s[1]!];
      if (u >= s[2]!) [step, stepSince] = ["dim3", t0 + s[2]!];
      if (u < R1) line = { text: kit.lines.ultimate![0]!, at: t0 + T0 + 200 };
    } else step = "night";
    if (moment !== "back") {
      if (u >= R1) {
        anim = { name: "test3", since: t0 + R1, then: "lightsTest" };
        line = { text: findLine(["q"]), at: t0 + R1 };
        shown.push({ square: queen, at: t0 + R1 + 1500, kind: "found" });
        closing.push({ square: queen, at: t0 + R1 + 3000 + 900 });
        if (u >= R1 + 3000) anim = { name: "testFound", since: t0 + R1 + 3000, then: "lightsTest" };
      }
      if (u >= R2) {
        anim = { name: "test4", since: t0 + R2, then: "lightsTest" };
        line = { text: findLine(rook && knight ? ["r", "n"] : ["k"]), at: t0 + R2 };
        if (u >= R2 + 1200 && u < R2 + 2000) over.push({ square: wrong, name: "darkMiss", anim: "miss", since: t0 + R2 + 1200 });
        if (rook) shown.push({ square: rook, at: t0 + R2 + 2600, kind: "found" });
        if (knight) shown.push({ square: knight, at: t0 + R2 + 4000, kind: "answer" });
        for (const sq of [rook, knight]) if (sq) closing.push({ square: sq, at: t0 + R2 + 4000 + 1200 });
        if (u >= R2 + 4000) {
          anim = { name: "testMiss", since: t0 + R2 + 4000, then: "lightsTest" };
          line = { text: pickLine(kit, "missed", `wip:${k}`) ?? "Forgetting costs.", at: t0 + R2 + 4000 };
        }
      }
    }
    if (moment === "back" && u < B) anim = { name: "lightsTest", since: t0 };
    if (u >= B) {
      anim = { name: "lightsBack", since: t0 + B };
      const relit = B + (cueAt(back, "relight") ?? 0);
      if (u >= relit) [step, stepSince] = ["dawn", t0 + relit];
      line = { text: kit.lines.lightsBack![k % kit.lines.lightsBack!.length]!, at: t0 + B + 300 };
    }
    const done = u >= B + animLength(back);
    if (step && !(step === "dawn" && u >= B + 2600)) items.push(...nightItems({ orientation, step, since: stepSince, now, shown, closing, from: spotSquare }));
    if (anim && !done)
      parts.push(
        <div class="power-moment" key="lo">
          <span style={{ position: "absolute", zIndex: 8, pointerEvents: "none", left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.width}%`, aspectRatio: `${kit.ch.w} / ${kit.ch.h}` }}>
            <BossMoment boss={BOSS} anim={anim.name} since={anim.since} then={anim.then} />
          </span>
        </div>,
      );
    if (line) parts.push(<Line key={line.text} text={line.text} at={line.at} now={now} above />);
  }

  return (
    <>
      {/* (Which squares show what, for the tests: "e4:thin".) */}
      <div class="power-board wip-preview" aria-hidden="true" data-squares={items.filter((i) => i.name === "darkSquare").map((i) => `${i.square}:${i.anim}`).join(" ")}>
        <BoardEffects items={[...items, ...over]} orientation={orientation} class="pw-fire-board pw-dark-board" />
      </div>
      {parts}
    </>
  );
}

/** The bulbs' countdown in the preview (10 s round): a bulb out every 1.5 s, the cast at 6 s, the relight after it. */
function bulbsAt(t: number): { lit: number; anim: string; then?: string; since: number } {
  const loop = 10000;
  const k = Math.floor(t / loop);
  const u = t - k * loop;
  const base = k * loop;
  if (u < 1500) return { lit: 3, anim: "lit3", since: 0 };
  if (u < 3000) return { lit: 2, anim: "out3", then: "lit2", since: base + 1500 };
  if (u < 4500) return { lit: 1, anim: "out2", then: "lit1", since: base + 3000 };
  if (u < 7600) return { lit: 0, anim: "out1", then: "lit0", since: base + 4500 };
  return { lit: 3, anim: "relight", then: "lit3", since: base + 7600 };
}
