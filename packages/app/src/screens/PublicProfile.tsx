import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { rankView } from "@chessroyale/core";
import { BackButton, DressedPawn, TEST_LEVEL } from "../components/FrontDoor.tsx";
import { BossArt } from "../components/BossCharacter.tsx";
import { InviteButton, useProfileActions } from "../components/Friends.tsx";
import { ItemArt } from "../components/Items.tsx";
import { Recent, ReportSheet, WearingRows } from "../components/ProfileParts.tsx";
import { RankEmblem } from "../components/RankEmblem.tsx";
import { SELECT_TINT } from "../characters/boss-select.ts";
import { account, fetchProfile, onAccountChange, type PublicProfile } from "../account.ts";
import type { ProfileTarget } from "../profile-nav.ts";
import { yourRankShown } from "../ranked.ts";
import { testSwitchesAllowed } from "../test-switches.ts";
import {
  RANKED_MODES,
  RECENT_SHOWN,
  hasOwnIcon,
  levelLine,
  peakLine,
  rankedState,
  recentRows,
  recordText,
  seenLine,
  streakText,
  tierTitle,
  tileWeight,
  winRate,
  wornTiles,
  type RankedModeId,
  type RecentRow,
} from "../public-profile.ts";
import "../public-profile.css";

/**
 * The public profile (docs/decisions/2026-10-28-public-profile.md; Eric's mockup, Oct 28): the one page everyone has, the same
 * for every viewer. A tap on another player's name or face opens it; yours opens it from "View public profile" at the top of
 * your own profile, with Challenge, Add Friend and ••• greyed. Nothing private is ever on it: no email, sign-in method, age,
 * the hidden 1 v 1 rating or fair-play details. Classes start with `pp-`.
 *
 * Nothing hidden, nothing shifts (docs/rules/eric.md): the page takes the same room while it loads (the same markup, its
 * text clear on gray bars) and after; the Ranked Standing card is one height in every mode of its menu; the level line, the
 * note line and the cards' lists keep their height when empty.
 */

// ---------------- Icons ----------------

