import { useMemo, useState } from "preact/hooks";
import { SQUADS } from "@chessroyale/core";
import { squadsVotes, type NetSquadsLobby } from "@chessroyale/chess/squads";
import { BackButton, DressedPawn } from "../components/FrontDoor.tsx";
import { MuteButton } from "../components/MuteButton.tsx";
import { Bracket, Member, SquadTag, StandingsPanel, StandingsStrip, useNow } from "../components/SquadsParts.tsx";
import { account } from "../account.ts";
import { pawnLook } from "../looks.ts";
import type { SquadsClient } from "../squads.ts";
import { ROUND_NAME, placementText, squadColour, squadName, standingsOrder } from "../squads-view.ts";
import type { VoteView } from "../game.ts";
import { VoteScreen, type VoteHost, type VotePlayer } from "./Vote.tsx";
import { SquadsMatchScreen } from "./SquadsMatch.tsx";
import { TokenBreakdown } from "../components/SquadsBlocks.tsx";
import { MercenaryShop } from "../components/MercenaryShop.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import { SIDE_PANEL } from "../components/SquadsParts.tsx";
import { FlagIcon, MatchMenu, type MatchExit } from "../components/MatchMenu.tsx";

/**
 * Squads' screens (docs/areas/squads.md, "The screens"), by the lobby's phase: the waiting room (the queue's seats, 32 of
 * them in 8 squads), the pre-game votes (the vote board Crowd uses), then the bracket: your match (SquadsMatch.tsx), or
 * watching (knocked out, or through and waiting), and the results. Every squad's standing and team clock are always on
 * screen: a side panel on a computer, a strip on a phone.
 */

export interface SquadsActions {
  /** Leave this lobby and go home. */
  onHome: () => void;
  /** Resign (mid-bracket, your squad still in): a loss, a bot in your seat, then the resign screen. */
  onResign: () => void;
  /** Leave and queue again (solo), or back to your party. */
  onAgain: () => void;
  /** You came with a party: "Back to your party" instead of the solo queue. */
  party: boolean;
}

/**
 * What leaving means in a Squads lobby right now (MatchMenu, the standings' Leave): before the bracket, Leave (a bot
 * takes your seat, nothing recorded); with your squad still in it, Resign (a loss at the worst place it can still
 * finish, a bot in your seat for good); your squad out, Leave (its result stands). Null: nothing to leave.
 */
export function squadsExit(client: SquadsClient, actions: SquadsActions): MatchExit | null {
  const lobby = client.lobby;
  if (!lobby || client.left || client.resigning || client.resigned || lobby.phase === "results" || lobby.phase === "waiting") return null;
  const sq = client.mySquad;
  if (lobby.phase !== "bracket") return { kind: "leave", note: "You'll go home, and a bot takes your seat.", go: actions.onHome };
  if (!sq || client.placed) return { kind: "leave", note: "Your squad's result stands. You'll go home.", go: actions.onHome };
  return { kind: "resign", note: `You'll leave the lobby and it counts as a loss. A bot plays your seat for the ${squadName(sq.id)}.`, go: actions.onResign };
}

/** You resigned: what went on your record, and where to go next (the lobby goes on without you). */
function SquadsResigned({ client, actions }: { client: SquadsClient; actions: SquadsActions }) {
  const r = client.resigned;
  const sq = client.mySquad;
  return (
    <div class="screen results sq-results sq-resigned">
      <div class="trophy resigned" aria-hidden="true">
        <FlagIcon size={56} />
      </div>
      <h1>You resigned</h1>
      <p class="muted">
        {!r ? "Leaving the lobby…" : client.lobby?.test ? "Test lobby: nothing goes on your record." : `On your record: ${placementText(r.placement)} of ${r.players} squads.`}
        {sq ? ` A bot plays your seat for the ${squadName(sq.id)}.` : ""}
      </p>
      {r && !client.lobby?.test && <p class="team-result bad">It counts as a loss.</p>}
      <div class="sq-card-actions">
        <button type="button" class="fd-btn primary" onClick={actions.onAgain}>
          {actions.party ? "Back to your party" : "Queue again"}
        </button>
        <button type="button" class="fd-btn" onClick={actions.onHome}>
          Home
        </button>
      </div>
    </div>
  );
}

