import { useEffect, useState } from "preact/hooks";

/**
 * Light or dark (DECISIONS.md, "Light and dark, a switch"). Until someone picks, the app follows the device. A pick
 * (the sun button, or Settings → Theme) is remembered on this device.
 *
 * The page always carries the theme it shows as `<html data-theme="light|dark">`, set before the first paint by the
 * little script in index.html (the same rules as `resolveTheme` below; a unit test checks they agree) and kept in step
 * here when the device changes or someone picks. The stylesheet's light rules hang off `:root[data-theme="light"]`.
 */

export type ThemePref = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_KEY = "brc.theme";
/** The device's own setting: light only when it asks for light (no preference reads as dark, the app's base). */
const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** What a stored value means: "light" or "dark" is a pick; anything else (nothing, junk) follows the device. */
export function parseThemePref(stored: string | null | undefined): ThemePref {
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** The theme shown: the pick, else the device's. */
export function resolveTheme(pref: ThemePref, deviceLight: boolean): Theme {
  return pref === "system" ? (deviceLight ? "light" : "dark") : pref;
}

/** The sun button: whatever is showing, the other one (a pick from then on, even if it matches the device). */
export function toggledPref(shown: Theme): ThemePref {
  return shown === "dark" ? "light" : "dark";
}

/** (Without storage, a pick lasts as long as the page.) */
let memory: ThemePref | null = null;

/** What's picked on this device ("system" until someone picks). */
export function themePref(): ThemePref {
  if (memory) return memory;
  try {
    return parseThemePref(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

function deviceLight(): boolean {
  try {
    return matchMedia(LIGHT_QUERY).matches;
  } catch {
    return false;
  }
}

/** The theme on screen now. */
export const currentTheme = (): Theme => resolveTheme(themePref(), deviceLight());

const listeners = new Set<() => void>();

/** Puts the theme on the page (`<html data-theme>`), and tells whoever's drawing a theme button. */
export function applyTheme() {
  const t = currentTheme();
  if (document.documentElement.getAttribute("data-theme") !== t) document.documentElement.setAttribute("data-theme", t);
  listeners.forEach((l) => l());
}

/** Picks a theme ("system": follow the device again), remembers it on this device, and shows it. */
export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // No storage: it still changes, for as long as the page is open.
    memory = pref;
  }
  applyTheme();
}

let watching = false;
/** Follows the device while nothing is picked (and keeps `data-theme` right if the script in index.html didn't run). */
export function watchTheme() {
  if (watching) return;
  watching = true;
  try {
    matchMedia(LIGHT_QUERY).addEventListener("change", applyTheme);
  } catch {
    // No media queries: the theme stays as it is.
  }
  applyTheme();
}

/** The theme picked and shown, for a button or the Settings choice; re-renders when either changes. */
export function useTheme(): { pref: ThemePref; theme: Theme } {
  const read = () => ({ pref: themePref(), theme: currentTheme() });
  const [state, set] = useState(read);
  useEffect(() => {
    const fn = () => set(read());
    listeners.add(fn);
    fn();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return state;
}
