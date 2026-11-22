import { SOLO_ABANDON, bossDef } from "@chessroyale/core";
import { useEffect, useRef, useState } from "preact/hooks";
import { forfeitKeptSolo } from "../account.ts";
import { useAccount } from "../screens/Profile.tsx";
import { forfeitAsk, keptMoves, keptReal, onForfeitAsk, resumeKeptSolo, type KeptSolo } from "../solo-kept.ts";
import { BossPortrait } from "./BossPortrait.tsx";
import { Confirm } from "./MatchMenu.tsx";

/** The boss's name as the card says it (the kit's; "the boss" for one this version doesn't know). */
const bossName = (id: string): string => bossDef(id)?.name ?? "the boss";

/** What a Forfeit does now, by your moves (SOLO_ABANDON.minMoves): a loss past the mark, nothing under it. */
export const forfeitNote = (k: KeptSolo): string =>
  keptReal(k) ? "Forfeiting counts as a loss." : `Under ${SOLO_ABANDON.minMoves} moves, forfeiting doesn't count.`;

/**
 * "You have a game in progress" (Eric, Nov 22, step 2): a solo boss battle this device kept (solo-kept.ts), on the app's load and as
 * Boss Battle opens (account.ts `soloKept`): the boss, your move number, Resume and Forfeit, side by side (nothing behind another tap,
 * docs/rules/eric.md). Over every screen, the confirm's card on its blurred layer; it waits for one of the two (no tap away). With it,
 * the question another solo game's start asks first while one is kept: "Forfeit your game in progress?" (Cancel, Forfeit).
 */
export function GameInProgress() {
  const { soloKept, profile } = useAccount();
  const [, tick] = useState(0);
  useEffect(() => onForfeitAsk(() => tick((n) => n + 1)), []);
  const ask = forfeitAsk();
  if (ask) {
    const k = ask.kept;
    return (
      <div class="mm-scrim gp-scrim" onClick={() => ask.answer(false)}>
        <Confirm
          heading="Forfeit your game in progress?"
          note={`Your game against ${bossName(k.boss)} (move ${keptMoves(k)}) ends. ${forfeitNote(k)}`}
          go="Forfeit"
          onCancel={() => ask.answer(false)}
          onGo={() => void forfeitKeptSolo(k).then(() => ask.answer(true))}
        />
      </div>
    );
  }
  const k = soloKept && profile && soloKept.user === profile.user.id ? soloKept : null;
  return k ? <KeptCard kept={k} /> : null;
}

function KeptCard({ kept: k }: { kept: KeptSolo }) {
  const resume = useRef<HTMLButtonElement>(null);
  // (Focus on Resume: Enter or a stray tap never forfeits.)
  useEffect(() => resume.current?.focus(), []);
  const def = bossDef(k.boss);
  const name = bossName(k.boss);
  return (
    <div class="mm-scrim gp-scrim">
      <div class="mm-confirm gp-card" role="alertdialog" aria-modal="true" aria-labelledby="gp-title" aria-describedby="gp-note" data-testid="game-in-progress">
        <p class="gp-title" id="gp-title">
          You have a game in progress
        </p>
        <div class="gp-boss">
          {def && <BossPortrait boss={{ name: def.name, icon: def.icon }} class="gp-face" label="" />}
          <span class="gp-line">
            {name} · Move {keptMoves(k)}
          </span>
        </div>
        <p class="gp-note" id="gp-note">
          {forfeitNote(k)}
        </p>
        <div class="mm-confirm-actions">
          <button type="button" class="mm-btn" onClick={() => void forfeitKeptSolo(k)}>
            Forfeit
          </button>
          <button type="button" class="mm-btn gp-resume" ref={resume} onClick={() => resumeKeptSolo(k)}>
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
