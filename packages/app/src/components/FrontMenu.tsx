import type { ComponentChildren } from "preact";
import { account } from "../account.ts";
import { friendsBadge, useFriends } from "../friends.ts";
import { useLive } from "../live.ts";
import { DressedPawn, GearIcon, Logo } from "./FrontDoor.tsx";
import { GlobalChat } from "./GlobalChat.tsx";
import { FriendsBadge, InviteToast } from "./Friends.tsx";
import { AwayNote } from "./AwayNote.tsx";
import { Pic } from "../home-art/Pic.tsx";
import { ARENA_TOWN_BADGE } from "../home-art/arena-town-badge.ts";
import { MOUSE_LAYOUT } from "./MatchMenu.tsx";
import { useMedia } from "./QuickChat.tsx";
import { questsForYou } from "../quests.ts";

/** Where the computer's side menu can take you. */
export interface FrontNav {
  home: () => void;
  /** Chess Town: the town square (/town; Eric, Oct 26, as Boss Arena; renamed Nov 1). */
  chessTown: () => void;
  /** Solo Boss Mode: the solo boss screen (the tiles, the stage, Boss alone; Eric, Oct 26). */
  soloBoss: () => void;
  friends: () => void;
  /** Daily Quests: home with its quests overlay open (Eric, Nov 10). */
  quests: () => void;
  shop: () => void;
  profile: () => void;
  settings: () => void;
  /** Your friends list (the live panel's Friends section, the phone home's line). */
  friendsList: () => void;
  /** Sign in (the global chat's guests). */
  signIn?: () => void;
}

export type FrontPage = "home" | "town" | "raid" | "queue" | "profile" | "settings" | "shop" | "lobby" | "friends" | "autochess";

const Icon = ({ d, children }: { d?: string; children?: ComponentChildren }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);

/** The crown: Boss Battle's icon (Chess Town has the crest). */
const crown = () => (
  <Icon>
    <path d="M5 20h14M6 20l-1.5-11 4.5 3.5L12 5l3 7.5L19.5 9 18 20" />
  </Icon>
);

