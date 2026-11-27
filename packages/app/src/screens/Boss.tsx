import { useEffect, useLayoutEffect, useMemo, useState } from "preact/hooks";
import { hapticOnce } from "../haptics.ts";
import { KING_ATTACK, MOO_BEATS, SNACK, bossIntroTimeline, bossRules, fenAtPly, inCheck, legalMoves, pieceAt, shotSaves, withPiece } from "@chessroyale/chess";
import { BLIZZARD, BURN, BossBarExtra, CANDLE, battleDecor, casterOf, FUNHOUSE, FireBurn, HOLLOW_CASTER, THAW, angleView, dockLine, noMoveLine, PowerBoard, PowerMoment, RageMeter, funhouseView, mateMomentsOf, momentAt, momentsOf, thawOver, useMomentSpeech } from "../components/BossPowers.tsx";
import { BossMoment } from "../components/BossEffect.tsx";
import { SnackTime, bounceFen, bounceJolt, snackPawnShown, yourTopple } from "../components/BigBoy.tsx";
import { boardSawJolt, sawSwapBoard, sawyerMoments, splitFen, splitStill, swapStill } from "../components/Sawyer.tsx";
import { SHOWDOWN_KING_AT, pigBoard } from "../components/Pig.tsx";
import { alfilFen, alfilJolt, earlyLanding } from "../components/Alfil.tsx";
import { hopperFen, yourPulls } from "../components/Hopper.tsx";
import { rookTakenMoment, smudgyFen } from "../components/Smudgy.tsx";
import { fullMoonMoment, noteMooMoments } from "../components/Moo.tsx";
import { DashHangOn, hangOnAt, hangOnFen, popOffMoments } from "../components/Dash.tsx";
import { folioMoments, revisionFen } from "../components/Folio.tsx";
import { gingerMoments } from "../components/Ginger.tsx";
import { gardenerFen } from "../components/Gardener.tsx";
import { fireLine } from "../components/Grex.tsx";
import { timberFen } from "../components/Timber.tsx";
import { ZEBRA_BEATS, zebraFen, zebraGold, zebraTurnMoments } from "../components/Zebra.tsx";
import { pickLine } from "../characters/boss-beats.ts";
import { rememberBoss } from "../boss-history.ts";
import { bannerOn, dueQueenBanner, resetBattleBanners } from "../battle-banners.ts";
import { bossKit } from "../characters/kits.ts";
import { bossMoveCues, kingSay, resetKingSpeech } from "../godKing.ts";
import { FightBanner } from "../components/FightBanner.tsx";
import { GodKingPortrait, kingSquare } from "../components/GodKing.tsx";
import { KingAttack, mateAttack } from "../components/KingAttack.tsx";
import { Board } from "../components/Board.tsx";
import { seatKey } from "../board/yours.ts";
import { useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { UnderBoard } from "../components/QuickChat.tsx";
import { BossPanel, besideBoard, useBossLayout } from "../components/MovePanel.tsx";
import { bossFramed, type BossView, type DodgeRun, type GameView, type LightsView, type RushView } from "../game.ts";
import { LightsDock, LightsOutLayer, lightsStatus } from "../components/LightsOut.tsx";
import { RushLayer, rushBoard, rushDock } from "../components/DashRush.tsx";
import { DodgeLayer, FIRE_AT as CHANDY_FIRE_AT, chandyFen, chandyTurnMoments, dodgeDock, dodgeFen } from "../components/Chandy.tsx";
import { strangerBoard, strangerTurnMoments } from "../components/Stranger.tsx";
import { birdieFen, birdieTurnMoments } from "../components/Birdie.tsx";
import { seenKey, useStillKey } from "../hooks.ts";
import { Hud } from "./Hud.tsx";
import { SideFigures, TowerBoardLives } from "./TowerBar.tsx";
import { moverOf, onSide, partOf, partsOf, sideOf } from "../boss-side.ts";
import { BossDock, Dots } from "../components/BossDock.tsx";
import { BossCharacter, BossFace, BossTag, hasCharacter, resetBeats } from "../components/BossCharacter.tsx";
import { WipPreview, wipPower } from "../components/WipPreview.tsx";
import { ordinal } from "./StageBreak.tsx";
import { CRITICAL, VoiceBubble, bossVoice } from "../speech.tsx";
import { kingBlocked } from "../components/Recluse.tsx";
import { BrainLoading } from "../components/BrainLoading.tsx";
import { bossBannerMs, bossInText, crowdFinalists } from "@chessroyale/core";
import { testParams } from "../test-switches.ts";

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

/** The dock's "Ginger plays e5": the boss who moved (on a Battle Tower floor of several, the one who did: TowerBar.tsx moverOf), with his portrait. */
function PlaysLine({ boss, san }: { boss: BossView; san: string }) {
  return (
    <>
      <BossTag boss={boss} /> plays <strong>{san}</strong>
    </>
  );
}

/**
 * The boss at a glance: who it is, its level, its bars, when it strikes next. Shown above the board all through the battle.
 * Its name, then its level ("LVL 50"), then its ultimate's rage meter, then its passive's bar when it has one, in a column
 * at the left, left aligned with the name; the status ("Strikes in 3 moves", "58 moves left", the result) at the top right;
 * under it free room, a slot for the boss's own prop (BossUi.barProp). The boss's threat (1 to 5) is in the bar's label, no
 * longer drawn (Eric, Oct 23: "remove the skull shit"; the select screen and the menus keep their skulls).
 */
export function BossBar({ boss, match, move }: { boss: BossView; match?: GameView; move?: string }) {
  // A boss with a character stands at the bar's left on a phone (on a computer, by the board: see BossSide), with
  // its portrait in the bar instead.
  const char = !!match && hasCharacter(match);
  // (The Hidden Boss's phase 2 has no meters: his bullet clock is phase 1's.)
  const meters = match?.bossNote == null;
  const until = match?.phase.kind === "boss" && !match.phase.lights && !match.phase.thinking && !match.phase.intro ? match.phase.until : 0;
  // (Test link ?barslot=1: the prop's room outlined, so a screenshot shows it.)
  const slot = testParams().get("barslot") === "1";
  return (
    // (A phone's name column starts this far right of its usual place, for a figure that reaches past it: kits.ts barName.)
    <div class={`boss-bar${char ? " has-char" : ""}${slot ? " barslot" : ""}`} style={{ "--bc-name": `${bossKit(boss.name)?.barName ?? 0}px` }} role="status" aria-label={`${boss.name}, threat ${boss.threat} of 5`}>
      {char && <BossCharacter match={match!} place="bar" />}
      <span class={`boss-icon${char ? " boss-icon-face" : ""}`} aria-hidden="true">
        <BossFace boss={boss} live />
      </span>
      <span class="boss-main">
        <span class="boss-name">
          <strong>{boss.name}</strong>
          <BossLevel boss={boss} />
          {meters && (
            <>
              <span class="boss-ult">
                <RageMeter boss={boss} />
                <BossBarExtra boss={boss} until={until} part="ult" />
              </span>
              <span class="boss-passive">
                <BossBarExtra boss={boss} until={until} />
              </span>
            </>
          )}
        </span>
        {/* (The move number, a computer's: left of the status, where the title line said it, Nov 1.) */}
        {move && <span class="boss-move">{move}</span>}
        <BossNext boss={boss} match={match} />
        <span class="boss-prop">{meters && <BossBarExtra boss={boss} until={until} part="prop" />}</span>
        {/* (His words, a phone's: inside the bar, from the name column's left edge to its right padding, under the status, so never
            over it: one row when short, else two balanced rows. A computer's are by his figure beside the board.) */}
        {char && <VoiceBubble voice={bossVoice} class="bc-bubble bc-bar-bubble" balanced />}
      </span>
    </div>
  );
}

/** The lone bar's status at its top right ("Strikes in 3 moves", "58 moves left", the result); a Battle Tower floor's card has it too (TowerBar). */
export function BossNext({ boss, match }: { boss: BossView; match?: GameView }) {
  return (
    <span class="boss-next">
      {match?.bossNote != null
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
          : // (A boss that never strikes, the Hidden Boss: the moves left, since the title says which move it is.)
            movesLeft(boss)}
    </span>
  );
}

/**
 * His level under his name: "LVL 50", Eric's RPG number (the battle's own, from his rating: NetBoss.level). It follows the
 * strength he plays his next move at: up (the Full Moon, the showdown's reply) it's gold with a small arrow, down (the King's
 * strike) it's red with a quick slash, for as long as that lasts; screen readers hear "Level 99". "LVL ???" (Level unknown)
 * for the Hidden Boss; nothing from a server that sends none. His child form's level (Nov 13) climbs a step at a time from his
 * first and stays up: each step pops as it comes.
 */
export function BossLevel({ boss }: { boss: BossView }) {
  const lv = boss.level;
  if (lv === undefined) return null;
  const base = boss.levelBase ?? lv;
  const dir = lv === null || base === null || lv === base ? "" : lv > base ? "up" : "down";
  // (The match's screens are drawn anew at every phase, and the bar with them: a badge drawn again carries on its pop from
  // when the lift began, so the pop plays once, not at every phase (Nov 12).)
  // (The Hidden Boss's child climbs a step at a time, staying up: each new level pops once too, as a new lift.)
  const mark = dir === "up" ? `up:${lv}` : dir;
  const since = levelSince(`${boss.name}:${boss.startMove}`, mark);
  return (
    // (Its own element for each direction, and each new level up: a lift or a slash plays as it begins, then stays as a color.)
    <span key={mark} class={`boss-level${dir ? ` lv-${dir}` : ""}${dir === "up" && boss.powers?.fullMoon ? " lv-aura" : ""}`} data-level={lv ?? "unknown"} style={dir ? { animationDelay: `${since - Date.now()}ms` } : undefined}>
      <span class="lv-text" aria-hidden="true">
        LVL {lv ?? "???"}
      </span>
      {dir && <i class="lv-mark" aria-hidden="true" />}
      <span class="lv-sr">{lv === null ? "Level unknown" : `Level ${lv}`}</span>
    </span>
  );
}

/** When the level's current direction began on this device (one battle at a time): a lift or a slash that goes on keeps its start. */
let levelDir = { battle: "", dir: "", at: 0 };
function levelSince(battle: string, dir: string): number {
  if (levelDir.battle !== battle || levelDir.dir !== dir) levelDir = { battle, dir, at: Date.now() };
  return levelDir.at;
}

/** The crowd's moves left before the battle is judged, this one included: "12 moves left". */
const movesLeft = (boss: BossView) => {
  const n = Math.max(0, boss.maxMoves - boss.crowdMoves);
  return `${n} ${n === 1 ? "move" : "moves"} left`;
};

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
export function BossScreen({ match, boss, until, thinking: thinkingNow, intro, loading, afterLoading, lights, rush, dodge, fall }: { match: GameView; boss: BossView; until: number; thinking?: boolean; intro?: boolean; loading?: boolean; afterLoading?: boolean; lights?: LightsView; rush?: RushView; dodge?: DodgeRun; fall?: boolean }) {
  const now = useFrameNow();
  const layout = useBossLayout();
  // (Hollow's Lights out comes before his move, Dash's Scramble Rush after it: as far as the rest of the screen goes, nothing new
  // has moved and no moment plays.)
  // (Chandy's Dodge too, as your turn begins: nothing new has moved.)
  const thinking = thinkingNow || !!lights || !!rush || !!dodge;
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
  useState(() => intro && !loading && (resetKingSpeech(), bossVoice.reset(), resetBeats(), resetBattleBanners()));
  useState(() => intro && !loading && rememberBoss(boss.id, `${boss.id}:${history.join("")}`));
  // The boss's mate: its attack on the crowd's king (its kit has one), from KING_ATTACK.mateAt into the screen's last
  // KING_ATTACK.mateHoldMs; the result waits for it (bossTurnShowMs). No power's moment comes with a mate, but Chub &
  // Chirp's fifth carrot's (mateMoments): the pull and his win play first, ending as that last stretch begins.
  // (A floor of several: the boss whose move mated, from his own part of the view, and every boss's own drawing from his: own(id).)
  const own = (id: string) => partOf(boss, id);
  const mover = moverOf(boss);
  const mating = !intro && !thinking && !victim && mateAttack(mover);
  const mateKing = mating ? kingSquare(boss.board.fen, boss.crowdSide) : null;
  const attackAt = until - KING_ATTACK.mateHoldMs + KING_ATTACK.mateAt;
  // Boss powers: the moments that come as the turn passes to the crowd (after the boss's move), or the funhouse's own.
  // (Beaten, the Hidden Boss's fall: the board holds while he collapses; no moment of the last turn plays again.)
  // (While he thinks, only Alfil's pieces coming down early, at the start of his turn: earlyLanding; a carrot of Chub &
  // Chirp's your move just pulled: yourPulls; Big Boy's tower your move knocked over: yourTopple; Smudgy's hidden rook your move just took: rookTakenMoment; Moo's Full Moon,
  // as your move lands: fullMoonMoment; Ginger's Super Freeze: gingerMoments; Sawyer's Saw Swap: sawyerMoments; Folio's fold and Revision, as your move lands: folioMoments; Dash's pop-off: popOffMoments; the Stranger's finisher as his move is about to show: strangerTurnMoments; and Birdie's train and fall: birdieTurnMoments.)
  const moments = useMemo(() => {
    if (intro || victim || fall) return [];
    if (mating) return mateMomentsOf(boss, until);
    // (A floor of several: each boss's own, from his own part of the view, named his for its banner and words: audit 2, finding 1.)
    if (thinking) return lights || rush || dodge ? [] : partsOf(boss).flatMap((b) => [earlyLanding(b), ...yourPulls(b), ...yourTopple(b), ...rookTakenMoment(b), ...fullMoonMoment(b), ...gingerMoments(b), ...sawyerMoments(b), ...folioMoments(b), ...popOffMoments(b), ...zebraTurnMoments(b), ...chandyTurnMoments(b), ...strangerTurnMoments(b), ...birdieTurnMoments(b)].filter((m) => m !== null).map((m) => (sideOf(boss) ? { ...m, boss: b.id } : m)));
    return momentsOf(boss, until);
  }, [boss.board.fen, boss.powers?.events.length, until, thinking, intro, victim, mating, fall]);
  // (Moo's daze: he's drawn powered up until its `calm`, noted from the moment's start.)
  noteMooMoments(own("moo"), moments);
  const moment = momentAt(moments, now);
  // Each moment's line, into the boss's voice: its text box keeps it up for its time, into the crowd's turn.
  useMomentSpeech(boss, moments, now);
  const funhouse = moments.find((m) => m.kind === "funhouse") ?? null;
  // (Big Boy's Big Bounce and Chub & Chirp's hop and Pawn Bounce, before his move: as far as the rest of the screen goes, his
  // last move isn't news.)
  const bounce = moments.find((m) => m.kind === "bounce" || m.kind === "hop" || m.kind === "pawnBounce") ?? null;
  // Boingo's funhouse and its later steps: the board as it was until its spin, the spin, then the new angle. In the
  // funhouse's own screen, the crowd's move he plays for it lands at its beat (FUNHOUSE.moveAt).
  const fun = funhouseView(moments, now, own("clown").powers, bossKit(own("clown").name));
  const funMove = funhouse ? (own("clown").powers?.funhouse ?? null) : null;
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
  // The queen banners, events of their captures (battle-banners.ts; Eric, Nov 5): read from the capture record of the
  // board's newest move, never the board. QUEEN DOWN! (his face) as his move that took your queen lands; QUEEN SLAIN!
  // (the God King's) in his thinking straight after yours took his. Each once for its ply: a later screen of the turn
  // (the Slam's, a bounce's, the funhouse's, his second thinking) never brings it back.
  const queenDue = intro || loading || victim ? null : dueQueenBanner(boss, thinkingNow ? "thinking" : thinking ? null : "move", `${boss.id}:${boss.startMove}`);
  const queenBanner = queenDue && bannerOn(queenDue.key, now, bossBannerMs()) ? queenDue : null;
  // (QUEEN SLAIN!'s buzz, once for its banner, as it comes: haptics.ts.)
  useLayoutEffect(() => {
    if (queenBanner?.kind === "slain") hapticOnce(`slain:${queenBanner.key}`, "queenSlain");
  }, [queenBanner?.key]);
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
    if (thawSaid) kingSay(thawOver(own("gingerbread")) ? "thawed" : "thaw", `thaw-${thaw!.key}`);
  }, [thawSaid]);
  useEffect(() => {
    if (funLine) kingSay("funhouse", `funhouse-${funhouse!.key}`);
  }, [funLine]);
  // Don Dough's dough: the God King's word as a lump lands ("Squash it before it rises!").
  const dough = moments.find((m) => m.kind === "doughDrop");
  const doughLine = !!dough && now >= dough.at + ZEBRA_BEATS.drop.landAt;
  useEffect(() => {
    if (doughLine) kingSay("dough", `dough-${dough!.key}`);
  }, [doughLine]);
  // Chandy's Lock-on Shot: the God King's warning as it's aimed, as he fires the aim (Nov 24); quiet when no move of yours can put a piece
  // in front of its target ("the God King quiet about threats he can't heed": Wrangler's duel).
  const shotAim = moments.find((m) => m.kind === "queenAim");
  const shotAimLine = !!shotAim && now >= shotAim.at + CHANDY_FIRE_AT;
  useEffect(() => {
    if (!shotAimLine || !shotAim!.square) return;
    const fen = boss.board.fen;
    if (!shotSaves(fen, shotAim!.square, boss.crowdSide, boss.powers?.allowed ?? legalMoves(fen)).length) return;
    kingSay(shotAim!.shape === "r" ? "shotRook" : "shotQueen", `shot-${shotAim!.key}`);
  }, [shotAimLine]);
  // Wrangler's showdown: the God King's word as "DRAW!" comes.
  const showdown = moments.find((m) => m.kind === "showdown");
  const showdownLine = !!showdown && now >= showdown.at + SHOWDOWN_KING_AT;
  useEffect(() => {
    if (showdownLine) kingSay("showdown", `showdown-${showdown!.key}`);
  }, [showdownLine]);
  // Moo & Moon's Full Moon: the God King's word as its cinematic ends (Nov 20), so players know he plays his best now.
  const fullMoon = moments.find((m) => m.kind === "fullMoon");
  const fullMoonLine = !!fullMoon && now >= fullMoon.at + MOO_BEATS.fullMoon.total;
  useEffect(() => {
    if (fullMoonLine) kingSay("fullMoon", `fullMoon-${fullMoon!.key}`);
  }, [fullMoonLine]);
  // The board: the crowd's view (in Boingo's funhouse turned upside down, then a quarter turn either way, then back:
  // each step turns it as its moment reaches its spin).
  const view = intro ? angleView(0, boss.crowdSide) : angleView(fun.angle, boss.crowdSide);
  const orientation = view.orientation;
  // Grex's fire after the crowd's move (while the boss thinks): a piece left on a tile ablaze burns, shown on the
  // board until its flare; a tile under the king fizzles. The God King's warning the first time a piece steps onto one.
  const burnt = thinking && !intro && !victim ? (own("grex").powers?.burnt ?? []).filter((b) => b.turn === boss.crowdMoves) : [];
  const burnAt = burnStart(burnt.length ? `${boss.id}:${boss.crowdMoves}:${boss.board.ply}` : "");
  const burning = burnt.filter((b) => b.piece);
  const stepped = own("grex").powers?.stepped ?? null;
  useEffect(() => {
    if (thinking && stepped !== null && stepped === boss.crowdMoves) kingSay("fireTile", `fire-tile-${boss.id}-${stepped}`);
  }, [thinking, stepped]);
  const fenPlain = funMove?.move && !funPlayed ? fenAtPly(history, history.length - 1, bases) : introFen;
  const fenBurnt = burning.length && now < burnAt + BURN.goneAt ? burning.reduce((f, b) => withPiece(f, b.square, { color: boss.crowdSide, type: b.piece! }), fenPlain) : fenPlain;
  // Chandy's queen lock: the piece his round hits on its square until the round reaches it.
  // (The Stranger's finisher, while he thinks: your piece off its square once his finisher has taken it, until his move shows.)
  const stranger = strangerBoard(own("stranger"), moments, now, chandyFen(own("chandy"), moments, now, fenBurnt));
  const fenShown = stranger?.fen ?? chandyFen(own("chandy"), moments, now, fenBurnt);
  const lastShown = funMove?.move ? (funPlayed ? funMove.move : null) : introLast;
  // The Big Bounce: the board before it, less the pieces up in the air, then the new position as they come down; the
  // eval bar keeps the position before it until they've all settled. The board jolts as he lands and at the crash.
  const bounceShown = bounceFen(own("bigboy").powers?.bounce, bounce && now >= bounce.at - (bounce.lead ?? 0) ? bounce : null, now, boss.board.fen);
  // Sawyer's split after his first move: the new half isn't on the board until the pawn cracks, and both are in the air
  // (the moment draws them) until they've landed; the board doesn't animate those changes.
  const split = moments.find((m) => m.kind === "split") ?? null;
  const splitShown = bounceShown ? null : splitFen(own("sawyer").powers?.split, split, now, fenShown);
  // Wrangler's long pull, lasso drag and showdown: the piece where it was until his tug, the line-up's pieces where they
  // stood until each pair is yanked in (the moment draws them on their way); the eval bar keeps the position before.
  const pig = bounceShown || splitShown ? null : pigBoard(own("pig"), moments, now, fenShown);
  // Alfil's moments: the fusion's pawns until they lift and its elephant once it lands, the Slam's pieces until they
  // fly, the landing's once they're down (each moment draws its own on their way); the board doesn't animate those.
  const alfil = bounceShown || splitShown || pig ? null : alfilFen(own("alfil"), moments, now, fenShown);
  // Chub & Chirp's: the hop's pawn on its square until it takes off and on the next once it has landed, the spin's prize
  // pieces once they've dropped (each moment draws its own on their way); the board doesn't animate those.
  const hopper = bounceShown || splitShown || pig || alfil ? null : hopperFen(own("hopper"), moments, now, fenShown);
  // Smudgy's: the rook where he lifted it until the paint covers his pawns, a revealed rook still a pawn until the paint drips
  // off it, a Repaint's pieces in their old colors until each stroke (his hidden rook itself is drawn as a pawn by the board:
  // camo.ts); the board doesn't animate what his moment changes under the paint.
  const smudgy = bounceShown || splitShown || pig || alfil || hopper ? null : smudgyFen(own("smudgy"), moments, now, fenShown);
  // Puddles': the position before his watering until each outcome's cue (a piece a killer plant eats, until its snap; a grown piece, until
  // its pop, which pops in); the board shows the rest as it fades and appears.
  const gardener = bounceShown || splitShown || pig || alfil || hopper || smudgy ? null : gardenerFen(own("gardener"), moments, now, fenShown);
  // Folio's Revision: the position after your move until its moment takes both moves back (the game's board is already back:
  // a base); the board slides the pieces back then.
  const revised = bounceShown || splitShown || pig || alfil || hopper || smudgy || gardener ? null : revisionFen(boss, moments, now);
  // Timber's: a piece he dropped off its square until his plank lands; a pawn he gnaws on its square until his last chomp.
  const timber = bounceShown || splitShown || pig || alfil || hopper || smudgy || gardener || revised ? null : timberFen(own("timber"), moments, now, fenShown);
  // Don Dough's: a piece risen from his dough off its square until the rise's pop.
  const zebra = bounceShown || splitShown || pig || alfil || hopper || smudgy || gardener || revised || timber ? null : zebraFen(own("zebra"), moments, now, fenShown);
  // Sawyer's Saw Swap: the position before it until his half's blocks come loose (the game's board is already swapped: a base), then
  // without his half's pieces while the blocks slide (the moment draws them), then the board as it is as they land.
  const swapped = bounceShown || splitShown || pig || alfil || hopper || smudgy || gardener || revised || timber || zebra ? null : sawSwapBoard(own("sawyer"), moments, now);
  // Birdie's train: the piece it smashes on its square until it rides, the line's pieces off the board while it rides (its layer draws
  // them stepping aside), your king off its square once his train has hit it; the board doesn't animate those.
  const birdie = bounceShown || splitShown || pig || alfil || hopper || smudgy || gardener || revised || timber || zebra || swapped ? null : birdieFen(own("birdie"), moments, now, fenShown);
  // (Dash's "Hang on" while he thinks: your move taken back on screen, then played again; the game's board never changes. When it
  // started, for the dock's clock, which shows his gag's time; and the board takes no new pre-move meanwhile, only shows those waiting.)
  const gagAt = thinking && !intro && !victim ? hangOnAt(moments, now) : undefined;
  const hangOn = gagAt !== undefined ? hangOnFen(own("dash"), moments, now) : null;
  // (Dash's Scramble Rush: his sweep, your placements, then the position as it was: the game's never changed.)
  const boardFen = dodge ? dodgeFen(boss, fenShown, dodge, now) : rush ? rushBoard(boss, rush, now) : (bounceShown ?? splitShown ?? pig?.fen ?? alfil ?? hopper ?? smudgy?.fen ?? gardener?.fen ?? revised?.fen ?? timber?.fen ?? zebra?.fen ?? swapped?.fen ?? birdie?.fen ?? hangOn?.fen ?? fenShown);
  const rushLines = rush ? rushDock(boss, rush, now) : dodge ? dodgeDock(boss, dodge, now) : null;
  const evalFen = bounceShown && bounceShown !== boss.board.fen ? (own("bigboy").powers?.bounce?.before ?? fenShown) : (pig?.evalFen ?? swapped?.evalFen ?? fenShown);
  const jolt = bounceJolt(bounce && now >= bounce.at ? bounce : null, now) ?? boardSawJolt(moment, now) ?? alfilJolt(moment, now);
  // (Burnt, charred by the Roman candle, or the king fireproof: one line, fireLine.)
  const burnLine = burnt.length && now < burnAt + BURN.ms ? fireLine(burnt, boss.board.fen) : null;
  // Grex slams the Roman candle down on the board: it jolts.
  const slam = moment?.kind === "candle" && now >= moment.at + CANDLE.slamAt && now < moment.at + CANDLE.slamAt + CANDLE.slamMs;
  // The screen draws every frame for its effects; the parts that don't move with them (the header, the boss by the
  // board, the chat) only as the match changes and five times a second, as on your move's screen (useStillKey).
  const still = useStillKey(match, now);
  // (A floor of several: whose moment plays now, so his own figure, and only his, steps out of his part or his place beside the board
  // while the moment draws him elsewhere, as a lone boss's does: TowerBar.tsx, tower.css `.tw-casting`. Eric, Nov 21.)
  // (A moment drawn outside the moments' list (Hollow's Lights out, Big Boy's snack) is the boss to move's: his turn brought it.)
  const side = sideOf(boss);
  const caster = !side ? null : moment ? casterOf(boss, moment).id : (side.bosses[side.toMove]?.id ?? null);
  const hud = useMemo(() => <Hud match={match} caster={caster} />, [match, still, caster]);
  const bossSide = useMemo(() => <SideFigures match={match} caster={caster} />, [match, still, caster]);
  // (Smudgy's reveal under the paint: the newest move isn't named yet, in the dock or the move list.)
  const hush = !!smudgy?.hush;
  const under = useMemo(() => besideBoard(match, layout, <UnderBoard match={match} />, hush), [match, still, layout.strip, layout.computer, hush]);
  // The dock's words change with the match and with these, read from the clock (a new word read from the clock goes in
  // this list): it's drawn again when one of them changes, not every frame (Lights out's prompt, every frame).
  const snacking = !!snack && t >= tl.claimAt + SNACK.grabAt && t < tl.bannerAt;
  const momentLine = moment ? dockLine(moment) : null;
  // (A turn of his with no move to show: Alfil's fusion was his move.)
  const noMove = !intro && !thinking && !victim && !boss.lastMove ? noMoveLine(mover) : null;
  // (Lights out, before its first round, as the night falls: the dock as on every other screen, your clock held, what
  // it means for you; its rounds take the whole box, with the crowd's meter: LightsDock.)
  const lightsStart = !!lights && lightsStatus(lights, match.settings.lateGraceMs, now).key === "start";
  const dock = useMemo(
    () => (
      <BossDock
        match={match}
        side={boss.crowdSide}
        cues={kingCues}
        wide={!!lights && !lightsStart}
        panel={layout.strip ? <BossPanel match={match} hushLast={hush} /> : undefined}
        gagAt={gagAt}
        status={
          lights && !lightsStart ? (
            // (Lights out: the round's prompt, whole, for the whole round, and the crowd's meter.)
            <LightsDock lights={lights} graceMs={match.settings.lateGraceMs} now={now} />
          ) : (
          <>
            <span class="dock-line">
              {/* (Nothing his bubble or a banner says at the same moment: Hollow's claim and Big Boy's snack line are
                  his bubble's; the dock says what the snack means for you. A power's moment: its banner names it, so
                  the dock keeps the turn's own line, unless the moment has words of its own for you, dockLine.) */}
              {rushLines ? (
                <>
                  <BossTag boss={boss} />: <strong>{rushLines.line}</strong>
                </>
              ) : lightsStart ? (
                <strong>Remember where his pieces are.</strong>
              ) : snacking ? (
                <>
                  <BossTag boss={boss} />: <strong>You start a pawn down.</strong>
                </>
              ) : intro ? (
                <strong>{boss.raid ? (alone ? "You vs the boss." : "All of you vs the boss.") : finalistsLine()}</strong>
              ) : fall ? (
                // (Beaten, the Hidden Boss collapses and mumbles before the result.)
                <>
                  🏆 <strong>You beat him!</strong>
                </>
              ) : funMove?.move ? (
                // (Short enough for a phone's dock with the move in it: his icon says who.)
                <>
                  {/* (Only his picture here, as the line always had: the name would push "Not scored." out of a phone's dock.) */}
                  <BossFace boss={own("clown")} class="boss-tag-face" label={own("clown").name} live /> Plays <strong>your</strong> move{funPlayed ? <>: <strong>{funMove.san}</strong></> : "…"}
                </>
              ) : momentLine ? (
                <>
                  <BossTag boss={casterOf(boss, moment)} />: <strong>{momentLine}</strong>
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
                  {/* (A floor of several: the boss to move, by name.) */}
                  <Dots /> <strong>{sideOf(boss) ? boss.name : "The boss"}</strong> is thinking…
                </>
              ) : boss.lastMove ? (
                <>
                  {/* (His reveal isn't named until the paint drips: "Boss plays …", smudgyFen's `hush`.) */}
                  <PlaysLine boss={mover} san={smudgy?.hush ? "…" : boss.lastMove.san} />
                </>
              ) : noMove ? (
                <>
                  <BossTag boss={mover} />: <strong>{noMove}</strong>
                </>
              ) : null}
            </span>
            <span class="dock-line muted">
              {rushLines
                ? rushLines.sub
                : lightsStart
                ? "Clocks stopped."
                : intro
                ? // (A boss that never strikes, the Hidden Boss, and Boss Battle alone or in a party: nothing about strikes.)
                  bossRules(boss)?.noStrikes || match.settings.bossNoStrikes
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
    ),
    [match, still, kingCues, lights, lights ? now : 0, rushLines?.line, rushLines?.sub, snacking, funPlayed, momentLine, burnLine, left, noMove, hush, layout.strip, gagAt],
  );
  return (
    <div class={`screen game boss-screen${bossFramed(match) ? " bf-frame" : ""}${victim ? " striking" : ""}`}>
      {hud}
      {/* (No line above the board: the dock says what's happening, and "You beat him!", "The boss is thinking…", "Struck down"
          and "Boss plays" say what the old line did, Eric, Oct 24.) */}
      <div class={`board-area${slam ? " pw-slam" : ""}${jolt === "crash" ? " pw-crash" : jolt === "bump" ? " pw-bump" : ""}`}>
        <div class={`board-row${fun.spin === "half" ? " pw-flipping" : fun.spin ? ` pw-turning-${fun.spin}` : ""}`}>
          {bossSide}
          <EvalBar fen={evalFen} orientation={orientation === "white" ? "w" : "b"} evaluate={(f) => match.evaluate(f)} />
          <Board fen={boardFen} orientation={orientation} turn={view.turn} lastMove={pig?.lastMove ?? revised?.lastMove ?? (swapped ? swapped.lastMove : hangOn ? hangOn.lastMove : lastShown)} animate={!rush && !bounceShown && !splitStill(split, now) && !swapStill(moments, now) && !birdie?.still && !pig?.still && !stranger?.still && !alfil && !hopper && !smudgy?.still} elephants={intro ? undefined : onSide(boss, (b) => b.powers?.elephants)} gold={intro ? undefined : zebraGold(own("zebra"), moments, now)} decor={gardener?.decor ?? (intro ? undefined : battleDecor(boss, { moments, now, burnt, since: burnAt }))} premove={{ key: seatKey(match, boss.board.id, boss.crowdSide), side: boss.crowdSide, watch: !!lights || !!rush || !!loading || gagAt !== undefined, hold: gagAt !== undefined }}>
            {/* (A floor of several: every boss's marks, each from his own part of the view with his own moments: audit 2, finding 1.) */}
            {!intro && partsOf(boss).map((b) => <PowerBoard key={b.id} boss={b} orientation={orientation} moments={sideOf(boss) ? moments.filter((m) => !m.boss || m.boss === b.id) : moments} now={now} fen={boardFen} />)}
            {rush && <RushLayer boss={boss} view={rush} now={now} orientation={orientation} onPlace={(from, to) => match.rushPlace(from, to)} />}
            {dodge && <DodgeLayer boss={boss} run={dodge} now={now} onPick={(sq) => match.dodgeVote(sq)} />}
            {lights && <LightsOutLayer boss={boss} lights={lights} now={now} orientation={orientation} graceMs={match.settings.lateGraceMs} onTap={(sq) => match.lightsTap(sq)} />}
            {wipPower() && <WipPreview fen={fenShown} orientation={orientation} crowd={boss.crowdSide} />}
            <PowerMoment boss={boss} moment={moment} now={now} orientation={orientation} side={boss.crowdSide} />
            {/* (Dash's "Hang on" on the board's middle, his whole routine there: a portal on the page's top layer.) */}
            {gagAt !== undefined && <DashHangOn key={gagAt} at={gagAt} />}
            {mateKing && <KingAttack boss={mover} square={mateKing} orientation={orientation} startAt={attackAt} now={now} seed={`mate:${boss.board.fen}`} king={boss.crowdSide} />}
            <FireBurn burnt={burnt} since={burnAt} now={now} orientation={orientation} />
            {claimed && t >= tl.claimAt && t < tl.bannerAt && <ClaimDark boss={boss} since={mountedAt + tl.claimAt} now={now} />}
            {snack && t >= tl.claimAt && t < tl.bannerAt && <SnackTime boss={boss} since={snackAt} now={now} orientation={orientation} />}
            {intro && t >= tl.bannerAt && <FightBanner text="START!" sound="bannerStart" ms={tl.total - tl.bannerAt} />}
            {/* (The queen banners are silent for now: Eric, Oct 11, the gasp sounded wrong. Its file is kept, unused:
                queenGasp in sound.ts, public/sounds/banner/queen-gasp.mp3.) */}
            {queenBanner?.kind === "slain" && <FightBanner key={queenBanner.key} tone="hero" face={<GodKingPortrait side={boss.crowdSide} />} text="QUEEN SLAIN!" sub={`You take ${bossInText(boss.name)}'s queen`} ms={bossBannerMs()} />}
            {queenBanner?.kind === "down" && <FightBanner key={queenBanner.key} tone="boss" face={<BossFace boss={mover} />} text="QUEEN DOWN!" sub={`${bossInText(mover.name, true)} takes your queen`} ms={bossBannerMs()} />}
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
                  <BossTag boss={boss} /> struck down
                </span>
                <strong class="boss-strike-name">{name(victim)}</strong>
              </div>
            )}
            <TowerBoardLives match={match} />
          </Board>
        </div>
      </div>
      {dock}
      {under}
    </div>
  );
}

