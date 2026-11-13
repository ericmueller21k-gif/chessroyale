/**
 * The area banner (Eric, Nov 11, approving its mockup: "super clean. That's exactly what I was imagining";
 * docs/decisions/2026-11-11-area-banner-room-music.md): as you walk into a home's room through its door, its name across a soft dark
 * band a third down the room's view, the boss's name above it in gold ("DON DOUGH'S"), a thin gold rule above and below the name.
 * Fades in, holds and fades out (AREA_BANNER); reduced motion shows it for the same time with no fades. Taps pass through it.
 */
import { useLayoutEffect, useRef } from "preact/hooks";
import { AREA_BANNER } from "@chessroyale/core";

export interface AreaBannerText {
  /** The gold line above: the boss's name and 's, or the back room's; null for a room without a boss (just the name). */
  sub: string | null;
  /** The building's name. */
  title: string;
}

/** What a room's banner says, from its data: its home's name, its boss's (a room without one: none), "BACK ROOM" for a back room. */
export function areaBannerOf(def: { boss?: string | null; part?: "back" | "landing" | "top" }, homeName: string): AreaBannerText {
  // (The walk-up's floors, Nov 13: "Second floor", "Top floor" over its name; its hall, as every home's front, its boss's.)
  const sub = def.part === "back" ? "Back room" : def.part === "landing" ? "Second floor" : def.part === "top" ? "Top floor" : def.boss ? `${def.boss}'s` : null;
  return { sub: sub && sub.toUpperCase(), title: homeName.toUpperCase() };
}

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AreaBanner({ text, onDone }: { text: AreaBannerText; onDone: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  // (A layout effect: its first frame is already at the fade's start.)
  useLayoutEffect(() => {
    const { inMs, holdMs, outMs } = AREA_BANNER;
    const total = inMs + holdMs + outMs;
    const a =
      !reduced() && el.current?.animate
        ? el.current.animate([{ opacity: 0 }, { opacity: 1, offset: inMs / total }, { opacity: 1, offset: (inMs + holdMs) / total }, { opacity: 0 }], { duration: total, fill: "forwards" })
        : null;
    const t = setTimeout(() => done.current(), total);
    return () => {
      clearTimeout(t);
      a?.cancel();
    };
  }, []);
  return (
    <div class="area-banner" aria-hidden="true">
      <div class="area-banner-band" ref={el}>
        {text.sub && <div class="area-banner-sub">{text.sub}</div>}
        <div class="area-banner-rule" />
        <div class="area-banner-title">{text.title}</div>
        <div class="area-banner-rule" />
      </div>
    </div>
  );
}
