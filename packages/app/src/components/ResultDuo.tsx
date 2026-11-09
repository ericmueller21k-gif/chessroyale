import { useEffect, useState } from "preact/hooks";
import { KING_ATTACK } from "@chessroyale/chess";
import type { XpGrant } from "@chessroyale/core";
import type { GameView } from "../game.ts";
import { bossKit } from "../characters/kits.ts";
import { turned } from "../characters/sprite-kit.ts";
import { pawnLook } from "../looks.ts";
import { BossCharacter } from "./BossCharacter.tsx";
import { YourPawn } from "./BossDock.tsx";
import { SpriteAnim } from "./BossEffect.tsx";
import { XpResult } from "./XpResult.tsx";

/**
 * A boss battle's result (Eric, Nov 9: "get rid of the king in the victory and defeat screen entirely … it always shows our pawn
 * piece and the boss. And then if we lost, it shows him … attack animation on us"; docs/decisions/2026-11-09-boss-result-v2.md):
 * one row, the boss on the left (his bow, his line in his bubble) and your pawn on the right, facing him, your name, XP and level
 * under it (XpResult, compact). Victory, defeat or a draw, alone or in a raid, after a Last Stand too; no God King.
 *
 * A loss: the boss plays his attack on a king (his kit's `kingAttack`, the one the board plays at his mate: KingAttack.tsx) where he
 * stands, from his landing to his laugh (KING_ATTACK.landAt to leaveAt: he's already here, so no drop-in and no leap off), his
 * usual figure hidden meanwhile; your pawn jolts back and flashes at each lash (the king's jolt and flash at a mate, in CSS). Then
 * his usual figure again (his victory). A win: his defeat as before. A draw: both stand.
 */

/** When the attack starts after the screen shows (ms): a beat to take in the screen first. */
const ATTACK_DELAY_MS = 250;
/** How long it plays here: from his landing to his laugh's end. */
export const RESULT_ATTACK_MS = KING_ATTACK.leaveAt - KING_ATTACK.landAt;

export function ResultDuo({ match, result, xp }: { match: GameView; result: "crowd" | "boss" | "draw"; xp: XpGrant | null | undefined }) {
  const boss = match.boss!;
  const kit = bossKit(boss.name);
  const ka = result === "boss" ? kit?.kingAttack : undefined;
  // (Once per screen: decided as it first draws.)
  const [at] = useState(() => Date.now() + ATTACK_DELAY_MS);
  const [stage, setStage] = useState<"wait" | "on" | "done">(ka ? "wait" : "done");
  useEffect(() => {
    if (!ka) return;
    const on = setTimeout(() => setStage("on"), Math.max(0, at - Date.now()));
    const off = setTimeout(() => setStage("done"), Math.max(0, at + RESULT_ATTACK_MS - Date.now()));
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, []);
  // His attack faces our right unless drawn facing left (`facesLeft`): then mirrored about his feet, or turned if he has writing
  // on him (Big Boy's shirt), as on the board.
  const mirrored = !!ka?.facesLeft;
  const reads = mirrored && !!ka?.ch.reads?.length;
  const ch = ka ? (reads ? turned(ka.ch) : ka.ch) : undefined;
  const attacking = stage === "on" && !!ka && !!ch;
  // (The pawn's jolts, by CSS, from the first lash: its delay from its first drawing, decided once, so a redraw never moves it.)
  const [lashIn] = useState(() => at + (KING_ATTACK.lashAt - KING_ATTACK.landAt) - Date.now());
  return (
    <div class={`results-duo rd-is-${result}${attacking ? " rd-attacking" : ""}`} data-attack={ka ? stage : undefined}>
      <div class="rd-boss">
        <BossCharacter match={match} place="results" />
        {attacking && (
          <span
            class={`rd-attack${mirrored && !reads ? " flip" : ""}`}
            aria-hidden="true"
            style={{ "--ra-w": ch!.w, "--ra-h": ch!.h, "--ra-fx": ch!.foot[0], "--ra-fy": ch!.foot[1] }}
          >
            <SpriteAnim ch={ch!} anim={ka!.anim} since={at - KING_ATTACK.landAt} sounds={ka!.sounds ?? kit!.sounds} id={`result-${boss.id}`} />
          </span>
        )}
      </div>
      <div class="rd-you">
        <div class={`rd-pawn${ka && stage !== "done" ? " rd-hit" : ""}`} style={ka && stage !== "done" ? { animationDelay: `${Math.round(lashIn)}ms` } : undefined}>
          <YourPawn look={pawnLook({ id: "", isYou: true, isBot: false }).look} side={boss.crowdSide} hopAt={0} />
        </div>
        <XpResult xp={xp} compact />
      </div>
    </div>
  );
}
