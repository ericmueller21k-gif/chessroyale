/** Install ("Add to Home Screen") support and service worker registration. */

import { APP_WINDOW } from "@chessroyale/core";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

let noWorker: () => void = () => {};
/**
 * Resolves if this page will have no service worker: the dev server's build, a browser without one, or a registration that failed.
 * (Home's fetch ahead of the town's files waits until the worker answers the page, unless there'll be none: town/baked-files.ts.)
 */
export const workerNever = new Promise<void>((ok) => (noWorker = ok));

/** Call before rendering: Chrome fires beforeinstallprompt early. */
export function setUpInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    answerWorker(navigator.serviceWorker);
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        // (This page is loaded: the worker lets go of the versions no open tab runs any more, sw-template.js prune.)
        .then((reg) => reg.active?.postMessage({ type: "brc-loaded" }))
        .catch(() => {
          // Not fatal: the app works without it, just not offline.
          noWorker();
        });
    });
  } else noWorker();
}

/** This page's entry script (its path under /assets/: which version it runs), or null (the dev server's). */
export function entryScript(doc: Document = document): string | null {
  const src = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src;
  return src ? new URL(src, location.href).pathname : null;
}

/**
 * The service worker asks each open tab which version it runs ("brc-entry?"), and keeps that version's files while it does (a tab
 * left open across a deploy still opens its rooms: sw-template.js, prune). The answer goes back on the port it sent.
 */
export function answerWorker(sw: Pick<ServiceWorkerContainer, "addEventListener" | "startMessages">, entry = () => entryScript()): void {
  sw.addEventListener("message", (e) => {
    const ask = e as MessageEvent<{ type?: string } | null>;
    if (ask.data?.type === "brc-entry?") ask.ports[0]?.postMessage(entry());
  });
  // (A worker's messages wait until the page starts them: a listener added with addEventListener doesn't.)
  sw.startMessages();
}

export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  const e = deferred;
  deferred = null;
  await e.prompt();
  listeners.forEach((l) => l());
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}


const SIZED_KEY = "brc.app-window-sized";

type SizableWindow = Pick<Window, "matchMedia" | "outerWidth" | "resizeTo" | "moveTo"> & {
  screen: Pick<Screen, "availWidth" | "availHeight"> & { availLeft?: number; availTop?: number };
  navigator: Navigator & { standalone?: boolean };
};

/**
 * The installed app on a computer, on its first launch: open at a computer's size (APP_WINDOW), centered, not the narrow window Chrome
 * opens an installed app in (which takes the phone layout). Once: the flag is set first, so a window the player resizes keeps their size.
 * Phones and tablets (no fine pointer), a tab, or a browser that refuses to resize: nothing happens.
 */
export function sizeAppWindow(win: SizableWindow = window, store: Pick<Storage, "getItem" | "setItem"> = localStorage): void {
  const standalone = win.matchMedia("(display-mode: standalone)").matches || win.navigator.standalone === true;
  if (!standalone || !win.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  try {
    if (store.getItem(SIZED_KEY)) return;
    store.setItem(SIZED_KEY, "1");
  } catch {
    return;
  }
  const s = win.screen;
  const w = Math.min(APP_WINDOW.width, s.availWidth);
  const h = Math.min(APP_WINDOW.height, s.availHeight);
  if (win.outerWidth >= w) return;
  try {
    win.resizeTo(w, h);
    win.moveTo((s.availLeft ?? 0) + Math.round((s.availWidth - w) / 2), (s.availTop ?? 0) + Math.round((s.availHeight - h) / 2));
  } catch {
    // Refused: the window stays as the browser opened it.
  }
}
