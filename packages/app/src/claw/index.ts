/**
 * Boingo's claw machine (Eric, Nov 6; docs/decisions/2026-11-06-claw-machine.md, -boingo-home.md). It stands in Boingo's Funhouse as
 * a cabinet the room draws (claw/view.ts); a tap on its coin slot, standing at it, calls `openClawMachine()`: its controls open in a
 * small panel at the bottom (ClawMachine.tsx, its own chunk, loaded on that first tap: nothing of it loads with the app). One at a
 * time: a second call while it's open does nothing. Leaving the room closes it (`closeClawMachine`).
 */
let open = false;
let closer: (() => void) | null = null;

export function openClawMachine(): void {
  if (open) return;
  open = true;
  void import("./ClawMachine.tsx")
    .then((m) => {
      if (!open) return;
      closer = m.mountClawMachine(() => {
        open = false;
        closer = null;
      });
    })
    .catch(() => void (open = false));
}

/** Closes the controls if they're open (leaving the room). Safe at any point: the play is the server's, already done. */
export function closeClawMachine(): void {
  if (closer) closer();
  open = false;
  closer = null;
}

/** The controls are open. */
export const clawMachineOpen = (): boolean => open;
