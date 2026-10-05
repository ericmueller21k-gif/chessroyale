import { useEffect, useMemo, useState } from "preact/hooks";
import { PREGAME_VOTES, VOTE_ZONE_FILES, allVoteMoves, equippedLook, voteMoves, voteOptionOf } from "@chessroyale/core";
import { account } from "../account.ts";
import { PawnHat } from "../components/Cosmetics.tsx";
import { Board } from "../components/Board.tsx";
import { TimerBar, useFrameNow } from "../components/Countdown.tsx";
import { CrowdGhosts, type GhostPick } from "../components/CrowdGhosts.tsx";
import { myTeam, type GameView, type VoteView } from "../game.ts";
import { play } from "../sound.ts";
import { useCrowdAnimations } from "./Crowd.tsx";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

/** Where a zone sits on the board (percent), from the given side: files b-c, d-e or f-g, ranks 4-5. */
function zoneBox(option: number, orientation: "white" | "black") {
  const files = VOTE_ZONE_FILES[option]!;
  const cols = files.map((f) => f.charCodeAt(0) - 97).map((c) => (orientation === "white" ? c : 7 - c));
  return { left: Math.min(...cols) * 12.5, top: 37.5, width: 25, height: 25 };
}

/** Your pawn's hat, on the square it was pushed to. */
function VoteHat({ square, orientation, hat }: { square: string; orientation: "white" | "black"; hat: string }) {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const col = orientation === "white" ? f : 7 - f;
  const row = orientation === "white" ? 7 - r : r;
  return (
    <span class="vote-hat" style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` }}>
      <PawnHat hat={hat} />
    </span>
  );
}

/** A stable pick of which of the zone's two pawns a voter pushed (for the ghosts). */
const pawnFor = (playerId: string, side: "w" | "b", option: number) => {
  const h = [...playerId].reduce((a, c) => (Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);
  return voteMoves(side, option)[h % 2]!;
};

/**
 * A pre-game vote. Three zones in the middle of the board; everyone pushes a
 * pawn two squares into the zone they want (White pawns land on rank 4, Black
 * on rank 5), or taps a card. Every vote flies in as a ghost pawn, with a live
 * count per zone. When time's up the winning zone lights up.
 */
export function VoteScreen({ match, vote }: { match: GameView; vote: VoteView }) {
  const def = PREGAME_VOTES[vote.index]!;
  const now = useFrameNow();
  const animate = useCrowdAnimations();
  const side = myTeam(match) ?? "w";
  const orientation = side === "w" ? "white" : "black";
  const fen = `${START} ${side} KQkq - 0 1`;
  const mine = vote.votes.find((v) => match.isYou(v.playerId)) ?? null;
  const [myMove, setMyMove] = useState<string | null>(null);
  const counting = vote.result === null;
  const open = counting && now < vote.until;
  const visible = vote.votes.filter((v) => v.at <= now || match.isYou(v.playerId));
  const counts = def.options.map((_, i) => visible.filter((v) => v.option === i).length);
  const rank = useMemo(() => new Map(match.standings().map((s, i) => [s.id, i])), [vote.key]);
  const ghosts: GhostPick[] = visible.map((v) => ({
    id: v.playerId,
    name: match.isYou(v.playerId) ? "You" : match.nameOf(v.playerId),
    move: match.isYou(v.playerId) && myMove ? myMove : pawnFor(v.playerId, v.side, v.option),
    you: match.isYou(v.playerId),
    rank: rank.get(v.playerId) ?? 999,
  }));
  const winner = vote.result === null ? null : def.options[vote.result]!;
  useEffect(() => {
    if (vote.result !== null) play("select");
  }, [vote.result]);
  const cast = (option: number, move?: string) => {
    if (!open || mine) return;
    setMyMove(move ?? voteMoves(side, option)[0]!);
    match.castVote(option);
  };
  // Your hat from the shop, on the pawn you pushed.
  const hat = equippedLook(account().profile?.shop, "hat").hat ?? "none";
  const nextLabel = vote.index + 1 < vote.count ? PREGAME_VOTES[vote.index + 1]!.title : "The game begins";
  const nextIn = vote.nextAt ? Math.max(0, Math.ceil((vote.nextAt - now) / 1000)) : null;

  return (
    <div class="screen game vote-screen">
      <div class="vote-head">
        <span class="vote-step">
          Vote {vote.index + 1} of {vote.count}
        </span>
        <h1>{def.title}</h1>
        <p class="muted small">
          {winner
            ? `${nextLabel}${nextIn ? ` in ${nextIn}…` : "…"}`
            : mine
              ? "Vote in. Watch the crowd decide."
              : "Push a pawn two squares into a zone, or tap a card."}
        </p>
      </div>
      <div class="board-area">
        <div class="board-row vote-board-row">
          <Board
            fen={fen}
            orientation={orientation}
            interactive={open && !mine}
            moves={allVoteMoves(side)}
            onMove={(m) => {
              const option = voteOptionOf(m);
              if (option !== null) cast(option, m);
            }}
          >
            {counting && <TimerBar startsAt={vote.startsAt} deadline={vote.until} total={Math.max(1, vote.until - vote.startsAt)} />}
            <div class="vote-zones" aria-hidden="true">
              {def.options.map((o, i) => {
                const box = zoneBox(i, orientation);
                const state = vote.result === null ? "" : vote.result === i ? " win" : " lose";
                return (
                  <div
                    key={o.id}
                    class={`vote-zone${state}${mine?.option === i ? " mine" : ""}`}
                    style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
                  >
                    <span class="vote-zone-icon">{o.icon}</span>
                    <span class="vote-zone-count">{counts[i]}</span>
                  </div>
                );
              })}
            </div>
            <CrowdGhosts fen={fen} picks={ghosts} orientation={orientation} animate={animate} faint tags={false} />
            {mine && myMove && hat !== "none" && <VoteHat square={myMove.slice(2, 4)} orientation={orientation} hat={hat} />}
            {winner && (
              <div class="vote-banner" role="status">
                <span class="vote-banner-icon">{winner.icon}</span>
                <strong>{winner.label}</strong>
                <span>{winner.blurb}</span>
              </div>
            )}
          </Board>
        </div>
      </div>
      <div class={`vote-cards${orientation === "black" ? " flipped" : ""}`} role="radiogroup" aria-label={def.title}>
        {def.options.map((o, i) => {
          const total = Math.max(1, counts.reduce((s, x) => s + x, 0));
          const state = vote.result === null ? "" : vote.result === i ? " win" : " lose";
          return (
            <button
              type="button"
              role="radio"
              aria-checked={mine?.option === i}
              key={o.id}
              class={`vote-card${mine?.option === i ? " on" : ""}${state}`}
              disabled={!open || !!mine}
              onClick={() => cast(i)}
            >
              <span class="vote-card-icon" aria-hidden="true">
                {o.icon}
              </span>
              <strong>{o.label}</strong>
              <span class="vote-card-blurb">{o.blurb}</span>
              <span class="vote-card-bar">
                <i style={{ width: `${(100 * counts[i]!) / total}%` }} />
              </span>
              <span class="vote-card-count">{counts[i]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
