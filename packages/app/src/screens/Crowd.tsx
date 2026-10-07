import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { applyMove, inCheck, pieceAt, sideToMove, toSan } from "@chessroyale/chess";
import { blunderWords, capitalised, crowdMoveCues, type KingCue } from "../godKing.ts";
import { brilliance, equippedLook, type Augment } from "@chessroyale/core";
import { Board } from "../components/Board.tsx";
import { TimerBar, useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { ChatSection, UnderBoard } from "../components/QuickChat.tsx";
import { SquareRing } from "../components/ShadeMoves.tsx";
import { CrowdGhosts, type GhostPick } from "../components/CrowdGhosts.tsx";
import { KING_CUT_MS, KingSummon, kingSquare } from "../components/GodKing.tsx";
import { LastStand, clearSquare, lastStandBoard } from "../components/LastStand.tsx";
import { LAST_STAND, LAST_STAND_MS } from "@chessroyale/chess";
import { BossDock, Dots } from "../components/BossDock.tsx";
import { BossHeading } from "./Play.tsx";
import { crowdAnimations, crowdTrail, onPrefsChange } from "../prefs.ts";
import { elimination, finalName, myTeam, type BoardView, type GameView, type GroupReveal, type Standing } from "../game.ts";
import { GavelPiece } from "../components/Gavel.tsx";
import { Avatar } from "../components/Items.tsx";
import { PlayerName } from "../components/PlayerName.tsx";
import { Breakdown } from "../components/Breakdown.tsx";
import { account } from "../account.ts";
import { seenKey } from "../hooks.ts";
import { play } from "../sound.ts";
import { Hud } from "./Hud.tsx";
import { ordinal } from "./StageBreak.tsx";

const sideName = (s: "w" | "b") => (s === "w" ? "White" : "Black");

/** The device's Crowd animation setting, kept in sync if it changes. */
export function useCrowdAnimations(): boolean {
  const [on, setOn] = useState(crowdAnimations());
  useEffect(() => onPrefsChange(() => setOn(crowdAnimations())), []);
  return on;
}

/** The device's motion trail setting (Crowd, with animations on), kept in sync if it changes. */
export function useCrowdTrail(): boolean {
  const [on, setOn] = useState(crowdTrail());
  useEffect(() => onPrefsChange(() => setOn(crowdTrail())), []);
  return on;
}

/** Picks as ghost pieces with names, ranked by the leaderboard. */
export function ghostPicks(match: GameView, picks: readonly { playerId: string; move: string | null }[]): GhostPick[] {
  const rank = new Map(match.standings().map((s, i) => [s.id, i]));
  return picks.flatMap((p) =>
    p.move ? [{ id: p.playerId, name: match.nameOf(p.playerId), move: p.move, you: match.isYou(p.playerId), rank: rank.get(p.playerId) ?? 999 }] : [],
  );
}

/** The live picks visible right now (each from its moment), as ghosts. */
/** Picks already on screen this turn (by position), so the reveal doesn't animate them a second time. */
const seenLive = { fen: "", ids: new Set<string>() };

export function LiveGhosts({ match, fen, orientation }: { match: GameView; fen: string; orientation: "white" | "black" }) {
  const animate = useCrowdAnimations();
  const trail = useCrowdTrail();
  const now = useFrameNow();
  // Picks made before you could see them catch up in a quick wave from this moment; later ones arrive live.
  const [since] = useState(Date.now());
  const live = match.livePicks();
  if (!live) return null;
  const sorted = [...live].sort((a, b) => a.at - b.at);
  let k = 0;
  const visible = sorted.filter((p) => (p.at <= since ? since + 35 * k++ : p.at) <= now);
  if (seenLive.fen !== fen) {
    seenLive.fen = fen;
    seenLive.ids = new Set();
  }
  for (const p of visible) seenLive.ids.add(p.playerId);
  return <CrowdGhosts fen={fen} picks={ghostPicks(match, visible)} orientation={orientation} animate={animate} trail={trail} faint />;
}
const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);

