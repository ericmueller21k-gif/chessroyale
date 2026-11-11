import { render } from "preact";
import { useEffect, useLayoutEffect, useReducer, useState } from "preact/hooks";
import { BOSS_CRATES, CLAW, adminFirst, bossCrateDef, clawWonLine, tokenBossName, type BossCrateDef } from "@chessroyale/core";
import { grantTestItems, playClawOnServer } from "../account.ts";
import { TokenArt } from "../components/TokenArt.tsx";
import { CrateOpening } from "../screens/Crates.tsx";
import { useAccount } from "../screens/Profile.tsx";
import { play, warmSounds } from "../sound.ts";
import { testParams } from "../test-switches.ts";
import { CLAW_START, clawStep, newRequestId, type ClawStage } from "./flow.ts";
import { CLAW_PLAY, COIN_MS, clawStage } from "./view.ts";
import "./claw.css";

/**
 * Boingo's claw machine's controls (Eric, Nov 6; docs/decisions/2026-11-06-claw-machine.md and -boingo-home.md; the flow: flow.ts).
 * The machine is the cabinet in his Funhouse: its claw is drawn by the room (shops/ShopRoom.tsx) from the play this writes
 * (view.ts CLAW_PLAY). Eric, Nov 6: "the real claw machine in the room … not a separate 2D overlay screen". So this is only a small
 * panel docked at the bottom, the cabinet zoomed in above it: "Insert one boss coin" and your boss tokens; a pick drops the coin in
 * (the server decides the play now); once it has answered, the claw roams on its own until STOP (or CLAW.roamSeconds), drops, grabs
 * and lifts; a win carries the boss's crate to the chute ("You won Folio's Boss Crate!", Open now: the Crates tab's own opening);
 * a loss drops it back on the pile, or slips ("So close! Try again?"). Closing at any point is safe: the token is spent and any
 * crate is already in your inventory, on the server.
 */

/** The boss crates the picker offers (as the Crates tab lists them: one in the game for admins first only to an admin or a holder). */
const offered = (admin: boolean, tokens: Record<string, number>): BossCrateDef[] =>
  BOSS_CRATES.filter((c) => admin || (tokens[c.boss] ?? 0) > 0 || !adminFirst({ id: c.boss }));

/** The e2e's seed hook (`?clawSeed=N`): only where the test switches are allowed, and the server honors it only where TEST_SWITCHES is on. */
const testSeed = (): number | undefined => {
  const v = testParams().get("clawSeed");
  return v !== null && /^\d{1,9}$/.test(v) ? Number(v) : undefined;
};

