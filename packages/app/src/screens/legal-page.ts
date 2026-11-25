// (Off the legal pages, Legal.tsx, which load on entry: the app asks these on home. Nov 10, phone load.)

export type LegalPage = "privacy" | "terms" | "copyright";

/** Which legal page an address shows (null: none). */
export const legalPageOf = (path: string): LegalPage | null => (path === "/privacy" || path === "/terms" || path === "/copyright" ? (path.slice(1) as LegalPage) : null);

/**
 * Back from a legal page. Every link here is a plain link (a page load), from the landing page, Settings, the FAQ or
 * the other legal page, so back is the browser's back to it; opened any other way (typed, or from another site), home.
 */
export function leaveLegal(close: () => void) {
  let fromHere = false;
  try {
    fromHere = history.length > 1 && !!document.referrer && new URL(document.referrer).origin === location.origin;
  } catch {
    // No referrer to read.
  }
  if (fromHere) {
    history.back();
    return;
  }
  close();
  history.replaceState(null, "", "/");
}
