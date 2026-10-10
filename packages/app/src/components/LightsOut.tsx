import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { BOSS_POWERS } from "@chessroyale/core";
import { LIGHTS_OUT, lightsDeadline, lightsHeld, lightsOutTimeline, lightsRate } from "@chessroyale/chess";
import { bossKit } from "../characters/kits.ts";
import { animLength, cueAt, lightsOutSmashes, lightsOutSpot, nightItems, nightWarmList, type NightState, type SquareItem } from "../characters/power-art.ts";
import { findLine, findShort } from "../characters/hollow.ts";
import { pickLine } from "../characters/boss-beats.ts";
import type { BossView, LightsView } from "../game.ts";
import { BoardEffects, BossMoment, prewarm } from "./BossEffect.tsx";
import { PowerBanner } from "./PowerParts.tsx";
import { TimerBar } from "./Countdown.tsx";
import { CRITICAL, NORMAL, Say, SpeechBox, bossVoice } from "../speech.tsx";

/**
 * Hollow's Lights out on the board, from the shared state (the server's test and timing, solo's alike): the game paused,
 * nobody's clock running. His banner; he leaves his corner for his spot above the board and smashes his strand in three
 * strikes, a section at a time, the board dimming a step at each, night at the last. Then each round: he names his
 * pieces ("Find my queen."), a bar counts your seconds down (each tap, right or wrong, gives you a second more: the bar
 * bumps back up with a "+1s"), and every square takes a tap: a piece found flashes back into view; a wrong square gets
 * his red-violet slash. The round is over once everyone has used their tries or run out of time. At the round's end the answers show (gold), the pieces not found cost lightsOutMiss each, and the
 * night closes over them again. Then a fresh strand spills from the void, the light spreads out from him across the
 * board, and he goes back to his corner to play his move. The dark squares from before are still there.
 */

/** The night closing over a square again, and the dawn crossing the whole board (its stagger from his spot, and a tile's). */
const CLOSE_MS = 500;
const DAWN_MS = 1700;

/** When this device first saw each found square, wrong tap and round end (a screen drawn again carries on). */
const seenAt = new Map<string, number>();
function firstSeen(key: string, now: number): number {
  let t = seenAt.get(key);
  if (t === undefined) {
    seenAt.set(key, (t = now));
    if (seenAt.size > 300) seenAt.delete(seenAt.keys().next().value!);
  }
  return t;
}

