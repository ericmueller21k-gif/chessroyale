import { useEffect, useMemo, useState } from "preact/hooks";
import { bossIntroTimeline, fenAtPly, inCheck, lastMoveTookQueen, pieceAt, withPiece } from "@chessroyale/chess";
import { BLIZZARD, BURN, BulbStrip, CANDLE, FUNHOUSE, FireBurn, HOLLOW_CASTER, funhouseFlipAt, powerLine, PowerBoard, PowerMoment, RageMeter, crowdOrientation, funhouseBeat, momentAt, momentsOf } from "../components/BossPowers.tsx";
import { BossMoment } from "../components/BossEffect.tsx";
import { pickLine } from "../characters/boss-beats.ts";
import { rememberBoss } from "../boss-history.ts";
import { bossKit } from "../characters/kits.ts";
import { bossMoveCues, kingSay, resetKingSpeech } from "../godKing.ts";
import { FightBanner } from "../components/FightBanner.tsx";
import { GodKingPortrait } from "../components/GodKing.tsx";
import { Board } from "../components/Board.tsx";
import { useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { UnderBoard } from "../components/QuickChat.tsx";
import { SquareRing } from "../components/ShadeMoves.tsx";
import type { BossView, GameView, LightsView } from "../game.ts";
import { LightsOutLayer, lightsStatus } from "../components/LightsOut.tsx";
import { seenKey } from "../hooks.ts";
import { Hud } from "./Hud.tsx";
import { BossDock, Dots } from "../components/BossDock.tsx";
import { BossCharacter, BossFace, BossSide, hasCharacter } from "../components/BossCharacter.tsx";
import { WipPreview, wipPower } from "../components/WipPreview.tsx";
import { BossHeading } from "./Play.tsx";
import { ordinal } from "./StageBreak.tsx";

/** For the raid's opening roulette: famous lines flicking past before the real one lands. */
const ROULETTE = [
  "Queen's Gambit Declined",
  "Sicilian Defense",
  "Ruy Lopez",
  "Italian Game",
  "French Defense",
  "Caro-Kann Defense",
  "King's Indian Defense",
  "London System",
  "Scandinavian Defense",
  "English Opening",
  "Slav Defense",
  "Nimzo-Indian Defense",
];

function OpeningRoulette({ name }: { name: string }) {
  const [start] = useState(Date.now());
  const now = useFrameNow();
  const t = now - start;
  const spinning = t < 1800;
  // Slows down as it goes, like a wheel.
  const i = Math.floor(Math.sqrt(t) / 3);
  return <span class={`opening-roulette${spinning ? " spinning" : " landed"}`}>{spinning ? ROULETTE[i % ROULETTE.length] : name}</span>;
}

/** The dock's line for a power's moment. */
const POWER_DOCK: Record<string, string> = { freeze: "Freeze!", pie: "Pie!", blizzard: "Blizzard!", funhouse: "Funhouse!", warn: "Rage!", spark: "Sparkler!", candle: "Roman candle!", fireball: "Fireballs!", dark: "Darkness!" };
const PIECE_NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };

/** When each burn after a crowd move started on this device (a screen drawn again carries on, it doesn't restart). */
const burnStarts = new Map<string, number>();
function burnStart(key: string): number {
  if (!key) return 0;
  let t = burnStarts.get(key);
  if (t === undefined) {
    t = Date.now();
    burnStarts.set(key, t);
    if (burnStarts.size > 50) burnStarts.delete(burnStarts.keys().next().value!);
  }
  return t;
}

