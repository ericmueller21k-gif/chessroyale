import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { memo } from "preact/compat";
import { BOSS_POWERS } from "@chessroyale/core";
import { bossRules } from "@chessroyale/chess";
import { account } from "../account.ts";
import type { GameView, StrikeState } from "../game.ts";
import { kingSay, kingVoice, setKingFallen, type KingCue } from "../godKing.ts";
import { play, warmSounds } from "../sound.ts";
import { TICK_FROM_SECONDS, useFrameNow } from "./Countdown.tsx";
import { GodKingFallen, GodKingSprite, kingCommandAct } from "./GodKing.tsx";
import type { GodKingAnim } from "../characters/god-king.ts";
import { Chevrons, type useHistoryView } from "./HistoryNav.tsx";
import { COMPUTER_LAYOUT } from "./MatchMenu.tsx";
import { Bolt } from "./PowerUpButton.tsx";
import { useMedia } from "./QuickChat.tsx";
import { VoiceBubble } from "../speech.tsx";
import { clockShown } from "../clock-text.ts";
import { bulletIncrementOn, kingBlocked, mockKingHelp } from "./Recluse.tsx";
import { RaceBadge } from "./Hopper.tsx";

/**
 * Boss battle: everything below the board, the same on every screen (your move,
 * the reveal, the boss's turn) so nothing moves from one to the next:
 *
 * - one row, the board's width and lined up with its edges: the arrows for
 *   stepping through the game either side of a status box. In the box, centered,
 *   what's happening right now (two lines at most), or which move you're looking
 *   at while you step back; at its right, your clock, always there (DockClock); during Chub & Chirp's carrot race,
 *   the race's count (RaceBadge): at the box's left where it has the room, else at the left of the God King's line;
 * - the God King himself, standing by and breathing, with his charges at his
 *   feet: on a phone, on a line of his own under the row (beside it where the
 *   screen has room right of the board). He says a few words now and then (`cues`). Tap him
 *   and his commands pop up above his head, like an old Final Fantasy battle
 *   menu: play this move, or strike the boss. Tap him again to close it.
 *   After his Last Stand he lies there fallen, and the charges he had left are
 *   the crowd's power-ups: a ⚡ button with the count, above his fallen figure,
 *   where his menu was (the engine's top 3 moves, as in Crowd).
 *
 * On a computer (styles.css, .boss-dock) the God King stands by the board's
 * bottom-right corner instead, facing the boss across the board (Eric, Oct 11);
 * his words and menu open outwards there.
 */
