import { memo } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import { useMedia } from "./QuickChat.tsx";
import type { NetBracketMatch, NetSquadsLobby, NetWallet } from "@chessroyale/chess/squads";
import { Coins } from "./SquadsBlocks.tsx";
import { TinyBoard } from "./TinyBoard.tsx";
import { PlayerName } from "./PlayerName.tsx";
import type { SquadsClient } from "../squads.ts";
import {
  FORMAT_NAME,
  LOW_BANK_MS,
  ROUND_NAME,
  bankText,
  myBoards,
  placementText,
  points,
  shownMatches,
  squadClocks,
  squadColour,
  squadName,
  standingLine,
  standingsOrder,
  type LocalMatch,
  type SquadClock,
} from "../squads-view.ts";

/**
 * Squads' shared pieces (docs/areas/squads.md, "The screens"): a squad's name chip, its team clock (counting down live,
 * red and pulsing in sudden death), the standings (a side panel on a computer, a compact strip on a phone, with a sheet
 * of the whole table), every board in the lobby as tiny boards, and the bracket.
 */

/** Where the standings are a side panel (a computer); below it, a strip (a phone). The stylesheet's line too. */
export const SIDE_PANEL = "(min-width: 1100px) and (min-height: 600px)";

/** Now, every `ms` (the clocks: ten times a second, without redrawing the whole screen). */
export function useNow(ms = 100, active = true): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, active]);
  return now;
}

/** A squad's name with its colour. */
export function SquadTag({ id, you, short }: { id: number | null; you?: boolean; short?: boolean }) {
  return (
    <span class={`sq-tag${you ? " you" : ""}`} style={{ "--sq": squadColour(id) }}>
      <i aria-hidden="true" />
      {short ? squadName(id).slice(0, 3) : squadName(id)}
    </span>
  );
}

/** Every squad's clock now (re-drawn ten times a second by whoever shows it). */
export function useClocks(client: SquadsClient, active = true): SquadClock[] {
  const now = useNow(100, active);
  return squadClocks(client.clocks, client.matches.values(), now);
}

/**
 * A team clock: "3:41" (tenths under ten seconds), a ▼ while draining (▼▼ twice as fast), and at zero sudden death
 * ("Sudden death" where there's room, "SD" in the phone's strip), red and pulsing.
 */
export function ClockText({ clock, delayMs, short }: { clock: SquadClock | undefined; delayMs?: number; short?: boolean }) {
  if (!clock) return <span class="sq-clock">–</span>;
  if (clock.suddenDeath)
    return (
      <span class="sq-clock sd" title={`Sudden death: every move within ${Math.round((delayMs ?? 3000) / 1000)} s`}>
        {short ? "SD" : "Sudden death"}
      </span>
    );
  return (
    <span class={`sq-clock${clock.rate ? " running" : ""}${clock.bankMs < LOW_BANK_MS ? " low" : ""}`}>
      {bankText(clock.bankMs)}
      {clock.rate > 0 && <b aria-hidden="true">{clock.rate > 1 ? "▼▼" : "▼"}</b>}
    </span>
  );
}

/**
 * The standings as a side panel (a computer): every squad, best placed first, with its name, members, where it stands
 * in the bracket, and its team clock counting down.
 */
export function StandingsPanel({ client, onLeave }: { client: SquadsClient; onLeave?: () => void }) {
  const lobby = client.lobby;
  const clocks = useClocks(client);
  if (!lobby || !lobby.squads.length) return null;
  const mine = client.mySquad?.id ?? null;
  const delay = lobby.rules ? lobby.rules.clock.delaySeconds * 1000 : 3000;
  // (Mercenary: every squad's coins, for everyone.)
  const wallets = client.wallets;
  return (
    <section class="sq-standings" aria-label="Squads">
      <h2 class="sq-standings-head">
        Squads <span class="muted">· team clocks</span>
      </h2>
      {standingsOrder(lobby).map((id) => {
        const sq = lobby.squads.find((s) => s.id === id)!;
        const clock = clocks.find((c) => c.squadId === id);
        return (
          <div key={id} class={`sq-row${id === mine ? " you" : ""}${clock?.suddenDeath ? " sd" : ""}${sq.placement && sq.placement !== 1 ? " out" : ""}`} style={{ "--sq": squadColour(id) }}>
            <div class="sq-row-top">
              <SquadTag id={id} you={id === mine} />
              <span class="sq-row-pos">{standingLine(lobby, id)}</span>
              {wallets.length > 0 && <SquadCoins wallets={wallets} id={id} />}
              <ClockText clock={clock} delayMs={delay} />
            </div>
            <div class="sq-row-members">
              {sq.seats.map((pid) => (
                <Member key={pid} client={client} id={pid} />
              ))}
            </div>
          </div>
        );
      })}
      {onLeave && <LeaveButton client={client} onLeave={onLeave} />}
    </section>
  );
}

