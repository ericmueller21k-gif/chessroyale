import { useEffect, useState } from "preact/hooks";
import { SQUADS } from "@chessroyale/core";
import { FdButton } from "../components/FrontDoor.tsx";
import type { PartyClient } from "../squads.ts";

/**
 * Squads' party (docs/areas/squads.md, "The screens"): make one (a code and an invite link, /squads/party/CODE), or
 * join by code or link; see who's in; the leader queues everyone into one squad. Admins (and anyone where the test
 * switch is on) also get the test lobbies: straight at Relay, Pairs or the final.
 */
export function PartySheet({
  party,
  joinCode,
  loading,
  error,
  onlineLocked,
  admin,
  onCreate,
  onJoin,
  onTest,
  onSignIn,
  onClose,
}: {
  party: PartyClient | null;
  /** An invite link's code: the join form is filled in. */
  joinCode?: string;
  loading: boolean;
  error?: string | null;
  onlineLocked?: boolean;
  admin?: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onTest: (start: "votes" | "relay" | "pairs" | "final") => void;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(joinCode ?? "");
  const [copied, setCopied] = useState(false);
  const [, redraw] = useState(0);
  useEffect(() => party?.subscribe(() => redraw((n) => n + 1)), [party]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const p = party?.party ?? null;
  const copy = async () => {
    if (!party) return;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: "HunChess Squads", text: "Join my squad", url: party.link });
      else await navigator.clipboard.writeText(party.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Cancelled, or no clipboard: the link is on screen to copy by hand.
    }
  };
  const leader = p?.members.find((m) => m.id === p.leaderId);
  const connected = p?.members.filter((m) => m.connected).length ?? 0;
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fd-sheet sq-party" role="dialog" aria-modal="true" aria-labelledby="party-title">
        <div class="fd-sheet-head">
          <h2 id="party-title">{party ? `Party ${party.code}` : "Squads party"}</h2>
          <button type="button" class="fd-icon-btn" aria-label={party ? "Leave the party" : "Close"} onClick={onClose}>
            ✕
          </button>
        </div>
        {onlineLocked ? (
          <>
            <p class="fd-sub">Squads is online, so it needs an account. It takes a few seconds with Google or your email.</p>
            <FdButton primary onClick={onSignIn}>
              Sign in to play online
            </FdButton>
          </>
        ) : party ? (
          <>
            <p class="fd-sub">Up to {SQUADS.partyMax} friends play in one squad. Share the code or the link.</p>
            <div class="sq-invite">
              <span class="sq-invite-code" aria-label="Party code">
                {party.code}
              </span>
              <span class="sq-invite-link">{party.link.replace(/^https?:\/\//, "")}</span>
              <FdButton class="small" onClick={() => void copy()}>
                {copied ? "Copied" : "Copy link"}
              </FdButton>
            </div>
            <ul class="sq-party-members" aria-label="Members">
              {p?.members.map((m) => (
                <li key={m.id} class={`${m.connected ? "" : "away"}${m.id === party.memberId ? " you" : ""}`}>
                  <span class={`fd-dot${m.connected ? "" : " off"}`} aria-hidden="true" />
                  <span class="sq-party-name">{m.id === party.memberId ? `${m.name} (you)` : m.name}</span>
                  {m.id === p.leaderId && <span class="sq-party-lead">leader</span>}
                </li>
              ))}
              {p && Array.from({ length: Math.max(0, p.max - p.members.length) }, (_, i) => (
                <li key={`e${i}`} class="empty">
                  <span class="fd-dot off" aria-hidden="true" />
                  <span class="sq-party-name muted">Open seat · a bot if nobody comes</span>
                </li>
              ))}
            </ul>
            {p?.state === "queueing" ? (
              <div class="sq-party-state" role="status">
                <strong>Finding a lobby…</strong>
                {p.busy && <span class="muted small">{p.busy.message}</span>}
                {party.isLeader && (
                  <FdButton class="small" onClick={() => party.cancel()}>
                    Cancel
                  </FdButton>
                )}
              </div>
            ) : party.isLeader ? (
              <button type="button" class="fd-play sq-party-play" disabled={!connected} onClick={() => party.queue()}>
                PLAY · {connected} {connected === 1 ? "player" : "players"}
              </button>
            ) : (
              <p class="sq-party-state muted" role="status">
                Waiting for {leader?.name ?? "the leader"} to press PLAY
              </p>
            )}
            {party.error && <p class="fd-error">{party.error}</p>}
            <FdButton danger onClick={onClose}>
              Leave the party
            </FdButton>
          </>
        ) : (
          <>
            <p class="fd-sub">Play Squads with up to {SQUADS.partyMax - 1} friends: you all sit in one squad, and bots fill the rest.</p>
            <FdButton primary disabled={loading} onClick={onCreate}>
              Create a party
            </FdButton>
            <div class="fd-or">or join one</div>
            <div class="fd-join">
              <input
                class="fd-code"
                value={code}
                maxLength={5}
                placeholder="CODE"
                aria-label="Party code"
                autoFocus={!!joinCode}
                onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
              />
              <FdButton primary={!!joinCode} disabled={loading || code.trim().length !== 5} onClick={() => onJoin(code.trim())}>
                Join party
              </FdButton>
            </div>
            {error && <p class="fd-error">{error}</p>}
            {admin && (
              <div class="sq-test" aria-label="Test lobbies">
                <span class="fd-label">TEST LOBBY</span>
                <div class="sq-test-row">
                  {(["votes", "relay", "pairs", "final"] as const).map((s) => (
                    <FdButton key={s} class="small" disabled={loading} onClick={() => onTest(s)}>
                      {s === "votes" ? "Start" : s === "relay" ? "Relay" : s === "pairs" ? "Pairs" : "Final"}
                    </FdButton>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