/** The boss at a glance: who it is, how scary, when it strikes next. Shown above the board all through the battle. */
export function BossBar({ boss, match }: { boss: BossView; match?: GameView }) {
  // A boss with a character stands at the bar's left on a phone (on a computer, by the board: see BossSide), with
  // its portrait in the bar instead.
  const char = !!match && hasCharacter(match);
  return (
    <div class={`boss-bar${char ? " has-char" : ""}`} role="status">
      {char && <BossCharacter match={match!} place="bar" />}
      <span class={`boss-icon${char ? " boss-icon-face" : ""}`} aria-hidden="true">
        <BossFace boss={boss} />
      </span>
      <span class="boss-name">
        <strong>{boss.name}</strong>
        <span class="boss-threat" aria-label={`Threat ${boss.threat} of 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} class={i < boss.threat ? "on" : ""}>
              💀
            </i>
          ))}
          <RageMeter boss={boss} />
          <BulbStrip boss={boss} until={match?.phase.kind === "boss" && !match.phase.lights && !match.phase.thinking && !match.phase.intro ? match.phase.until : 0} />
        </span>
      </span>
      <span class="boss-next">
        {boss.result
          ? boss.result === "crowd"
            ? "Defeated!"
            : boss.result === "boss"
              ? "The boss won"
              : "A draw"
          : boss.strikeIn !== null
            ? boss.strikeIn <= 1
              ? "Strikes after this move"
              : `Strikes in ${boss.strikeIn} moves`
            : `Move ${Math.min(boss.crowdMoves + 1, boss.maxMoves)} of ${boss.maxMoves}`}
      </span>
    </div>
  );
}

/** Hollow's line as he claims the dark side (the same for everyone). */
const claimLine = (boss: BossView) => {
  const kit = bossKit(boss.name);
  return (kit && pickLine(kit, "claim", `${boss.id}:claim:${boss.startMove}`)) ?? "The dark side is mine.";
};

/**
 * Hollow claims the dark side in the intro (the crowd would have been Black): he steps up to the board's corner, points
 * at himself and the dark rises round him like a cloak (his `claimDark`), with his line.
 */
function ClaimDark({ boss, since, now }: { boss: BossView; since: number; now: number }) {
  const kit = bossKit(boss.name);
  if (!kit?.ch.anims.claimDark) return null;
  const line = claimLine(boss);
  const lineAt = since + 500;
  return (
    <div class="power-moment pm-claim">
      <span class="pm-caster pm-hollow" style={{ aspectRatio: `${kit.ch.w} / ${kit.ch.h}`, left: `${HOLLOW_CASTER.left}%`, top: `${HOLLOW_CASTER.top}%`, width: `${HOLLOW_CASTER.width}%` }}>
        <BossMoment boss={boss.name} anim="claimDark" since={since} then="idle" />
      </span>
      {now >= lineAt && (
        <div class="pm-line" role="status" aria-label={line}>
          {line.slice(0, Math.min(line.length, Math.floor((now - lineAt) / 28) + 1))}
        </div>
      )}
    </div>
  );
}

/**
 * Boss battle, between the crowd's moves: the boss thinking, then its move; or
 * the boss striking down the crowd's worst recent mover, with a flash and the
 * victim's name crossed out.
 */
export function BossScreen({ match, boss, until, thinking: thinkingNow, intro, lights }: { match: GameView; boss: BossView; until: number; thinking?: boolean; intro?: boolean; lights?: LightsView }) {
  const now = useFrameNow();
  // (Hollow's Lights out comes before his move: as far as the rest of the screen goes, he hasn't moved yet.)
  const thinking = thinkingNow || !!lights;
  const [mountedAt] = useState(Date.now());
  const victim = boss.justKilled ?? null;
  // The intro: the boss's card over the starting position, the game so far replayed quickly from the start,
  // then "START!".
  const history = boss.board.history;
  // (Hollow claims the dark side after the card, when the crowd would have been Black.)
  const claimed = !!intro && !!boss.powers?.claimed;
  const tl = useMemo(() => bossIntroTimeline(history.length, claimed), [history.length, claimed]);
  const t = now - mountedAt;
  const plies = intro ? Math.max(0, Math.min(history.length, Math.floor((t - tl.replayAt) / Math.max(1, tl.step)))) : history.length;
  const bases = boss.board.bases;
  const introFen = useMemo(() => (intro ? fenAtPly(history, plies, bases) : boss.board.fen), [intro, plies, boss.board.fen]);
  const introLast = intro ? (plies > 0 ? history[plies - 1]! : null) : boss.board.lastMove;
  const showCard = intro && t < tl.replayAt;
  // A new boss battle: the God King starts afresh (he'll introduce himself on your first move). This device remembers
  // the boss, so the next random one is another.
  useState(() => intro && resetKingSpeech());
  useState(() => intro && rememberBoss(boss.id, `${boss.id}:${history.join("")}`));
  // Boss powers: the moments that come as the turn passes to the crowd (after the boss's move), or the funhouse's own.
  const moments = useMemo(() => (intro || thinking || victim ? [] : momentsOf(boss, until)), [boss.board.fen, boss.powers?.events.length, until, thinking, intro, victim]);
  const moment = momentAt(moments, now);
  const funhouse = moments.find((m) => m.kind === "funhouse") ?? null;
  const fun = funhouseBeat(funhouse && now >= funhouse.at ? funhouse : null, now, funhouseFlipAt(bossKit(boss.name)));
  const funMove = funhouse ? boss.powers?.funhouse : null;
  // The God King's word on the boss's move.
  const kingCues = useMemo(() => {
    const m = boss.lastMove;
    if (intro || thinking || victim || !m || funhouse) return [];
    // (A check is said as your move begins: turnCues.)
    return bossMoveCues(boss.board.fen, m);
  }, [boss.board.fen, thinking, intro, victim]);
  // A boss blunder: the engine's numbers before and after its move (the eval bar's, already worked out or cheap).
  useEffect(() => {
    if (intro || thinking || victim || funhouse || !boss.lastMove || history.length !== boss.board.ply) return;
    let live = true;
    const before = fenAtPly(history, history.length - 1, bases);
    void Promise.all([match.evaluate(before), match.evaluate(boss.board.fen)]).then(([w0, w1]) => {
      if (!live || w0 === null || w1 === null) return;
      const swing = boss.crowdSide === "w" ? w1 - w0 : w0 - w1;
      if (swing >= 0.15) kingSay("bossBlunder", `blunder-${boss.board.fen}`);
    });
    return () => {
      live = false;
    };
  }, [boss.board.fen, thinking]);
  // The boss takes your queen: its banner, face and roar.
  const tookQueen = !intro && !thinking && !victim && !funhouse && boss.lastMove?.captured === "q";
  // You take the boss's queen: your banner (the God King's face), while the boss "thinks" (it waits for it).
  const slewQueen = !intro && !!thinkingNow && !victim && lastMoveTookQueen(history, bases);
  const left = until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  // Lights out: what the dock says (a round's prompt may take both its lines).
  const lightsNow = lights ? lightsStatus(lights, match.settings.lateGraceMs, now) : null;
  // A boss raid alone plays like any chess site: the boss's move lands and it's your turn (no ring, no countdown).
  const alone = match.standings().length === 1;
  const youStruck = victim !== null && match.isYou(victim);
  useEffect(() => {
    match.seen.set(seenKey(boss.board), boss.board.ply);
  }, [boss.board.ply]);
  const name = (id: string) => (match.isYou(id) ? "You" : match.nameOf(id));
  // The God King's word after the blizzard (the queen alone is free; no queen to move: the king) and the funhouse.
  const blizzard = moments.find((m) => m.kind === "blizzard");
  const blizzardLine = !!blizzard && now >= blizzard.at + BLIZZARD.lineAt;
  const funLine = !!funhouse && now >= funhouse.at + FUNHOUSE.exitAt;
  useEffect(() => {
    if (!blizzardLine) return;
    const queenFree = (boss.powers?.allowed ?? []).some((m) => pieceAt(boss.board.fen, m.slice(0, 2))?.type === "q");
    kingSay(queenFree ? "blizzard" : "blizzardKing", `blizzard-${blizzard!.key}`);
  }, [blizzardLine]);
  useEffect(() => {
    if (funLine) kingSay("funhouse", `funhouse-${funhouse!.key}`);
  }, [funLine]);
  // The board: the crowd's view (flipped for a while after the funhouse); in the funhouse it flips as he lands, and
  // the move he plays for the crowd lands at its beat.
  const unflipped = boss.crowdSide === "w" ? "white" : "black";
  const flippedView = unflipped === "white" ? "black" : "white";
  const orientation = fun ? (fun.flipped ? flippedView : unflipped) : intro ? unflipped : crowdOrientation(boss, boss.crowdSide);
  // G-REX's fire after the crowd's move (while the boss thinks): a piece left on a tile ablaze burns, shown on the
  // board until its flare; a tile under the king fizzles. The God King's warning the first time a piece steps onto one.
  const burnt = thinking && !intro && !victim ? (boss.powers?.burnt ?? []).filter((b) => b.turn === boss.crowdMoves) : [];
  const burnAt = burnStart(burnt.length ? `${boss.id}:${boss.crowdMoves}:${boss.board.ply}` : "");
  const burning = burnt.filter((b) => b.piece);
  const stepped = boss.powers?.stepped ?? null;
  useEffect(() => {
    if (thinking && stepped !== null && stepped === boss.crowdMoves) kingSay("fireTile", `fire-tile-${boss.id}-${stepped}`);
  }, [thinking, stepped]);
  const fenPlain = fun && !fun.played ? fenAtPly(history, history.length - 1, bases) : introFen;
  const fenShown = burning.length && now < burnAt + BURN.goneAt ? burning.reduce((f, b) => withPiece(f, b.square, { color: boss.crowdSide, type: b.piece! }), fenPlain) : fenPlain;
  const lastShown = fun ? (fun.played ? funMove?.move ?? introLast : null) : introLast;
  // (One or two pieces by name; more, how many: the dock's line stays one line.)
  const burnNames = burning.length > 2 ? `${burning.length} pieces` : burning.map((b) => PIECE_NAME[b.piece!] ?? "piece").join(" and ");
  const fizzled = burnt.some((b) => b.fizzled);
  const burnLine = burnt.length && now < burnAt + BURN.ms ? (burning.length ? `${burnNames.charAt(0).toUpperCase()}${burnNames.slice(1)} burnt!` : fizzled ? "Your king is fireproof." : null) : null;
  // G-REX slams the Roman candle down on the board: it jolts.
  const slam = moment?.kind === "candle" && now >= moment.at + CANDLE.slamAt && now < moment.at + CANDLE.slamAt + CANDLE.slamMs;
  return (
    <div class={`screen game boss-screen${victim ? " striking" : ""}`}>
      <Hud match={match} />
      <div class={`board-area${slam ? " pw-slam" : ""}`}>
        <div class="opening-name">
          <BossHeading side={boss.crowdSide} note={lights ? "lights out" : thinking ? "the boss is thinking" : victim ? "the boss strikes" : intro ? undefined : "the boss's move"} />
        </div>
        <div class={`board-row${fun?.flipping ? " pw-flipping" : ""}`}>
          <BossSide match={match} />
          <EvalBar fen={fenShown} orientation={orientation === "white" ? "w" : "b"} evaluate={(f) => match.evaluate(f)} />
          <Board fen={fenShown} orientation={orientation} lastMove={lastShown}>
            {!intro && <PowerBoard boss={boss} orientation={orientation} moments={moments} now={now} fen={fenShown} />}
            {lights && <LightsOutLayer boss={boss} lights={lights} now={now} orientation={orientation} graceMs={match.settings.lateGraceMs} onTap={(sq) => match.lightsTap(sq)} />}
            {wipPower() && <WipPreview fen={fenShown} orientation={orientation} crowd={boss.crowdSide} />}
            {!thinking && !victim && !alone && !funhouse && boss.lastMove && <SquareRing square={boss.lastMove.move.slice(2, 4)} orientation={orientation} />}
            <PowerMoment boss={boss} moment={moment} now={now} orientation={orientation} side={boss.crowdSide} />
            <FireBurn burnt={burnt} since={burnAt} now={now} orientation={orientation} />
            {claimed && t >= tl.claimAt && t < tl.bannerAt && <ClaimDark boss={boss} since={mountedAt + tl.claimAt} now={now} />}
            {intro && t >= tl.bannerAt && <FightBanner text="START!" sound="bannerStart" />}
            {slewQueen && (
              <FightBanner key={`slew-${history.length}`} tone="hero" face={<GodKingPortrait side={boss.crowdSide} />} text="QUEEN SLAIN!" sub={`You take ${boss.name}'s queen`} sound="queenGasp" />
            )}
            {tookQueen && <FightBanner tone="boss" face={<BossFace boss={boss} />} text="QUEEN DOWN!" sub={`${boss.name} takes your queen`} sound="queenGasp" />}
            {showCard && (
              <div class={`boss-intro${t > tl.replayAt - 350 ? " leaving" : ""}`} role="alert">
                <span class="boss-intro-icon" aria-hidden="true">
                  <BossFace boss={boss} />
                </span>
                <span class="boss-strike-text">A boss appears</span>
                <strong class="boss-intro-name">{boss.name}</strong>
                {boss.raid && boss.openingName && <OpeningRoulette name={boss.openingName} />}
                <span class="boss-intro-note">
                  {boss.raid && !boss.openingName
                    ? `A fresh game from the starting position. You play ${boss.crowdSide === "w" ? "White" : "Black"}.`
                    : boss.raid
                    ? `It challenges you from this opening, ${boss.startMove - 1} moves in. You play ${boss.crowdSide === "w" ? "White" : "Black"}.`
                    : boss.startMove > 1
                    ? `It takes over your game from move ${boss.startMove}, where it was roughly even. The crowd plays White.`
                    : "A fresh game. The crowd plays White."}
                </span>
              </div>
            )}
            {victim && (
              <div class="boss-strike" role="alert">
                <span class="boss-strike-skull" aria-hidden="true">
                  💀
                </span>
                <span class="boss-strike-text">
                  {boss.icon} {boss.name} struck down
                </span>
                <strong class="boss-strike-name">{name(victim)}</strong>
              </div>
            )}
          </Board>
        </div>
      </div>
      <BossDock
        match={match}
        side={boss.crowdSide}
        cues={kingCues}
        status={
          lightsNow?.wrap ? (
            // (His prompt may take both lines on a phone, the count after it.)
            <span>
              {lightsNow.line} <span class="muted">{lightsNow.sub}</span>
            </span>
          ) : (
          <>
            <span class="dock-line">
              {lights ? (
                lightsNow!.line
              ) : claimed && t >= tl.claimAt && t < tl.bannerAt ? (
                <>
                  {boss.icon} <strong>{claimLine(boss)}</strong>
                </>
              ) : intro ? (
                <strong>{boss.raid ? "All of you vs the boss." : "Ten of you vs the boss."}</strong>
              ) : funMove ? (
                <>
                  {boss.icon} {boss.name.replace(/^The /, "")} plays <strong>your</strong> move{fun?.played ? <>: <strong>{funMove.san}</strong></> : "…"}
                </>
              ) : moment ? (
                <>
                  {/* (Hollow's cover: his words are in his text box over the board; the dock keeps it short.) */}
                  {boss.icon} <strong>{(moment.kind !== "dark" && powerLine(bossKit(boss.name), moment)) || POWER_DOCK[moment.kind]}</strong>
                </>
              ) : victim ? (
                <strong class="bad">
                  💀 Struck down: {name(victim)}
                </strong>
              ) : burnLine ? (
                <>
                  🔥 <strong>{burnLine}</strong>
                </>
              ) : thinking ? (
                <>
                  <Dots /> <strong>The boss</strong> is thinking…
                </>
              ) : boss.lastMove ? (
                <>
                  {boss.icon} Boss plays <strong>{boss.lastMove.san}</strong>
                </>
              ) : null}
            </span>
            <span class="dock-line muted">
              {lights
                ? lightsNow!.sub
                : intro
                ? `Worst mover struck every ${match.settings.bossKillEvery} moves.`
                : funMove
                  ? "Not scored."
                  : victim
                  ? youStruck
                    ? `You played worst. You finish ${match.placement}${ordinal(match.placement ?? 0)}.`
                    : "Worst moves since its last strike."
                  : boss.lastMove?.staggered && !thinking
                    ? "Staggered: a weaker move."
                    : left !== null && left > 0 && !alone
                      ? `Your move in ${left}`
                      : boss.kills.length
                        ? `Struck down: ${boss.kills.map((k) => name(k.id)).join(", ")}`
                        : ""}
            </span>
          </>
          )
        }
      />
      <UnderBoard match={match} />
    </div>
  );
}

