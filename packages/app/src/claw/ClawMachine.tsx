import { render } from "preact";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "preact/hooks";
import { BOSS_CRATES, CLAW, adminFirst, bossCrateDef, bossCrateOf, clawWonLine, tokenBossName, type BossCrateDef } from "@chessroyale/core";
import { grantTestItems, playClawOnServer } from "../account.ts";
import { TokenArt } from "../components/TokenArt.tsx";
import { BossCrateArt, CrateOpening } from "../screens/Crates.tsx";
import { useAccount } from "../screens/Profile.tsx";
import { play, warmSounds } from "../sound.ts";
import { testParams } from "../test-switches.ts";
import { CLAW_START, clawStep, newRequestId, roamX, type ClawStage } from "./flow.ts";
import "./claw.css";

/**
 * Boingo's claw machine (Eric, Nov 6; docs/decisions/2026-11-06-claw-machine.md; the flow: flow.ts). The machine's own screen opens
 * over the room's zoomed view: "Insert one boss coin" and your boss tokens; a pick drops the coin in (the server decides the play
 * now), the claw roams on its own until STOP (or CLAW.roamSeconds), drops, grabs and lifts; a win carries the boss's crate to the
 * chute ("You won Folio's Boss Crate!", Open now: the Crates tab's own opening); a loss slips at the top ("So close! Try again?").
 * Closing at any point is safe: the token is spent and any crate is already in your inventory, on the server.
 */

/** Where the chute is (0 = the glass's left edge, 1 = its right). */
const CHUTE_X = 0.1;
/** How long the coin takes to drop into the slot (ms). */
const COIN_MS = 700;

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
  const arm = useRef<HTMLDivElement>(null);
  const x = useRef(0.5);

  useEffect(() => warmSounds(["clawCoin", "clawWhir", "clawGrab", "clawThud"]), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);

  // Each stage's sound as it shows (a layout effect: heard with its first frame) and its timer.
  useLayoutEffect(() => {
    const stage: ClawStage = s.stage;
    if (stage === "coin") {
      play("clawCoin");
      const t = setTimeout(() => dispatch({ kind: "coinIn" }), COIN_MS);
      return () => clearTimeout(t);
    }
    if (stage === "roam") {
      play("clawWhir");
      const start = performance.now();
      let raf = requestAnimationFrame(function step(now) {
        x.current = roamX(now - start);
        arm.current?.style.setProperty("--claw-x", x.current.toFixed(4));
        raf = requestAnimationFrame(step);
      });
      const t = setTimeout(() => dispatch({ kind: "stop" }), CLAW.roamSeconds * 1000);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }
    const wait = stage === "drop" ? CLAW.dropMs : stage === "lift" ? CLAW.liftMs : stage === "carry" ? CLAW.carryMs : 0;
    if (stage === "lift") play("clawGrab");
    if (stage === "carry") play("clawWhir");
    if (stage === "won") play("clawThud");
    if (stage === "carry") {
      x.current = CHUTE_X;
      arm.current?.style.setProperty("--claw-x", String(CHUTE_X));
    }
    if (stage === "insert") x.current = 0.5;
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
  const crate = s.boss ? bossCrateOf(s.boss) : undefined;
  const won = s.answer?.won === true && s.answer.crate ? bossCrateDef(s.answer.crate) : undefined;
  const held = s.stage === "lift" || s.stage === "carry";

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
    <div class="claw-veil" role="dialog" aria-label="Claw machine" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
        <div class="claw-glass">
          <div class="claw-rail" />
          <div ref={arm} class={`claw-arm${held ? " claw-holding" : ""}`} style={{ "--claw-x": String(x.current) }}>
            <div class="claw-cable" />
            <svg class="claw-head" viewBox="0 0 40 30" aria-hidden="true">
              <rect x="14" y="0" width="12" height="8" rx="2" />
              <path class="claw-prong claw-prong-l" d="M16 7 L8 20 L13 28" />
              <path class="claw-prong claw-prong-r" d="M24 7 L32 20 L27 28" />
            </svg>
            {crate && held && (
              <div class={`claw-prize${s.answer?.won ? "" : " claw-slip"}`} data-crate={crate.id}>
                <BossCrateArt crate={crate} />
              </div>
            )}
          </div>
          <div class="claw-pile" aria-hidden="true">
            {list.slice(0, 5).map((c) => (
              <span key={c.id} class="claw-pile-crate">
                <BossCrateArt crate={c} />
              </span>
            ))}
          </div>
          <div class="claw-chute">{s.stage === "won" && won && <div class="claw-chute-crate"><BossCrateArt crate={won} /></div>}</div>
          {s.stage === "coin" && s.boss && (
            <div class="claw-coin" aria-hidden="true">
              <TokenArt boss={s.boss} />
            </div>
          )}
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

/** Puts the machine over the page; `gone` when it closes. */
export function mountClawMachine(gone: () => void): void {
  const root = document.createElement("div");
  root.className = "claw-root";
  document.body.appendChild(root);
  const close = () => {
    render(null, root);
    root.remove();
    gone();
  };
  render(<ClawMachine onClose={close} />, root);
}