export function ClawMachine({ onClose }: { onClose: () => void }) {
  const { profile } = useAccount();
  const tokens = profile?.locker?.tokens ?? {};
  const admin = !!profile?.admin;
  const [s, dispatch] = useReducer(clawStep, CLAW_START);
  const [granting, setGranting] = useState(false);

  useEffect(() => warmSounds(["clawCoin", "clawWhir", "clawGrab", "clawThud"]), []);
  useEffect(() => {
    CLAW_PLAY.open = true;
    return () => {
      CLAW_PLAY.open = false;
      // (Closed mid-play: the claw parks at home; the play is already done on the server.)
      clawStage(CLAW_PLAY, "insert", performance.now(), null, null);
    };
  }, []);
  // (A layout effect, as every pop-up's: an effect waits for a paint, and an Escape pressed as it opened was lost. LESSONS.md, Nov 11.)
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);

  // Each stage's sound as it shows (a layout effect: heard with its first frame) and its timer.
  useLayoutEffect(() => {
    const stage: ClawStage = s.stage;
    // (The room's cabinet draws its claw from this, from this frame on.)
    clawStage(CLAW_PLAY, stage, performance.now(), s.answer ? s.answer.won === true : null, s.request);
    if (stage === "coin") {
      play("clawCoin");
      const t = setTimeout(() => dispatch({ kind: "coinIn" }), COIN_MS);
      return () => clearTimeout(t);
    }
    if (stage === "roam") {
      play("clawWhir");
      const t = setTimeout(() => dispatch({ kind: "stop" }), CLAW.roamSeconds * 1000);
      return () => clearTimeout(t);
    }
    const wait = stage === "drop" ? CLAW.dropMs : stage === "lift" ? CLAW.liftMs : stage === "carry" ? CLAW.carryMs : 0;
    if (stage === "lift") play("clawGrab");
    if (stage === "carry") play("clawWhir");
    if (stage === "won") play("clawThud");
    if (!wait) return;
    const t = setTimeout(() => dispatch({ kind: "next" }), wait);
    return () => clearTimeout(t);
  }, [s.stage]);

  const pick = (boss: string) => {
    const request = newRequestId();
    dispatch({ kind: "pick", boss, request });
    playClawOnServer(boss, request, testSeed())
      .then((answer) => dispatch({ kind: "answer", answer }))
      .catch((e: unknown) => dispatch({ kind: "refused", message: e instanceof Error ? e.message : "The claw machine couldn't take your coin." }));
  };

  const list = offered(admin, tokens);
  const total = list.reduce((n, c) => n + (tokens[c.boss] ?? 0), 0);
  const won = s.answer?.won === true && s.answer.crate ? bossCrateDef(s.answer.crate) : undefined;

  if (s.stage === "opening" && won) {
    return (
      <div class="claw-veil" role="dialog" aria-label="Claw machine">
        <div class="claw-machine claw-opening crates">
          <CrateOpening crate={won} force={{}} onClose={() => dispatch({ kind: "again" })} />
        </div>
      </div>
    );
  }

  return (
    <div class="claw-veil" role="dialog" aria-label="Claw machine">
      <div class={`claw-machine claw-${s.stage}${s.answer?.won ? " claw-win" : ""}`} data-stage={s.stage}>
        <button type="button" class="claw-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div class="claw-screen" aria-live="polite">
          {s.stage === "insert" && "Insert one boss coin"}
          {s.stage === "coin" && "…"}
          {(s.stage === "roam" || s.stage === "drop" || s.stage === "lift" || s.stage === "carry") && (s.stage === "roam" ? "Tap STOP to drop the claw" : "…")}
          {s.stage === "won" && won && clawWonLine(won.name)}
          {s.stage === "lost" && "So close! Try again?"}
          {s.stage === "refused" && s.message}
        </div>
        <div class="claw-controls">
          {s.stage === "insert" && (
            <>
              {total === 0 && <p class="claw-none">You have no boss tokens yet.</p>}
              <div class="claw-picker">
                {list.map((c) => {
                  const n = tokens[c.boss] ?? 0;
                  return (
                    <button type="button" key={c.boss} class="claw-token" data-boss={c.boss} data-count={n} disabled={!n} onClick={() => pick(c.boss)}>
                      <TokenArt boss={c.boss} />
                      <span class="claw-token-name">{tokenBossName(c.boss)}</span>
                      <span class="claw-token-n">× {n}</span>
                    </button>
                  );
                })}
              </div>
              {admin && (
                <button
                  type="button"
                  class="claw-admin"
                  disabled={granting}
                  onClick={() => {
                    setGranting(true);
                    void list
                      .reduce((p, c) => p.then(() => grantTestItems({ boss: c.boss, tokens: 3 })), Promise.resolve())
                      .catch(() => undefined)
                      .finally(() => setGranting(false));
                  }}
                >
                  Admin: +3 of each token
                </button>
              )}
            </>
          )}
          {(s.stage === "coin" || s.stage === "roam" || s.stage === "drop" || s.stage === "lift" || s.stage === "carry") && (
            <button type="button" class="claw-stop" disabled={s.stage !== "roam"} onClick={() => dispatch({ kind: "stop" })}>
              STOP
            </button>
          )}
          {s.stage === "won" && (
            <div class="claw-actions">
              <button type="button" class="claw-open" onClick={() => dispatch({ kind: "open" })}>
                Open now
              </button>
              <button type="button" class="claw-again" onClick={() => dispatch({ kind: "again" })}>
                Play again
              </button>
            </div>
          )}
          {(s.stage === "lost" || s.stage === "refused") && (
            <div class="claw-actions">
              <button type="button" class="claw-again" onClick={() => dispatch({ kind: "again" })}>
                Try again
              </button>
              <button type="button" class="claw-done" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Puts the machine's controls over the page; `gone` when they close. Returns what closes them. */
export function mountClawMachine(gone: () => void): () => void {
  const root = document.createElement("div");
  root.className = "claw-root";
  document.body.appendChild(root);
  const close = () => {
    render(null, root);
    root.remove();
    gone();
  };
  render(<ClawMachine onClose={close} />, root);
  return close;
}