/** The square under a point of the board (chessground's board box, from either side). */
function squareAtPoint(el: Element, x: number, y: number, orientation: "white" | "black"): string | null {
  const r = el.getBoundingClientRect();
  const col = Math.floor(((x - r.left) / r.width) * 8);
  const row = Math.floor(((y - r.top) / r.height) * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return orientation === "white" ? `${"abcdefgh"[col]}${8 - row}` : `${"abcdefgh"[7 - col]}${row + 1}`;
}

/**
 * Where Lights out stands at `now`: the round on (or whose answers show); whether it's open for you (your own time,
 * a second more for each tap, and tries left) or you're waiting for the others; your deadline in it; the lights back.
 */
export function lightsBeat(lights: LightsView, graceMs: number, now: number) {
  const tl = lightsOutTimeline(lights.rounds, graceMs);
  const t = now - lights.at;
  const i = tl.rounds.findIndex((r) => !r.over || t < r.answersAt + LIGHTS_OUT.answerMs);
  const round = i >= 0 && t >= tl.rounds[i]!.at ? i : -1;
  const tr = round >= 0 ? tl.rounds[round]! : null;
  const used = round >= 0 ? (lights.mine[round]?.used ?? (lights.mine[round]?.found.length ?? 0) + (lights.mine[round]?.wrong.length ?? 0)) : 0;
  const deadline = tr ? lightsDeadline(tr, used) : 0;
  const live = !!tr && !tr.over;
  const open = live && t < deadline + graceMs && used < lights.rounds[round]!.pieces.length;
  return { tl, t, round, open, waiting: live && !open, used, deadline, back: t >= tl.backAt };
}

/** The pieces this player has missed so far (rounds over: not found), each costing lightsOutMiss. */
export function lightsMissed(lights: LightsView, upTo = lights.rounds.length): number {
  return lights.rounds.slice(0, upTo).reduce((n, r, i) => n + (r.answers ? r.pieces.length - (lights.mine[i]?.found.length ?? 0) : 0), 0);
}

/**
 * The crowd's verdict, once every round is over (the server's count): it held the light (its find rate at or above
 * lightsOutHold), or he moves twice. Null while the test runs (or without a count).
 */
export function lightsVerdict(lights: LightsView): "held" | "failed" | null {
  const c = lights.crowd;
  if (!c || c.settled < c.asked || !lights.rounds.every((r) => r.answers)) return null;
  return lightsHeld(c) ? "held" : "failed";
}

/**
 * What the dock shows through Lights out (Eric, Oct 10: the round's prompt on screen, whole, for the whole round, in a
 * place that's always in view): the round's prompt (his words, or the compact list when they don't fit the dock's two
 * lines), your count, then the round's result; the crowd's meter all along; at the end, the verdict.
 */
export function lightsStatus(lights: LightsView, graceMs: number, now: number): { prompt: string; short: string; note: string; meter: boolean; key: string } {
  const b = lightsBeat(lights, graceMs, now);
  const cost = BOSS_POWERS.lightsOutMiss;
  if (b.back) {
    const n = lightsMissed(lights);
    const v = lightsVerdict(lights);
    const text = v === "failed" ? "He moves twice!" : v === "held" ? "The light holds." : "The lights are back.";
    return { prompt: text, short: text, note: n ? `Missed ${n}: −${n * cost}` : "You found every piece.", meter: true, key: "back" };
  }
  if (b.round < 0) return { prompt: "Lights out!", short: "Lights out!", note: "Clocks stopped.", meter: false, key: "start" };
  const r = lights.rounds[b.round]!;
  const mine = lights.mine[b.round] ?? { found: [], wrong: [] };
  const targets = r.targets ?? r.pieces;
  const prompt = findLine(targets);
  const short = findShort(targets, 0);
  const missed = r.pieces.length - mine.found.length;
  const note =
    b.open ? `${mine.found.length}/${r.pieces.length}`
    : b.waiting ? `${mine.found.length}/${r.pieces.length} · waiting for the others`
    : missed ? `Missed ${missed}: −${missed * cost}`
    : r.pieces.length > 1 ? "Found them all!" : "Found it!";
  return { prompt, short, note, meter: true, key: `round-${b.round}` };
}

/**
 * The dock through Lights out: the round's prompt, whole (his sentence; the compact list if that would take more than
 * the dock's two lines, measured in its own font and box), your count or the round's result, and the crowd's meter: its
 * find rate so far against lightsOutHold (the line), from the server's count, moving as anyone taps.
 */
export function LightsDock({ lights, graceMs, now }: { lights: LightsView; graceMs: number; now: number }) {
  const st = lightsStatus(lights, graceMs, now);
  const box = useRef<HTMLSpanElement>(null);
  // 0: his sentence; 1: the compact list (it didn't fit); 2: the compact list, a size smaller.
  const [fit, setFit] = useState({ key: "", level: 0 });
  const level = fit.key === st.key + st.prompt ? fit.level : 0;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || level >= 2) return;
    if (el.scrollHeight > el.clientHeight + 1) setFit({ key: st.key + st.prompt, level: level + 1 });
  });
  const hold = BOSS_POWERS.lightsOutHold;
  const c = lights.crowd;
  const rate = c ? lightsRate(c) : null;
  const pct = rate === null ? null : Math.round(rate * 100);
  return (
    <div class="lo-dock" data-step={st.key}>
      <span ref={box} class={`lo-prompt${level === 2 ? " small" : ""}`} data-fit={level}>
        <strong>{level ? st.short : st.prompt}</strong> <span class="muted">{st.note}</span>
      </span>
      {st.meter && c ? (
        <span
          class={`lo-meter${rate !== null && rate >= hold ? " ok" : ""}`}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? 0}
          aria-label={`The crowd has found ${pct ?? 0}% of his pieces so far; it needs ${Math.round(hold * 100)}%`}
          data-found={c.found}
          data-settled={c.settled}
          data-asked={c.asked}
        >
          <span class="lo-meter-bar" aria-hidden="true">
            <i style={{ width: `${pct ?? 0}%` }} />
            <b style={{ left: `${hold * 100}%` }} />
          </span>
          <span class="lo-meter-pct">{pct === null ? "—" : `${pct}%`}</span>
          <span class="lo-meter-of muted">needs {Math.round(hold * 100)}%</span>
        </span>
      ) : (
        <span class="lo-meter" aria-hidden="true" />
      )}
    </div>
  );
}

/** The prompt box's sizes, each a step smaller (`.lo-line.fit1`…); past the last, it's moved back into view (SpeechBox). */
const LINE_FITS = 3;

