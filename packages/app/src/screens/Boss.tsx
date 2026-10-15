import { useEffect, useLayoutEffect, useMemo, useState } from "preact/hooks";
import { KING_ATTACK, SNACK, bossIntroTimeline, bossRules, fenAtPly, inCheck, lastMoveTookQueen, pieceAt, withPiece } from "@chessroyale/chess";
import { BLIZZARD, BURN, BossBarExtra, CANDLE, FUNHOUSE, FireBurn, HOLLOW_CASTER, THAW, angleView, dockLine, PowerBoard, PowerMoment, RageMeter, funhouseView, momentAt, momentsOf, thawOver, useMomentSpeech } from "../components/BossPowers.tsx";
import { BossMoment } from "../components/BossEffect.tsx";
import { SnackTime, bounceFen, bounceJolt, snackLine, snackPawnShown } from "../components/BigBoy.tsx";
import { boardSawJolt, splitFen, splitStill } from "../components/Sawyer.tsx";
import { SHOWDOWN_KING_AT, pigBoard } from "../components/Pig.tsx";
import { pickLine } from "../characters/boss-beats.ts";
import { rememberBoss } from "../boss-history.ts";
import { bossKit } from "../characters/kits.ts";
import { bossMoveCues, kingSay, resetKingSpeech } from "../godKing.ts";
import { FightBanner } from "../components/FightBanner.tsx";
import { GodKingPortrait, kingSquare } from "../components/GodKing.tsx";
import { KingAttack, mateAttack } from "../components/KingAttack.tsx";
import { Board } from "../components/Board.tsx";
import { useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { UnderBoard } from "../components/QuickChat.tsx";
import { SquareRing } from "../components/ShadeMoves.tsx";
import type { BossView, GameView, LightsView } from "../game.ts";
import { LightsDock, LightsOutLayer } from "../components/LightsOut.tsx";
import { seenKey } from "../hooks.ts";
import { Hud } from "./Hud.tsx";
import { BossDock, Dots } from "../components/BossDock.tsx";
import { BossCharacter, BossFace, BossSide, hasCharacter, resetBeats } from "../components/BossCharacter.tsx";
import { WipPreview, wipPower } from "../components/WipPreview.tsx";
import { BossHeading } from "./Play.tsx";
import { ordinal } from "./StageBreak.tsx";
import { CRITICAL, bossVoice } from "../speech.tsx";
import { kingBlocked } from "../components/Recluse.tsx";
import { BrainLoading } from "../components/BrainLoading.tsx";
import { crowdFinalists } from "@chessroyale/core";

/** The Crowd's boss final as it starts: how many face the boss (crowdFinalists: the top 4), as a word. */
const NUMBER_WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
export const finalistsLine = (n = crowdFinalists("boss")) => `${NUMBER_WORDS[n] ?? n} of you vs the boss.`;

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
          {/* (The Hidden Boss's phase 2 has no meter: his bullet clock is phase 1's.) */}
          {!match?.bossNote && <RageMeter boss={boss} />}
          {!match?.bossNote && <BossBarExtra boss={boss} until={match?.phase.kind === "boss" && !match.phase.lights && !match.phase.thinking && !match.phase.intro ? match.phase.until : 0} />}
        </span>
      </span>
      <span class="boss-next">
        {match?.bossNote
          ? match.bossNote
          : boss.result
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
  // His line, into his voice (his text box, for its time: speech.tsx).
  const lineAt = since + 500;
  const due = now >= lineAt;
  useLayoutEffect(() => {
    if (due) bossVoice.say(claimLine(boss), `${boss.id}:${boss.startMove}:claim`, CRITICAL);
  }, [due]);
  if (!kit?.ch.anims.claimDark) return null;
  return (
    <div class="power-moment pm-claim">
      <span class="pm-caster pm-hollow" style={{ aspectRatio: `${kit.ch.w} / ${kit.ch.h}`, left: `${HOLLOW_CASTER.left}%`, top: `${HOLLOW_CASTER.top}%`, width: `${HOLLOW_CASTER.width}%` }}>
        <BossMoment boss={boss.name} anim="claimDark" since={since} then="idle" />
      </span>
    </div>
  );
}

/**
 * Boss battle, between the crowd's moves: the boss thinking, then its move; or
 * the boss striking down the crowd's worst recent mover, with a flash and the
 * victim's name crossed out.
 */
export function BossScreen({ match, boss, until, thinking: thinkingNow, intro, loading, afterLoading, lights, fall }: { match: GameView; boss: BossView; until: number; thinking?: boolean; intro?: boolean; loading?: boolean; afterLoading?: boolean; lights?: LightsView; fall?: boolean }) {
  const now = useFrameNow();
  // (Hollow's Lights out comes before his move: as far as the rest of the screen goes, he hasn't moved yet.)
  const thinking = thinkingNow || !!lights;
  const [mountedAt] = useState(Date.now());
  const victim = boss.justKilled ?? null;
  // The intro: the boss's card over the starting position, the game so far replayed quickly from the start,
  // then "START!".
  const history = boss.board.history;
  // (Hollow claims the dark side after the card, when the crowd would have been Black; Big Boy eats his snack then.)
  const claimed = !!intro && !!boss.powers?.claimed;
  const snack = intro && boss.powers?.snack ? boss.powers.snack : null;
  const tl = useMemo(() => bossIntroTimeline(history.length, claimed, !!snack), [history.length, claimed, !!snack]);
  // (Solo, the loading step before the intro, while the boss's brain loads: the intro's first frame, held, under its
  // own card. The intro then starts afresh: App mounts it anew.)
  const t = loading ? 0 : now - mountedAt;
  const plies = intro ? Math.max(0, Math.min(history.length, Math.floor((t - tl.replayAt) / Math.max(1, tl.step)))) : history.length;
  const bases = boss.board.bases;
  const snackAt = mountedAt + tl.claimAt;
  const pawnBack = !!snack && snackPawnShown(snackAt, now);
  const introFen = useMemo(() => {
    const f = intro ? fenAtPly(history, plies, bases) : boss.board.fen;
    // (Big Boy's snack: the pawn is on the board until he grabs it.)
    return pawnBack ? withPiece(f, snack!, { color: boss.crowdSide, type: "p" }) : f;
  }, [intro, plies, boss.board.fen, pawnBack]);
  const introLast = intro ? (plies > 0 ? history[plies - 1]! : null) : boss.board.lastMove;
  const showCard = intro && !loading && t < tl.replayAt;
  // The Hidden Boss: the God King's own opening line for this fight (Eric's "I sense a tremendous power within this
  // foe.") as "START!" comes, while nothing else is being said, so it's always heard; it's his intro, so the first move
  // doesn't say another.
  const foeIntro = !!intro && kingBlocked(boss) && t >= tl.bannerAt;
  useEffect(() => {
    if (foeIntro) kingSay("foeIntro", "intro");
  }, [foeIntro]);
  // A new boss battle: the God King starts afresh (he'll introduce himself on your first move). This device remembers
  // the boss, so the next random one is another.
  useState(() => intro && !loading && (resetKingSpeech(), bossVoice.reset(), resetBeats()));
  useState(() => intro && !loading && rememberBoss(boss.id, `${boss.id}:${history.join("")}`));
  // The boss's mate: its attack on the crowd's king (its kit has one), from KING_ATTACK.mateAt after its move shows;
  // the result waits for it (bossTurnShowMs). No power's moment comes with a mate.
  const mating = !intro && !thinking && !victim && mateAttack(boss);
  const mateKing = mating ? kingSquare(boss.board.fen, boss.crowdSide) : null;
  const attackAt = until - KING_ATTACK.mateHoldMs + KING_ATTACK.mateAt;
  // Boss powers: the moments that come as the turn passes to the crowd (after the boss's move), or the funhouse's own.
  // (Beaten, the Hidden Boss's fall: the board holds while he collapses; no moment of the last turn plays again.)
  const moments = useMemo(() => (intro || thinking || victim || mating || fall ? [] : momentsOf(boss, until)), [boss.board.fen, boss.powers?.events.length, until, thinking, intro, victim, mating, fall]);
  const moment = momentAt(moments, now);
  // Each moment's line, into the boss's voice: its text box keeps it up for its time, into the crowd's turn.
  useMomentSpeech(boss, moments, now);
  const funhouse = moments.find((m) => m.kind === "funhouse") ?? null;
  // (Big Boy's Big Bounce, before his move: as far as the rest of the screen goes, his last move isn't news.)
  const bounce = moments.find((m) => m.kind === "bounce") ?? null;
  // Boingo's funhouse and its later steps: the board as it was until its spin, the spin, then the new angle. In the
  // funhouse's own screen, the crowd's move he plays for it lands at its beat (FUNHOUSE.moveAt).
  const fun = funhouseView(moments, now, boss.powers, bossKit(boss.name));
  const funMove = funhouse ? (boss.powers?.funhouse ?? null) : null;
  const funPlayed = !!funhouse && now >= funhouse.at + FUNHOUSE.moveAt;
  // The God King's word on the boss's move.
  const kingCues = useMemo(() => {
    const m = boss.lastMove;
    if (intro || thinking || victim || !m || funhouse || bounce) return [];
    // (A check is said as your move begins: turnCues.)
    return bossMoveCues(boss.board.fen, m);
  }, [boss.board.fen, thinking, intro, victim]);
  // A boss blunder: the engine's numbers before and after its move (the eval bar's, already worked out or cheap).
  useEffect(() => {
    if (intro || thinking || victim || funhouse || bounce || !boss.lastMove || history.length !== boss.board.ply) return;
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
  // The boss takes your queen: its banner and face.
  const tookQueen = !intro && !thinking && !victim && !funhouse && !bounce && boss.lastMove?.captured === "q";
  // You take the boss's queen: your banner (the God King's face), while the boss "thinks" (it waits for it).
  const slewQueen = !intro && !!thinkingNow && !victim && lastMoveTookQueen(history, bases);
  const left = until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  // A boss raid alone plays like any chess site: the boss's move lands and it's your turn (no ring, no countdown).
  const alone = match.standings().length === 1;
  const youStruck = victim !== null && match.isYou(victim);
  useEffect(() => {
    match.seen.set(seenKey(boss.board), boss.board.ply);
  }, [boss.board.ply]);
  const name = (id: string) => (match.isYou(id) ? "You" : match.nameOf(id));
  // The God King's word after the blizzard (one piece free: the queen, the king, or another), as it thaws (more of
  // ours free; then the ice gone), and after the funhouse.
  const blizzard = moments.find((m) => m.kind === "blizzard");
  const blizzardLine = !!blizzard && now >= blizzard.at + BLIZZARD.lineAt;
  const thaw = moments.find((m) => m.kind === "thaw");
  const thawSaid = !!thaw && now >= thaw.at + THAW.lineAt;
  const funLine = !!funhouse && now >= funhouse.at + FUNHOUSE.exitAt;
  useEffect(() => {
    if (!blizzardLine) return;
    const free = new Set((boss.powers?.allowed ?? []).map((m) => pieceAt(boss.board.fen, m.slice(0, 2))?.type));
    kingSay(free.has("q") ? "blizzard" : free.has("k") && free.size === 1 ? "blizzardKing" : "blizzardOne", `blizzard-${blizzard!.key}`);
  }, [blizzardLine]);
  useEffect(() => {
    if (thawSaid) kingSay(thawOver(boss) ? "thawed" : "thaw", `thaw-${thaw!.key}`);
  }, [thawSaid]);
  useEffect(() => {
    if (funLine) kingSay("funhouse", `funhouse-${funhouse!.key}`);
  }, [funLine]);
  // Wrangler's showdown: the God King's word as "DRAW!" comes.
  const showdown = moments.find((m) => m.kind === "showdown");
  const showdownLine = !!showdown && now >= showdown.at + SHOWDOWN_KING_AT;
  useEffect(() => {
    if (showdownLine) kingSay("showdown", `showdown-${showdown!.key}`);
  }, [showdownLine]);
  // The board: the crowd's view (in Boingo's funhouse turned upside down, then a quarter turn either way, then back:
  // each step turns it as its moment reaches its spin).
  const view = intro ? angleView(0, boss.crowdSide) : angleView(fun.angle, boss.crowdSide);
  const orientation = view.orientation;
  // G-REX's fire after the crowd's move (while the boss thinks): a piece left on a tile ablaze burns, shown on the
  // board until its flare; a tile under the king fizzles. The God King's warning the first time a piece steps onto one.
  const burnt = thinking && !intro && !victim ? (boss.powers?.burnt ?? []).filter((b) => b.turn === boss.crowdMoves) : [];
  const burnAt = burnStart(burnt.length ? `${boss.id}:${boss.crowdMoves}:${boss.board.ply}` : "");
  const burning = burnt.filter((b) => b.piece);
  const stepped = boss.powers?.stepped ?? null;
  useEffect(() => {
    if (thinking && stepped !== null && stepped === boss.crowdMoves) kingSay("fireTile", `fire-tile-${boss.id}-${stepped}`);
  }, [thinking, stepped]);
  const fenPlain = funMove?.move && !funPlayed ? fenAtPly(history, history.length - 1, bases) : introFen;
  const fenShown = burning.length && now < burnAt + BURN.goneAt ? burning.reduce((f, b) => withPiece(f, b.square, { color: boss.crowdSide, type: b.piece! }), fenPlain) : fenPlain;
  const lastShown = funMove?.move ? (funPlayed ? funMove.move : null) : introLast;
  // The Big Bounce: the board before it, less the pieces up in the air, then the new position as they come down; the
  // eval bar keeps the position before it until they've all settled. The board jolts as he lands and at the crash.
  const bounceShown = bounceFen(boss.powers?.bounce, bounce && now >= bounce.at ? bounce : null, now, boss.board.fen);
  // Sawyer's split after his first move: the new half isn't on the board until the pawn cracks, and both are in the air
  // (the moment draws them) until they've landed; the board doesn't animate those changes.
  const split = moments.find((m) => m.kind === "split") ?? null;
  const splitShown = bounceShown ? null : splitFen(boss.powers?.split, split, now, fenShown);
  // Wrangler's long pull, lasso drag and showdown: the piece where it was until his tug, the line-up's pieces where they
  // stood until each pair is yanked in (the moment draws them on their way); the eval bar keeps the position before.
  const pig = bounceShown || splitShown ? null : pigBoard(boss, moments, now, fenShown);
  const boardFen = bounceShown ?? splitShown ?? pig?.fen ?? fenShown;
  const evalFen = bounceShown && bounceShown !== boss.board.fen ? (boss.powers?.bounce?.before ?? fenShown) : (pig?.evalFen ?? fenShown);
  const jolt = bounceJolt(bounce && now >= bounce.at ? bounce : null, now) ?? boardSawJolt(moment, now);
  // (One or two pieces by name; more, how many: the dock's line stays one line.)
  const burnNames = burning.length > 2 ? `${burning.length} pieces` : burning.map((b) => PIECE_NAME[b.piece!] ?? "piece").join(" and ");
  const fizzled = burnt.some((b) => b.fizzled);
  const burnLine = burnt.length && now < burnAt + BURN.ms ? (burning.length ? `${burnNames.charAt(0).toUpperCase()}${burnNames.slice(1)} burnt!` : fizzled ? "Your king is fireproof." : null) : null;
  // G-REX slams the Roman candle down on the board: it jolts.
  const slam = moment?.kind === "candle" && now >= moment.at + CANDLE.slamAt && now < moment.at + CANDLE.slamAt + CANDLE.slamMs;
  return (
    <div class={`screen game boss-screen${victim ? " striking" : ""}`}>
      <Hud match={match} />
      <div class={`board-area${slam ? " pw-slam" : ""}${jolt === "crash" ? " pw-crash" : jolt === "bump" ? " pw-bump" : ""}`}>
        <div class="opening-name">
          <BossHeading side={boss.crowdSide} note={fall ? "the boss is beaten" : lights ? "lights out" : thinking ? "the boss is thinking" : victim ? "the boss strikes" : intro ? undefined : "the boss's move"} />
        </div>
        <div class={`board-row${fun.spin === "half" ? " pw-flipping" : fun.spin ? ` pw-turning-${fun.spin}` : ""}`}>
          <BossSide match={match} />
          <EvalBar fen={evalFen} orientation={orientation === "white" ? "w" : "b"} evaluate={(f) => match.evaluate(f)} />
          <Board fen={boardFen} orientation={orientation} turn={view.turn} lastMove={pig?.lastMove ?? lastShown} animate={!bounceShown && !splitStill(split, now) && !pig?.still}>
            {!intro && <PowerBoard boss={boss} orientation={orientation} moments={moments} now={now} fen={boardFen} />}
            {lights && <LightsOutLayer boss={boss} lights={lights} now={now} orientation={orientation} graceMs={match.settings.lateGraceMs} onTap={(sq) => match.lightsTap(sq)} />}
            {wipPower() && <WipPreview fen={fenShown} orientation={orientation} crowd={boss.crowdSide} />}
            {!thinking && !victim && !alone && !funhouse && !bounce && !pig && boss.lastMove && <SquareRing square={boss.lastMove.move.slice(2, 4)} orientation={orientation} />}
            <PowerMoment boss={boss} moment={moment} now={now} orientation={orientation} side={boss.crowdSide} />
            {mateKing && <KingAttack boss={boss} square={mateKing} orientation={orientation} startAt={attackAt} now={now} seed={`mate:${boss.board.fen}`} king={boss.crowdSide} />}
            <FireBurn burnt={burnt} since={burnAt} now={now} orientation={orientation} />
            {claimed && t >= tl.claimAt && t < tl.bannerAt && <ClaimDark boss={boss} since={mountedAt + tl.claimAt} now={now} />}
            {snack && t >= tl.claimAt && t < tl.bannerAt && <SnackTime boss={boss} since={snackAt} now={now} orientation={orientation} />}
            {intro && t >= tl.bannerAt && <FightBanner text="START!" sound="bannerStart" />}
            {/* (The queen banners are silent for now: Eric, Oct 11, the gasp sounded wrong. Its file is kept, unused:
                queenGasp in sound.ts, public/sounds/banner/queen-gasp.mp3.) */}
            {slewQueen && <FightBanner key={`slew-${history.length}`} tone="hero" face={<GodKingPortrait side={boss.crowdSide} />} text="QUEEN SLAIN!" sub={`You take ${boss.name}'s queen`} />}
            {tookQueen && <FightBanner tone="boss" face={<BossFace boss={boss} />} text="QUEEN DOWN!" sub={`${boss.name} takes your queen`} />}
            {loading && <BrainLoading match={match} boss={boss} />}
            {showCard && (
              // (After the loading step, whose card it takes over from: no entrance, so the board doesn't blink between.)
              <div class={`boss-intro${afterLoading ? " no-entrance" : ""}${t > tl.replayAt - 350 ? " leaving" : ""}`} role="alert">
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
        wide={!!lights}
        status={
          lights ? (
            // (Lights out: the round's prompt, whole, for the whole round, and the crowd's meter.)
            <LightsDock lights={lights} graceMs={match.settings.lateGraceMs} now={now} />
          ) : (
          <>
            <span class="dock-line">
              {claimed && t >= tl.claimAt && t < tl.bannerAt ? (
                <>
                  {boss.icon} <strong>{claimLine(boss)}</strong>
                </>
              ) : snack && t >= tl.claimAt + SNACK.grabAt && t < tl.bannerAt ? (
                <>
                  {boss.icon} <strong>{snackLine(boss)}</strong>
                </>
              ) : intro ? (
                <strong>{boss.raid ? "All of you vs the boss." : finalistsLine()}</strong>
              ) : fall ? (
                // (Beaten, the Hidden Boss collapses and mumbles before the result.)
                <>
                  🏆 <strong>You beat him!</strong>
                </>
              ) : funMove?.move ? (
                // (Short enough for a phone's dock with the move in it: his icon says who.)
                <>
                  {boss.icon} Plays <strong>your</strong> move{funPlayed ? <>: <strong>{funMove.san}</strong></> : "…"}
                </>
              ) : moment ? (
                <>
                  {boss.icon} <strong>{dockLine(moment)}</strong>
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
              {intro
                ? // (A boss that never strikes, the Hidden Boss: nothing about strikes.)
                  bossRules(boss)?.noStrikes
                  ? ""
                  : `Worst mover struck every ${match.settings.bossKillEvery} moves.`
                : funMove?.move
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

