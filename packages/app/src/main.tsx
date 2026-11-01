import { render } from "preact";
import "./board/pieces.css";
import { App } from "./App.tsx";
import { BanNotice } from "./components/FairPlay.tsx";
import { ErrorBoundary, ReportSheet } from "./components/Problems.tsx";
import { MaintenanceBanner } from "./components/MaintenanceBanner.tsx";
import { DuelQueueBar } from "./components/DuelQueueBar.tsx";
import { startStatus } from "./status.ts";
import { setUpInstall } from "./install.ts";
import { watchErrors } from "./problems.ts";
import { watchStaleChunks } from "./stale.ts";
import { audioUnlocked, prepareAudio, unlockAudio } from "./sound.ts";
import { watchTheme } from "./theme.ts";
import { applyBoardColors } from "./prefs.ts";
import { setBannerPlusSource } from "@chessroyale/core";
import { bannerPlusAsked } from "./test-switches.ts";
import { account, onAccountChange } from "./account.ts";
import { loadRide } from "./components/rides/load.ts";
import "./styles.css";
// (A computer's board as big as the window's height: after styles.css, whose computer sizes it takes over.)
import "./board-size.css";

// Errors on this device are reported (problems.ts), from the start.
watchErrors();
// A chunk of an older version gone after a deploy (opening the town square): the page loads again (stale.ts).
watchStaleChunks();
setUpInstall();
// Light or dark: the page already shows the right one (index.html's script); from here on it follows the device
// while nothing is picked.
watchTheme();
// The board colors picked on this device (Settings → Board): on the page before any board is drawn.
applyBoardColors();
// A tester's ?bannerplus= (test-switches.ts): the banners' extra for the games on this device.
setBannerPlusSource(bannerPlusAsked);
// Browsers allow sound only after a tap. iPhones don't count every event as one (a pointerdown alone isn't
// enough), so every tap tries until sound is on (cheap once it is). The audio graph is made beforehand, while the page
// is idle, so the first tap (often a game's first move) only switches it on and starts the samples loading after its
// own frame.
prepareAudio();
for (const ev of ["pointerdown", "touchend", "click", "keydown"]) window.addEventListener(ev, () => audioUnlocked() || unlockAudio(), { passive: true });
// The kill switches and the maintenance banner (status.ts), asked now and every minute.
startStatus();
// (Fair play's ban notice sits over any screen: PLAY, a new lobby or joining one can bring it up; so does the
// feedback sheet, from the match menu or Settings, and the maintenance banner, at the top, with the 1 v 1 search's bar
// under it while you browse. A render error anywhere
// shows "Something went wrong" instead of a blank page.)
render(
  <ErrorBoundary>
    <App />
    <BanNotice />
    <ReportSheet />
    <MaintenanceBanner />
    <DuelQueueBar />
  </ErrorBoundary>,
  document.getElementById("app")!,
);

// Your own worn ride's drawing (its own chunk, rides/load.ts), asked for after the first paint and again whenever your look
// changes (once a ride: it's kept), so your pawn on home, in your ring and in the town rarely waits for it (Nov 1, rides lazy).
requestAnimationFrame(() =>
  setTimeout(() => {
    const wornRide = () => void loadRide(account().profile?.locker?.look?.ride?.def);
    onAccountChange(wornRide);
    wornRide();
  }),
);
