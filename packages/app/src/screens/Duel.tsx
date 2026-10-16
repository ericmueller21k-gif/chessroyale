import type { ComponentChildren, VNode } from "preact";
import { useEffect, useState } from "preact/hooks";
import { controlLabel, duelControl } from "@chessroyale/core";
import { other, type Color, type DuelEnd } from "@chessroyale/chess/duel";
import { Board } from "../components/Board.tsx";
import { Avatar } from "../components/Items.tsx";
import { MatchMenu, type MatchExit } from "../components/MatchMenu.tsx";
import { PlayerName } from "../components/PlayerName.tsx";
import { COMPUTER_LAYOUT } from "../components/MatchMenu.tsx";
import { ChatPanel, useMedia, type ChatPeople } from "../components/QuickChat.tsx";
import { DuelOverlay, DuelVote } from "../components/DuelVote.tsx";
import { DuelRankPill } from "../components/DuelRankPill.tsx";
import { DuelStage, type StageSide } from "../components/DuelStage.tsx";
import { clockAt, type DuelQueue, type DuelSession, type DuelSide, type DuelSnapshot } from "../duel.ts";
import { account } from "../account.ts";
import { ranked1v1Rank } from "../ranked.ts";
import { clockShown } from "../clock-text.ts";

/**
 * Ranked 1 v 1's screens (docs/areas/ranked.md): the stage (components/DuelStage.tsx: the search, with Cancel and after
 * RANKED_1V1.fewPlayersSeconds the "Few players online right now" choice, then the versus moment on the same stage),
 * and the game, whose board loads once and stays put from the vote to the result. Classes are `dv-`.
 */

/** Redraws when the session (or queue) changes, and `ms` apart while `running` (the clocks). */
function useSession(s: { subscribe(fn: () => void): () => void }, running: boolean, ms = 100): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => s.subscribe(() => setNow(Date.now())), [s]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [running, ms]);
  return now;
}

// ---------------- The stage: the search, then the versus moment ----------------

/** The stage's title: the mode, as the search always said it. */
const stageHead = (
  <>
    <h2>1 v 1</h2>
    <p class="muted dv-sub">Classic chess</p>
  </>
);

/** You on the stage while searching: your account's name, look and 1 v 1 rank. */
function youOnStage(): StageSide {
  const me = account().profile;
  return { name: me?.user.name ?? "You", look: me?.locker?.look, rank: ranked1v1Rank() };
}

/**
 * The search: your pawn on its platform, the other platform empty and waiting ("Finding opponent…" and the time),
 * Cancel; after RANKED_1V1.fewPlayersSeconds, "Few players online right now" (Keep waiting, or a bot). (A function
 * returning the stage, not a component of its own: the search and the versus moment must be the same `DuelStage`, so
 * Preact keeps it, and your pawn on it, from one to the other.)
 */
function searchStage(queue: DuelQueue, now: number, few: boolean, onKeep: () => void, onCancel: () => void, onBot: () => void, onAway: () => void) {
  const s = queue.state;
  const waited = s.kind === "searching" ? Math.max(0, now - s.since) : 0;
  return (
    <DuelStage
      label="Finding opponent"
      you={youOnStage()}
      them={null}
      head={
        <>
          {/* Home, still searching (Eric, Oct 16: "a back button or they can view inventory"): the bar comes with you. */}
          <button type="button" class="dv-st-home" onClick={onAway} aria-label="Home: keep searching while you look around">
            <span aria-hidden="true">‹</span> Home
          </button>
          {stageHead}
        </>
      }
      waiting={
        <>
          <span class="dv-st-finding">Finding opponent…</span>
          <span class="dv-wait">{clockShown(waited)}</span>
        </>
      }
    >
      {few && (
        <div class="dv-few" role="status">
          <strong>Few players online right now</strong>
          <div class="dv-few-actions">
            <button type="button" class="btn btn-secondary" onClick={onKeep}>
              Keep waiting
            </button>
            <button type="button" class="btn btn-primary" onClick={onBot}>
              Play a bot (unranked)
            </button>
          </div>
        </div>
      )}
      <button type="button" class="btn btn-secondary dv-cancel" onClick={onCancel}>
        Cancel
      </button>
    </DuelStage>
  );
}