function Item({ label, icon, on, tip, tour, title, disabled, onClick }: { label: string; icon: ComponentChildren; on?: boolean; tip?: boolean; tour?: string; title?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" class={`fd-menu-item${on ? " on" : ""}`} data-tour={tour} aria-current={on ? "page" : undefined} title={title ?? (tip ? label : undefined)} disabled={disabled} onClick={onClick}>
      <span class="fd-menu-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/**
 * The computer's left column: the logo, where to go, and Settings at the bottom (like the big chess sites). `game`: on a
 * match's screen (GameFrame, Nov 1), where each item leaves the match first (App.tsx), its labels as tooltips.
 */
export function SideMenu({ page, nav, game = false }: { page?: FrontPage; nav: FrontNav; game?: boolean }) {
  const p = account().profile;
  const tip = game;
  const questsOn = questsForYou();
  return (
    <nav class="fd-side" aria-label="Menu">
      <Logo onClick={nav.home} />
      <div class="fd-menu">
        <Item tip={tip} tour="play" label="Play" on={page === "home" || page === "queue"} onClick={nav.home} icon={<Icon d="M7 4.5v15l12-7.5z" />} />
        <Item tip={tip} tour="chess-town" label="Chess Town" on={page === "town"} onClick={nav.chessTown} icon={<Pic ch={ARENA_TOWN_BADGE} scale={1} class="fd-menu-crest" />} />
        <Item tip={tip} tour="boss-battle" label="Boss Battle" on={page === "raid"} onClick={nav.soloBoss} icon={crown()} />
        <Item
          tip={tip}
          tour="play-with-friends"
          label="Play with friends"
          on={page === "lobby"}
          onClick={nav.friends}
          icon={
            <Icon>
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
              <circle cx="17" cy="9" r="2.6" />
              <path d="M16 13.6c2.8.2 5 2.2 5 5" />
            </Icon>
          }
        />
        {/* (Daily Quests (Eric, Nov 10): the quests overlay, over home. Greyed until quests are yours, as the phone's top-bar button.) */}
        <Item
          tip={tip}
          tour="quests"
          label="Daily Quests"
          title={questsOn === false ? "Sign in for quests" : tip ? "Daily Quests" : undefined}
          disabled={questsOn !== true}
          onClick={nav.quests}
          icon={
            <Icon>
              <path d="M8 4H6.5A2.5 2.5 0 0 0 4 6.5v13A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5v-13A2.5 2.5 0 0 0 17.5 4H16" />
              <rect x="8" y="2" width="8" height="4" rx="1.2" />
              <path d="M8.5 13.2l2.3 2.3 4.2-4.4" />
            </Icon>
          }
        />
        <Item
          tip={tip}
          tour="shop"
          label="Shop & crates"
          on={page === "shop"}
          onClick={nav.shop}
          icon={
            <Icon>
              <path d="M5 8h14l-1.2 12H6.2z" />
              <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
            </Icon>
          }
        />
        <Item tip={tip} tour="profile" label="Profile" on={page === "profile"} onClick={nav.profile} icon={<DressedPawn size="ring" look={p?.locker?.look} ride own />} />
      </div>
      <div class="fd-menu fd-menu-end">
        <Item tip={tip} tour="settings" label="Settings" on={page === "settings"} onClick={nav.settings} icon={<GearIcon />} />
      </div>
    </nav>
  );
}

/** The right column's top slot: the town's (TOWN and its tools, which Town.tsx draws into it), auto chess's (AUTO CHESS and the round, AutoChess.tsx), else empty (RightPanel). */
export const RIGHT_SLOT_TOOLS = "rc-slot-tools";

/**
 * The computer's right column (Eric's approved mockup, Nov 7: notes/briefs/assets/chat-column-*.png), the same place and size on
 * every front-door page (home and every mode, the queue, the town and its rooms, the pages): flat, no boxes, thin lines between.
 * From the top: a slot of fixed height (in the town "TOWN" with its tools under it; elsewhere empty, so nothing below ever moves),
 * "FRIENDS ›" (opens your friends) and the live line under it, then the global chat (components/GlobalChat.tsx) filling the rest.
 * docs/decisions/2026-11-07-typed-chat-column.md.
 */
export function RightPanel({ onFriends, onSignIn, slot }: { onFriends: () => void; onSignIn?: () => void; slot?: string }) {
  // (A computer's: under 1024 px the column isn't shown, so nothing in it is drawn, fetched or polled.)
  const computer = useMedia("(min-width: 1024px)");
  return computer ? <RightColumn onFriends={onFriends} onSignIn={onSignIn} slot={slot} /> : <aside class="fd-right" aria-label="Live" />;
}

function RightColumn({ onFriends, onSignIn, slot }: { onFriends: () => void; onSignIn?: () => void; slot?: string }) {
  const live = useLive();
  // (Your friends' news for the badge: requests and invites, refreshed while the column shows.)
  useFriends(true);
  const label = live ? `${live.online} online, ${live.matches} matches running, ${live.queue} in queue` : undefined;
  return (
    <aside class="fd-right" aria-label="Live">
      <div class="rc-slot">
        {slot && (
          <>
            <h2 class="rc-h">{slot}</h2>
            <div class="rc-tools" id={RIGHT_SLOT_TOOLS} />
          </>
        )}
      </div>
      <div class="rc-sep" />
      <button type="button" class="rc-h rc-friends" onClick={onFriends}>
        FRIENDS ›<FriendsBadge n={friendsBadge()} />
      </button>
      <p class="rc-online" role="status" aria-label={label}>
        <span class={`fd-dot${live ? "" : " off"}`} />
        {live ? (
          <>
            <b>{live.online.toLocaleString("en-US")} online</b> · {plural(live.matches, "match", "matches")} · {live.queue.toLocaleString("en-US")} in queue
          </>
        ) : (
          " "
        )}
      </p>
      <div class="rc-sep" />
      <GlobalChat onSignIn={onSignIn} />
    </aside>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/**
 * A match's screen on a computer with a mouse (Nov 1): the side menu beside it, the match in the rest (game-frame.css). A
 * phone or a tablet has no frame: the screen is as it was.
 */
export function GameFrame({ children, nav }: { children: ComponentChildren; nav: FrontNav }) {
  // (Not on a touch screen: the front door's side menu is shown at 1024 px and wider whatever the pointer, which would move a
  // tablet's screen, so it isn't drawn there. The frame is the same element either way (no box of its own on a phone or a
  // tablet: game-frame.css), so a window that crosses the line keeps its screen mounted.)
  const mouse = useMedia(MOUSE_LAYOUT);
  return (
    <div class="gm-frame">
      {mouse && <SideMenu nav={nav} game />}
      <div class="gm-main">{children}</div>
    </div>
  );
}

/**
 * The front door's frame: the page's background and its center column. On a computer (1024 px and wider) with `nav`,
 * the side menu on the left and the live panel on the right; on a phone, just the center. (The queue is a state of
 * the home screen, in the same frame: see HomeScreen.)
 */
export function FrontFrame({ children, page, nav }: { children: ComponentChildren; page?: FrontPage; nav?: FrontNav }) {
  return (
    <div class={`fd-root${nav ? " framed" : ""}${page ? ` fd-on-${page}` : ""}`}>
      {nav && <SideMenu page={page} nav={nav} />}
      <main class="fd-center">{children}</main>
      {/* (The global chat on every page with the column: it was home's and the town's only, so the queue, 1 v 1's search among them, had none. Nov 7.) */}
      {nav && <RightPanel onFriends={nav.friendsList} onSignIn={nav.signIn} slot={page === "town" ? "TOWN" : page === "autochess" ? "AUTO CHESS" : undefined} />}
      {/* A new invite: front-door pages only (never over a match, nor in the queue). */}
      {nav && page !== "queue" && <InviteToast />}
      {/* Back from the town for being away (town/afk.ts): "You've been dropped from the town" on home. */}
      {page === "home" && <AwayNote />}
    </div>
  );
}