/**
 * Leaving the lobby: before your squad is out a bot takes your seat for good (the server's rule), so it asks once more.
 */
function LeaveButton({ client, onLeave }: { client: SquadsClient; onLeave: () => void }) {
  const [sure, setSure] = useState(false);
  const playing = !!client.mySquad && !client.placed && client.lobby?.phase !== "results";
  return (
    <button type="button" class={`sq-leave${sure ? " sure" : ""}`} onClick={() => (playing && !sure ? setSure(true) : onLeave())}>
      {playing ? (sure ? "Leave now: a bot takes your seat" : "Leave the lobby") : "Leave the lobby"}
    </button>
  );
}

/** A member's name ("You" for you; a bot marked): a tap opens their profile. */
export function Member({ client, id }: { client: SquadsClient; id: string }) {
  const p = client.lobby?.players.find((x) => x.id === id);
  if (!p) return null;
  const you = id === client.myId;
  return (
    <span class={`sq-member${you ? " you" : ""}${p.isBot || p.botPlays ? " bot" : ""}${p.left ? " left" : ""}`}>
      <PlayerName name={p.name} uid={p.uid} you={you} bot={p.isBot}>
        {you ? "You" : p.name}
      </PlayerName>
      {p.isBot ? <small aria-label="bot">🤖</small> : p.botPlays ? <small title="A bot plays this seat">🤖</small> : null}
    </span>
  );
}

/**
 * The standings as a phone's compact strip: every squad's short name and clock in one row (yours ringed, sudden
 * death red and pulsing). A tap opens the whole table.
 */
export function StandingsStrip({ client, onLeave }: { client: SquadsClient; onLeave?: () => void }) {
  const [open, setOpen] = useState(false);
  const lobby = client.lobby;
  // (Not where the side panel shows them: every Squads screen is in the arena, which has it there.)
  const hidden = useMedia(SIDE_PANEL);
  const clocks = useClocks(client, !hidden);
  if (hidden || !lobby || !lobby.squads.length) return null;
  const mine = client.mySquad?.id ?? null;
  return (
    <>
      <button type="button" class="sq-strip" aria-label="Squads: show the standings" onClick={() => setOpen(true)}>
        {standingsOrder(lobby).map((id) => {
          const sq = lobby.squads.find((s) => s.id === id)!;
          const clock = clocks.find((c) => c.squadId === id);
          return (
            <span key={id} class={`sq-strip-chip${id === mine ? " you" : ""}${clock?.suddenDeath ? " sd" : ""}${sq.placement && sq.placement !== 1 ? " out" : ""}`} style={{ "--sq": squadColour(id) }}>
              <span class="sq-strip-name">{squadName(id)}</span>
              <ClockText clock={clock} short />
            </span>
          );
        })}
      </button>
      {open && (
        <div class="tower-overlay" role="dialog" aria-label="Squads" onClick={() => setOpen(false)}>
          <div class="tower-sheet sq-sheet" onClick={(e) => e.stopPropagation()}>
            <div class="tower-sheet-head">
              <strong>Squads</strong>
              <button type="button" class="tower-close" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <StandingsPanel client={client} />
            {lobby.bracket.length > 0 && <Bracket lobby={lobby} mine={mine} />}
            {onLeave && <LeaveButton client={client} onLeave={onLeave} />}
          </div>
        </div>
      )}
    </>
  );
}

/** One tiny board, drawn again only when its position, its marks or whether it can be tapped change. */
const SquadTiny = memo(
  function SquadTiny({
  fen,
  lastMove,
  label,
  you,
  next,
  on,
  over,
  onTap,
}: {
  fen: string;
  lastMove: string | null;
  label: string;
  you: boolean;
  next: boolean;
  on: boolean;
  over: boolean;
  onTap?: () => void;
}) {
  const body = (
    <>
      <TinyBoard fen={fen} lastMove={lastMove} />
      {you && <span class="sq-mark you">YOU</span>}
      {!you && next && <span class="sq-mark next">NEXT</span>}
    </>
  );
  const cls = `sq-tiny${on ? " on" : ""}${over ? " over" : ""}${you ? " is-you" : ""}`;
  return onTap ? (
    <button type="button" class={cls} aria-label={`Watch ${label}`} onClick={onTap}>
      {body}
    </button>
  ) : (
    <span class={cls} aria-label={label}>
      {body}
    </span>
  );
  },
  // (A new tap handler each time the screen draws is the same handler: it only says which board to open.)
  (a, b) => a.fen === b.fen && a.lastMove === b.lastMove && a.label === b.label && a.you === b.you && a.next === b.next && a.on === b.on && a.over === b.over && !a.onTap === !b.onTap,
);

/**
 * Every board in the lobby as tiny boards across the top, match by match: your squad's match ringed, YOU on your board
 * and NEXT on next turn's. Tappable (`onWatch`) only once you've moved this half: one opens full size.
 */