/**
 * The versus moment (RANKED_1V1.versusMs, the game's own timing): the same stage, the opponent's pawn dropped onto
 * the empty platform with their name and rank. While the game object waits for both players (`waiting`), the
 * platform is still empty: their pawn arrives as the versus moment starts, so it holds for the whole of it.
 */
export function versusStage(snap: DuelSnapshot) {
  const you = snap.you;
  const side = (c: Color): StageSide => ({ name: snap.players[c].name, look: snap.players[c].look, rank: snap.players[c].rank });
  const there = snap.phase === "versus";
  return (
    <DuelStage
      label={there ? "Opponent found" : "Opponent found…"}
      you={side(you)}
      them={there ? side(other(you)) : null}
      head={stageHead}
      waiting={<span class="dv-st-finding">Opponent found…</span>}
    >
      <p class={`dv-st-line${there ? "" : " dv-st-hold"}`}>You play {SIDE_NAME[you]}</p>
    </DuelStage>
  );
}

// ---------------- The game ----------------

const SIDE_NAME: Record<Color, string> = { w: "White", b: "Black" };

/** The result's headline, from your side. */
export function resultTitle(end: DuelEnd, you: Color): string {
  if (end.result === "aborted") return "Game aborted";
  if (end.result === "1/2-1/2") return "Draw";
  return (end.result === "1-0") === (you === "w") ? "You won" : "You lost";
}

/**
 * Why it ended, in a sentence of its own under the headline, from your side (`them`: the other player's name).
 * ("You won" / "Bob resigned.": two lines, never run together.)
 */
