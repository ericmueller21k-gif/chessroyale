import { render } from "preact";
import "./board/pieces.css";
import { App } from "./App.tsx";
import { BanNotice } from "./components/FairPlay.tsx";
import { ErrorBoundary, ReportSheet } from "./components/Problems.tsx";
import { MaintenanceBanner } from "./components/MaintenanceBanner.tsx";
import { startStatus } from "./status.ts";
import { setUpInstall } from "./install.ts";
import { watchErrors } from "./problems.ts";
import { audioUnlocked, prepareAudio, unlockAudio } from "./sound.ts";
import { watchTheme } from "./theme.ts";
import "./styles.css";

// Errors on this device are reported (problems.ts), from the start.
watchErrors();
setUpInstall();
// Light or dark: the page already shows the right one (index.html's script); from here on it follows the device
// while nothing is picked.
watchTheme();
// Browsers allow sound only after a tap. iPhones don't count every event as one (a pointerdown alone isn't
// enough), so every tap tries until sound is on (cheap once it is). The audio graph is made beforehand, while the page
// is idle, so the first tap (often a game's first move) only switches it on and starts the samples loading after its
// own frame.
prepareAudio();
for (const ev of ["pointerdown", "touchend", "click", "keydown"]) window.addEventListener(ev, () => audioUnlocked() || unlockAudio(), { passive: true });
// The kill switches and the maintenance banner (status.ts), asked now and every minute.
startStatus();
// (Fair play's ban notice sits over any screen: PLAY, a new lobby or joining one can bring it up; so does the
// feedback sheet, from the match menu or Settings, and the maintenance banner, at the top. A render error anywhere
// shows "Something went wrong" instead of a blank page.)
render(
  <ErrorBoundary>
    <App />
    <BanNotice />
    <ReportSheet />
    <MaintenanceBanner />
  </ErrorBoundary>,
  document.getElementById("app")!,
);
