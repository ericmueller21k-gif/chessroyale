import { render } from "preact";
import { checkBan, isBanned, watchBans } from "./ban.ts";
import "./board/pieces.css";
import { App } from "./App.tsx";
import { watchShell } from "./shell.ts";
import { loadStep } from "./loadbar.ts";
import { BanScreen, useBanned } from "./components/FairPlay.tsx";
import { ErrorBoundary, ReportSheet } from "./components/Problems.tsx";
import { MaintenanceBanner } from "./components/MaintenanceBanner.tsx";
import { SearchBar } from "./components/SearchBar.tsx";
import { startStatus } from "./status.ts";
import { hapticsDebug } from "./haptics.ts";
import { setUpInstall } from "./install.ts";
import { watchErrors } from "./problems.ts";
import { watchStaleChunks } from "./stale.ts";
import { prepareAudio, wakeAudio } from "./sound.ts";
import { watchTheme } from "./theme.ts";
import { applyBoardColors } from "./prefs.ts";
import { mountOf, setBannerPlusSource, shownLook } from "@chessroyale/core";
import { bannerPlusAsked } from "./test-switches.ts";
import { account, onAccountChange } from "./account.ts";
import { loadRide } from "./components/rides/load.ts";
import "./styles.css";
// (A computer's board as big as the window's height: after styles.css, whose computer sizes it takes over.)
import "./board-size.css";
// (A computer's game screens: the side menu beside them, and a boss battle's top, Nov 1: after board-size.css.)
import "./game-frame.css";

// No pinch zoom on a phone (Eric, Nov 6): the viewport meta says user-scalable=no, which iOS Safari ignores, so its pinch
// gesture is stopped here, and any two-finger move (a pinch) is too. Single-finger scrolling and taps are left alone; the
// game's own pointer handlers are on their own elements.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// A ban means you can't sign in (Eric, Nov 13; ban.ts): every answer the page gets is looked at for the server's ban answer, from
// the first request on; a device that remembers the ban asks the server once whether it still holds.
watchBans();
if (isBanned()) void checkBan();

// The app's script has run: the loading bar (index.html's shell, if it's showing) moves on to signing in (loadbar.ts).
loadStep("signIn");

// Errors on this device are reported (problems.ts), from the start.
watchErrors();
// A chunk of an older version gone after a deploy (opening the town square): the page loads again (stale.ts).
watchStaleChunks();
setUpInstall();
// A phone is upright (Eric, Nov 11): where the browser allows a lock (an installed app, or full screen) it is locked to portrait. Elsewhere
// index.html's panel covers a phone held sideways. Refused or unsupported (a computer): nothing happens.
try {
  (screen.orientation as ScreenOrientation & { lock?: (o: "portrait") => Promise<void> }).lock?.("portrait")?.catch(() => {});
} catch {
  /* Not supported here. */
}
// Light or dark: the page already shows the right one (index.html's script); from here on it follows the device
// while nothing is picked.
watchTheme();
// Eric's look test (Nov 14): the green ring round a played move's square. `?ring=off` hides it, `?ring=fade` fades it in at the
// square's size (no zoom), `?ring=on` puts it back. Remembered for the tab (sessionStorage), any page, any board.
try {
  const asked = new URLSearchParams(location.search).get("ring");
  if (asked === "off" || asked === "fade") sessionStorage.setItem("brc.ring", asked);
  else if (asked === "on") sessionStorage.removeItem("brc.ring");
  const ring = sessionStorage.getItem("brc.ring");
  if (ring) document.documentElement.dataset.ring = ring;
} catch {
  // (No storage: the usual ring.)
}
// The board colors picked on this device (Settings → Board): on the page before any board is drawn.
applyBoardColors();
// A tester's ?bannerplus= (test-switches.ts): the banners' extra for the games on this device.
setBannerPlusSource(bannerPlusAsked);
// Browsers allow sound only after a tap. iPhones don't count every event as one (a pointerdown alone isn't
// enough), so every tap tries until sound is on (cheap once it is). The audio graph is made beforehand, while the page
// is idle, so the first tap (often a game's first move) only switches it on and starts the samples loading after its
// own frame. Every tap also checks the sound is still on and brings it back if not (wakeAudio: a new audio context if iOS left
// the old one dead, coming back from another app or with the page on screen; Eric, Nov 3). Capture: it runs before the page's
// own handlers, so that tap's sound plays too.
prepareAudio();
for (const ev of ["pointerdown", "touchend", "click", "keydown"]) window.addEventListener(ev, wakeAudio, { passive: true, capture: true });
// The kill switches and the maintenance banner (status.ts), asked now and every minute.
startStatus();
// (`?haptics=debug`: the on-screen log of each tick tried, haptics.ts.)
hapticsDebug();
// (The shell in index.html goes as soon as #app draws anything but the splash: shell.ts.)
watchShell();
// (A banned account sees fair play's ban screen and nothing else, on every URL: no menus, no town, no solo, no chat. Otherwise the
// feedback sheet sits over any screen, from the match menu or Settings, and the maintenance banner, at the top, with the 1 v 1
// search's bar under it while you browse. A render error anywhere shows "Something went wrong" instead of a blank page.)
function Root() {
  if (useBanned()) return <BanScreen />;
  return (
    <ErrorBoundary>
      <App />
      <ReportSheet />
      <MaintenanceBanner />
      <SearchBar />
    </ErrorBoundary>
  );
}
render(<Root />, document.getElementById("app")!);

// Your own worn ride's drawing (its own chunk, rides/load.ts), asked for after the first paint and again whenever your look
// changes (once a ride: it's kept), so your pawn on home, in your ring and in the town rarely waits for it (Nov 1, rides lazy).
requestAnimationFrame(() =>
  setTimeout(() => {
    const wornRide = () => void loadRide(mountOf(shownLook(account().profile?.locker?.look))?.def);
    onAccountChange(wornRide);
    wornRide();
  }),
);