const Svg = ({ children, size = 22, fill = "none", stroke = "currentColor", width = 2 }: { children: ComponentChildren; size?: number; fill?: string; stroke?: string; width?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke={stroke} stroke-width={width} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

const Dots = () => (
  <Svg fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </Svg>
);
const ChevronDown = () => (
  <Svg size={16} width={2.4}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
const ChevronRight = () => (
  <Svg size={16} width={2.4}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);
/** Two swords crossed: a blade each from the top corners, a crossguard and a grip with its pommel at the bottom. */
const Swords = () => (
  <Svg size={24} fill="currentColor" width={1.4}>
    <path d="M3 3l4.2.8 8.3 8.5-3.2 3.2L3.8 7.2z" />
    <path d="M21 3l-4.2.8-8.3 8.5 3.2 3.2 8.5-8.3z" />
    <path d="M10.5 17.5l6.5-6.5M13.5 17.5L7 11" fill="none" stroke-width="2.2" />
    <path d="M15.5 15.5l3.2 3.2M8.5 15.5l-3.2 3.2" fill="none" stroke-width="2.4" />
    <circle cx="19.8" cy="19.8" r="1.4" />
    <circle cx="4.2" cy="19.8" r="1.4" />
  </Svg>
);
const PersonPlus = () => (
  <Svg size={24}>
    <circle cx="9" cy="8" r="3.6" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <path d="M19 8v6M16 11h6" />
  </Svg>
);
const Trophy = () => (
  <Svg size={22} fill="var(--fd-gold)" stroke="color-mix(in srgb, var(--fd-gold) 50%, #000)" width={1.6}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 6H4v1.5A3 3 0 0 0 7 10.5M17 6h3v1.5a3 3 0 0 1-3 3" />
    <path d="M12 14v3M9 20h6M10 17h4v3h-4z" />
  </Svg>
);
const Clock = () => (
  <Svg size={22}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
const Shirt = () => (
  <Svg size={22} fill="var(--fd-gold)" stroke="color-mix(in srgb, var(--fd-gold) 50%, #000)" width={1.6}>
    <path d="M8 3L3 6l2.5 4L8 9v12h8V9l2.5 1L21 6l-5-3a4 4 0 0 1-8 0z" />
  </Svg>
);
const ModeIcon = ({ mode }: { mode: "crowd" | "squads" | "classic" }) =>
  mode === "crowd" ? (
    <Svg size={20}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 13.8c2.7.2 5 2 5 5" />
    </Svg>
  ) : mode === "squads" ? (
    <Svg size={20}>
      <path d="M12 3l8 3v5.5c0 4.5-3.2 8-8 9.5-4.8-1.5-8-5-8-9.5V6z" />
    </Svg>
  ) : (
    <span class="pp-glyph" aria-hidden="true">
      ♟
    </span>
  );

// ---------------- A small menu ----------------

/**
 * A button that opens a small menu under it (over the page: nothing moves). A tap outside, Escape or a choice closes it.
 * Its items are `role="menuitem"` (or "menuitemradio") buttons; `children` gets `close`.
 */
function Menu({
  label,
  trigger,
  triggerClass,
  align = "left",
  disabled,
  children,
}: {
  label: string;
  trigger: ComponentChildren;
  triggerClass: string;
  align?: "left" | "right";
  disabled?: boolean;
  children: (close: () => void) => ComponentChildren;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  // (A layout effect: the keys work from the very frame the menu shows in.)
  useLayoutEffect(() => {
    if (!open) return;
    const items = () => [...(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [])];
    items()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const all = items();
        const at = all.indexOf(document.activeElement as HTMLElement);
        all[(at + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [open]);
  // (A menu left open on a page that has gone greyed, say a new page's load.)
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return (
    <div class="pp-menu-wrap">
      <button ref={button} type="button" class={triggerClass} aria-label={label} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
        {trigger}
      </button>
      {open && (
        <>
          <div class="pp-menu-scrim" onClick={() => setOpen(false)} />
          <div ref={list} class={`pp-menu ${align}`} role="menu" aria-label={label}>
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- The picture ----------------

/**
 * Their dressed pawn in a circle. Behind it their icon, filling the circle, blurred and faded (Eric: "whatever you design for
 * your icon will be there… it should be like faded or blurred"); with no icon of their own (the default pawn), the theme's
 * light yellow. A green dot at the lower right while they're online (never when they hide it).
 */
function Picture({ p, loading }: { p: PublicProfile | null; loading: boolean }) {
  const icon = p?.icon;
  const own = hasOwnIcon(icon);
  return (
    <div class="pp-avatar">
      <span class="pp-circle" data-backdrop={loading ? "loading" : own ? "icon" : "default"}>
        {own &&
          (icon.startsWith("data:image/png") ? (
            <img class="pp-backdrop" src={icon} alt="" draggable={false} />
          ) : (
            <span class="pp-backdrop pp-backdrop-emoji" aria-hidden="true">
              {icon}
            </span>
          ))}
        {!loading && <DressedPawn size="avatar" look={p?.look} />}
      </span>
      {p?.online && !p.hidden && <span class="pp-online" role="img" aria-label="Online" />}
    </div>
  );
}

// ---------------- Ranked Standing ----------------

/** A plain badge where the emblem goes (placements, or no games yet): a shield, with what it says inside. It fills the emblem's box. */
function PlainBadge({ text }: { text: string }) {
  return (
    <span class="pp-badge" aria-hidden="true">
      <svg viewBox="0 0 48 48" preserveAspectRatio="xMidYMid meet">
        <path d="M24 4l17 6v12c0 10-7 17-17 22C14 39 7 32 7 22V10z" />
      </svg>
      <span>{text}</span>
    </span>
  );
}

function RankedCard({ p, own, loading, wide }: { p: PublicProfile | null; own: boolean; loading: boolean; wide: boolean }) {
  const [mode, setMode] = useState<RankedModeId>("1v1");
  const current = RANKED_MODES.find((m) => m.id === mode)!;
  const r = p?.ranked1v1;
  const real = r?.rank ?? rankView(null);
  // (Your own: an admin's `?rank=` in its place, shown even before a game, so every emblem can be seen.)
  const rank = own ? yourRankShown(real) : real;
  const banned = !!p?.banned;
  const state = loading ? "ranked" : rankedState(rank, banned);
  const one = mode === "1v1" && state !== "banned";
  const soon = mode !== "1v1" && state !== "banned";
  const title = state === "unranked" ? "Unranked" : tierTitle(rank);
  // (Rank points: none in placements or before a first game.)
  const rp = loading ? "00" : rank.placement ? null : String(rank.points);
  const sk = loading ? " sk" : "";
  return (
    <section class="pp-panel pp-ranked" aria-labelledby="pp-ranked-title">
      <div class="pp-panel-head">
        <h2 class="pp-h" id="pp-ranked-title">
          Ranked Standing
        </h2>
        <Menu label={`Ranked mode: ${current.label}`} triggerClass="pp-mode" trigger={<>{current.label}<ChevronDown /></>} disabled={loading || banned}>
          {(close) =>
            RANKED_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="menuitemradio"
                aria-checked={m.id === mode}
                class="pp-menu-item"
                onClick={() => {
                  setMode(m.id);
                  close();
                }}
              >
                {m.label}
              </button>
            ))
          }
        </Menu>
        <span class="pp-season">Season 1</span>
      </div>
      {/* (All three layers sit in one cell, so the card is as tall as the tallest in every mode: 1 v 1's, which has the most.) */}
      <div class="pp-body">
        <div class={`pp-layer pp-one${one ? "" : " off"}`} aria-hidden={one ? undefined : "true"}>
          <div class="pp-rk-main">
            {/* (The emblem's art in whole steps of its 48 px: 96 on a phone, 144 on a computer; the card's CSS shows it at the mockup's size.) */}
            <span class="pp-emblem">{loading ? null : state === "ranked" ? <RankEmblem rank={rank} scale={wide ? 3 : 2} /> : <PlainBadge text={state === "placement" ? `${rank.placement!.played}/${rank.placement!.of}` : "?"} />}</span>
            <div class="pp-rk-words">
              <span class="pp-cap">CURRENT TIER</span>
              <strong class={`pp-tier${sk}`}>{loading ? "Platinum 3" : title}</strong>
              <span class={`pp-rp${sk}`}>
                {(loading || rp) && (
                  <>
                    <Trophy />
                    <span>
                      <b>{rp}</b> RP
                    </span>
                  </>
                )}
              </span>
              <span class={`pp-peak${sk}`}>{loading ? "Peak rank: Platinum 3" : peakLine(r?.peak)}</span>
            </div>
          </div>
          <div class="pp-stats">
            {(
              [
                [loading ? "00%" : winRate(r?.wins ?? 0, r?.games ?? 0), "Win rate"],
                [loading ? "00 – 00" : recordText(r?.wins ?? 0, r?.losses ?? 0), "W / L"],
                [loading ? "0" : streakText(r ? r.streak : 0), "Win streak"],
              ] as const
            ).map(([v, k]) => (
              <div key={k} class="pp-stat">
                <strong class={sk}>{v}</strong>
                <span>{k}</span>
              </div>
            ))}
          </div>
        </div>
        {soon && (
          <div class="pp-layer pp-center">
            <p class="pp-soon">Coming soon</p>
          </div>
        )}
        {state === "banned" && (
          <div class="pp-layer pp-center">
            <span class="fd-pill fp-banned">Banned</span>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------- Recent Matches ----------------

function Face({ face }: { face: RecentRow["face"] }) {
  if (face.kind === "pawn")
    return (
      <span class="pp-face">
        <DressedPawn size="seat" look={face.look} />
      </span>
    );
  if (face.kind === "boss") {
    return (
      <span class="pp-face pp-face-boss" style={{ "--bs-tint": SELECT_TINT[face.id ?? ""] ?? "#8a8f9a" }}>
        {face.id ? <BossArt boss={{ id: face.id, name: face.name, icon: face.icon }} /> : <span aria-hidden="true">{face.icon}</span>}
      </span>
    );
  }
  return (
    <span class="pp-face pp-face-mode">
      <ModeIcon mode={face.mode} />
    </span>
  );
}

const PLACEHOLDER_ROW: RecentRow = {
  key: "",
  at: 0,
  face: { kind: "mode", mode: "classic" },
  pill: { text: "WIN", tone: "win" },
  title: "vs. Playername",
  sub: "Ranked · 2h ago",
  rp: { text: "+18", tone: "none" },
};

function RecentCard({ rows, loading, onAll, none }: { rows: RecentRow[]; loading: boolean; onAll: () => void; none: boolean }) {
  const list = loading ? Array.from({ length: RECENT_SHOWN }, (_, i) => ({ ...PLACEHOLDER_ROW, key: `sk${i}` })) : rows;
  return (
    <section class="pp-panel pp-recent" aria-labelledby="pp-recent-title">
      <div class="pp-panel-head">
        <span class="pp-ico">
          <Clock />
        </span>
        <h2 class="pp-h" id="pp-recent-title">
          Recent Matches
        </h2>
        <button type="button" class="pp-all" disabled={loading || none} onClick={onAll}>
          View all <ChevronRight />
        </button>
      </div>
      <ol class="pp-rows">
        {list.map((r) => (
          <li key={r.key} class={`pp-row${loading ? " sk-row" : ""}`}>
            <span class={`pp-pill ${r.pill.tone}`}>{r.pill.text}</span>
            {loading ? <span class="pp-face" /> : <Face face={r.face} />}
            <span class="pp-row-text">
              <strong>{r.title}</strong>
              <span>{r.sub}</span>
            </span>
            <span class={`pp-rpchange ${r.rp.tone}`}>{r.rp.text}</span>
          </li>
        ))}
        {!loading && none && <li class="pp-empty">No matches yet.</li>}
      </ol>
    </section>
  );
}

// ---------------- Equipped Cosmetics ----------------

function CosmeticsCard({ p, loading, onAll }: { p: PublicProfile | null; loading: boolean; onAll: () => void }) {
  const tiles = p ? wornTiles(p.look) : [];
  return (
    <section class="pp-panel pp-cosmetics" aria-labelledby="pp-cosmetics-title">
      <div class="pp-panel-head">
        <span class="pp-ico">
          <Shirt />
        </span>
        <h2 class="pp-h" id="pp-cosmetics-title">
          Equipped Cosmetics
        </h2>
        <button type="button" class="pp-all" disabled={loading || !tiles.length} onClick={onAll}>
          View all <ChevronRight />
        </button>
      </div>
      {/* (One row of three tiles, or of four when four are worn: the card is one size whatever is worn.) */}
      <div class={`pp-tiles n${Math.max(3, tiles.length)}`}>
        {loading &&
          [0, 1, 2].map((i) => (
            <div key={i} class="pp-tile sk-tile">
              <span class="pp-tile-art" />
              <span class="pp-tile-text">
                <strong>Pirate Hat</strong>
                <span>Head · Opal</span>
                <span class="pp-rarity">Legendary</span>
              </span>
            </div>
          ))}
        {tiles.map((t) => (
          <div key={t.slot} class="pp-tile" style={`--w:${tileWeight(t.line)}`}>
            <span class="pp-tile-art" aria-hidden="true">
              <ItemArt def={t.def} finish={t.finish} />
            </span>
            <span class="pp-tile-text">
              <strong>{t.name}</strong>
              <span>{t.line}</span>
              <span class="pp-rarity" style={{ background: t.tier.color }}>
                {t.tier.name}
              </span>
            </span>
          </div>
        ))}
        {!loading && !tiles.length && <p class="pp-nothing">Nothing equipped</p>}
      </div>
    </section>
  );
}

// ---------------- Sheets ----------------

/** A sheet over the page (the full list of matches, or each worn item's details): ✕, Escape or a tap outside closes it. */
function Sheet({ id, title, onClose, children }: { id: string; title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fd-sheet" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div class="fd-sheet-head">
          <h2 id={id}>{title}</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------- The page ----------------

/** The page is two columns from this wide (its own width, so it holds in the computer's frame and not in a narrower one). */
const WIDE_FROM = 744;

export function PublicProfileScreen({ target, onBack, match }: { target: ProfileTarget; onBack: () => void; /** Opened during an online match: its lobby's code (a report made here is about this match). */ match?: string }) {
  const [, rerender] = useState(0);
  useEffect(() => onAccountChange(() => rerender((n) => n + 1)), []);
  const { profile: me } = account();
  const uid = target.uid ?? (target.you ? me?.user.id : undefined);
  const own = !!me && uid === me.user.id;
  const [fetched, setFetched] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "report" | "matches" | "cosmetics">(null);
  // Yours reloads when your account changes (a new name or icon, something new to wear).
  const version = own ? `${me?.user.name}|${me?.user.icon}|${JSON.stringify(me?.locker?.look ?? {})}` : "";
  useEffect(() => {
    if (!uid) return;
    let live = true;
    setError(null);
    fetchProfile(uid)
      .then((x) => live && setFetched(x))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [uid, version]);
  const p = fetched && fetched.id === uid ? fetched : null;
  const loading = !p;
  const act = useProfileActions(uid ?? "", p?.name ?? target.name);
  const now = useMemo(() => Date.now(), [p]);

  // Two columns when the page is wide enough (measured here once, as it opens and when it's resized, not by the window).
  const root = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setWide(el.clientWidth >= WIDE_FROM);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const name = p?.name ?? target.name;
  const seen = p ? seenLine(p, now) : null;
  const level = levelLine(testSwitchesAllowed(), TEST_LEVEL.level);
  const rows = p ? recentRows(p.ranked1v1?.recent ?? [], p.recent, now) : [];
  const blocked = act.rel === "blocked";
  // The buttons: greyed (never gone) on your own page, with a guest or a young device where friends are off, while loading, and for someone you blocked.
  const idle = loading || own;
  const friendOff = idle || !act.on || blocked;
  const friend =
    act.rel === "friend"
      ? { label: act.confirm === "remove" ? "Tap again to remove" : "Remove Friend", go: act.remove }
      : act.rel === "sent"
        ? { label: "Cancel Request", go: act.cancel }
        : act.rel === "received"
          ? { label: "Accept Friend", go: act.accept }
          : { label: "Add Friend", go: act.add };
  const sk = loading && !name ? " sk" : "";
  const note = loading ? error : act.note;

  return (
    <div ref={root} class={`fd-page pp${wide ? " pp-wide" : ""}${loading ? " pp-loading" : ""}${loading && error ? " pp-failed" : ""}`} aria-busy={loading && !error}>
      <header class="fd-page-head pp-head">
        <BackButton onClick={onBack} />
        <h1 class="pp-title">Player Profile</h1>
        <Menu label="More options" triggerClass="fd-icon-btn pp-dots" trigger={<Dots />} align="right" disabled={idle}>
          {(close) => (
            <>
              <button
                type="button"
                role="menuitem"
                class="pp-menu-item"
                disabled={!act.on}
                onClick={() => {
                  if (blocked) {
                    act.unblock();
                    close();
                  } else {
                    act.block();
                    // (The first tap asks "Tap again to block" and the menu stays; the second blocks.)
                    if (act.confirm === "block") close();
                  }
                }}
              >
                {blocked ? "Unblock" : act.confirm === "block" ? "Tap again to block" : "Block"}
              </button>
              <button
                type="button"
                role="menuitem"
                class="pp-menu-item danger"
                onClick={() => {
                  close();
                  setSheet("report");
                }}
              >
                Report
              </button>
            </>
          )}
        </Menu>
      </header>

      <section class="pp-card" aria-label="Player">
        <Picture p={p} loading={loading} />
        <h2 class={`pp-name${sk}`}>{name || "Loading name"}</h2>
        <div class="pp-seen">
          {seen?.dot && <span class="fd-dot small" aria-hidden="true" />}
          <span class={loading ? "sk" : undefined}>{seen?.text ?? "Online now · Joined Oct 2026"}</span>
        </div>
        {/* (Levels aren't built yet: only an admin's placeholder shows. For everyone else there is no line, so nothing is ever added later.) */}
        {level && <div class="pp-level">{level}</div>}
        <div class="pp-actions">
          <InviteButton uid={uid ?? ""} onNote={act.setNote} label="Challenge" small={false} primary greyed disabled={idle || blocked} icon={<Swords />} title="Invite to play" />
          <button type="button" class="fd-btn pp-friend" disabled={friendOff} onClick={friend.go}>
            {act.confirm === "remove" ? null : <PersonPlus />}
            {friend.label}
          </button>
        </div>
      </section>

      <div class="pp-cols">
        <RankedCard p={p} own={own} loading={loading} wide={wide} />
        <RecentCard rows={rows} loading={loading} none={!rows.length} onAll={() => setSheet("matches")} />
        <CosmeticsCard p={p} loading={loading} onAll={() => setSheet("cosmetics")} />
      </div>

      {/* (What just happened: "Request sent.", "Invited…", a refusal. A note over the bottom of the screen for a few seconds, never in the page's flow, so it moves nothing.) */}
      {(note ?? (blocked ? `You blocked ${name}. Unblock is in the ••• menu.` : "")) && (
        <p key={note ?? "blocked"} class="fd-note fr-note pp-note" role="status">
          {note ?? `You blocked ${name}. Unblock is in the ••• menu.`}
        </p>
      )}

      {sheet === "report" && p && <ReportSheet p={p} match={match} onClose={() => setSheet(null)} />}
      {sheet === "matches" && p && (
        <Sheet id="pp-matches-title" title="Recent matches" onClose={() => setSheet(null)}>
          <Recent p={p} bare />
        </Sheet>
      )}
      {sheet === "cosmetics" && p && (
        <Sheet id="pp-cosmetics-title" title="Equipped cosmetics" onClose={() => setSheet(null)}>
          <WearingRows look={p.look} />
        </Sheet>
      )}
    </div>
  );
}
