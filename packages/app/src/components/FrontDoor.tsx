import type { ComponentChildren } from "preact";
import { equippedLook, itemDef, ratingTier, shopItem, type ItemLook, type ItemSlot, type RankEffect, type ShopState } from "@chessroyale/core";
import { Avatar } from "./Items.tsx";
import { account, type Profile } from "../account.ts";
import type { LiveCounts } from "../live.ts";
import { setThemePref, toggledPref, useTheme } from "../theme.ts";

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

/** "12k", "1.2M": a big balance, short, for the narrowest phones' top bar. */
export function shortCoins(n: number): string {
  if (n < 10_000) return n.toLocaleString("en-US");
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${Math.floor(n / 100_000) / 10}M`;
}

/**
 * Your coin balance, as the server has it (hidden without an account): "● 1,250 coins". In a phone's top bar the word
 * goes when there isn't room for it, and below 360 px a balance of 10,000 or more shows short ("12k"), so the bar
 * never runs off the screen.
 */
export function Coins({ coins }: { coins: number | null }) {
  if (coins === null) return null;
  const full = coins.toLocaleString("en-US");
  const short = shortCoins(coins);
  return (
    <div class="fd-coins" aria-label={`${coins} coins`}>
      <span class="fd-coins-n">
        <span aria-hidden="true">●</span> <span class={short !== full ? "fd-coins-full" : undefined}>{full}</span>
        {short !== full && <span class="fd-coins-short">{short}</span>}
      </span>
      <span class="fd-coins-word"> coins</span>
    </div>
  );
}

/** The shop hat you wear (shown when no crate item is on your head). */
export const myHat = (profile: Profile | null | undefined) => equippedLook(profile?.shop, "hat").hat ?? "none";

/**
 * A dressed pawn (the item-builder's Avatar) in a box with room for what sticks out (a weapon, a crown), and an
 * optional shadow under it. `size` picks the box from the stylesheet.
 */
export function DressedPawn({
  look,
  hat = "none",
  size,
  shadow,
  side = "w",
}: {
  look?: ItemLook;
  hat?: string;
  size: "hero" | "profile" | "ring" | "card" | "seat" | "side";
  shadow?: boolean;
  side?: "w" | "b";
}) {
  return (
    <span class={`fd-pawn fd-pawn-${size}${shadow ? " shadow" : ""}`} aria-hidden="true">
      <span class="fd-pawn-box">
        <Avatar look={look} side={side} hat={hat} />
      </span>
    </span>
  );
}

/** Your pawn in a gold ring: it opens your profile. */
export function MyPawnButton({ onClick }: { onClick: () => void }) {
  const p = account().profile;
  return (
    <button type="button" class="fd-ring" aria-label="Your profile" onClick={onClick}>
      <DressedPawn look={p?.locker?.look} hat={myHat(p)} size="ring" />
    </button>
  );
}

/** Your coins and your pawn in its ring (the home's top bar on a phone; the top right of the page on a computer). */
export function AccountBar({ onProfile }: { onProfile: () => void }) {
  const p = account().profile;
  return (
    <div class="fd-top-right">
      <Coins coins={p?.shop?.coins ?? null} />
      <MyPawnButton onClick={onProfile} />
    </div>
  );
}

/**
 * Light or dark (Eric: "when you click the sun, it switches to a black sun, and then it makes it dark mode"): a bright
 * sun in light mode, a black one in dark mode. A tap shows the other theme and remembers the pick on this device.
 */
export function ThemeButton({ class: cls }: { class?: string }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      class={`fd-theme${dark ? " dark" : ""}${cls ? ` ${cls}` : ""}`}
      aria-label="Dark mode"
      aria-pressed={dark}
      title={dark ? "Dark mode (tap for light)" : "Light mode (tap for dark)"}
      onClick={() => setThemePref(toggledPref(theme))}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" stroke-linecap="round" aria-hidden="true">
        <circle class="fd-sun-disc" cx="12" cy="12" r="6" stroke-width="1.6" />
        <path
          class="fd-sun-rays"
          stroke-width="2"
          d="M19.8 12H22M17.52 17.52l1.55 1.55M12 19.8V22M6.48 17.52l-1.55 1.55M4.2 12H2M6.48 6.48 4.93 4.93M12 4.2V2M17.52 6.48l1.55-1.55"
        />
      </svg>
    </button>
  );
}

/** Settings: a gear (the side menu, your profile). */
export const GearIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export function FdButton({
  children,
  primary,
  danger,
  disabled,
  onClick,
  label,
  class: cls,
}: {
  children: ComponentChildren;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
  class?: string;
}) {
  return (
    <button
      type="button"
      class={`fd-btn${primary ? " primary" : ""}${danger ? " danger" : ""}${cls ? ` ${cls}` : ""}`}
      disabled={disabled}
      aria-label={label}
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

/** What a rank needs to be drawn: its name, colour and (the top ranks) effect. */
export type RankLook = { label: string; color: string; effect: RankEffect | null };

const rankClass = (t: RankLook) => `tier${t.effect ? ` rank-${t.effect}` : ""}`;

/** The rank pill on a profile: "Weighty · 1612" in the rank's colour (the top three dressed up), or "No rating yet". */
export function RankPill({ tier, rating }: { tier: RankLook | null; rating: number | null }) {
  if (!tier || rating === null) return <span class="fd-pill">No rating yet</span>;
  return (
    <span class={`fd-pill ${rankClass(tier)}`} style={{ "--tier": tier.color }}>
      {`${tier.label} · ${Math.round(rating)}`}
    </span>
  );
}

/** The rank line under your name on home: the rank's name in its colour, then the rating ("Weighty · 1612"). */
export function RankLine({ rating }: { rating: number | null }) {
  const t = ratingTier(rating);
  if (!t || rating === null) return <>No rating yet</>;
  return (
    <>
      <span class={`fd-rank ${rankClass(t)}`} style={{ "--tier": t.color }}>
        {t.label}
      </span>
      {` · ${Math.round(rating)}`}
    </>
  );
}

/** The order worn items are listed in. */
export const WORN_ORDER: readonly ItemSlot[] = ["skin", "head", "face", "weapon"];

/** What you wear, by name: crate items, then a shop hat if no crate item is on the head. */
export function wearingNames(look: ItemLook | undefined, shop: Pick<ShopState, "equipped"> | null | undefined): string {
  const names = WORN_ORDER.flatMap((slot) => {
    const it = look?.[slot];
    const d = it && itemDef(it.def);
    return d ? [d.name] : [];
  });
  const hat = shopItem(shop?.equipped?.hat ?? "");
  if (!look?.head && hat && hat.look.hat && hat.look.hat !== "none") names.splice(look?.skin ? 1 : 0, 0, hat.name);
  return names.join(", ");
}

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

