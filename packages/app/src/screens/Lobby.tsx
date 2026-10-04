import { useFrameNow } from "../components/Countdown.tsx";
import type { NetMatch } from "../net.ts";

/** "Play now": the count climbs as players join; at the fill time (or when full) bots take the empty seats and it starts. */
function FindingScreen({ match, onLeave }: { match: NetMatch; onLeave: () => void }) {
  const now = useFrameNow();
  const humans = match.players.filter((p) => !p.isBot).length;
  const size = match.settings.lobbySize;
  const left = match.fillAt ? Math.max(0, Math.ceil((match.fillAt - now) / 1000)) : null;
  return (
    <div class="screen center finding">
      <h1>Finding players…</h1>
      <div class="finding-count" aria-live="polite">
        <strong>{humans}</strong>
        <span>/ {size}</span>
      </div>
      <div class="finding-bar" aria-hidden="true">
        <i style={{ width: `${(100 * humans) / size}%` }} />
      </div>
      <p class="muted">
        {left !== null && left > 0
          ? `Starting in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}. Bots fill any empty seats.`
          : "Starting…"}
      </p>
      <p class="muted small">50 v 50 · unranked</p>
      <button type="button" class="btn btn-secondary btn-wide" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}

export function LobbyScreen({ match, onLeave }: { match: NetMatch; onLeave: () => void }) {
  if (match.auto) return <FindingScreen match={match} onLeave={onLeave} />;
  const humans = match.players.filter((p) => !p.isBot);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "HunChess", text: `Join my lobby: ${match.code}`, url: match.inviteUrl });
      else await navigator.clipboard.writeText(match.inviteUrl);
    } catch {
      // Dismissed.
    }
  };
  return (
    <div class="screen lobby">
      <h1>Lobby {match.code}</h1>
      <div class="invite">
        <div class="muted small">Invite friends with the link or the code</div>
        <div class="invite-code">{match.code}</div>
        <button type="button" class="btn btn-secondary btn-wide" onClick={share}>
          Share invite link
        </button>
      </div>
      <h2 class="muted small">
        Players ({humans.length} of {match.settings.lobbySize}) · empty seats fill with bots
      </h2>
      <ul class="lobby-players">
        {humans.map((p) => (
          <li key={p.id} class={match.isYou(p.id) ? "you" : ""}>
            <span class={`dot ${p.connected ? "on" : ""}`} aria-label={p.connected ? "connected" : "disconnected"} />
            <span>{p.name}</span>
            {p.id === match.hostId && <span class="host-badge">host</span>}
          </li>
        ))}
      </ul>
      {match.isHost ? (
        <>
          <button type="button" class="btn btn-primary btn-wide" onClick={() => match.startMatch()}>
            Start with {humans.length} {humans.length === 1 ? "player" : "players"} + {match.settings.lobbySize - humans.length} bots
          </button>
          <p class="muted small">
            You're the host: your browser scores every round with the chess engine, so keep this tab open. A computer works best.
          </p>
        </>
      ) : (
        <p class="status">Waiting for the host to start…</p>
      )}
      <button type="button" class="btn btn-secondary btn-wide" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}
