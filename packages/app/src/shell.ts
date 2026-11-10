/**
 * The shell in index.html (Nov 10, phone load): what shows before the app's script has run. Dropped as the app draws its
 * first screen that isn't its splash (the shell is the splash, or home's frame where this device lands on home), in the
 * same frame, so the swap can't be seen: home's parts sit where the shell's did. `seenHome`: this device lands on home,
 * so the next load's shell is home's frame (index.html reads the mark).
 */
const MARK = "brc.homeShell";
let gone = false;

export function dropShell(): void {
  if (gone) return;
  gone = true;
  document.getElementById("shell")?.remove();
}

/** Home is on screen (`true`), or the landing page instead (`false`): the next load's shell. */
let marked: boolean | null = null;
export function markHome(home: boolean): void {
  if (marked === home) return;
  marked = home;
  try {
    if (home) localStorage.setItem(MARK, "1");
    else localStorage.removeItem(MARK);
  } catch {
    // No storage: the splash next time.
  }
}

/**
 * Drops the shell the moment #app shows anything but the splash, whichever component drew it (Nov 10: App's own check runs
 * only when App renders, so a home a child drew could sit under the shell until App's next render, and the shell covers the
 * screen). A MutationObserver runs before the browser paints, so the swap still can't be seen.
 */
export function watchShell(): void {
  const app = document.getElementById("app");
  if (!app || gone) return;
  const obs = new MutationObserver(() => {
    if (!app.firstElementChild || app.querySelector(".fd-splash")) return;
    obs.disconnect();
    dropShell();
    if (app.querySelector(".fd-home")) markHome(true);
    else if (app.querySelector(".landing")) markHome(false);
  });
  obs.observe(app, { childList: true, subtree: true });
}
