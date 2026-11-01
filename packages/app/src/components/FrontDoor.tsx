import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { FRONT_DOOR, type ItemLook, type ItemSlot } from "@chessroyale/core";
import type { HomeRankLine } from "../ranked.ts";
import { Avatar } from "./Items.tsx";
import { account } from "../account.ts";
import type { LiveCounts } from "../live.ts";
import { testSwitchesAllowed } from "../test-switches.ts";

/**
 * The front door's shared pieces (home, queue, profiles, the desktop frame), in the approved look: dark ground,
 * two panel shades, gold, green for online, Archivo and Archivo Black. Dressed pawns are always the item-builder's
 * Avatar; nothing here draws an item.
 */

/** "Hun" + "Chess" in gold. */
export function Logo({ onClick }: { onClick?: () => void }) {
  const inner = (
    <>
      Hun<span>Chess</span>
    </>
  );
  return onClick ? (
    <button type="button" class="fd-logo" onClick={onClick} aria-label="HunChess home">
      {inner}
    </button>
  ) : (
    <div class="fd-logo">{inner}</div>
  );
}

/**
 * A dressed pawn (the item-builder's Avatar) in a box with room for what sticks out (a weapon, a crown), and an
 * optional shadow under it. `size` picks the box from the stylesheet. `ride` (the profiles, Oct 31; home's pawn and your ring,
 * Nov 1): on its ride, if it has one on, its idle playing, fitted into the same box.
 */
/** One hop of the hero pawn (styles.css, `fd-hop`: 1.8 s). */
const HOP_MS = 1800;

export function DressedPawn({
  look,
  size,
  shadow,
  side = "w",
  ride = false,
}: {
  look?: ItemLook;
  size: "hero" | "profile" | "ring" | "card" | "seat" | "side" | "stage" | "avatar";
  shadow?: boolean;
  side?: "w" | "b";
  ride?: boolean;
}) {
  const pawn = useRef<HTMLSpanElement>(null);
  // Home's hero pawn hops, on a computer as on a phone, not under reduced motion (Eric: "add the bounce effect every 30
  // seconds like we have in autochess"; Oct 24: it never hopped on a computer, because this check and the hop's CSS were
  // phone-only): the first hop FRONT_DOOR.heroHopFirstSec after it shows, then one every FRONT_DOOR.heroHopEverySec. The
  // timers stop when the pawn goes (home closes).
  useEffect(() => {
    if (size !== "hero") return;
    const canHop = () => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let next: ReturnType<typeof setTimeout>;
    let land: ReturnType<typeof setTimeout>;
    const hop = () => {
      if (canHop()) {
        pawn.current?.classList.add("hop");
        land = setTimeout(() => pawn.current?.classList.remove("hop"), HOP_MS);
      }
      next = setTimeout(hop, FRONT_DOOR.heroHopEverySec * 1000);
    };
    next = setTimeout(hop, FRONT_DOOR.heroHopFirstSec * 1000);
    return () => {
      clearTimeout(next);
      clearTimeout(land);
    };
  }, [size]);
  const box = (
    <span class="fd-pawn-box">
      <Avatar look={look} side={side} ride={ride} />
    </span>
  );
  return (
    <span ref={pawn} class={`fd-pawn fd-pawn-${size}${shadow ? " shadow" : ""}`} aria-hidden="true">
      {/* (Home's hero: the box sits in a pawn-sized wrapper that hops, so the hop moves the pawn and nothing in the layout.) */}
      {size === "hero" ? <span class="fd-hop">{box}</span> : box}
    </span>
  );
}

/** Your pawn in a gold ring: it opens your profile. */
export function MyPawnButton({ onClick }: { onClick: () => void }) {
  const p = account().profile;
  return (
    <button type="button" class="fd-ring" aria-label="Your profile" onClick={onClick}>
      <DressedPawn look={p?.locker?.look} size="ring" ride />
    </button>
  );
}

/**
 * Your pawn in its ring (the home's top bar on a phone; the top right of the page on a computer). No coins (Eric,
 * Oct 18: "nobody needs to see their coins" there; the shop and your profile show them).
 */
export function AccountBar({ onProfile }: { onProfile: () => void }) {
  return (
    <div class="fd-top-right">
      <MyPawnButton onClick={onProfile} />
    </div>
  );
}

/** Settings: a gear (the side menu, your profile). */
export const GearIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

/** The shop: a bag, drawn as the gear is (the phone's top bar). */
export const ShopIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 8h14l-1 12.2a1 1 0 0 1-1 .8H7a1 1 0 0 1-1-.8z" />
    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
  </svg>
);

/** Friends: two people, drawn as the gear is (the phone's top bar). */
export const FriendsIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <circle cx="17" cy="9" r="2.6" />
    <path d="M16 13.6c2.8.2 5 2.2 5 5" />
  </svg>
);

