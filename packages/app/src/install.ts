/** Install ("Add to Home Screen") support and service worker registration. */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

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
        });
    });
  }
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

const DISMISS_KEY = "brc.install-dismissed";

export function installDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Not important.
  }
}