export function resultReason(end: DuelEnd, you: Color, them: string): string {
  const byYou = end.by === you;
  switch (end.reason) {
    case "checkmate":
      return "Checkmate.";
    case "resign":
      return byYou ? "You resigned." : `${them} resigned.`;
    case "timeout":
      return byYou ? "You ran out of time." : `${them} ran out of time.`;
    case "timeout_vs_insufficient":
      return byYou ? `You ran out of time, but ${them} couldn't checkmate.` : `${them} ran out of time, but you couldn't checkmate.`;
    case "stalemate":
      return "Stalemate.";
    case "repetition":
      return "The same position three times.";
    case "fifty_moves":
      return "50 moves each without a capture or a pawn move.";
    case "insufficient_material":
      return "Not enough material to checkmate.";
    case "agreement":
      return "Draw agreed.";
    case "abort":
      return `${byYou ? "You" : them} left before the first moves. No rank change.`;
    case "no_first_move":
      return `${byYou ? "Your" : `${them}'s`} first move didn't come in time. No rank change.`;
    case "no_show":
      return "Your opponent didn't arrive. No rank change.";
  }
}

/** Your rank's change, in a line ("Gold 2 · 45 RP (+18)", "Placement 2/5", "Placed: Gold 4 · 25 RP"). */
function rankLine(snap: DuelSnapshot): string | null {
  if (snap.bot) return "Unranked game";
  if (!snap.end || snap.end.result === "aborted") return null;
  const o = snap.outcome;
  if (!o) return "Updating your rank…";
  if (o.unranked) return "Unranked game";
  const c = o.change;
  if (!c) return null;
  if (c.placed) return `Placed: ${c.after.label}`;
  if (c.points === null) return c.after.label;
  return `${c.after.label} (${c.points >= 0 ? "+" : "−"}${Math.abs(c.points)})`;
}

/** A player's strip: pawn, name, rank, and their clock (always in the same place, readable at a glance). */
function DuelStrip({ p, c, you, ms, running, clockShownNow, away }: { p: DuelSide; c: Color; you: boolean; ms: number; running: boolean; clockShownNow: boolean; away: boolean }) {
  const low = clockShownNow && ms < 20_000;
  return (
    <div class={`dv-strip${you ? " dv-you" : " dv-them"}`} data-side={c}>
      <span class="dv-strip-pawn" aria-hidden="true">
        <Avatar look={p.look ?? undefined} side={c} />
      </span>
      <span class="dv-strip-who">
        <PlayerName name={p.name} uid={p.uid ?? undefined} you={you} bot={p.bot} class="dv-name" />
        <DuelRankPill rank={p.rank} />
        {away && <span class="dv-away">away</span>}
      </span>
      <span class={`dv-clock${running ? " on" : ""}${low ? " low" : ""}`} aria-label={`${you ? "Your" : `${p.name}'s`} clock: ${clockShownNow ? clockShown(ms, { tenths: true }) : "not set"}`}>
        {clockShownNow ? clockShown(ms, { tenths: true }) : "–:––"}
      </span>
    </div>
  );
}

/**
 * Ranked 1 v 1 from PLAY to the result, one component throughout: the search and the versus moment are one stage in
 * the home screen's frame (`frame`; on a computer the side menu stays, as in every queue), so from the search to the
 * versus moment the stage (and your pawn on it) stays put and only the opponent arrives. Then the game's board, which
 * loads once and stays put from the vote to the result.
 */
export function DuelFront({
  queue,
  session,
  frame,
  onCancel,
  onBot,
  onAway,
  onHome,
  onAgain,
}: {
  queue: DuelQueue | null;
  session: DuelSession | null;
  frame: (stage: ComponentChildren) => VNode;
  onCancel: () => void;
  onBot: () => void;
  /** Home (or anywhere else) while the search goes on: the bar on every screen brings you back. */
  onAway: () => void;
  onHome: () => void;
  onAgain: () => void;
}) {
  const src = (session ?? queue)!;
  const first = session?.snapshot();
  const live = first ? !first.end && !first.gone : queue!.state.kind === "searching";
  const now = useSession(src, live, session ? 100 : 500);
  // ("Keep waiting" is the queue's: it holds while you browse and come back. This redraws for it.)
  const [, redraw] = useState(0);
  if (!session) {
    const q = queue!;
    const s = q.state;
    if (s.kind === "refused")
      return frame(
        <div class="dv-stage dv-refused" role="alert">
          <header class="dv-st-head">{stageHead}</header>
          <p>{s.message}</p>
          <button type="button" class="btn btn-primary" onClick={onCancel}>
            Back
          </button>
        </div>,
      );
    const few = !q.keepWaiting && s.kind === "searching" && now >= q.fewAt;
    const keep = () => {
      q.keepWaiting = true;
      redraw((n) => n + 1);
    };
    return frame(searchStage(q, now, few, keep, onCancel, onBot, onAway));
  }
  const snap = session.snapshot();
  if (snap.gone && !snap.end)
    return (
      <div class="screen center dv-gone">
        <h1>1 v 1</h1>
        <p class="muted">{snap.gone}</p>
        <button type="button" class="btn btn-primary" onClick={onHome}>
          Home
        </button>
      </div>
    );
  if (snap.phase === "waiting" || snap.phase === "versus") return frame(versusStage(snap));
  return <DuelBoard session={session} snap={snap} now={now} onHome={onHome} onAgain={onAgain} />;
}

function DuelBoard({ session, snap, now, onHome, onAgain }: { session: DuelSession; snap: DuelSnapshot; now: number; onHome: () => void; onAgain: () => void }) {
  const computer = useMedia(COMPUTER_LAYOUT);
  const you = snap.you;
  const them = other(you);
  const orientation = you === "w" ? "white" : "black";
  const toMove: Color = snap.moves.length % 2 === 0 ? "w" : "b";
  const over = snap.phase === "over";
  const myTurn = snap.phase === "play" && !over && toMove === you;
  const control = snap.control ? duelControl(snap.control) : null;
  const clockLine = control && snap.clock ? controlLabel({ ...control, ...snap.clock }) : null;
  const set = snap.clock !== null;
  const first = snap.firstMoveBy !== null && !over ? Math.max(0, Math.ceil((snap.firstMoveBy - now) / 1000)) : null;
  // Abort before both first moves (nothing recorded); after, resign (a loss). Nothing once it's over.
  const abortable = !over && snap.moves.length < 2;
  const exit: MatchExit | null = over
    ? null
    : abortable
      ? { kind: "leave", note: "The game is called off: no result, and no rank change.", go: () => session.resign() }
      : { kind: "resign", note: "It counts as a loss.", go: () => session.resign() };
  const theirName = snap.players[them].name;
  const people: ChatPeople = {
    nameOf: (id) => (id === "w" || id === "b" ? snap.players[id].name : "?"),
    isYou: (id) => id === you,
    who: (id) => (id === "w" || id === "b" ? { uid: snap.players[id].uid ?? undefined, isBot: !!snap.players[id].bot, team: null } : undefined),
  };
  const status = over
    ? null
    : snap.phase === "vote"
      ? "Drag your pawn: Bullet, Blitz or Rapid"
      : snap.phase === "overlay"
        ? null
        : first !== null
          ? myTurn
            ? `Your first move: ${first} s`
            : `${theirName}'s first move: ${first} s`
          : myTurn
            ? "Your move"
            : `${theirName} is thinking`;
  // Your move shown at once on the board; a move the board can't make (not your turn) is never sent.
  const board = (
    <Board fen={snap.fen} orientation={orientation} lastMove={snap.lastMove} interactive={myTurn} onMove={(m) => session.move(m)}>
      {snap.phase === "vote" && snap.voteAt !== null && snap.voteEndsAt !== null && (
        <DuelVote
          you={you}
          picks={snap.picks}
          looks={{ w: snap.players.w.look, b: snap.players.b.look }}
          voteAt={snap.voteAt}
          voteEndsAt={snap.voteEndsAt}
          now={now}
          onPick={(z) => session.pick(z)}
        />
      )}
      {snap.phase === "overlay" && clockLine && <DuelOverlay text={`Timer: ${clockLine}`} />}
    </Board>
  );
  return (
    <div class={`screen game duel-screen${over ? " over" : ""}`}>
      <div class="hud-row">
        <div class="hud dv-title">
          <h1>1 v 1</h1>
          <span class="dv-control">{clockLine ?? "Classic chess"}</span>
        </div>
        <MatchMenu exit={exit} />
      </div>
      <div class="board-area">
        <DuelStrip p={snap.players[them]} c={them} you={false} ms={clockAt(snap, them, now)} running={snap.running && toMove === them && !over} clockShownNow={set} away={!snap.bot && !snap.connected[them] && !over} />
        <div class="board-row">{board}</div>
        <DuelStrip p={snap.players[you]} c={you} you ms={clockAt(snap, you, now)} running={snap.running && toMove === you && !over} clockShownNow={set} away={false} />
      </div>
      <div class="play-footer dv-panel">
        {status && (
          <p class={`dv-status${myTurn ? " mine" : ""}`} role="status">
            {status}
          </p>
        )}
        {!over && snap.drawOffer === them && (
          <div class="dv-draw" role="alert">
            <span>{theirName} offers a draw</span>
            <button type="button" class="btn btn-primary dv-small" onClick={() => session.draw()}>
              Accept
            </button>
            <button type="button" class="btn btn-secondary dv-small" onClick={() => session.drawNo()}>
              Decline
            </button>
          </div>
        )}
        {!over && snap.drawOffer === you && <p class="muted dv-draw-sent">Draw offered</p>}
        {!over && snap.phase === "play" && snap.drawOffer === null && (
          <button type="button" class="btn btn-secondary dv-small dv-offer" disabled={!snap.canOffer[you]} onClick={() => session.draw()}>
            Offer a draw
          </button>
        )}
        {over && snap.end && <DuelResult snap={snap} onHome={onHome} onAgain={onAgain} />}
      </div>
      {session.chat && session.chat.enabled && (
        <div class="lchat dv-chat">
          <ChatPanel people={people} chat={session.chat} variant={computer ? "side" : "full"} />
        </div>
      )}
    </div>
  );
}

/** The result card: who won and why, your rank's change, your coins, and what's next. */
function DuelResult({ snap, onHome, onAgain }: { snap: DuelSnapshot; onHome: () => void; onAgain: () => void }) {
  const end = snap.end!;
  const you = snap.you;
  const line = rankLine(snap);
  const coins = snap.outcome?.coins ?? 0;
  const title = resultTitle(end, you);
  return (
    <div class={`dv-result${title === "You won" ? " won" : title === "You lost" ? " lost" : ""}`} role="status">
      <strong class="dv-result-title">{title}</strong>
      <p class="dv-result-why">{resultReason(end, you, snap.players[other(you)].name)}</p>
      {(line || coins > 0) && (
        <span class="dv-result-line">
          {line && <span class="dv-result-rank">{line}</span>}
          {line && coins > 0 && " · "}
          {coins > 0 && <span class="dv-result-coins">+{coins} coins</span>}
        </span>
      )}
      <div class="dv-result-actions">
        <button type="button" class="btn btn-primary" onClick={onAgain}>
          {snap.bot ? "Find a person" : "Play again"}
        </button>
        <button type="button" class="btn btn-secondary" onClick={onHome}>
          Home
        </button>
      </div>
    </div>
  );
}
