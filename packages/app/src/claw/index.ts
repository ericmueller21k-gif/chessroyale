import { testParams } from "../test-switches.ts";

/**
 * Boingo's claw machine (Eric, Nov 6; docs/decisions/2026-11-06-claw-machine.md). Boingo's Funhouse places the machine and, on a tap
 * of its coin slot, calls `openClawMachine()`: the machine's own screen opens over the page (ClawMachine.tsx, its own chunk, loaded
 * on that first tap: nothing of it loads with the app). One at a time: a second call while it's open does nothing.
 */
let open = false;

export function openClawMachine(): void {
  if (open) return;
  open = true;
  void import("./ClawMachine.tsx")
    .then((m) => m.mountClawMachine(() => void (open = false)))
    .catch(() => void (open = false));
}

/**
 * The test switch `?claw=1` (where the test switches are allowed: an admin, TEST_SWITCHES, the dev server): opens the machine as the
 * page loads, for the e2e and stills (and before Boingo's room places it). Called once the account has loaded.
 */
export function openClawFromAddress(): void {
  if (testParams().get("claw") === "1") openClawMachine();
}