/** The waiting room: "12 / 32", the seconds until bots fill, and the 32 seats (your party's together), then the squads. */
export function SquadsQueue({ client, onCancel }: { client: SquadsClient; onCancel: () => void }) {
  const now = useNow(250);
  const lobby = client.lobby;
  const size = lobby?.seats ?? SQUADS.squadCount * SQUADS.squadSize;
  const people = lobby?.players.filter((p) => !p.isBot) ?? [];
  const filled = !!lobby?.filledAt;
  const left = lobby?.fillAt ? Math.max(0, Math.ceil((lobby.fillAt - now) / 1000)) : null;
  const test = lobby?.test;
  const me = client.myId;
  const myParty = client.me?.partyId ?? null;
  const line = filled
    ? "Squads formed · the votes are next"
    : test
      ? `Test lobby · starts at ${ROUND_NAME[test.start]} · bots fill in ${left ?? "…"} s`
      : `Finding players · ${left ?? "…"} s, then bots fill the rest`;
  const myLook = account().profile?.locker?.look;
  // Before the fill: people in the order they joined (you first). After: the eight squads of four.
  const squads = lobby?.squads.length ? lobby.squads : null;
  const pawn = (id: string | null) => {
    if (!id) return <span class="fd-seat empty" />;
    const p = lobby!.players.find((x) => x.id === id)!;
    const you = id === me;
    const dress = you ? { look: myLook } : pawnLook({ id, name: p.name, isYou: false, isBot: p.isBot, look: client.looks.get(id) });
    return (
      <span key={id} class={`fd-seat pop${you ? " you" : ""}${p.isBot ? " bot" : ""}${!p.isBot && p.partyId === myParty && !you && myParty ? " friend" : ""}`} title={you ? "You" : p.name}>
        <DressedPawn size="seat" look={dress.look} />
      </span>
    );
  };
  return (
    <div class="fd-page fd-queue sq-queue">
      <header class="fd-page-head">
        <BackButton onClick={onCancel} label="Leave the queue" />
        <h1 class="fd-queue-mode">Squads · 8 squads of 4</h1>
        <span class="fd-queue-mute">
          <MuteButton />
        </span>
      </header>
      <div class="fd-queue-info">
        <div class="fd-queue-count" aria-live="polite">
          <span class="fd-count-n">{filled ? size : people.length}</span> <span class="fd-count-of">/ {size}</span>
        </div>
        <div class="fd-queue-line">{line}</div>
        {(lobby?.players.filter((p) => !p.isBot && p.partyId === myParty).length ?? 0) > 1 && <div class="fd-queue-rank">Your party sits together in one squad</div>}
      </div>
      <div class="fd-bar" aria-hidden="true">
        <i style={{ width: `${(100 * (filled ? size : people.length)) / size}%` }} />
      </div>
      <div class="fd-queue-panel">
        {squads ? (
          <div class="sq-squads-grid">
            {squads.map((sq) => (
              <div key={sq.id} class={`sq-squad-box${sq.seats.includes(me ?? "") ? " you" : ""}`} style={{ "--sq": squadColour(sq.id) }}>
                <SquadTag id={sq.id} you={sq.seats.includes(me ?? "")} />
                <div class="sq-squad-seats">{sq.seats.map((id) => pawn(id))}</div>
              </div>
            ))}
          </div>
        ) : (
          <div class="fd-seats sq-seats" role="img" aria-label={`${people.length} of ${size} seats filled`}>
            {Array.from({ length: size }, (_, i) => {
              const ordered = [...people.filter((p) => p.id === me), ...people.filter((p) => p.id !== me)];
              const p = ordered[i];
              return p ? pawn(p.id) : <span key={`e${i}`} class="fd-seat empty" />;
            })}
          </div>
        )}
        <div class="fd-queue-you">
          <DressedPawn size="card" look={myLook} />
          <div>
            <div class="fd-you-title">You're in{squads ? ` · ${squadName(client.mySquad?.id)}` : ""}</div>
            <div class="fd-you-sub">Squads of 4 play a bracket: Relay, Pairs, then the final</div>
          </div>
        </div>
      </div>
      <button type="button" class="fd-btn fd-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/** The pre-game votes on Crowd's vote board: everyone's pawn on your side of an empty board, three zones, three cards. */
function SquadsVote({ client, vote, onLeave, exit }: { client: SquadsClient; vote: NonNullable<SquadsClient["vote"]>; onLeave: () => void; exit: MatchExit | null }) {
  const lobby = client.lobby!;
  // The votes this lobby holds (a test lobby whose mode is set has no Mode vote), each found by its id, never by its
  // place: so a vote always shows its own options, in their one fixed order.
  const all = squadsVotes();
  const defs = vote.count < all.length ? all.filter((d) => d.id !== "mode") : all;
  const def = all.find((d) => d.id === vote.id) ?? defs[vote.index]!;
  const host: VoteHost = useMemo(
    () => ({
      // (Every pawn on one side: there are no teams here, only squads.)
      standings: (): VotePlayer[] => lobby.players.map((p) => ({ id: p.id, name: p.name, isYou: p.id === client.myId, isBot: p.isBot, team: "w", look: client.looks.get(p.id) })),
      isYou: (id) => id === client.myId,
      castVote: (option) => client.castVote(option),
      settings: { voteYouScale: 1.12 },
    }),
    [lobby, client.myId],
  );
  const view: VoteView = { ...vote, votes: vote.votes.map((v) => ({ playerId: v.playerId, option: v.option, at: v.at, side: "w" as const, ...(v.joined ? { joined: true as const } : {}) })) };
  return (
    <VoteScreen
      match={host}
      vote={view}
      def={def}
      evalBar={false}
      chime={false}
      next={(i) => (i < defs.length ? defs[i]!.title : "The bracket is drawn")}
      extra={
        client.test ? (
          <button type="button" class="sq-next" onClick={() => client.nextRound()}>
            Skip votes
          </button>
        ) : undefined
      }
      below={<StandingsStrip client={client} onLeave={onLeave} exit={exit} />}
      menu={<MatchMenu exit={exit} />}
    />
  );
}

/**
 * Your squad is out: where it placed, your reward, and what next: watch the rest of the bracket, or queue again.
 */
function OutCard({ client, actions, onSpectate }: { client: SquadsClient; actions: SquadsActions; onSpectate: () => void }) {
  const p = client.placed!;
  return (
    <div class="fd-sheet-scrim sq-out-scrim">
    <div class="fd-sheet sq-out" role="dialog" aria-modal="true" aria-label="Knocked out">
      <div class="sq-card-title">Knocked out · {placementText(p.placement)}</div>
      <p class="muted small">
        {squadName(p.squadId)} placed {placementText(p.placement)} of 8 squads.{" "}
        {p.coins || p.crates ? `+${p.coins} coins${p.crates ? ` · ${p.crates} crate` : ""}` : client.lobby?.test ? "Test lobby: no rewards." : ""}
      </p>
      <div class="sq-card-actions">
        <button type="button" class="fd-btn" onClick={onSpectate}>
          Spectate the bracket
        </button>
        <button type="button" class="fd-btn primary" onClick={actions.onAgain}>
          {actions.party ? "Back to your party" : "Queue again"}
        </button>
      </div>
    </div>
    </div>
  );
}

/** Your squad's finished Pairs match's same-move tokens, every use and the judge's verdict (the post-match breakdown). */
function MyTokens({ client }: { client: SquadsClient }) {
  const sq = client.mySquad;
  const m = sq ? [...client.matches.values()].find((x) => x.format === "pairs" && x.state === "over" && x.sides.some((s) => s.squadId === sq.id)) : undefined;
  if (!m || !m.tokenLog.length) return null;
  return <TokenBreakdown log={m.tokenLog} sides={m.sides} mine={m.sides.findIndex((s) => s.squadId === sq!.id)} />;
}

/** The bracket phase: your match, or watching (with the bracket in the panel). */
function SquadsBracketPhase({ client, actions }: { client: SquadsClient; actions: SquadsActions }) {
  const [spectating, setSpectating] = useState(false);
  const lobby = client.lobby!;
  const mine = client.mySquad;
  const placed = client.placed && client.placed.placement !== 1 ? client.placed : null;
  const current = mine ? [...client.matches.values()].find((m) => m.state !== "over" && m.sides.some((s) => s.squadId === mine.id)) : undefined;
  const live = !!current;
  // Between matches (none on, or the next one's intro): the last match's token breakdown.
  const between = !current || (current.state === "break" && current.format !== "pairs");
  const through = !!mine && !live && !placed && lobby.bracket.some((b) => b.squads.includes(mine.id) && b.state !== "over");
  const panel = (
    <>
      {placed && !spectating && <OutCard client={client} actions={actions} onSpectate={() => setSpectating(true)} />}
      {placed && spectating && (
        <div class="sq-card">
          <div class="sq-card-title">Spectating · {squadName(placed.squadId)} placed {placementText(placed.placement)}</div>
          <div class="sq-card-actions">
            <button type="button" class="fd-btn primary" onClick={actions.onAgain}>
              {actions.party ? "Back to your party" : "Queue again"}
            </button>
            <button type="button" class="fd-btn" onClick={actions.onHome}>
              Home
            </button>
          </div>
        </div>
      )}
      {through && (
        <div class="sq-card">
          <div class="sq-card-title">Through! {squadName(mine!.id)} won its match</div>
          <p class="muted small">Your next match starts once the other one ends. Tap any tiny board to watch it.</p>
        </div>
      )}
      {(between || placed) && <MyTokens client={client} />}
      {(!live || placed) && <Bracket lobby={lobby} mine={mine?.id ?? null} />}
    </>
  );
  return (
    <>
      <SquadsMatchScreen client={client} panel={panel} onNextRound={() => client.nextRound()} onLeave={actions.onHome} exit={squadsExit(client, actions)} />
      {/* Mercenary: your squad's shop, while it waits for its next match. */}
      <MercenaryShop client={client} />
    </>
  );
}

/** The results: every squad's placement (yours ringed), your reward, and what next. */
function SquadsResults({ client, actions }: { client: SquadsClient; actions: SquadsActions }) {
  const lobby = client.lobby!;
  const mine = client.mySquad?.id ?? null;
  const placed = client.placed;
  const order = standingsOrder(lobby);
  const won = placed?.placement === 1;
  return (
    <div class="screen results sq-results">
      <div class="trophy" aria-hidden="true">
        {won ? "🏆" : placed?.placement === 2 ? "🥈" : "♟️"}
      </div>
      <h1>{placed ? (won ? "Champions!" : `${placementText(placed.placement)} of 8 squads`) : "The bracket is decided"}</h1>
      {placed && (
        <p class="muted">
          {won ? `${squadName(placed.squadId)} won the Squads final.` : `${squadName(placed.squadId)} placed ${placementText(placed.placement)}.`}{" "}
          {placed.coins || placed.crates ? `+${placed.coins} coins${placed.crates ? ` and ${placed.crates} crate` : ""}.` : lobby.test ? "Test lobby: no rewards." : ""}
        </p>
      )}
      <ol class="sq-places">
        {order.map((id) => {
          const sq = lobby.squads.find((s) => s.id === id)!;
          return (
            <li key={id} class={id === mine ? "you" : ""} style={{ "--sq": squadColour(id) }}>
              <span class="sq-place">{sq.placement ? placementText(sq.placement) : "–"}</span>
              <span class="sq-place-main">
                <SquadTag id={id} you={id === mine} />
                <span class="sq-row-members">
                  {sq.seats.map((pid) => (
                    <Member key={pid} client={client} id={pid} />
                  ))}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <MyTokens client={client} />
      <Bracket lobby={lobby} mine={mine} />
      <div class="sq-card-actions">
        <button type="button" class="fd-btn primary" onClick={actions.onAgain}>
          {actions.party ? "Back to your party" : "Play again"}
        </button>
        <button type="button" class="fd-btn" onClick={actions.onHome}>
          Home
        </button>
      </div>
    </div>
  );
}

/** The phases after the waiting room, framed: the standings beside them on a computer. */
export function SquadsScreen({ client, actions }: { client: SquadsClient; actions: SquadsActions }) {
  const side = useMedia(SIDE_PANEL);
  const lobby = client.lobby;
  if (!lobby) return <div class="screen center"><p class="muted">Connecting…</p></div>;
  // You resigned (or are resigning): your record and what next, whatever the lobby does meanwhile.
  if (client.resigning || client.resigned) return <SquadsResigned client={client} actions={actions} />;
  const exit = squadsExit(client, actions);
  const body =
    lobby.phase === "vote" && client.vote ? (
      <SquadsVote client={client} vote={client.vote} onLeave={actions.onHome} exit={exit} />
    ) : lobby.phase === "results" ? (
      <SquadsResults client={client} actions={actions} />
    ) : lobby.phase === "bracket" ? (
      <SquadsBracketPhase client={client} actions={actions} />
    ) : (
      <div class="screen center">
        <p class="muted">The squads are formed: the votes are next…</p>
      </div>
    );
  return (
    <div class="arena sq-arena">
      {/* (Only where it shows: its clocks are drawn ten times a second.) */}
      {side && (
        <aside class="tower-side sq-side">
          <StandingsPanel client={client} onLeave={actions.onHome} exit={exit} />
        </aside>
      )}
      {body}
    </div>
  );
}

/** For the queue frame: whether the lobby is still gathering (the waiting room shows). */
export const squadsWaiting = (lobby: NetSquadsLobby | null) => !lobby || lobby.phase === "waiting" || lobby.phase === "filled";