/** Crowd 50 v 50: the other team is choosing (or their votes are being counted). You watch. */
export function WatchScreen({
  match,
  board,
  startsAt,
  deadline,
  counting = false,
}: {
  match: GameView;
  board: BoardView;
  startsAt: number;
  deadline: number;
  counting?: boolean;
}) {
  const side = sideToMove(board.fen);
  const team = myTeam(match) ?? (side === "w" ? "b" : "w");
  useEffect(() => {
    match.seen.set(seenKey(board), board.ply);
  }, [board]);
  const choosing = match.standings().filter((s) => !s.out && s.team === side);
  const done = choosing.filter((s) => match.done.has(s.id)).length;
  return (
    <div class="screen game crowd">
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          <strong>{sideName(side)} team</strong> is choosing · you're on <strong>{sideName(team)}</strong>
        </div>
        <div class="board-row">
          <EvalBar fen={board.fen} orientation={team} evaluate={(f) => match.evaluate(f)} />
          <Board fen={board.fen} orientation={team === "w" ? "white" : "black"} lastMove={board.lastMove}>
            {!counting && deadline > 0 && <TimerBar startsAt={startsAt} deadline={deadline} total={Math.max(1, deadline - startsAt)} />}
            <LiveGhosts match={match} fen={board.fen} orientation={team === "w" ? "white" : "black"} />
          </Board>
        </div>
      </div>
      <div class="play-footer">
        <div class="waiting-banner" role="status">
          <span class="waiting-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>{counting ? "Counting the votes…" : `${sideName(side)} is voting.`}</strong>{" "}
            {counting ? "" : "Your team moves next."}
          </span>
          {choosing.length > 0 && (
            <span class="waiting-count">
              {done}/{choosing.length}
            </span>
          )}
        </div>
      </div>
      <UnderBoard match={match} />
    </div>
  );
}

/**
 * Crowd's reveal. Animations on: every pick comes in as its own ghost piece in
 * quick succession (silently), each move tagged with its top three names and
 * "+N". Animations off: the tags and one still ghost per move at once. Either
 * way the vote bars count up, the winner blinks three times with three tones,
 * and then only the chosen piece moves.
 */
