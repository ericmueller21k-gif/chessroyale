/**
 * The loading bar's steps (Eric, Nov 10: a bar that "just says … loading", only past a ~2 s hang). index.html's shell draws the bar
 * and shows it once the page has loaded for FRONT_DOOR.loadBarAfterMs; the app moves it here as each step finishes: how much is done
 * and what's loading now. It never goes back (the shell keeps the furthest), and does nothing once the shell has gone.
 * ("Loading the game…" at 0.1 is the shell's own first line: the app's script itself.)
 */
export const LOAD_STEPS = {
  /** The app's script has run: now /api/auth/config. */
  signIn: [0.35, "Signing you in…"],
  /** Sign-in's settings are in: now your profile (/api/me). */
  account: [0.6, "Loading your account…"],
  /** Your account is in (or there's none to load): whatever home still waits on (an invite's or a rejoin's check). */
  last: [0.85, "Almost there…"],
} as const satisfies Record<string, readonly [number, string]>;
export type LoadStep = keyof typeof LOAD_STEPS;

export function loadStep(step: LoadStep): void {
  const [to, text] = LOAD_STEPS[step];
  (globalThis as { hcLoad?: (to: number, text: string) => void }).hcLoad?.(to, text);
}
