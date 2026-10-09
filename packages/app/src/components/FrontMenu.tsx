import type { ComponentChildren } from "preact";
import { bossThreat } from "@chessroyale/core";
import { account } from "../account.ts";
import { useLive, type PlayingNow } from "../live.ts";
import { AccountBar, DressedPawn, GearIcon, LiveLine, Logo, myHat } from "./FrontDoor.tsx";
import { GlobalChat } from "./GlobalChat.tsx";

/** Where the computer's side menu can take you. */
export interface FrontNav {
  home: () => void;
  bossAlone: () => void;
  friends: () => void;
  shop: () => void;
  profile: () => void;
  settings: () => void;
  /** Sign in (the global chat's guests). */
  signIn?: () => void;
}

export type FrontPage = "home" | "queue" | "profile" | "settings" | "shop" | "lobby";

const Icon = ({ d, children }: { d?: string; children?: ComponentChildren }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);

function Item({ label, icon, on, onClick }: { label: string; icon: ComponentChildren; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" class={`fd-menu-item${on ? " on" : ""}`} aria-current={on ? "page" : undefined} onClick={onClick}>
      <span class="fd-menu-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** The computer's left column: the logo, where to go, and Settings at the bottom (like the big chess sites). */
export function SideMenu({ page, nav }: { page?: FrontPage; nav: FrontNav }) {
  const p = account().profile;
  return (
    <nav class="fd-side" aria-label="Menu">
      <Logo onClick={nav.home} />
      <div class="fd-menu">
        <Item label="Play" on={page === "home" || page === "queue"} onClick={nav.home} icon={<Icon d="M7 4.5v15l12-7.5z" />} />
        <Item
          label="Boss alone"
          onClick={nav.bossAlone}
          icon={
            <Icon>
              <path d="M5 20h14M6 20l-1.5-11 4.5 3.5L12 5l3 7.5L19.5 9 18 20" />
            </Icon>
          }
        />
        <Item
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
        <Item
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
        <Item label="Profile" on={page === "profile"} onClick={nav.profile} icon={<DressedPawn size="ring" look={p?.locker?.look} hat={myHat(p)} />} />
      </div>
      <div class="fd-menu fd-menu-end">
        <Item label="Settings" on={page === "settings"} onClick={nav.settings} icon={<GearIcon />} />
      </div>
    </nav>
  );
}

/** A running match on the list: its mode (and boss), players left, and how long it's been going. */
function matchLine(m: PlayingNow, now: number): { title: string; sub: string } {
  // (A raid's boss is random now: its strength's skulls, not a name.)
  const title = m.mode === "boss" ? `Boss raid${m.bossElo ? ` · ${"💀".repeat(bossThreat(m.bossElo))}` : ""}` : m.mode === "crowd" ? "Crowd · 50 v 50" : "Classic";
  const left = m.alive !== null && m.total !== null ? `${m.alive} of ${m.total} left` : "starting";
  const min = m.startedAt ? Math.max(0, Math.round((now - m.startedAt) / 60_000)) : null;
  return { title, sub: [left, min === null ? null : min < 1 ? "just started" : `${min} min in`].filter(Boolean).join(" · ") };
}

/** The computer's right column: your coins and pawn at the top right, the live line, and the matches being played now. */
export function RightPanel({ onProfile, chat, onSignIn }: { onProfile: () => void; chat?: boolean; onSignIn?: () => void }) {
  const live = useLive();
  const now = Date.now();
  return (
    <aside class="fd-right" aria-label="Live">
      <AccountBar onProfile={onProfile} />
      <LiveLine live={live} stacked />
      <section class="fd-section">
        <h2 class="fd-label">PLAYING NOW</h2>
        {live && !live.playing.length && <p class="fd-note">No matches running right now. PLAY starts one.</p>}
        {live?.playing.map((m, i) => {
          const l = matchLine(m, now);
          return (
            <div key={`${m.startedAt}-${i}`} class="fd-playing">
              <span class={`fd-playing-mode ${m.mode}`} aria-hidden="true">
                {m.mode === "boss" ? "👑" : "♟"}
              </span>
              <span class="fd-item-text">
                <strong>{l.title}</strong>
                <span>{l.sub}</span>
              </span>
            </div>
          );
        })}
      </section>
      {/* The home page's global chat (the social lane's: components/GlobalChat.tsx). */}
      {chat && <GlobalChat onSignIn={onSignIn} />}
    </aside>
  );
}

/**
 * The front door's frame: the page's background and its centre column. On a computer (1024 px and wider) with `nav`,
 * the side menu on the left and the live panel on the right; on a phone, just the centre. (The queue is a state of
 * the home screen, in the same frame: see HomeScreen.)
 */
export function FrontFrame({ children, page, nav }: { children: ComponentChildren; page?: FrontPage; nav?: FrontNav }) {
  return (
    <div class={`fd-root${nav ? " framed" : ""}${page ? ` fd-on-${page}` : ""}`}>
      {nav && <SideMenu page={page} nav={nav} />}
      <main class="fd-center">{children}</main>
      {nav && <RightPanel onProfile={nav.profile} chat={page === "home"} onSignIn={nav.signIn} />}
    </div>
  );
}