export function BossDock({
  match,
  nav,
  canCall = false,
  strike,
  status,
  wide = false,
  side = "w",
  cues = [],
  away = false,
  leaping = false,
  command,
  fallen: fallenNow,
  charges: chargesShown,
  powerUp,
  king,
  clock,
}: {
  match: GameView;
  /** Your move: step back through the game (the arrows are grayed out elsewhere). */
  nav?: { view: ReturnType<typeof useHistoryView>; total: number };
  canCall?: boolean;
  strike?: StrikeState;
  status: ComponentChildren;
  /** The status takes the whole row, no « » (Hollow's Lights out: his prompt and the crowd's meter need the room). */
  wide?: boolean;
  /** The crowd's color, for the God King's armor. */
  side?: "w" | "b";
  /** What just happened, most important first: he may say something about the first that speaks. */
  cues?: { cue: KingCue; key: string }[];
  /** He's on the board right now (summoned), not standing by. */
  away?: boolean;
  /** His Last Stand: he leaps up out of the dock onto the board. */
  leaping?: boolean;
  /** He's commanding from his spot (KingCommand): what, and when he started (a Date.now() value). */
  command?: { mode: "move" | "strike"; startAt: number };
  /** He has fallen (after his Last Stand); by default, once it has happened. The reveal where it happens times it. */
  fallen?: boolean;
  /** The crowns to show, if not the battle's (the reveal of his Last Stand shows the ones he had until he leaps). */
  charges?: number;
  /**
   * Your move, once he has fallen: the ⚡ power-ups he left you can be used (`enabled`), and whether one is in use
   * this move (its arrows are on the board). Other screens just show how many you hold.
   */
  powerUp?: { enabled: boolean; inUse: boolean };
  /**
   * What he shows instead of standing by, never to be called (the Hidden Boss's phase change: triumphant, drained, fading
   * as the boss absorbs him), or "gone": absorbed, his place empty for the rest of the fight (phase 2), his words gone
   * with him (a bubble from an empty place read as a slip).
   */
  king?: KingShow;
  /**
   * Your clock at the status box's right (DockClock): your move's, counting down. Left out, it holds where your last move
   * stopped it (the boss's turn, the reveal, the waiting); null: none on this screen.
   */
  clock?: DockClockRun | null;
}) {
  const boss = match.boss;
  const fallen = fallenNow ?? !!boss?.lastStand;
  const charges = fallen ? 0 : (chargesShown ?? boss?.kingCharges ?? 0);
  // His leftover charges, as your power-ups (one in use this move already counts as spent).
  const held = match.practice ? Infinity : (match.standings().find((s) => s.isYou)?.powerUps ?? 0);
  const inUse = !!powerUp?.inUse;
  const left = inUse ? Math.max(0, held - 1) : held;
  const enabled = !!powerUp?.enabled && !inUse && left > 0;
  const [menu, setMenu] = useState(false);
  // (His unit is drawn again only when what it shows changes: the same values, the same objects and callbacks.)
  const power = useMemo(() => (fallen && (left > 0 || inUse) ? { left, inUse, enabled } : null), [fallen, left, inUse, enabled]);
  const onPower = useCallback(() => {
    play("menuSelect");
    match.usePowerUp();
  }, [match]);
  const onTap = useCallback(() => {
    play(menu ? "menuClose" : "menuOpen");
    setMenu(!menu);
  }, [menu]);
  // (A computer has the admins' testing items in the title line instead: Hud.tsx, .match-tools.)
  const computer = useMedia(COMPUTER_LAYOUT);
  // (The God King beside the row, not under it: lineUpWithBoard measures the room.)
  const [beside, setBeside] = useState(false);
  // Chub & Chirp's carrot race count: in the status box where it has the room (a computer, or the God King beside the
  // row), else at the left of the God King's line under the row (a phone: the box keeps the room for its words).
  const raceInBox = computer || beside;
  const view = nav?.view;
  const moveNo = (p: number) => `${Math.ceil(p / 2)}${p % 2 === 1 ? "" : "…"}`;
  const ready = canCall && charges > 0 && !match.kingCalled && !fallen && !king;
  const cueKey = cues.map((c) => c.key).join("|");
  // Fallen, he says nothing more (but his last words, and his return if the crowd wins).
  useEffect(() => setKingFallen(fallen), [fallen]);
  useEffect(() => {
    for (const c of cues) if (kingSay(c.cue, c.key)) break;
  }, [cueKey]);
  // The menu closes by itself once he can't be called (time ran out, the move went in).
  useEffect(() => {
    if (!ready) setMenu(false);
  }, [ready]);
  const dockRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => lineUpWithBoard(dockRef.current!, setBeside), []);
  // (His "can't" made ahead in the sound worker, so its first tap never stalls a slow phone.)
  useEffect(() => warmSounds(["kingCant"]), []);
  return (
    <>
    <div class="boss-dock" ref={dockRef}>
      <div class={`history-nav boss-dock-main${view?.browsing ? " browsing" : ""}${wide ? " wide" : ""}`}>
        {!wide && (
          <button type="button" class="nav-btn" aria-label="Previous move" disabled={!view || view.ply === 0} onClick={() => view?.go(view.ply - 1)}>
            <Chevrons back />
          </button>
        )}
        <div class="boss-dock-status">
          {/* (Chub & Chirp's carrot race: the count and your moves left, at the box's left, for as long as it's on.) */}
          {!wide && raceInBox && <RaceBadge boss={boss} />}
          <div class="dk-text" role="status" aria-live="polite">
            {view?.browsing ? (
              <button type="button" class="history-label" onClick={() => view.live()} aria-label="Back to the live position">
                Move {moveNo(view.ply)} · {view.ply}/{nav!.total} · back to live
              </button>
            ) : (
              status
            )}
          </div>
          {/* (Lights out's prompt takes the whole box, as it takes the arrows' room.) */}
          {!wide && clock !== null && <DockClock match={match} boss={boss} run={clock} />}
        </div>
        {!wide && (
          <button type="button" class="nav-btn" aria-label="Next move" disabled={!view?.browsing} onClick={() => view?.go(view.ply + 1)}>
            <Chevrons />
          </button>
        )}
      </div>
      {!wide && !raceInBox && <RaceBadge boss={boss} below />}
      <GodKingUnit
        show={king}
        side={side}
        charges={charges}
        ready={ready}
        away={away}
        leaping={leaping}
        command={command}
        fallen={fallen}
        power={power}
        onPower={onPower}
        menu={
          menu && ready ? (
            <CommandMenu
              strike={strike}
              struck={!!boss?.staggerNext}
              onPick={(s) => {
                play("menuSelect");
                setMenu(false);
                // (The Hidden Boss: the God King's help doesn't work against him. He mocks the try, and it spends the
                // charge as if it had worked: callKing.)
                if (boss && kingBlocked(boss)) mockKingHelp(boss);
                match.callKing(s);
              }}
            />
          ) : null
        }
        onTap={onTap}
      />
    </div>
    {!computer && <UltimateTest match={match} />}
    {!computer && <EngineMove match={match} />}
    {!computer && <BrainDebug match={match} />}
    </>
  );
}