export function LightsOutLayer({ boss, lights, now, orientation, graceMs, onTap }: { boss: BossView; lights: LightsView; now: number; orientation: "white" | "black"; graceMs: number; onTap: (square: string) => void }) {
  const kit = bossKit(boss.name);
  // The night is drawn ahead, a slice a frame, from when he drops in (its first showing never stalls a phone).
  useEffect(() => prewarm("nightSquare", nightWarmList()), [lights.key]);
  if (!kit?.ch.anims.lightsOut || !kit.ch.anims.lightsBack) return null;
  const { tl, t, round, open, used, deadline, back } = lightsBeat(lights, graceMs, now);
  const at = lights.at;
  const out = kit.ch.anims.lightsOut;
  const backAnim = kit.ch.anims.lightsBack;
  const smashes = lightsOutSmashes(out).map((x) => LIGHTS_OUT.dropAt + x);
  const relit = tl.backAt + (cueAt(backAnim, "relight") ?? 0);
  // The night: dimmed a step at each smash, night at the last, the dawn as the strand relights.
  let step: NightState["step"] | null = null;
  let stepSince = 0;
  smashes.forEach((s, k) => {
    if (t >= s) [step, stepSince] = [(["dim1", "dim2", "dim3"] as const)[k]!, at + s];
  });
  if (t >= relit) [step, stepSince] = ["dawn", at + relit];
  // Squares showing their piece in the latest round begun: found (from when this device saw it), the answers as it ends
  // (gold), and the night closing over them before the next round. A wrong square gets his slash; out of time, so does
  // each piece not found (quietly but the first), before its answer shows.
  const shown: { square: string; at: number; kind: "found" | "answer" }[] = [];
  const closing: { square: string; at: number }[] = [];
  const misses: SquareItem[] = [];
  const latest = tl.rounds.reduce((k, r, i) => (t >= r.at ? i : k), -1);
  if (latest >= 0) {
    const r = lights.rounds[latest]!;
    const tr = tl.rounds[latest]!;
    const mine = lights.mine[latest] ?? { found: [], wrong: [] };
    const ends = tr.over ? at + tr.answersAt : Infinity;
    for (const sq of mine.found) shown.push({ square: sq, at: firstSeen(`${lights.key}:${latest}:found:${sq}`, now), kind: "found" });
    for (const sq of mine.wrong) {
      const since = firstSeen(`${lights.key}:${latest}:wrong:${sq}`, now);
      if (now < since + 700) misses.push({ square: sq, name: "darkMiss", anim: "miss", since });
    }
    if (r.answers && now >= ends) {
      const left = r.answers.filter((sq) => !mine.found.includes(sq));
      if (mine.found.length < r.pieces.length && now < ends + 700) left.forEach((sq, k) => misses.push({ square: sq, name: "darkMiss", anim: "miss", since: ends, quiet: k > 0 }));
      for (const sq of left) shown.push({ square: sq, at: ends + 250, kind: "answer" });
    }
    // (The last round's stay until the dawn lifts the night.)
    if (latest < lights.rounds.length - 1) for (const x of shown) closing.push({ square: x.square, at: ends + LIGHTS_OUT.answerMs - CLOSE_MS });
  }
  // His spot: centred above the board, his feet on its top edge (the dawn spreads out from there).
  const spot = lightsOutSpot(kit.ch, 36);
  const spotSquare = orientation === "white" ? "d8" : "e1";
  const items = step && !(step === "dawn" && now > stepSince + DAWN_MS) ? nightItems({ orientation, step, since: stepSince, now, shown, closing, from: spotSquare }) : [];
  // His animation: the drop and the smashes, the countdown each round, his reaction as a round ends (found them all: he
  // recoils; any missed: he cackles), and the lights back. Then he's back in his corner.
  let anim: { name: string; since: number; then?: string } | null = null;
  if (t >= LIGHTS_OUT.dropAt) anim = { name: "lightsOut", since: at + LIGHTS_OUT.dropAt, then: "lightsTest" };
  tl.rounds.forEach((tr, i) => {
    if (t < tr.at) return;
    const secs = Math.round(lights.rounds[i]!.ms / 1000);
    anim = { name: kit.ch.anims[`test${secs}`] ? `test${secs}` : "lightsTest", since: at + tr.at, then: "lightsTest" };
    if (tr.over && t >= tr.answersAt) {
      const missed = lights.rounds[i]!.pieces.length - (lights.mine[i]?.found.length ?? 0);
      anim = { name: missed ? "testMiss" : "testFound", since: at + tr.answersAt, then: "lightsTest" };
    }
  });
  if (back) anim = { name: "lightsBack", since: at + tl.backAt };
  const gone = t >= tl.backAt + animLength(backAnim);
  // Each round's prompt in its box above the board's top-left, typed, for the whole round, through its answers, until
  // the next round's replaces it (Eric, Oct 10). His other words ("It's time.", and as the lights come back the
  // verdict: the crowd held the light or he moves twice; without a count, his usual line) go into his voice: his text
  // box keeps each up for its time (speech.tsx), after this screen has gone.
  const verdict = lightsVerdict(lights);
  const verdictBeat = verdict === "held" ? "lightsHeld" : verdict === "failed" ? "lightsFailed" : "lightsBack";
  const prompt = round >= 0 ? { text: findLine(lights.rounds[round]!.targets ?? lights.rounds[round]!.pieces), at: at + tl.rounds[round]!.at } : null;
  const said = `${boss.id}:${boss.startMove}:${lights.key}`;
  const timeAt = at + LIGHTS_OUT.dropAt + 200;
  const backAt = at + tl.backAt + 300;
  const tr = round >= 0 ? tl.rounds[round]! : null;
  // Each tap gives you a second more: "+1s" flashes by the bar as it bumps back up.
  const bumpAt = open && used > 0 ? firstSeen(`${lights.key}:${round}:tap:${used}`, now) : 0;
  return (
    <>
      {items.length > 0 && (
        <div class="power-board lo-board" aria-hidden="true" data-step={step ?? ""}>
          <BoardEffects items={items} orientation={orientation} class="pw-fire-board lo-night" />
        </div>
      )}
      {misses.length > 0 && (
        <div class="power-board lo-misses" aria-hidden="true">
          <BoardEffects items={misses} orientation={orientation} class="pw-fire-board" />
        </div>
      )}
      {/* (Markers for what shows where: found, answers; and the round on.) */}
      <div class="lo-marks" aria-hidden="true" data-round={round} data-open={open ? "1" : "0"}>
        {lights.mine.flatMap((m, i) => m.found.map((sq) => <span key={`f-${i}-${sq}`} class="lo-found" data-square={sq} data-round={i} />))}
        {lights.rounds.flatMap((r, i) => (r.answers ?? []).map((sq) => <span key={`a-${i}-${sq}`} class="lo-answer" data-square={sq} data-round={i} />))}
      </div>
      {!gone && (
        <div class="power-moment pm-lights">
          {t < LIGHTS_OUT.dropAt && <PowerBanner boss={boss} side={boss.crowdSide} text="LIGHTS OUT!" tone="dark" />}
          {anim && (
            <span class="pm-hollow-spot" style={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.width}%`, aspectRatio: `${kit.ch.w} / ${kit.ch.h}` }}>
              <BossMoment boss={boss.name} anim={(anim as { name: string }).name} since={(anim as { since: number }).since} then={(anim as { then?: string }).then} />
            </span>
          )}
        </div>
      )}
      {now >= timeAt && <Say voice={bossVoice} text={kit.lines.ultimate?.[0] ?? "It's time."} sayKey={`${said}:time`} priority={CRITICAL} at={timeAt} />}
      {back && now >= backAt && (
        <Say voice={bossVoice} text={(pickLine(kit, verdictBeat, `${lights.key}:back`) ?? kit.lines[verdictBeat]?.[0] ?? kit.lines.lightsBack?.[0]) || "Remember that."} sayKey={`${said}:back`} priority={NORMAL} at={backAt} />
      )}
      {prompt && now >= prompt.at && <SpeechBox key={prompt.text} class="pm-line lo-line" text={prompt.text} at={prompt.at} until={Infinity} now={now} fits={LINE_FITS} />}
      {tr && open && <TimerBar startsAt={at + tr.at} deadline={at + deadline} total={tr.until - tr.at} />}
      {bumpAt > 0 && now < bumpAt + 800 && (
        <span key={`bump-${round}-${used}`} class="lo-plus" aria-hidden="true">
          +1s
        </span>
      )}
      {open && (
        <div
          class="lo-taps"
          role="grid"
          aria-label="Tap where his pieces are"
          onPointerDown={(e) => {
            const cg = (e.currentTarget as HTMLElement).parentElement?.querySelector("cg-board");
            const sq = cg ? squareAtPoint(cg, e.clientX, e.clientY, orientation) : null;
            if (sq) onTap(sq);
          }}
        />
      )}
    </>
  );
}
