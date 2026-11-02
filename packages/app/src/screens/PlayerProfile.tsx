import { useEffect, useState } from "preact/hooks";
import { BOSS_TIERS, rankView } from "@chessroyale/core";
import { BackButton, DressedPawn, FdButton, GearIcon, RatingPill } from "../components/FrontDoor.tsx";
import { DuelRankPill } from "../components/DuelRankPill.tsx";
import { RankEmblem } from "../components/RankEmblem.tsx";
import { yourRankShown } from "../ranked.ts";
import { IconEditor, UserIcon } from "../components/PixelIcon.tsx";
import { SignIn } from "../components/SignIn.tsx";
import { QuickChatPicks } from "../components/ChatPicks.tsx";
import { FriendsBadge } from "../components/Friends.tsx";
import { Recent, Wearing } from "../components/ProfileParts.tsx";
import { friendsBadge, useFriends } from "../friends.ts";
import { account, fetchProfile, onAccountChange, tooYoung, updateProfile, youngGuest, type PublicProfile } from "../account.ts";
import { openProfile, type ProfileTarget } from "../profile-nav.ts";
import { nth } from "../public-profile.ts";
import { PublicProfileScreen } from "./PublicProfile.tsx";

/** "Online now", or when they were last seen. */
function seenLine(p: PublicProfile, now = Date.now()): string {
  if (p.hidden) return "Online status hidden";
  if (p.online) return "Online now";
  if (!p.lastSeen) return "Offline";
  const min = Math.round((now - p.lastSeen) / 60_000);
  if (min < 60) return `Last seen ${Math.max(1, min)} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `Last seen ${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Last seen yesterday" : d < 7 ? `Last seen ${d} days ago` : `Last seen ${new Date(p.lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** The rating after each of the last 30 rated matches, as a line. */
function RatingChart({ points, own }: { points: number[]; own: boolean }) {
  if (points.length < 2) {
    return (
      <div class="fd-chart">
        <div class="fd-chart-title">Rating, last 30 games</div>
        <p class="fd-note">{own ? "Play a couple of matches to see your line." : "Not enough matches yet."}</p>
      </div>
    );
  }
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = Math.max(1, hi - lo);
  const xy = points.map((r, i) => `${Math.round((i * 330) / (points.length - 1))},${Math.round(72 - ((r - lo) / span) * 64)}`).join(" ");
  return (
    <div class="fd-chart">
      <div class="fd-chart-title">
        Rating, last {points.length === 30 ? 30 : points.length} games
        <span>
          {lo}–{hi}
        </span>
      </div>
      <svg viewBox="0 0 330 80" width="100%" height="80" preserveAspectRatio="none" role="img" aria-label={`Rating chart, from ${points[0]} to ${points[points.length - 1]}`}>
        <polyline points={xy} fill="none" stroke="var(--fd-gold)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

const dash = (v: number | null) => (v === null ? "—" : String(v));
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/**
 * Ranked 1 v 1: their rank (or placements) and their record, once they've played a ranked game. Nothing for a banned
 * player (as the rating), nor for one who never played.
 */
function Ranked1v1({ p, own }: { p: PublicProfile; own: boolean }) {
  const r = p.ranked1v1;
  const real = r?.rank ?? rankView(null);
  // (Your own: an admin's `?rank=` in its place, shown even before a game, so every emblem can be seen.)
  const rank = own ? yourRankShown(real) : real;
  if (!r || (r.games === 0 && rank === real)) return null;
  return (
    <section class="fd-section dv-profile" aria-label="1 v 1 rank">
      <h2 class="fd-label">1 V 1</h2>
      <div class="fd-panel dv-profile-row">
        <RankEmblem rank={rank} scale={2} class="dv-profile-emblem" />
        <span class="dv-profile-words">
          <DuelRankPill rank={rank} class="dv-rank-big" />
          <span class="dv-record">
            {r.wins} won · {r.losses} lost · {r.draws} drawn
          </span>
        </span>
      </div>
    </section>
  );
}

/** The profile card's rank pill: their 1 v 1 rank once they've played a ranked game (your own: an admin's `?rank=`), else nothing. */
function HeaderRank({ p, own }: { p: PublicProfile; own: boolean }) {
  const r = p.ranked1v1;
  const real = r?.rank ?? rankView(null);
  const rank = own ? yourRankShown(real) : real;
  if (!r || (r.games === 0 && rank === real)) return null;
  return <DuelRankPill rank={rank} class="fd-card-rank" />;
}

function Stats({ p, own }: { p: PublicProfile; own: boolean }) {
  const [tab, setTab] = useState<"crowd" | "boss">("crowd");
  const tiles: [string, string][] =
    tab === "crowd"
      ? [
          [String(p.crowd.games), "games"],
          [String(p.crowd.wins), "wins"],
          [p.crowd.avgPlace === null ? "—" : nth(Math.round(p.crowd.avgPlace)), "avg place"],
          [p.crowd.best === null ? "—" : nth(p.crowd.best), "best finish"],
          [pct(p.crowd.cutsSurvivedPct), "cuts survived"],
          [dash(p.crowd.brilliant), "brilliant"],
        ]
      : [
          [String(p.boss.raids), "raids"],
          [String(p.boss.bossesBeaten), "tiers beaten"],
          [dash(p.boss.strikesSurvived), "strikes survived"],
          [dash(p.boss.lastStands), "Last Stands"],
          [pct(p.boss.survivedPct), "survived"],
          [dash(p.boss.brilliant), "brilliant"],
        ];
  return (
    <section class="fd-section">
      <div class="fd-tabs" role="tablist" aria-label="Mode">
        {(
          [
            ["crowd", "Crowd"],
            ["boss", "Boss raid"],
          ] as const
        ).map(([id, label]) => (
          <button type="button" role="tab" key={id} aria-selected={tab === id} class={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div class="fd-stats" role="tabpanel">
        {tiles.map(([v, k]) => (
          <div key={k} class="fd-stat">
            <strong>{v}</strong>
            <span>{k}</span>
          </div>
        ))}
      </div>
      <RatingChart points={p.ratingHistory} own={own} />
    </section>
  );
}

function Bosses({ beaten }: { beaten: number[] }) {
  return (
    <section class="fd-section">
      <h2 class="fd-label">
        BOSS TIERS BEATEN · {beaten.length} / {BOSS_TIERS.length}
      </h2>
      <div class="fd-bosses">
        {BOSS_TIERS.map((elo) => {
          const won = beaten.includes(elo);
          return (
            <div key={elo} class={`fd-boss${won ? " won" : ""}`} title={`Boss tier ${elo}`} aria-label={`Boss tier ${elo}: ${won ? "beaten" : "not yet"}`}>
              <strong>{elo}</strong>
              <span>{won ? "beaten" : "—"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Your name and icon: the name you play under, and the pixel icon you draw. */
function EditSheet({ onClose }: { onClose: () => void }) {
  const u = account().profile?.user;
  const [name, setName] = useState(u?.name ?? "");
  const [drawing, setDrawing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!u) return null;
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await updateProfile({ name: name.trim() });
      try {
        localStorage.setItem("brc.name", name.trim());
      } catch {
        // Not important.
      }
      onClose();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fd-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div class="fd-sheet-head">
          <h2 id="edit-title">Edit name &amp; icon</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <label class="fd-field">
          <span>Your name</span>
          <input value={name} maxLength={16} onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <FdButton primary disabled={busy || !name.trim() || name.trim() === u.name} onClick={() => void save()}>
          Save name
        </FdButton>
        <div class="fd-icon-row">
          <span class="profile-icon fd-icon-now">
            <UserIcon icon={u.icon} />
          </span>
          <span class="fd-sub">Your icon, a 48 × 48 pixel drawing (shown beside your name in places a pawn won't fit).</span>
          <FdButton class="small" onClick={() => setDrawing(true)} label="Edit your icon">
            Draw
          </FdButton>
        </div>
        {drawing && (
          <IconEditor
            initial={u.icon}
            onCancel={() => setDrawing(false)}
            onSave={async (png) => {
              await updateProfile({ icon: png });
              setDrawing(false);
              setMsg("Icon saved.");
            }}
          />
        )}
        {msg && <p class="fd-note">{msg}</p>}
      </div>
    </div>
  );
}

/**
 * A profile screen (docs/decisions/2026-10-28-public-profile.md). Another player's name or face opens the public profile
 * (PublicProfile.tsx: the same page for everyone, Eric, Oct 28). Your own pawn opens this one, today's, which has your
 * coins, Edit name & icon, the locker, Friends, Quick chat and Settings, and "View public profile" at its top (that page,
 * as others see yours). A bot, or someone with no account, gets a card saying so.
 */
export function PlayerProfileScreen({
  target,
  onBack,
  onLocker,
  onSettings,
  onShop,
  onFriends,
  match,
}: {
  target: ProfileTarget;
  /** Opened during an online match: its lobby's code (a report made on the public profile is about this match). */
  match?: string;
  onBack: () => void;
  onLocker?: () => void;
  onSettings?: () => void;
  /** The shop's chat packs (a locked line in Quick chat and emoji). */
  onShop?: () => void;
  /** Your friends list (a phone's way there: Eric, Oct 18, off home). */
  onFriends?: () => void;
}) {
  // (Yours from your own pawn, a name of yours, a bot or someone with no account: this screen. Everyone else's, and yours as
  // others see it: the public profile.)
  const mine = !!target.you && !target.public;
  if (!target.bot && !mine && (target.uid || target.you)) {
    return (
      <PublicProfileScreen
        target={target}
        match={match}
        // (Your own public page goes back to your profile, where you pressed "View public profile".)
        onBack={target.you ? () => openProfile({ you: true, name: target.name }) : onBack}
      />
    );
  }
  return <OwnProfileScreen target={target} onBack={onBack} onLocker={onLocker} onSettings={onSettings} onShop={onShop} onFriends={onFriends} />;
}

function OwnProfileScreen({
  target,
  onBack,
  onLocker,
  onSettings,
  onShop,
  onFriends,
}: {
  target: ProfileTarget;
  onBack: () => void;
  onLocker?: () => void;
  onSettings?: () => void;
  onShop?: () => void;
  onFriends?: () => void;
}) {
  const [, rerender] = useState(0);
  useEffect(() => onAccountChange(() => rerender((n) => n + 1)), []);
  const { config, profile: me } = account();
  const own = !!target.you || (!!me && target.uid === me.user.id);
  const friends = useFriends();
  const uid = own ? me?.user.id : target.uid;
  const [p, setP] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "edit">(null);
  // Your own reloads when your account changes (a new name, something new to wear).
  const version = own ? `${me?.user.name}|${JSON.stringify(me?.locker?.look ?? {})}` : "";
  useEffect(() => {
    if (!uid) return;
    let live = true;
    setError(null);
    fetchProfile(uid)
      .then((x) => live && setP(x))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [uid, version]);

  const head = (
    <header class="fd-page-head">
      <BackButton onClick={onBack} />
      {own && onSettings ? (
        <button type="button" class="fd-icon-btn" aria-label="Settings" onClick={onSettings}>
          <GearIcon />
        </button>
      ) : (
        <span class="fd-head-spacer" />
      )}
    </header>
  );

  // (Your own page for others: the one line at the top that's new, Oct 28. It's the public profile, as it shows you to others.)
  const viewPublic =
    own && uid ? (
      <button type="button" class="fd-row-link fd-view-public" onClick={() => openProfile({ uid, name: me?.user.name ?? target.name, you: true, public: true })}>
        View public profile
      </button>
    ) : null;

  // A bot: no profile, just who it is.
  if (target.bot || (!uid && !own)) {
    return (
      <div class="fd-page fd-profile">
        {head}
        <div class="fd-card">
          <DressedPawn size="profile" shadow />
          <div class="fd-card-name">{target.name}</div>
          <div class="fd-pills">
            <span class="fd-pill">{target.bot ? "Bot" : "Guest"}</span>
          </div>
          <p class="fd-sub fd-center-text">
            {target.bot ? "Bots fill the empty seats in a match. They have no profile." : "This player has no profile to show."}
          </p>
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div class="fd-page fd-profile">
        {head}
        {viewPublic}
        <div class="fd-card">
          <DressedPawn size="profile" shadow ride look={own ? me?.locker?.look : undefined} />
          <div class="fd-card-name">{own ? (me?.user.name ?? target.name) : target.name}</div>
          <p class="fd-sub">{error ?? "Loading…"}</p>
        </div>
      </div>
    );
  }

  const joined = new Date(p.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <div class="fd-page fd-profile">
      {head}
      {viewPublic}
      {/* Two columns on a computer: who they are and what they wear; then their numbers. One column on a phone. */}
      <div class="fd-profile-col">
      <div class="fd-card">
        <DressedPawn size="profile" shadow ride look={p.look} />
        <h1 class="fd-card-name">{p.name}</h1>
        <div class="fd-seen">
          <span class={`fd-dot small${p.online ? "" : " off"}`} />
          {seenLine(p)} · joined {joined}
        </div>
        <div class="fd-pills">
          {/* (The rank shown is 1 v 1's since Oct 28, once they've played one; the crowd rating's number beside it, no rank name.) */}
          {p.banned ? <span class="fd-pill fp-banned">Banned</span> : <HeaderRank p={p} own={own} />}
          {!p.banned && <RatingPill rating={p.rating} />}
          {p.topPercent !== null && <span class="fd-pill">Top {p.topPercent}%</span>}
          {/* (Your coins: on your profile and in the shop, not in home's top bar, Eric, Oct 18.) */}
          {own && me?.shop && <span class="fd-pill fp-coins">● {me.shop.coins.toLocaleString("en-US")} coins</span>}
        </div>
        {own && (
          <div class="fd-card-actions">
            {/* (Not for a guest on a device that answered the age question "too young": the default name and icon stay.) */}
            {!youngGuest() && (
              <FdButton primary class="small" onClick={() => setSheet("edit")}>
                Edit name &amp; icon
              </FdButton>
            )}
            {onLocker && (
              <FdButton class="small" onClick={onLocker}>
                Open locker
              </FdButton>
            )}
            {onFriends && friends.status !== "off" && friends.status !== "signIn" && (
              <FdButton class="small" onClick={onFriends}>
                Friends <FriendsBadge n={friendsBadge()} />
              </FdButton>
            )}
          </div>
        )}
      </div>
      <Wearing look={p.look} own={own} />
      {/* (The social lane's section: components/ChatPicks.tsx.) */}
      {own && <QuickChatPicks onShop={onShop} focus={target.section === "chat"} />}
      </div>
      <div class="fd-profile-col">
      <Ranked1v1 p={p} own={own} />
      <Stats p={p} own={own} />
      <Bosses beaten={p.bossesBeaten} />
      <Recent p={p} mark={own ? target.match : undefined} />
      {own ? (
        <>
          {me && !me.user.signedIn && config && (config.google || config.email) && !tooYoung() && (
            <section class="fd-section">
              <h2 class="fd-label">KEEP YOUR PROFILE</h2>
              <div class="fd-panel">
                <p class="fd-sub">You're a guest on this device. Sign in to keep this profile on any device, and to play online.</p>
                <SignIn google={config.google} email={config.email} next="/profile" />
              </div>
            </section>
          )}
          {onSettings && (
            <button type="button" class="fd-row-link" onClick={onSettings}>
              Settings: sound, the board, quick chat, how to play, your sign-in ›
            </button>
          )}
        </>
      ) : null}
      </div>
      {sheet === "edit" && <EditSheet onClose={() => setSheet(null)} />}
    </div>
  );
}