/** The room right of the board the God King needs to stand beside the dock's row on a phone: his 58 px and a gap. */
export const KING_BESIDE_PX = 66;

/** Where an element's box starts across the page, without transforms (a board that shakes or turns keeps its place). */
function pageLeft(el: HTMLElement): number {
  let x = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) x += e.offsetLeft;
  return x;
}

/**
 * The dock's row lined up with the board (Eric, Oct 15: "exactly the board's width and aligned with the board's left and
 * right edges", on every screen): the board as drawn (its squares, a whole number of device pixels, written by the board
 * itself) or, when the board's place holds more than one (the Hidden Boss's phase 2 on a computer), that place. Written
 * on the dock as --dk-left and --dk-w before the first paint, and again whenever either changes size (the scoreboard
 * opened or closed, the window turned); styles.css places the row and the God King by them. Where the screen's column
 * has KING_BESIDE_PX right of the board, the God King stands beside the row (`dk-beside`); otherwise under it (Eric,
 * Oct 15: decided by the room there is, not the device).
 */
function lineUpWithBoard(dock: HTMLElement, onBeside?: (beside: boolean) => void): (() => void) | void {
  const wrap = dock.parentElement?.querySelector<HTMLElement>(".board-area .board-row > .board-wrap");
  if (!wrap) return;
  const board = wrap.querySelector<HTMLElement>(":scope > .hb > .hb-container") ?? wrap;
  const place = () => {
    const left = pageLeft(board) - pageLeft(dock);
    const width = board.offsetWidth;
    dock.style.setProperty("--dk-left", `${left}px`);
    dock.style.setProperty("--dk-w", `${width}px`);
    // (Room in the screen's column right of the board for the God King: he stands beside the row, not under it.)
    const beside = dock.clientWidth - left - width >= KING_BESIDE_PX;
    dock.classList.toggle("dk-beside", beside);
    onBeside?.(beside);
  };
  place();
  const watch = new ResizeObserver(place);
  watch.observe(board);
  watch.observe(dock);
  return () => watch.disconnect();
}

/** Your move's clock (BossDock's `clock`): it runs from `startsAt` to `deadline`, standing still while `frozen`. */
export type DockClockRun = { startsAt: number; deadline: number; frozen?: { at: number; until: number } };

/** What's left on a running clock at `now` (ms). */
export const clockLeft = (run: DockClockRun, now: number): number =>
  Math.max(0, run.deadline - (run.frozen && now >= run.frozen.at && now < run.frozen.until ? run.frozen.until : Math.max(now, run.startsAt)));


/** Where each match's dock clock stopped: it holds there between your moves, whichever screen shows it. */
const held = new WeakMap<object, { run: DockClockRun | null; ms: number | null }>();

/** How long the "+2" of the bullet clock's increment shows beside the clock as your move begins (ms). */
export const DOCK_PLUS_MS = 1600;

/**
 * Your clock, bold at the status box's right, the same on every boss battle screen (Eric, Oct 15: "never disappears or
 * jumps between moves"): on your move, counting down (red from TICK_FROM_SECONDS); otherwise, dimmed, what you had
 * left when your move went in. Under the Hidden Boss's bullet clock with its increment, a move begins with the 2 s
 * added, and a brief "+2" beside the number says so. It re-renders itself, once each time the second shown changes;
 * the screen around it doesn't.
 */