export function SquadsBoards({
  client,
  watching,
  onWatch,
}: {
  client: SquadsClient;
  /** The board on the big board ("key/board"). */
  watching: string | null;
  /** Null: not tappable now (you have a move to make). */
  onWatch: ((key: string, board: number) => void) | null;
}) {
  const list = shownMatches([...client.matches.values()]);
  if (!list.length) return null;
  const mine = client.mySquad?.id ?? null;
  const total = list.reduce((n, m) => n + m.boards.length, 0);
  return (
    <div class={`sq-boards n${Math.min(16, total)}`} role="list" aria-label="Every board">
      {list.map((m) => (
        <MatchBoards key={m.key} m={m} client={client} mine={mine} watching={watching} onWatch={onWatch} />
      ))}
    </div>
  );
}

function MatchBoards({ m, client, mine, watching, onWatch }: { m: LocalMatch; client: SquadsClient; mine: number | null; watching: string | null; onWatch: ((key: string, board: number) => void) | null }) {
  const ours = m.sides.some((s) => s.squadId === mine);
  // (Your marks follow the board you're on: during the show after a turn's second half, still last turn's.)
  const marks = ours ? myBoards({ ...m, turn: shownTurn(m) }, client.myId) : null;
  return (
    <div role="listitem" class={`sq-match${ours ? " ours" : ""}${m.state === "over" ? " done" : ""}`} style={{ "--sq-a": squadColour(m.sides[0].squadId), "--sq-b": squadColour(m.sides[1].squadId) }}>
      {m.boards.map((b) => (
        <SquadTiny
          key={b.id}
          fen={b.fen}
          lastMove={b.lastMove}
          label={`${squadName(m.sides[0].squadId)} v ${squadName(m.sides[1].squadId)}, board ${b.id + 1}`}
          you={!!marks && marks.you === b.id}
          next={!!marks && marks.next === b.id && marks.next !== marks.you}
          on={watching === `${m.key}/${b.id}`}
          over={!!b.result || m.state === "over"}
          onTap={onWatch ? () => onWatch(m.key, b.id) : undefined}
        />
      ))}
    </div>
  );
}

/** The turn whose boards the screen shows: the one just played while its moves land (the show), else the current one. */
export function shownTurn(m: LocalMatch): number {
  if (m.state === "show" && m.last) {
    const e = m.last.events.find((x) => "turn" in x) as { turn: number } | undefined;
    if (e) return e.turn;
  }
  return m.turn;
}

/** The bracket: round 1's four matches, round 2's two, the final; each with its squads, score and state. */
export function Bracket({ lobby, mine, now }: { lobby: NetSquadsLobby; mine: number | null; now?: number }) {
  const t = now ?? Date.now();
  return (
    <div class="sq-bracket" aria-label="The bracket">
      {[0, 1, 2].map((round) => (
        <div key={round} class="sq-bracket-round">
          <div class="sq-bracket-title">
            {ROUND_NAME[round]} <span class="muted">· {FORMAT_NAME[(["relay", "pairs", "final"] as const)[round]!]}</span>
          </div>
          {lobby.bracket
            .filter((b) => b.round === round)
            .map((b) => (
              <BracketCard key={b.key} b={b} mine={mine} now={t} />
            ))}
        </div>
      ))}
    </div>
  );
}

function BracketCard({ b, mine, now }: { b: NetBracketMatch; mine: number | null; now: number }) {
  const state =
    b.state === "over"
      ? b.how === "time"
        ? "on time"
        : b.how === "coin"
          ? "coin"
          : b.how === "clinch"
            ? "clinched"
            : b.how === "admin"
              ? "ended"
              : "final score"
      : b.state === "playing"
        ? "playing"
        : b.state === "break"
          ? `in ${Math.max(0, Math.ceil(((b.startsAt ?? now) - now) / 1000))} s`
          : "waiting";
  return (
    <div class={`sq-bcard${b.squads.includes(mine as number) ? " ours" : ""} ${b.state}`}>
      {b.squads.map((id, i) => (
        <div key={i} class={`sq-bline${b.winner !== null && b.winner === id ? " won" : b.winner !== null ? " lost" : ""}`}>
          {id === null ? <span class="muted">—</span> : <SquadTag id={id} you={id === mine} />}
          <span class="sq-bpts">{b.points ? points(b.points[i]!) : ""}</span>
        </div>
      ))}
      <div class="sq-bstate">{state}</div>
    </div>
  );
}

/** "1st", "5th–8th": a placement in words. */
export const placementWords = placementText;

/** Mercenary: a squad's coins in the standings. */
function SquadCoins({ wallets, id }: { wallets: readonly NetWallet[]; id: number }) {
  const w = wallets.find((x) => x.squadId === id);
  return w ? <Coins n={w.coins} class="small" /> : null;
}
