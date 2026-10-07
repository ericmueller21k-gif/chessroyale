import type { NetMatch } from "../net.ts";
import { QueueScreen } from "./Queue.tsx";
import { PlayerName } from "../components/PlayerName.tsx";

export function LobbyScreen({ match, onLeave }: { match: NetMatch; onLeave: () => void }) {
  // Matchmade (PLAY): the queue, not a lobby.
  if (match.auto) return <QueueScreen match={match} onCancel={onLeave} />;
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
        Players ({humans.length} of {match.settings.lobbySize}){match.settings.raid ? "" : " · empty seats fill with bots"}
      </h2>
      <ul class="lobby-players">
        {humans.map((p) => (
          <li key={p.id} class={match.isYou(p.id) ? "you" : ""}>
            <span class={`dot ${p.connected ? "on" : ""}`} aria-label={p.connected ? "connected" : "disconnected"} />
            <PlayerName name={p.name} uid={p.uid} you={match.isYou(p.id)} />
            {p.id === match.hostId && <span class="host-badge">host</span>}
          </li>
        ))}
      </ul>
      {match.isHost ? (
        <>
          <button type="button" class="btn btn-primary btn-wide" onClick={() => match.startMatch()}>
            Start with {humans.length} {humans.length === 1 ? "player" : "players"}
            {/* (A boss raid has no bots.) */}
            {match.settings.raid ? "" : ` + ${match.settings.lobbySize - humans.length} bots`}
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