export function DockClock({ match, boss, run }: { match: GameView; boss: GameView["boss"]; run?: DockClockRun }) {
  let h = held.get(match);
  if (!h) held.set(match, (h = { run: null, ms: null }));
  const now = Date.now();
  // (The first look after your move went in: what was left then is what it holds.)
  if (run) h.run = run;
  const ms = h.run ? clockLeft(h.run, now) : h.ms;
  if (!run && h.run) h.run = null;
  h.ms = ms;
  const [, setShown] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setShown(Math.ceil(clockLeft(run, Date.now()) / 1000)), 200);
    return () => clearInterval(t);
  }, [run?.startsAt, run?.deadline, run?.frozen?.until]);
  // (Before your first move of the battle there's nothing to hold yet: none, and the words have the whole box.)
  if (ms === null) return null;
  const inc = run ? bulletIncrementOn(boss) : 0;
  const plus = inc > 0 && now - run!.startsAt < DOCK_PLUS_MS;
  const low = !!run && Math.ceil(ms / 1000) <= TICK_FROM_SECONDS;
  return (
    <span class={`dk-clock${run ? " running" : " held"}${low ? " low" : ""}`} role="timer" aria-label={`Your clock: ${clockShown(ms)}`}>
      {plus && (
        <span class="dk-plus" key={run!.startsAt} aria-hidden="true">
          +{inc}
        </span>
      )}
      <span class="dk-time" aria-hidden="true">
        {clockShown(ms)}
      </span>
    </span>
  );
}

/**
 * Testing, admins only (ADMIN_EMAILS, as for the fair-play review; online the server checks too): a small plain button
 * that brings the boss's ultimate as the next crowd turn begins, without the warning. Grayed out while one is on its
 * way or under way (its effect still running); ready again once it's over, as the meter fills again. Gone once a
 * once-a-battle ultimate has come (`ultimateOnce`: Chub & Chirp's Carrot Patch), or the last of a boss's few
 * (`ultimateMax`: Smudgy's second Repaint), whose trigger then refuses: a press would wait for nothing.
 * BOSS_POWERS.ultimateTestButton false removes it. A phone: under the dock; a computer: in the title line (Hud.tsx).
 */
export function UltimateTest({ match }: { match: GameView }) {
  const boss = match.boss;
  const p = boss?.powers;
  // (A press is for the next ultimate only: once it has come, the button is ready again.)
  const key = boss ? `${boss.id}:${boss.startMove}:${boss.board.generation}:${p?.ults ?? 0}` : "";
  const [pressed, setPressed] = useState("");
  // (The Hidden Boss's phase 2: his own ultimate, the few seconds a move.)
  const simul = match.simul;
  if (BOSS_POWERS.ultimateTestButton && account().profile?.admin && simul) {
    if (!simul.playing || simul.decided) return null;
    return (
      <button type="button" class="ult-test" disabled={simul.ultAt !== null} onClick={() => match.triggerUltimate()}>
        {simul.ultAt !== null ? "Ultimate under way (testing)" : "Trigger ultimate (testing)"}
      </button>
    );
  }
  if (!BOSS_POWERS.ultimateTestButton || !account().profile?.admin || !boss || !p || boss.result || match.bossNote != null || (bossRules(boss)?.ultimateOnce && p.ults) || (p.ults ?? 0) >= (bossRules(boss)?.ultimateMax ?? Infinity)) return null;
  // (Hollow's Lights out: the full meter has it on its way until the test has begun.)
  const lights = p.ultimate === "lightsout";
  const underWay = p.ultAt !== null && (!lights || (p.lightsAt != null && p.lightsAt >= p.ultAt));
  const coming = !underWay && (!!p.ultNext || p.warned || (lights && p.ultAt !== null) || pressed === key);
  return (
    <button
      type="button"
      class="ult-test"
      disabled={underWay || coming}
      onClick={() => {
        setPressed(key);
        match.triggerUltimate();
      }}
    >
      {underWay ? "Ultimate under way (testing)" : coming ? "Ultimate next turn (testing)" : "Trigger ultimate (testing)"}
    </button>
  );
}

