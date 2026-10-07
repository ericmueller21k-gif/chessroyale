import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import { BOSS_TIERS, SLOT_NAMES, bossInfo, isShiny, itemColor, itemDef, purity, shopItem, tierInfo, type ItemLook } from "@chessroyale/core";
import { BackButton, DressedPawn, FdButton, RankPill, WORN_ORDER, myHat } from "../components/FrontDoor.tsx";
import { HattedPawn } from "../components/Cosmetics.tsx";
import { ItemArt } from "../components/Items.tsx";
import { IconEditor, UserIcon } from "../components/PixelIcon.tsx";
import { SignIn } from "../components/SignIn.tsx";
import { QuickChatPicks } from "../components/ChatPicks.tsx";
import { account, fetchProfile, onAccountChange, reportPlayer, updateProfile, type PublicProfile } from "../account.ts";
import type { ProfileTarget } from "../profile-nav.ts";
import { ordinal } from "./StageBreak.tsx";

const nth = (n: number) => `${n}${ordinal(n)}`;

/** "Online now", or when they were last seen. */
function seenLine(p: PublicProfile, now = Date.now()): string {
  if (p.online) return "Online now";
  if (!p.lastSeen) return "Offline";
  const min = Math.round((now - p.lastSeen) / 60_000);
  if (min < 60) return `Last seen ${Math.max(1, min)} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `Last seen ${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Last seen yesterday" : d < 7 ? `Last seen ${d} days ago` : `Last seen ${new Date(p.lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** "today", "yesterday", "3 days ago", else the date. */
function when(at: number, now = Date.now()): string {
  const day = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * 60_000) / 86_400_000);
  const d = day(now) - day(at);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** What they wear, one row per item: the item itself (as it looks on them), slot, colour, purity and tier. */
function Wearing({ look, hat, own }: { look: ItemLook; hat: string; own: boolean }) {
  const rows = WORN_ORDER.flatMap((slot) => {
    const it = look[slot];
    const d = it && itemDef(it.def);
    return it && d ? [{ slot, it, d }] : [];
  });
  const shopHat = !look.head && hat !== "none" ? shopItem(`hat-${hat}`) : undefined;
  return (
    <section class="fd-section" aria-labelledby="wearing-label">
      <h2 class="fd-label" id="wearing-label">
        WEARING
      </h2>
      {!rows.length && !shopHat && <p class="fd-note">{own ? "Nothing yet. Open a crate in the shop, then wear it from your locker." : "Nothing yet."}</p>}
      {rows.map(({ slot, it, d }) => {
        const c = itemColor(it.color);
        const c2 = it.color2 ? itemColor(it.color2) : null;
        const tier = tierInfo(d.tier);
        return (
          <div key={slot} class="fd-item">
            <span class="fd-thumb" aria-hidden="true">
              <ItemArt def={it.def} finish={it} />
            </span>
            <span class="fd-item-text">
              <strong>{d.name}</strong>
              <span>
                {/* Each detail stays whole; a narrow row breaks between them. */}
                {[SLOT_NAMES[slot], c2 ? `${c.name} & ${c2.name}` : c.name, `${purity(it.blemish)}% pure`, ...(isShiny(it.blemish) ? ["Shiny"] : [])].map((t, i) => (
                  <Fragment key={i}>
                    {i > 0 && " · "}
                    <span class="fd-nowrap">{t}</span>
                  </Fragment>
                ))}
              </span>
            </span>
            <span class="fd-tier" style={{ background: tier.color }}>
              {tier.name}
            </span>
          </div>
        );
      })}
      {shopHat && (
        <div class="fd-item">
          <span class="fd-thumb" aria-hidden="true">
            <HattedPawn hat={hat} />
          </span>
          <span class="fd-item-text">
            <strong>{shopItem(`hat-${hat}`)!.name}</strong>
            <span>Head · from the shop</span>
          </span>
        </div>
      )}
    </section>
  );
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
          [String(p.boss.bossesBeaten), "bosses beaten"],
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
        BOSSES BEATEN · {beaten.length} / {BOSS_TIERS.length}
      </h2>
      <div class="fd-bosses">
        {BOSS_TIERS.map((elo) => {
          const won = beaten.includes(elo);
          return (
            <div key={elo} class={`fd-boss${won ? " won" : ""}`} title={bossInfo(elo).name} aria-label={`${bossInfo(elo).name}, ${elo}: ${won ? "beaten" : "not yet"}`}>
              <strong>{elo}</strong>
              <span>{won ? "beaten" : "—"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Recent({ p }: { p: PublicProfile }) {
  return (
    <section class="fd-section">
      <h2 class="fd-label">RECENT MATCHES</h2>
      {!p.recent.length && <p class="fd-note">No matches yet.</p>}
      {p.recent.map((r, i) => {
        const boss = r.mode === "boss";
        const place = boss ? (r.won === true ? "Won" : r.won === false ? "Lost" : r.survived === false ? "Out" : r.survived === true ? "Draw" : nth(r.placement)) : nth(r.placement);
        const gold = boss ? r.won === true : r.placement === 1;
        const mode =
          r.mode === "crowd"
            ? `Crowd · ${r.team ? "50 v 50" : "everyone moves"}`
            : boss
              ? `Boss raid · ${r.bossElo ? `${bossInfo(r.bossElo).name} ${r.bossElo}` : "a boss"}`
              : `Classic · ${r.players} players`;
        return (
          <div key={`${r.playedAt}-${i}`} class="fd-match">
            <span class={`fd-place${gold ? " gold" : ""}`}>{place}</span>
            <span class="fd-match-text">
              <strong>
                {mode}
                {r.online ? "" : " · solo"}
              </strong>
              <span>{[r.bestMove ? `Best move ${r.bestMove}` : null, when(r.playedAt)].filter(Boolean).join(" · ")}</span>
            </span>
          </div>
        );
      })}
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

const REASONS = ["Cheating (an engine)", "Name", "Something else"] as const;

function ReportSheet({ p, onClose }: { p: PublicProfile; onClose: () => void }) {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fd-sheet" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div class="fd-sheet-head">
          <h2 id="report-title">Report {p.name}</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {sent ? (
          <p class="fd-sub">{sent}</p>
        ) : (
          <>
            <p class="fd-sub">What's wrong? Reports are read by a person; nobody else sees them.</p>
            {REASONS.map((r) => (
              <FdButton
                key={r}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void reportPlayer(p.id, r)
                    .then(() => setSent("Thanks. We'll take a look."))
                    .catch((e: Error) => setSent(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                {r}
              </FdButton>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A profile (docs/mockups/front-door/Profile.dc.html): one structure for everyone. Yours adds Edit name & icon,
 * Open locker and settings; someone else's adds Report (and Add friend, later). Nothing private is ever shown:
 * the server's public profile has no email, sign-in method or icon in it.
 */
export function PlayerProfileScreen({
  target,
  onBack,
  onLocker,
  onSettings,
  onShop,
}: {
  target: ProfileTarget;
  onBack: () => void;
  onLocker?: () => void;
  onSettings?: () => void;
  /** The shop's chat packs (a locked line in Quick chat and emoji). */
  onShop?: () => void;
}) {
  const [, rerender] = useState(0);
  useEffect(() => onAccountChange(() => rerender((n) => n + 1)), []);
  const { config, profile: me } = account();
  const own = !!target.you || (!!me && target.uid === me.user.id);
  const uid = own ? me?.user.id : target.uid;
  const [p, setP] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "edit" | "report">(null);
  // Your own reloads when your account changes (a new name, something new to wear).
  const version = own ? `${me?.user.name}|${JSON.stringify(me?.locker?.look ?? {})}|${me?.shop?.equipped.hat}` : "";
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
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      ) : (
        <span class="fd-head-spacer" />
      )}
    </header>
  );

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
        <div class="fd-card">
          <DressedPawn size="profile" shadow look={own ? me?.locker?.look : undefined} hat={own ? myHat(me) : "none"} />
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
      {/* Two columns on a computer: who they are and what they wear; then their numbers. One column on a phone. */}
      <div class="fd-profile-col">
      <div class="fd-card">
        <DressedPawn size="profile" shadow look={p.look} hat={p.hat} />
        <h1 class="fd-card-name">{p.name}</h1>
        <div class="fd-seen">
          <span class={`fd-dot small${p.online ? "" : " off"}`} />
          {seenLine(p)} · joined {joined}
        </div>
        <div class="fd-pills">
          <RankPill tier={p.tier} rating={p.rating} />
          {p.topPercent !== null && <span class="fd-pill">Top {p.topPercent}%</span>}
        </div>
        {own && (
          <div class="fd-card-actions">
            <FdButton primary class="small" onClick={() => setSheet("edit")}>
              Edit name &amp; icon
            </FdButton>
            {onLocker && (
              <FdButton class="small" onClick={onLocker}>
                Open locker
              </FdButton>
            )}
          </div>
        )}
      </div>
      <Wearing look={p.look} hat={p.hat} own={own} />
      {/* (The social lane's section: components/ChatPicks.tsx.) */}
      {own && <QuickChatPicks onShop={onShop} focus={target.section === "chat"} />}
      </div>
      <div class="fd-profile-col">
      <Stats p={p} own={own} />
      <Bosses beaten={p.bossesBeaten} />
      <Recent p={p} />
      {own ? (
        <>
          {me && !me.user.signedIn && config && (config.google || config.email) && (
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
              Settings: sound, pace, Crowd options, how to play, your sign-in ›
            </button>
          )}
        </>
      ) : (
        <div class="fd-actions">
          <FdButton disabled>Add friend (later)</FdButton>
          <FdButton danger onClick={() => setSheet("report")}>
            Report
          </FdButton>
        </div>
      )}
      </div>
      {sheet === "edit" && <EditSheet onClose={() => setSheet(null)} />}
      {sheet === "report" && <ReportSheet p={p} onClose={() => setSheet(null)} />}
    </div>
  );
}
