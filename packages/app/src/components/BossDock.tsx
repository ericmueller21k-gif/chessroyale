import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { GameView, StrikeState } from "../game.ts";
import { kingLine, kingSay, type KingCue } from "../godKing.ts";
import { play } from "../sound.ts";
import { useFrameNow } from "./Countdown.tsx";
import { GodKingSprite } from "./GodKing.tsx";
import { Chevrons, type useHistoryView } from "./HistoryNav.tsx";

/**
 * Boss battle: everything below the board, the same on every screen (your move,
 * the reveal, the boss's turn) so nothing moves from one to the next:
 *
 * - on the left, a row for stepping through the game, and one status line (two
 *   at most) saying what's happening right now;
 * - on the right, the God King himself, standing by and breathing, with his
 *   charges at his feet. He says a few words now and then (`cues`). Tap him
 *   and his commands pop up above his head, like an old Final Fantasy battle
 *   menu: play this move, or strike the boss. Tap him again to close it.
 */
export function BossDock({
  match,
  nav,
  canCall = false,
  strike,
  status,
  side = "w",
  cues = [],
  away = false,
}: {
  match: GameView;
  /** Your move: step back through the game (the arrows are greyed out elsewhere). */
  nav?: { view: ReturnType<typeof useHistoryView>; total: number };
  canCall?: boolean;
  strike?: StrikeState;
  status: ComponentChildren;
  /** The crowd's colour, for the God King's armour. */
  side?: "w" | "b";
  /** What just happened, most important first: he may say something about the first that speaks. */
  cues?: { cue: KingCue; key: string }[];
  /** He's on the board right now (summoned), not standing by. */
  away?: boolean;
}) {
  const boss = match.boss;
  const charges = boss?.kingCharges ?? 0;
  const [menu, setMenu] = useState(false);
  const view = nav?.view;
  const moveNo = (p: number) => `${Math.ceil(p / 2)}${p % 2 === 1 ? "" : "…"}`;
  const ready = canCall && charges > 0 && !match.kingCalled;
  const cueKey = cues.map((c) => c.key).join("|");
  useEffect(() => {
    for (const c of cues) if (kingSay(c.cue, c.key)) break;
  }, [cueKey]);
  // The menu closes by itself once he can't be called (time ran out, the move went in).
  useEffect(() => {
    if (!ready) setMenu(false);
  }, [ready]);
  return (
    <div class="boss-dock">
      <div class="boss-dock-main">
        <div class={`history-nav boss-dock-nav${view?.browsing ? " browsing" : ""}`}>
          <button type="button" class="nav-btn" aria-label="Previous move" disabled={!view || view.ply === 0} onClick={() => view?.go(view.ply - 1)}>
            <Chevrons back />
          </button>
          <div class="nav-middle">
            {view?.browsing ? (
              <button type="button" class="history-label" onClick={() => view.live()} aria-label="Back to the live position">
                Move {moveNo(view.ply)} · {view.ply}/{nav!.total} · back to live
              </button>
            ) : null}
          </div>
          <button type="button" class="nav-btn" aria-label="Next move" disabled={!view?.browsing} onClick={() => view?.go(view.ply + 1)}>
            <Chevrons />
          </button>
        </div>
        <div class="boss-dock-status" role="status" aria-live="polite">
          {status}
        </div>
      </div>
      <GodKingUnit
        side={side}
        charges={charges}
        ready={ready}
        away={away}
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
  );
}

/** The God King standing by: breathing, his sword swaying, his charges at his feet; his words in a bubble above. */
function GodKingUnit({
  side,
  charges,
  ready,
  away,
  menu,
  onTap,
}: {
  side: "w" | "b";
  charges: number;
  ready: boolean;
  away: boolean;
  menu: ComponentChildren;
  onTap: () => void;
}) {
  const now = useFrameNow();
  const line = kingLine(now);
  return (
    <div class={`gk-unit${ready ? " ready" : ""}${away ? " away" : ""}${charges <= 0 ? " spent" : ""}${menu ? " open" : ""}`}>
      {menu ?? (line && !away && <SpeechBubble key={line} text={line} />)}
      <button type="button" class="gk-unit-btn" disabled={!ready} onClick={onTap} aria-label={ready ? "God King: tap to summon him" : "God King"}>
        <GodKingSprite side={side} class="idle" />
      </button>
      <span class="gk-unit-charges" aria-label={`${charges} charges left`}>
        {charges > 0 ? "👑".repeat(charges) : "—"}
      </span>
    </div>
  );
}

/** A pixel speech bubble; the words type themselves out. */
function SpeechBubble({ text }: { text: string }) {
  const [start] = useState(Date.now());
  const now = useFrameNow();
  const shown = Math.min(text.length, Math.floor((now - start) / 28) + 1);
  return (
    <div class="gk-bubble" role="status" aria-label={text}>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      <span class="gk-bubble-rest" aria-hidden="true">
        {text.slice(shown)}
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
