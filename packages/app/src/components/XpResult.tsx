import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { XP, XP_NONE_LINES, levelOf, levelProgress, xpAt, xpFillMs, xpInLevel, xpShownParts, type XpGrant } from "@chessroyale/core";
import { account, playerName } from "../account.ts";
import { gameXp, markXpFilled, xpFilled } from "../xp.ts";

/**
 * The XP box on every result screen (Eric, Nov 9: "after a game, it shows your meter bar and then it shows it like moving. I don't
 * want it to skip… It should like go up like a nice satisfying looking thing… on every page"; docs/decisions/2026-11-09-xp-box.md).
 * One fixed box (nothing shifts, whatever it shows): the gain and your level on top, the bar, then the parts ("Win +50": never the
 * minutes, Eric, Nov 9; core's xpShownParts) or why there was none; the top row reads "+37 XP · <your name> · Level 2", so it's plainly yours, not the boss's ("No XP: you left the match."). The bar fills from the old XP to the new over 1.5 to 2.5 s
 * (core's xpAt: eased, never a jump), the number counting up with it and each part showing as its share starts; a level-up fills
 * to the end, pops "Level 8!" and goes on from empty. Each frame only sets the bar's transform and three texts (its box contains its
 * own layout). Reduced motion: the end at once.
 *
 * `compact` (a boss battle's result, Eric, Nov 9: under your pawn, facing the boss): no frame; your name on a line of its own, then
 * "+N XP" and "Level N" over the bar, then the parts. The same pieces and fill (docs/decisions/2026-11-09-boss-result-v2.md).
 */

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `xp`: the grant (null: none came; undefined: still coming). `none`: what to say when none came (default: "No XP for this game."). */
export function XpResult({ xp, none = "No XP for this game.", compact = false }: { xp: XpGrant | null | undefined; none?: string; compact?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const gain = useRef<HTMLSpanElement>(null);
  const level = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const partsRef = useRef<HTMLDivElement>(null);
  // (While it's coming: your XP as your profile had it when the box appeared, standing still, read once: a profile refreshed while
  // waiting never moves the bar. For a game with none: the server's.)
  // (Read for a box with no grant too (`null`): it shows your real level, never "Level 1"; delta review D1.)
  const waited = useRef<number | null>(xp ? null : (account().profile?.xp ?? 0));
  const still = xp ? xp.before : (waited.current ?? 0);
  // (Where the fill starts, decided once per grant (review m7, Nov 9): never below what the box already showed while waiting, so the
  // bar never steps back; and a grant whose fill already finished in an earlier box (Squads' card, then its results) isn't
  // played again.)
  const plan = useRef<{ xp: XpGrant; from: number; again: boolean } | null>(null);
  if (xp && plan.current?.xp !== xp) {
    const shown = waited.current ?? xp.before;
    plan.current = { xp, from: Math.min(xp.after, Math.max(xp.before, shown)), again: xpFilled(xp) };
  }
  const from = xp ? plan.current!.from : still;
  const filling = !!xp && !xp.none && xp.after > from && !plan.current!.again;
  // (Done: its last state is shown. Never while it's still coming; at once for a game with none or nothing gained.)
  const [filled, setFilled] = useState<XpGrant | null>(null);
  const done = xp !== undefined && (!filling || filled === xp);

  // The fill, frame by frame, from its first frame (a layout effect: the box's first paint is the old XP).
  useLayoutEffect(() => {
    if (!xp || xp.none || !filling) return;
    const ms = xpFillMs(xp.after - from);
    const parts = [...(partsRef.current?.querySelectorAll<HTMLElement>(".xp-part") ?? [])];
    // (Each part shows as the count reaches its share: the first at once.)
    // (By the shown part's place in all the parts: the hidden time part still takes its share first.)
    const shown = xpShownParts(xp.parts);
    const starts = shown.map((s) => xp.parts.slice(0, s.of).reduce((sum, p) => sum + p.xp, 0));
    let shownLevel = levelOf(from);
    const draw = (t: number) => {
      const at = xpAt(from, xp.after, t, ms);
      if (fill.current) fill.current.style.transform = `scaleX(${at.share})`;
      if (gain.current) gain.current.textContent = `+${fmt(at.xp - xp.before)} XP`;
      if (at.level !== shownLevel) {
        shownLevel = at.level;
        if (level.current) level.current.textContent = `Level ${at.level}`;
        // (The pop: its animation started again for each new level.)
        const el = pop.current;
        if (el) {
          el.textContent = `Level ${at.level}!`;
          el.classList.remove("on");
          void el.offsetWidth;
          el.classList.add("on");
          // (The label steps aside while the pop stands in its place: never two "Level"s on top of each other.)
          box.current?.classList.add("xp-popping");
          el.onanimationend = () => box.current?.classList.remove("xp-popping");
        }
      }
      parts.forEach((el, i) => el.classList.toggle("shown", i === 0 || at.xp - xp.before >= starts[i]!));
    };
    const end = () => {
      markXpFilled(xp);
      setFilled(xp);
    };
    if (reduced()) {
      draw(ms);
      end();
      return;
    }
    draw(0);
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = now - t0;
      draw(t);
      if (t < ms) raf = requestAnimationFrame(frame);
      else end();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [xp]);

  const nothing = xp === null || !!xp?.none;
  const line = xp === undefined ? "Counting your XP…" : xp === null ? none : xp.none ? XP_NONE_LINES[xp.none] : null;
  const start = filling ? from : xp && !xp.none ? xp.after : still;
  const shownParts = xp && !xp.none ? xpShownParts(xp.parts) : [];
  return (
    <div class={`xp-box${compact ? " xp-compact" : ""}${nothing ? " xp-none" : ""}${xp === undefined ? " xp-wait" : ""}${done ? " xp-done" : ""}`} data-testid="xp-box" aria-live="polite" ref={box}>
      <div class="xp-top">
        <span class="xp-gain" ref={gain}>
          {xp === undefined ? "XP" : `+${fmt(filling ? from - (xp?.before ?? 0) : (xp?.after ?? 0) - (xp?.before ?? 0))} XP`}
        </span>
        {/* (Whose XP it is (Eric, Nov 9: "it looks like the boss is the one leveling up"): your name, centered, shrinking first.) */}
        <span class="xp-name" data-testid="xp-name">
          {playerName()}
        </span>
        <span class="xp-level" ref={level}>
          Level {levelOf(start)}
        </span>
      </div>
      <div class="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={XP.perLevel} aria-valuenow={xpInLevel(xp?.after ?? still)}>
        <div class="xp-fill" ref={fill} style={{ transform: `scaleX(${levelProgress(start)})` }} />
        <span class="xp-pop" ref={pop} aria-hidden="true" />
      </div>
      <div class="xp-parts" ref={partsRef}>
        {line !== null ? (
          <span class="xp-why">{line}</span>
        ) : (
          shownParts.map((p, i) => (
            <span key={i} class={`xp-part${filling ? "" : " shown"}`}>
              {i > 0 && <span class="xp-dot"> · </span>}
              {p.label}
              {p.xp !== null && (
                <>
                  {" "}
                  <b>+{fmt(p.xp)}</b>
                </>
              )}
            </span>
          ))
        )}
        {line === null && !xp!.parts.length && <span class="xp-why">{fmt(xpInLevel(xp!.after))} / {fmt(XP.perLevel)} XP</span>}
      </div>
    </div>
  );
}

/** A result screen's XP for its match (online: by its lobby code; solo: when its result comes back). Undefined: still coming. */
export function useGameXp(match: object, opts: { code?: string | null; solo?: boolean }): XpGrant | null | undefined {
  const [xp, setXp] = useState<XpGrant | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void gameXp(match, opts).then((x) => live && setXp(x));
    return () => {
      live = false;
    };
  }, [match]);
  return xp;
}
