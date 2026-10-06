import { useEffect, useState } from "preact/hooks";
import { ordinal } from "./StageBreak.tsx";
import { SignIn } from "../components/SignIn.tsx";
import { IconEditor, UserIcon } from "../components/PixelIcon.tsx";
import {
  account,
  onAccountChange,
  signOut,
  updateProfile,
  type ModeStats,
} from "../account.ts";

/** The account state, kept in sync. */
export function useAccount() {
  const [, setTick] = useState(0);
  useEffect(() => onAccountChange(() => setTick((t) => t + 1)), []);
  return account();
}

const nth = (n: number) => `${n}${ordinal(n)}`;

function Stats({ s }: { s: ModeStats }) {
  const tiles: [string, string][] = [
    ["Matches", String(s.matches)],
    ["Wins", String(s.wins)],
    ["Final four", String(s.finals)],
    ["Avg place", s.avgPlacement === null ? "—" : String(s.avgPlacement)],
    ["Best", s.best === null ? "—" : nth(s.best)],
  ];
  return (
    <div class="profile-stats">
      {tiles.map(([k, v]) => (
        <div key={k} class="profile-stat">
          <strong>{v}</strong>
          <span>{k}</span>
        </div>
      ))}
    </div>
  );
}

/** Your profile: icon, name, stats, recent matches, and signing in to keep it across devices. */
export function ProfileScreen({ onBack, onSettings }: { onBack: () => void; onSettings?: () => void }) {
  const { config, profile } = useAccount();
  const [tab, setTab] = useState<"all" | "classic" | "crowd" | "boss">("all");
  const [name, setName] = useState(profile?.user.name ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => setName(profile?.user.name ?? ""), [profile?.user.name]);
  if (!profile) {
    return (
      <div class="screen center">
        <p class="muted">Loading your profile…</p>
        <button type="button" class="btn btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }
  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const u = profile.user;
  const crowdTeamWins = profile.stats.crowd.teamWins;
  return (
    <div class="screen profile">
      <div class="profile-head">
        <button type="button" class="profile-icon" onClick={() => setEditing(true)} aria-label="Edit your icon">
          <UserIcon icon={u.icon} />
          <span class="profile-icon-edit">Edit</span>
        </button>
        <div class="profile-name">
          <input
            aria-label="Your name"
            value={name}
            maxLength={16}
            onInput={(e) => setName(e.currentTarget.value)}
            onBlur={() => name.trim() && name.trim() !== u.name && void run(() => updateProfile({ name: name.trim() }))}
          />
          <span class="muted small">{u.signedIn ? (u.google ? `Google · ${u.email ?? ""}` : u.email) : "Guest: sign in to keep this profile on any device"}</span>
        </div>
      </div>
      {editing && (
        <IconEditor
          initial={u.icon}
          onCancel={() => setEditing(false)}
          onSave={(png) =>
            run(async () => {
              await updateProfile({ icon: png });
              setEditing(false);
            }, "Icon saved.")
          }
        />
      )}
      <div class="mode-pick small-pick profile-tabs" role="tablist">
        {(["all", "classic", "crowd", "boss"] as const).map((t) => (
          <button type="button" role="tab" aria-selected={tab === t} key={t} class={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            <strong>{t === "all" ? "All" : t === "classic" ? "Classic" : t === "crowd" ? "Crowd" : "Boss"}</strong>
          </button>
        ))}
      </div>
      <Stats s={profile.stats[tab] ?? { matches: 0, wins: 0, finals: 0, avgPlacement: null, best: null, teamWins: 0 }} />
      {tab === "crowd" && profile.stats.crowd.matches > 0 && (
        <p class="muted small">
          Your team won the game {crowdTeamWins} of {profile.stats.crowd.matches} times.
        </p>
      )}
      {profile.rating !== null && <p class="muted small">Engine rating from your last match: {profile.rating}</p>}
      {profile.recent.length > 0 && (
        <>
          <h2 class="small muted">Recent matches</h2>
          <ul class="recent">
            {profile.recent.map((r) => (
              <li key={r.playedAt}>
                <span class={`recent-place${r.placement === 1 ? " gold" : r.placement <= 4 ? " final" : ""}`}>{nth(r.placement)}</span>
                <span>
                  {r.mode === "crowd" ? "Crowd" : r.mode === "boss" ? "Boss raid" : "Classic"} · {r.players} players{r.online ? "" : " · solo"}
                  {r.teamWon === true ? " · team won" : r.teamWon === false ? " · team lost" : ""}
                </span>
                <span class="muted small">{new Date(r.playedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {!u.signedIn && config && (config.google || config.email) && (
        <div class="signin">
          <h2>Keep your profile</h2>
          <SignIn google={config.google} email={config.email} next="/profile" />
        </div>
      )}
      {msg && <p class="muted small">{msg}</p>}
      <div class="profile-actions">
        <button type="button" class="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        {onSettings && (
          <button type="button" class="btn btn-secondary" onClick={onSettings}>
            Settings
          </button>
        )}
        {u.signedIn && (
          <button type="button" class="btn btn-secondary" disabled={busy} onClick={() => void run(signOut)}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