/**
 * Testing, admins only, Boss alone (Eric, Oct 14): "Engine move" plays Stockfish's best move for you (SoloMatch.engineMove).
 * Waits while it searches and when it isn't your move. A phone: under the dock; a computer: in the title line (Hud.tsx).
 */
export function EngineMove({ match }: { match: GameView }) {
  // (The Hidden Boss's phase 2 too: on your board, while it's your move there.)
  const simul = match.simul;
  if (!match.engineMoveShown || !match.engineMove || (match.boss?.result && !simul)) return null;
  if (simul && (simul.decided || !simul.playing)) return null;
  const ready = simul ? simul.playing && simul.boards[0]?.toMove === "crowd" : match.phase.kind === "play";
  return (
    <button type="button" class="engine-move" disabled={!ready || !!match.engineThinking} onClick={() => match.engineMove?.()}>
      Engine move
    </button>
  );
}

/**
 * Testing, admins (Boss alone): the boss's brain at work, e.g. "Maia 1450 · no guard · Maia's #1 · 120 ms"; and
 * Wrangler's showdown when the test trigger fired it outside the band (none inside it found), so it isn't taken for one
 * a player would get. A phone: a line under the dock; a computer: a small pill in the title line (Hud.tsx), the first
 * thing to shrink there.
 */
export function BrainDebug({ match }: { match: GameView }) {
  const p = match.boss?.powers;
  const outside = p?.showdown?.outside && p.showdown.turn === p.turn ? "Showdown (test: outside the band)" : null;
  const line = [match.brainLine, outside].filter(Boolean).join(" · ");
  if (!line || !account().profile?.admin) return null;
  return (
    <div class="brain-debug" aria-label="Boss brain (testing)" title={line}>
      🧠 {line}
    </div>
  );
}

/** The God King's place in the dock shown another way (BossDock's `king`). */
export type KingShow = { anim: GodKingAnim; since: number; then?: GodKingAnim; class: string } | "gone";

/** How long his "can't" shake and dimming last (ms; styles.css, .gk-unit.nope). */
const NOPE_MS = 400;

/**
 * The God King standing by: breathing, his sword swaying, his charges at his feet; his words in a bubble above. Drawn
 * again when what it shows changes (memo), not with the screen around it (a boss screen draws every frame).
 */