export function CrowdReveal({ match, mine, board, until }: { match: GameView; mine: GroupReveal; board: BoardView; until: number }) {
  const [start] = useState(Date.now());
  const now = useFrameNow();
  const animate = useCrowdAnimations();
  const trail = useCrowdTrail();
  // Boss battle: the God King's Last Stand on this move (it plays out after the move lands, in its own extra time).
  const stand = match.boss && mine.lastStand ? mine.lastStand : null;
  const total = Math.max(2500, until - start - (stand ? LAST_STAND_MS : 0));
  const picks = mine.result.players;
  // Every pick, in a mixed order (not grouped by move), for the rapid succession of ghosts.
  const ghosts = useMemo(() => {
    const h = (s: string) => [...s].reduce((a, c) => (Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);
    return ghostPicks(match, picks).sort((a, b) => h(a.id) - h(b.id));
  }, [mine]);
  // Picks you already watched come in live stay where they are; only the rest animate in, one every `step` ms.
  const seen = useMemo(() => {
    const ids = seenLive.fen === mine.fenBefore ? seenLive.ids : new Set<string>();
    return ghosts.filter((g) => ids.has(g.id)).length;
  }, [mine]);
  const ordered = useMemo(() => {
    const ids = seenLive.fen === mine.fenBefore ? seenLive.ids : new Set<string>();
    return [...ghosts.filter((g) => ids.has(g.id)), ...ghosts.filter((g) => !ids.has(g.id))];
  }, [ghosts]);
  const unseen = Math.max(0, ghosts.length - seen);
  const step = Math.max(20, Math.min(60, (total - 2200) / Math.max(1, unseen)));
  const t = now - start;
  const shown = animate ? Math.min(ghosts.length, seen + Math.floor(t / step) + (unseen ? 1 : 0)) : ghosts.length;
  const countEnd = animate ? (unseen ? unseen * step + 350 : 150) : seen === ghosts.length ? 150 : 600;
  const grow = ghosts.length ? (animate ? shown / ghosts.length : Math.min(1, t / countEnd)) : 1;
  // A crowd of one (a solo boss raid): your pick is the move and it's already on the board, so it stays there; no
  // ghost, no count, no second move of the piece.
  const alone = !mine.king && picks.length === 1 && match.isYou(picks[0]!.playerId) && picks[0]!.move === mine.result.playedMove;
  const landAt = alone ? 0 : countEnd + 250;
  // The God King playing the move: his summoning, his cut-in banner and his bolt come first, then the piece moves.
  const playAt = alone ? 0 : landAt + (mine.king ? 2100 + KING_CUT_MS : 750);
  const landed = t >= landAt;
  const played = t >= playAt;
  useEffect(() => {
    match.seen.set(seenKey(board), board.ply + (stand ? 0 : 1));
  }, [board]);

  const fen = mine.fenBefore;
  // The Last Stand: the move lands, he crashes onto the square, the piece slides back, he falls (lastStandBoard).
  const ts = t - playAt;
  const standMove = stand ? mine.result.playedMove : null;
  const kingMoved = !!standMove && pieceAt(fen, standMove.slice(0, 2))?.type === "k";
  const onBoard = useMemo(() => {
    const move = mine.result.playedMove;
    if (!played) return { fen, lastMove: board.lastMove };
    const after = applyMove(fen, move);
    if (!stand) return { fen: after, lastMove: move };
    const at = lastStandBoard(ts);
    const to = move.slice(2, 4);
    // (A king is never taken off the board: it just slides back.)
    if (at === "after" || (kingMoved && at === "pushed")) return { fen: after, lastMove: move };
    if (at === "pushed") return { fen: clearSquare(after, to), lastMove: move };
    if (at === "back" && !kingMoved) return { fen: clearSquare(fen, to), lastMove: board.lastMove };
    return { fen, lastMove: board.lastMove };
  }, [played, stand && lastStandBoard(ts)]);
  // The God King: summoned on your king's square, then he plays the move, and leaves as the round ends.
  const godKing = useMemo(() => {
    if (!mine.king) return null;
    const crowd = sideToMove(fen);
    const after = applyMove(fen, mine.result.playedMove);
    const before = kingSquare(fen, crowd);
    const later = kingSquare(after, crowd);
    if (!before || !later) return null;
    const orient = (myTeam(match) ?? crowd) === "w" ? ("white" as const) : ("black" as const);
    const exitAt = Math.max(start + playAt + 2900, until - 900);
    const from = mine.result.playedMove.slice(0, 2);
    const piece = pieceAt(fen, from)?.type;
    return {
      side: crowd,
      orientation: orient,
      kingBefore: before,
      kingAfter: later,
      target: from === before ? null : from,
      mode: "move" as const,
      startAt: start + landAt,
      moveAt: start + playAt,
      exitAt,
      san: toSan(fen, mine.result.playedMove),
      piece,
    };
  }, [mine, landAt, playAt]);
  // The God King's word on the crowd's move, once it lands (none on his Last Stand: it speaks for itself).
  const kingCues = useMemo(() => {
    if (!match.boss || stand) return [];
    if (mine.king) return [{ cue: "kingPlays" as KingCue, key: `kingplays-${fen}` }];
    const played = mine.result.playedMove;
    return crowdMoveCues(fen, played, picks.find((p) => p.move === played)?.loss ?? null);
  }, [mine]);
  const team = myTeam(match);
  const orientation = (team ?? sideToMove(fen)) === "w" ? "white" : "black";
  // The Last Stand's warning: the eval bar plunges to the crowd's chances after the blunder (White's side of it),
  // and goes back as the piece slides back. In the dock, what it loses in plain words.
  const crowdSide = sideToMove(fen);
  const plunge = stand && played && stand.after !== undefined && ts >= LAST_STAND.badgeAt && ts < LAST_STAND.slideAt ? (crowdSide === "w" ? stand.after : 1 - stand.after) : null;
  const verdict = useMemo(() => (stand ? capitalised(blunderWords(fen, stand)) : ""), [mine]);
  // (On the narrowest phones, "Your chances 52% → 9%" is shortened to "Chances 52% → 9%" to fit the dock.)
  const shortVerdict = verdict.replace(/^Your chances/, "Chances");
  const voters = picks.filter((p) => p.move).length;
  const rows = useMemo(() => {
    const byMove = new Map<string, { move: string; votes: number; you: boolean }>();
    for (const p of picks) {
      if (!p.move) continue;
      const r = byMove.get(p.move) ?? { move: p.move, votes: 0, you: false };
      r.votes++;
      r.you ||= match.isYou(p.playerId);
      byMove.set(p.move, r);
    }
    return [...byMove.values()].sort((a, b) => b.votes - a.votes || (a.move === mine.result.playedMove ? -1 : 1)).slice(0, 5);
  }, [mine]);
  const top = rows[0]?.votes ?? 1;
  const me = picks.find((p) => match.isYou(p.playerId));
  // A move that separated the field (never one found with a power-up, which shows the engine's moves).
  const bril = useMemo(() => brilliance(picks), [mine]);
  const youBrilliant = !!me && !!bril?.players.includes(me.playerId);
  const youHelped = !!me && !!bril && !youBrilliant && bril.moves.includes(me.move ?? "");
  const yours = me?.move ?? null;
  const yourRow = yours && !rows.some((r) => r.move === yours) ? { move: yours, votes: picks.filter((p) => p.move === yours).length, you: true } : null;

  // The ghosts come in silently; the winner gets three tones as it blinks.
  // (Not when you're the whole crowd: your move was simply played.)
  useEffect(() => {
    if (landed && !alone) play("select");
  }, [landed]);

  return (
    <div class="screen game crowd" onClick={() => played && !stand && match.skipReveal()}>
      <Hud match={match} />
      <div class={`board-area${stand && ts >= LAST_STAND.crashAt && ts < LAST_STAND.crashAt + 450 ? " ls-shake" : ""}`}>
        <div class="opening-name">
          {match.boss ? (
            <BossHeading side={sideToMove(fen)} note={mine.king ? "the God King's move" : stand && played ? (ts < LAST_STAND.freezeAt ? "a blunder" : "the God King's Last Stand") : `${voters} ${voters === 1 ? "vote" : "votes"}`} />
          ) : (
            <>
              <strong>{sideName(sideToMove(fen))}</strong> · {voters} {voters === 1 ? "vote" : "votes"}
            </>
          )}
        </div>
        {/* Same row as the play screen (eval bar + board), so the board never moves or resizes between phases. */}
        <div class="board-row">
        <EvalBar
          fen={played && !stand ? applyMove(fen, mine.result.playedMove) : fen}
          orientation={orientation === "white" ? "w" : "b"}
          evaluate={(f) => match.evaluate(f)}
          override={plunge}
        />
        <Board fen={onBoard.fen} orientation={orientation} lastMove={onBoard.lastMove} marks={stand && played && ts < LAST_STAND.crashAt ? { [mine.result.playedMove.slice(2, 4)]: "ls-blunder" } : undefined}>
          {!played && (
            <CrowdGhosts
              fen={fen}
              picks={ordered.slice(0, shown)}
              orientation={orientation}
              animate={animate}
              trail={trail}
              instant={new Set(ordered.slice(0, seen).map((g) => g.id))}
              chosen={landed ? mine.result.playedMove : null}
            />
          )}
          {played && !alone && !stand && <SquareRing square={mine.result.playedMove.slice(2, 4)} orientation={orientation} />}
          {godKing && t >= godKing.startAt - start && <KingSummon {...godKing} />}
          {stand && standMove && played && <LastStand side={sideToMove(fen)} orientation={orientation} fen={fen} move={standMove} startAt={start + playAt} />}
        </Board>
        </div>
      </div>
      {match.boss ? (
        <BossDock
          match={match}
          side={sideToMove(fen)}
          cues={mine.king ? kingCues : landed ? kingCues : []}
          away={(!!godKing && now >= godKing.startAt && now < godKing.exitAt + 900) || (!!stand && ts >= LAST_STAND.leapAt + 450 && ts < LAST_STAND.fadeAt)}
          leaping={!!stand && ts >= LAST_STAND.leapAt && ts < LAST_STAND.leapAt + 450}
          charges={stand && ts < LAST_STAND.leapAt ? (match.boss?.lastStand?.charges ?? 0) : undefined}
          fallen={stand ? ts >= LAST_STAND.fadeAt : undefined}
          status={
            stand && played ? (
              ts < LAST_STAND.slideAt ? (
                // The warning: the blunder, and what it loses, in plain words (no numbers but the chances).
                <>
                  <span class="dock-line">
                    <strong class="bad blunder-mark">?? Blunder: {toSan(fen, stand.move)}</strong>
                  </span>
                  <span class="dock-line blunder-words">
                    <span class="wide-only">{verdict}</span>
                    <span class="narrow-only">{shortVerdict}</span>
                  </span>
                </>
              ) : (
                <>
                  <span class="dock-line">
                    <strong class="gold">{ts < LAST_STAND.fadeAt ? "👑 He takes the blow!" : "👑 The God King has fallen"}</strong>
                  </span>
                  <span class="dock-line muted">
                    {ts < LAST_STAND.fadeAt
                      ? `${toSan(fen, stand.move)} is taken back`
                      : (match.boss?.lastStand?.charges ?? 0) * match.settings.lastStandPowerUps > 0
                        ? `He leaves you ⚡×${(match.boss?.lastStand?.charges ?? 0) * match.settings.lastStandPowerUps}`
                        : alone
                          ? "Pick again"
                          : "The crowd picks again"}
                  </span>
                </>
              )
            ) : (
            <>
              <span class="dock-line">
                {!landed ? (
                  mine.king ? (
                    <strong>👑 The God King answers the call…</strong>
                  ) : (
                    <>
                      <Dots /> <strong>Counting the votes…</strong>
                    </>
                  )
                ) : mine.king ? (
                  <>
                    <strong class="gold">👑 God King plays {toSan(fen, mine.result.playedMove)}</strong>
                  </>
                ) : (
                  <>
                    <strong>Crowd plays {toSan(fen, mine.result.playedMove)}</strong>{" "}
                    <span class="muted">
                      · {picks.filter((p) => p.move === mine.result.playedMove).length}/{voters}
                    </span>
                  </>
                )}
              </span>
              <span class="dock-line muted">
                {!me
                  ? `You watched · best ${toSan(fen, mine.bestMove)}`
                  : !me.move
                    ? mine.king !== undefined && match.kingCalled
                      ? picks.length > 1
                        ? `${mine.kingCalls} of ${picks.length} called him · no score`
                        : "You called him · no score"
                      : "No move from you."
                    : `You: ${toSan(fen, me.move)}${me.usedPowerUp ? " ⚡" : ""} (${fmt(me.roundScore)}) · best ${toSan(fen, mine.bestMove)}`}
              </span>
            </>
            )
          }
        />
      ) : (
      <div class="poll" role="status">
        {rows.map((r) => {
          const win = landed && r.move === mine.result.playedMove;
          return (
            <div key={r.move} class={`poll-row${win ? " win" : ""}${landed && !win ? " lose" : ""}${r.you ? " you" : ""}`}>
              <span class="poll-move">{toSan(fen, r.move)}</span>
              <span class="poll-bar">
                <i style={{ width: `${(100 * r.votes * grow) / top}%` }} />
              </span>
              <span class="poll-votes">{Math.round(r.votes * grow)}</span>
              {r.you && <span class="poll-you">you</span>}
            </div>
          );
        })}
        {yourRow && (
          <div class="poll-row you">
            <span class="poll-move">{toSan(fen, yourRow.move)}</span>
            <span class="poll-bar">
              <i style={{ width: `${(100 * yourRow.votes * grow) / top}%` }} />
            </span>
            <span class="poll-votes">{Math.round(yourRow.votes * grow)}</span>
            <span class="poll-you">you</span>
          </div>
        )}
        {mine.king !== undefined && (mine.kingCalls ?? 0) > 0 && (
          <div class={`poll-row king-row${landed && mine.king ? " win" : ""}`}>
            <span class="poll-move">👑 King</span>
            <span class="poll-bar">
              <i style={{ width: `${Math.min(100, (100 * (mine.kingCalls ?? 0) * grow) / Math.max(1, voters))}%` }} />
            </span>
            <span class="poll-votes">{Math.round((mine.kingCalls ?? 0) * grow)}</span>
          </div>
        )}
        {landed && bril && (
          <div class={`brilliant-line${youBrilliant ? " you" : ""}`} role="status">
            <span class="brilliant-mark" aria-hidden="true">‼</span>
            <span>
              <strong>{youBrilliant ? "Brilliant! " : "Brilliant move: "}</strong>
              {bril.moves.map((m) => toSan(fen, m)).join(" / ")} · only {bril.found} of {bril.total} found it
              {youHelped ? " (with a power-up: it doesn't count)" : ""}
            </span>
          </div>
        )}
        <div class="poll-result">
          {me ? (
            <>
              <span class={`round-score ${me.roundScore >= 0 ? "good" : "bad"}`}>{fmt(me.roundScore)}</span>
              <span class="muted small">
                {me.move ? `you picked ${toSan(fen, me.move)}` : "no move from you"} · best was {toSan(fen, mine.bestMove)}
              </span>
            </>
          ) : (
            <span class="muted small">Your team watched this one · best was {toSan(fen, mine.bestMove)}</span>
          )}
        </div>
      </div>
      )}
      <UnderBoard match={match} />
    </div>
  );
}

const AUGMENTS: { choice: Augment; title: string; step: number }[] = [
  { choice: "more", title: "More time", step: 1 },
  { choice: "same", title: "Same", step: 0 },
  { choice: "less", title: "Less time", step: -1 },
];

const BOT_HATS = ["none", "none", "none", "party", "crown", "wizard", "top", "viking"];
const hash = (s: string) => [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
/** The judge strikes this long after the screen opens. */
const GAVEL_AT = 1500;
/** The cut screen names at most this many of the players who went out (then "+N"). */
const CUT_NAMES_MAX = 12;

/**
 * Who went out, struck through (you first): as many names as fit the list's rows, never a row cut in half, and "+N"
 * for the rest. Measured before the paint, so a narrow phone or long names just show fewer names.
 */
function CutNames({ knockedOut }: { knockedOut: Standing[] }) {
  const [shown, setShown] = useState(CUT_NAMES_MAX);
  const [width, setWidth] = useState(() => innerWidth);
  const box = useRef<HTMLDivElement>(null);
  const names = useMemo(() => [...knockedOut].sort((a, b) => Number(!!b.isYou) - Number(!!a.isYou)), [knockedOut]);
  const more = names.length - Math.min(shown, names.length);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && shown > 0 && el.scrollHeight > el.clientHeight + 1) setShown(shown - 1);
  }, [shown, names, width]);
  useEffect(() => {
    // A new width (a turned phone, a resized window): fit the names again.
    const again = () => {
      setWidth(innerWidth);
      setShown(CUT_NAMES_MAX);
    };
    addEventListener("resize", again);
    return () => removeEventListener("resize", again);
  }, []);
  return (
    <div class="cut-out" ref={box} aria-label="Knocked out">
      {names.slice(0, shown).map((k) => (
        <PlayerName key={k.id} class={`cut-name${k.isYou ? " you" : ""}`} name={k.name} uid={k.uid} you={k.isYou} bot={k.isBot}>
          {k.isYou ? "You" : k.name}
        </PlayerName>
      ))}
      {more > 0 && <span class="cut-name more">+{more}</span>}
    </div>
  );
}