export function FdButton({
  children,
  primary,
  danger,
  disabled,
  onClick,
  label,
  title,
  class: cls,
}: {
  children: ComponentChildren;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
  /** A tooltip on a computer. */
  title?: string;
  class?: string;
}) {
  return (
    <button
      type="button"
      class={`fd-btn${primary ? " primary" : ""}${danger ? " danger" : ""}${cls ? ` ${cls}` : ""}`}
      disabled={disabled}
      aria-label={label}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** "● 214 online · 9 matches running · 31 in queue", from the server (an empty line of the same height until then). */
export function LiveLine({ live, stacked }: { live: LiveCounts | null; stacked?: boolean }) {
  if (!live) {
    return (
      <div class="fd-live" aria-hidden="true">
        <span class="fd-dot off" />
        <span class="fd-live-wait">&nbsp;</span>
      </div>
    );
  }
  const label = `${live.online} online, ${live.matches} matches running, ${live.queue} in queue`;
  // (The computer's side panel: one number to a line.)
  if (stacked) {
    return (
      <div class="fd-live stacked" role="status" aria-label={label}>
        <span class="fd-dot" />
        <span class="fd-live-lines">
          <strong>{live.online.toLocaleString("en-US")} online</strong>
          <span>{plural(live.matches, "match", "matches")} running</span>
          <span>{live.queue.toLocaleString("en-US")} in queue</span>
        </span>
      </div>
    );
  }
  return (
    <div class="fd-live" role="status" aria-label={label}>
      <span class="fd-dot" />
      <span>
        <strong>{live.online.toLocaleString("en-US")} online</strong> · {plural(live.matches, "match", "matches")} running · {live.queue.toLocaleString("en-US")} in queue
      </span>
    </div>
  );
}

/** A profile's rating pill: the crowd rating's number ("Rating 1612"), or "No rating yet". (No rank name: since Oct 28 the rank shown is 1 v 1's.) */
export function RatingPill({ rating }: { rating: number | null }) {
  return <span class="fd-pill">{rating === null ? "No rating yet" : `Rating ${Math.round(rating)}`}</span>;
}

/**
 * PLACEHOLDER for an admin's home, until the real levels exist (Eric, Oct 28: the level "lvl - 38", "show it at 3/4 like I'm
 * 3/4 to level 39"). Shown only where testSwitchesAllowed(); a player sees no level. The real level system replaces it. (The
 * test rank "Opal III" it came with is now any rank by `?rank=`: ranked.ts, rankFromSwitch.)
 */
export const TEST_LEVEL = { level: 38, progress: 0.75 } as const;

/**
 * The rank line under your name on home (Eric, Oct 28: "we're going with the new ranking system"): your ranked 1 v 1 rank,
 * the tier and division in the tier's color ("Gold 3 · 45 RP"), "Placement 2/5", or "Unranked" before your first ranked
 * game; a non-breaking space while your account loads (the line keeps its height). An admin's `?rank=` shows that rank.
 */
export function RankLine({ line }: { line: HomeRankLine }) {
  if (!line) return <>{"\u00a0"}</>;
  if (line === "unranked") return <>Unranked</>;
  if (line.placement) return <>{line.label}</>;
  const i = line.label.indexOf(" · ");
  return (
    <>
      <span class="fd-rank" style={{ "--tier": line.color }}>
        {line.label.slice(0, i)}
      </span>
      {line.label.slice(i)}
    </>
  );
}

// The ring round your icon, in the viewBox's own units: the icon's 38 px, a 2 px gap and the 2 px ring, so the ring's middle
// is 3 px out from the icon (a 13 radius round the icon's 10). Its length is worked out here so the fill needs no pathLength.
const RING = 46;
const RING_R = 13;
const RING_LEN = 4 * (RING - 2 - 2 * RING_R) + 2 * Math.PI * RING_R;
const RING_PATH = `M${RING / 2} 1H${RING - 1 - RING_R}A${RING_R} ${RING_R} 0 0 1 ${RING - 1} ${1 + RING_R}V${RING - 1 - RING_R}A${RING_R} ${RING_R} 0 0 1 ${RING - 1 - RING_R} ${RING - 1}H${1 + RING_R}A${RING_R} ${RING_R} 0 0 1 1 ${RING - 1 - RING_R}V${1 + RING_R}A${RING_R} ${RING_R} 0 0 1 ${1 + RING_R} 1H${RING / 2}`;

/**
 * An admin's test level on home (TEST_LEVEL, a placeholder): a thin green ring round your icon, filled clockwise from the top
 * to `progress` over a faint track, and "LVL 38" above it. Both sit outside the icon's box (styles.css, `fd-level`).
 */
export function LevelRing() {
  const { level, progress } = TEST_LEVEL;
  return (
    <>
      <span class="fd-level">{`LVL ${level}`}</span>
      <svg class="fd-level-ring" viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true" focusable="false">
        <path class="track" d={RING_PATH} />
        <path class="fill" d={RING_PATH} stroke-dasharray={`${(progress * RING_LEN).toFixed(2)} ${RING_LEN.toFixed(2)}`} />
      </svg>
    </>
  );
}

/** The order worn items are listed in (a ride last, Oct 31). */
export const WORN_ORDER: readonly ItemSlot[] = ["skin", "head", "face", "weapon", "ride"];

/** The 44 px back button at the top left of a front-door page. */
export function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" class="fd-back" aria-label={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