const GodKingUnit = memo(function GodKingUnit({
  show,
  side,
  charges,
  ready,
  away,
  leaping,
  command,
  fallen,
  power,
  onPower,
  menu,
  onTap,
}: {
  show?: KingShow;
  side: "w" | "b";
  charges: number;
  ready: boolean;
  away: boolean;
  leaping: boolean;
  command?: { mode: "move" | "strike"; startAt: number };
  fallen: boolean;
  power: { left: number; inUse: boolean; enabled: boolean } | null;
  onPower: () => void;
  menu: ComponentChildren;
  onTap: () => void;
}) {
  // He draws again every frame only while a command or his "can't" plays. Otherwise he rests: his figure animates
  // itself (GodKingSprite), his words keep themselves current (VoiceBubble).
  const now = Date.now();
  const [nopeAt, setNopeAt] = useState(0);
  const nope = nopeAt > 0 && now - nopeAt < NOPE_MS;
  useFrameNow(!!command || nope);
  // Commanding from his spot: his sword raised, then his bolt or his slashes (in step with KingCommand on the board).
  const act = command ? kingCommandAct(command.mode, command.startAt, now) : undefined;
  // His leap (his Last Stand) plays from when it starts.
  const leapAt = useMemo(() => (leaping ? Date.now() : 0), [leaping]);
  if (show) {
    // (The Hidden Boss absorbs him: his aura behind him, his figure as the phase change says, motes as he fades; his place
    // kept, empty once he's gone, so the dock doesn't move. Gone, his words go with him: no bubble from an empty place.)
    const gone = show === "gone";
    return (
      <div class={`gk-unit ${gone ? "gone" : show.class}`}>
        <VoiceBubble voice={kingVoice} class="gk-bubble" hidden={gone} />
        <span class="gk-unit-btn" role={gone ? undefined : "img"} aria-label={gone ? undefined : "The God King"} aria-hidden={gone ? "true" : undefined}>
          {!gone && (
            <>
              <i class="gk-aura" />
              <GodKingSprite side={side} anim={show.anim} since={show.since} then={show.then} class="absorbed" />
              <span class="gk-motes">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </>
          )}
        </span>
        <span class="gk-unit-charges">{!gone && charges > 0 ? "👑".repeat(charges) : ""}</span>
      </div>
    );
  }
  if (fallen) {
    // After his Last Stand: his fallen figure, on his side, cracked and grayed. No menu, no crowns; the charges he
    // had left are your power-ups, in a ⚡ button above him (the whole column is the button).
    const count = power ? (power.left === Infinity ? "∞" : String(power.left)) : "";
    return (
      <div class={`gk-unit fallen${power ? " has-power" : ""}`}>
        <VoiceBubble voice={kingVoice} class="gk-bubble" />
        {power && (
          <button
            type="button"
            class={`gk-power${power.enabled ? " ready" : ""}${power.inUse ? " in-use" : ""}`}
            disabled={!power.enabled}
            onClick={onPower}
            aria-label={
              power.inUse ? "Power-up in use: the engine's top 3 moves" : power.enabled ? `Use a power-up: the engine's top 3 moves (${count} left)` : `Power-ups: ${count}`
            }
          >
            <span class="gk-power-pill">
              <Bolt />
              {count}
            </span>
          </button>
        )}
        <span class="gk-unit-btn" role="img" aria-label="The God King has fallen">
          <GodKingFallen side={side} />
        </span>
        {!power && <span class="gk-unit-charges" />}
      </div>
    );
  }
  // No charges left (Eric, Oct 15): a tap gets his soft "can't" and a tiny shake, dimmed a moment; nothing else.
  const spent = charges <= 0 && !away && !leaping && !act;
  return (
    <div class={`gk-unit${ready ? " ready" : ""}${away ? " away" : ""}${leaping ? " leaping" : ""}${act ? " acting" : ""}${charges <= 0 ? " spent" : ""}${menu ? " open" : ""}${nope ? " nope" : ""}`}>
      {menu}
      <VoiceBubble voice={kingVoice} class="gk-bubble" hidden={!!menu || away || leaping} />
      <button
        type="button"
        class="gk-unit-btn"
        disabled={!ready && !spent}
        onClick={() => {
          if (ready) return onTap();
          play("kingCant");
          setNopeAt(Date.now());
        }}
        aria-label={ready ? "God King: tap to summon him" : spent ? "God King: no charges left" : "God King"}
      >
        <GodKingSprite
          side={side}
          anim={leaping ? "leap" : (act?.anim ?? "idle")}
          since={leaping ? leapAt : (act?.since ?? 0)}
          then={leaping ? undefined : act?.then}
          class={leaping ? "leap" : act ? "act" : "idle"}
        />
      </button>
      <span class="gk-unit-charges" aria-label={`${charges} charges left`}>
        {charges > 0 ? "👑".repeat(charges) : "—"}
      </span>
    </div>
  );
});

/**
 * His commands, in a little window above his head like an old Final Fantasy
 * battle menu: a ▶ cursor on the command you're pointing at.
 */
function CommandMenu({ strike, struck, onPick }: { strike?: StrikeState; struck: boolean; onPick: (strike: boolean) => void }) {
  const [at, setAt] = useState(0);
  const strikeOff = struck || !!strike?.mine;
  const items = [
    { label: "Play move", note: "Full strength. Uses your turn.", off: false, strike: false },
    { label: "Strike", note: struck ? "Already struck." : strike?.mine ? `Called ${strike.calls}/${strike.needed}.` : "Weakens its next move.", off: strikeOff, strike: true },
  ];
  return (
    <div class="gk-command" role="menu" aria-label="God King commands">
      {items.map((it, i) => (
        <button
          type="button"
          role="menuitem"
          key={it.label}
          class={`gk-command-item${at === i ? " at" : ""}`}
          disabled={it.off}
          onPointerEnter={() => !it.off && at !== i && (play("menuOpen"), setAt(i))}
          onFocus={() => setAt(i)}
          onClick={() => onPick(it.strike)}
        >
          <span class="gk-command-label">{it.label}</span>
          <span class="gk-command-note">{it.note}</span>
        </button>
      ))}
    </div>
  );
}

/** The three waiting dots, for a status line. */
export function Dots() {
  return (
    <span class="waiting-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