/**
 * Crowd's cut, as a judgement: every player is a pawn in a grid (White's team on the left, Black's on the
 * right, everyone in a fixed seat; bots in random hats, you in yours), the judge, a gavel piece, swings down,
 * and the players cut fade out. Then: who went out, whether you're through, and if not, why (the breakdown).
 */
export function CrowdCut({
  match,
  stage,
  standings,
  knockedOut,
  youOut,
  until,
  augments,
  moveClock,
}: {
  match: GameView;
  stage: number;
  standings: Standing[];
  knockedOut: Standing[];
  youOut: boolean;
  until?: number;
  augments?: boolean;
  moveClock?: number;
}) {
  const now = useFrameNow();
  const [start] = useState(Date.now());
  const [why, setWhy] = useState(false);
  const t = now - start;
  const slammed = t >= GAVEL_AT;
  useEffect(() => {
    const timer = setTimeout(() => play("gavel"), GAVEL_AT - 120);
    return () => clearTimeout(timer);
  }, []);
  const left = until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  const aliveAfter = standings.filter((s) => !s.out).length - knockedOut.length;
  // The last cut: what comes next (team final, boss battle, duel, or the final four).
  const final = stage >= match.settings.knockoutsPerStage.length - 1;
  const next = finalName(match.settings);
  const s = match.settings;
  const clock = moveClock ?? s.moveClockSeconds;
  const at = (step: number) => Math.max(s.clockRange[0], Math.min(s.clockRange[1], clock + step * s.clockStepSeconds));
  const cutNow = new Set(knockedOut.map((k) => k.id));
  const myHat = equippedLook(account().profile?.shop, "hat").hat ?? "none";
  const myLook = account().profile?.locker?.look;
  // Fixed seats: by team (White left, Black right), then by id.
  const seats = useMemo(() => {
    const byId = (a: Standing, b: Standing) => (a.id < b.id ? -1 : 1);
    const teams = standings.some((p) => p.team);
    if (!teams) return [...standings].sort(byId);
    const w = standings.filter((p) => p.team !== "b").sort(byId);
    const b = standings.filter((p) => p.team === "b").sort(byId);
    // Rows of ten: five of White's, then five of Black's.
    const out: Standing[] = [];
    for (let r = 0; r < Math.ceil(Math.max(w.length, b.length) / 5); r++) out.push(...w.slice(r * 5, r * 5 + 5), ...b.slice(r * 5, r * 5 + 5));
    return out;
  }, [stage]);
  // Your score and the line (the last player through) when you go out, for the breakdown.
  const me = standings.find((p) => p.isYou);
  // Online, once you're out you stay on this screen and see the later cuts too.
  const outBefore = !youOut && !!me?.out;
  const through = standings.filter((p) => !p.out && !cutNow.has(p.id));
  const line = through.length ? Math.min(...through.map((p) => p.points)) : 0;
  useEffect(() => {
    if (youOut && me) elimination.current = { stage, you: me.points, line, placement: match.placement, out: knockedOut.length, left: aliveAfter };
  }, [stage]);
  return (
    <div class={`screen crowd-cut judge${slammed ? " slammed" : ""}`} onClick={() => !match.serverPaced && !augments && !why && match.continueFromBreak()}>
      <div class="cut-head">
        <span class="cut-badge">CUT</span>
        <span>
          {knockedOut.length} out · {aliveAfter} left{final ? ` · the ${next.toLowerCase()} is next` : ""}
        </span>
      </div>
      <div class="judge-stage">
        <GavelPiece slam={slammed} />
      </div>
      <div class="pawn-grid" role="img" aria-label={`${aliveAfter} players through, ${knockedOut.length} cut`}>
        {seats.map((p) => {
          const side = p.team === "b" ? "b" : "w";
          const hat = p.isYou ? myHat : p.isBot ? BOT_HATS[hash(p.id) % BOT_HATS.length]! : "none";
          const look = p.isYou ? myLook : p.look;
          const state = cutNow.has(p.id) ? (slammed ? " cut-now" : " doomed") : p.out ? " gone" : "";
          return (
            <span key={p.id} class={`grid-pawn${state}${p.isYou ? " you" : ""}`} title={p.isYou ? "You" : p.name}>
              <Avatar look={look} side={side} hat={hat} />
            </span>
          );
        })}
      </div>
      {slammed && (
        <>
          <p class={youOut || outBefore ? "out-msg" : "safe-msg"}>
            {youOut
              ? `You're out, in ${match.placement}${ordinal(match.placement ?? 0)} place.`
              : outBefore
                ? `You went out earlier, in ${match.placement}${ordinal(match.placement ?? 0)} place.`
                : final
                ? next === "Boss battle"
                  ? "You face the boss!"
                  : next === "Duel"
                    ? "You're in the duel!"
                    : `You made the ${next.toLowerCase()}!`
                : "You're through."}
          </p>
          {youOut && (
            <button
              type="button"
              class="btn btn-primary why-btn"
              onClick={(e) => {
                e.stopPropagation();
                setWhy(true);
              }}
            >
              Why was I cut?
            </button>
          )}
          <CutNames knockedOut={knockedOut} />
          {/* Out, you stay here until the results: quick chat with your team (online). */}
          {(youOut || me?.out) && <ChatSection match={match} />}
        </>
      )}
      {why && (
        <div onClick={(e) => e.stopPropagation()}>
          <Breakdown moves={match.moves} you={me?.points} line={line} placement={match.placement} onClose={() => setWhy(false)} />
        </div>
      )}
      {augments && !youOut && !outBefore && (
        <>
          <h2 class="cut-vote-title">
            Next round's clock{" "}
            <span class="muted small">{match.serverPaced ? "· the majority decides" : "· your call"}</span>
          </h2>
          <div class="augments" role="radiogroup" aria-label="Augment: next round's move clock">
            {AUGMENTS.map((a) => (
              <button
                type="button"
                role="radio"
                aria-checked={match.augmentVote === a.choice}
                key={a.choice}
                class={`augment augment-${a.choice}${match.augmentVote === a.choice ? " on" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  match.voteAugment(a.choice);
                }}
              >
                <span class="augment-icon" aria-hidden="true">
                  {a.step > 0 ? "⏳" : a.step < 0 ? "⚡" : "＝"}
                </span>
                <strong>{a.title}</strong>
                <span class="augment-secs">{at(a.step)} s</span>
              </button>
            ))}
          </div>
        </>
      )}
      {left !== null && <p class="muted small cut-timer">Next round in {left}…</p>}
    </div>
  );
}
