import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { BOSS_POWERS } from "@chessroyale/core";
import { account } from "../account.ts";
import type { GameView, StrikeState } from "../game.ts";
import { kingLine, kingSay, setKingFallen, type KingCue } from "../godKing.ts";
import { play } from "../sound.ts";
import { useFrameNow } from "./Countdown.tsx";
import { GodKingFallen, GodKingSprite, kingCommandAct } from "./GodKing.tsx";
import { Chevrons, type useHistoryView } from "./HistoryNav.tsx";
import { Bolt } from "./PowerUpButton.tsx";
import { SpeechBox } from "../speech.tsx";

/**
 * Boss battle: everything below the board, the same on every screen (your move,
 * the reveal, the boss's turn) so nothing moves from one to the next:
 *
 * - on the left, one row: the arrows for stepping through the game either side
 *   of a status box (two lines at most) saying what's happening right now, or
 *   which move you're looking at while you step back;
 * - on the right, the God King himself, standing by and breathing, with his
 *   charges at his feet. He says a few words now and then (`cues`). Tap him
 *   and his commands pop up above his head, like an old Final Fantasy battle
 *   menu: play this move, or strike the boss. Tap him again to close it.
 *   After his Last Stand he lies there fallen, and the charges he had left are
 *   the crowd's power-ups: a ⚡ button with the count, above his fallen figure,
 *   where his menu was (the engine's top 3 moves, as in Crowd).
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
}: {
  match: GameView;
  /** Your move: step back through the game (the arrows are greyed out elsewhere). */
  nav?: { view: ReturnType<typeof useHistoryView>; total: number };
  canCall?: boolean;
  strike?: StrikeState;
  status: ComponentChildren;
  /** The status takes the whole row, no « » (Hollow's Lights out: his prompt and the crowd's meter need the room). */
  wide?: boolean;
  /** The crowd's colour, for the God King's armour. */
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
}) {
  const boss = match.boss;
  const fallen = fallenNow ?? !!boss?.lastStand;
  const charges = fallen ? 0 : (chargesShown ?? boss?.kingCharges ?? 0);
  // His leftover charges, as your power-ups (one in use this move already counts as spent).
  const held = match.practice ? Infinity : (match.standings().find((s) => s.isYou)?.powerUps ?? 0);
  const inUse = !!powerUp?.inUse;
  const left = inUse ? Math.max(0, held - 1) : held;
  const power = fallen && (left > 0 || inUse) ? { left, inUse, enabled: !!powerUp?.enabled && !inUse && left > 0 } : null;
  const [menu, setMenu] = useState(false);
  const view = nav?.view;
  const moveNo = (p: number) => `${Math.ceil(p / 2)}${p % 2 === 1 ? "" : "…"}`;
  const ready = canCall && charges > 0 && !match.kingCalled && !fallen;
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
  return (
    <>
    <div class="boss-dock">
      <div class={`history-nav boss-dock-main${view?.browsing ? " browsing" : ""}${wide ? " wide" : ""}`}>
        {!wide && (
          <button type="button" class="nav-btn" aria-label="Previous move" disabled={!view || view.ply === 0} onClick={() => view?.go(view.ply - 1)}>
            <Chevrons back />
          </button>
        )}
        <div class="boss-dock-status" role="status" aria-live="polite">
          {view?.browsing ? (
            <button type="button" class="history-label" onClick={() => view.live()} aria-label="Back to the live position">
              Move {moveNo(view.ply)} · {view.ply}/{nav!.total} · back to live
            </button>
          ) : (
            status
          )}
        </div>
        {!wide && (
          <button type="button" class="nav-btn" aria-label="Next move" disabled={!view?.browsing} onClick={() => view?.go(view.ply + 1)}>
            <Chevrons />
          </button>
        )}
      </div>
      <GodKingUnit
        side={side}
        charges={charges}
        ready={ready}
        away={away}
        leaping={leaping}
        command={command}
        fallen={fallen}
        power={power}
        onPower={() => {
          play("menuSelect");
          match.usePowerUp();
        }}
        menu={
          menu && ready ? (
            <CommandMenu
              strike={strike}
              struck={!!boss?.staggerNext}
              onPick={(s) => {
                play("menuSelect");
                setMenu(false);
                match.callKing(s);
              }}
            />
          ) : null
        }
        onTap={() => {
          play(menu ? "menuClose" : "menuOpen");
          setMenu(!menu);
        }}
      />
    </div>
    <UltimateTest match={match} />
    </>
  );
}

/**
 * Testing, admins only (ADMIN_EMAILS, as for the fair-play review; online the server checks too): a small plain button
 * that brings the boss's ultimate as the next crowd turn begins, without the warning. Greyed out once it's on its way
 * or spent. BOSS_POWERS.ultimateTestButton false removes it.
 */
export function UltimateTest({ match }: { match: GameView }) {
  const boss = match.boss;
  const p = boss?.powers;
  const key = boss ? `${boss.id}:${boss.startMove}:${boss.board.generation}` : "";
  const [pressed, setPressed] = useState("");
  if (!BOSS_POWERS.ultimateTestButton || !account().profile?.admin || !boss || !p || boss.result) return null;
  // (Hollow's Lights out: the full meter has it on its way until it has come.)
  const lights = p.ultimate === "lightsout";
  const spent = lights ? p.lightsAt != null : p.ultAt !== null;
  const coming = !spent && (!!p.ultNext || p.warned || (lights && p.ultAt !== null) || pressed === key);
  return (
    <button
      type="button"
      class="ult-test"
      disabled={spent || coming}
      onClick={() => {
        setPressed(key);
        match.triggerUltimate();
      }}
    >
      {spent ? "Ultimate used (testing)" : coming ? "Ultimate next turn (testing)" : "Trigger ultimate (testing)"}
    </button>
  );
}

/** The God King standing by: breathing, his sword swaying, his charges at his feet; his words in a bubble above. */
function GodKingUnit({
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
  const now = useFrameNow();
  const line = kingLine(now);
  // Commanding from his spot: his sword raised, then his bolt or his slashes (in step with KingCommand on the board).
  const act = command ? kingCommandAct(command.mode, command.startAt, now) : undefined;
  // His leap (his Last Stand) plays from when it starts.
  const leapAt = useMemo(() => (leaping ? Date.now() : 0), [leaping]);
  if (fallen) {
    // After his Last Stand: his fallen figure, on his side, cracked and greyed. No menu, no crowns; the charges he
    // had left are your power-ups, in a ⚡ button above him (the whole column is the button).
    const count = power ? (power.left === Infinity ? "∞" : String(power.left)) : "";
    return (
      <div class={`gk-unit fallen${power ? " has-power" : ""}`}>
        {line && <SpeechBox key={line.key} class="gk-bubble" text={line.text} at={line.at} until={line.until} now={now} fits={1} />}
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
  return (
    <div class={`gk-unit${ready ? " ready" : ""}${away ? " away" : ""}${leaping ? " leaping" : ""}${act ? " acting" : ""}${charges <= 0 ? " spent" : ""}${menu ? " open" : ""}`}>
      {menu ?? (line && !away && !leaping && <SpeechBox key={line.key} class="gk-bubble" text={line.text} at={line.at} until={line.until} now={now} fits={1} />)}
      <button type="button" class="gk-unit-btn" disabled={!ready} onClick={onTap} aria-label={ready ? "God King: tap to summon him" : "God King"}>
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
}

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
