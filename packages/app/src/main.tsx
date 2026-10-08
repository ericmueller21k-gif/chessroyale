import { render } from "preact";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import { App } from "./App.tsx";
import { BanNotice } from "./components/FairPlay.tsx";
import { setUpInstall } from "./install.ts";
import { audioRunning, unlockAudio } from "./sound.ts";
import { watchTheme } from "./theme.ts";
import "./styles.css";

setUpInstall();
// Light or dark: the page already shows the right one (index.html's script); from here on it follows the device
// while nothing is picked.
watchTheme();
// Browsers allow sound only after a tap. iPhones don't count every event as one (a pointerdown alone isn't
// enough), so every tap tries until sound is on (cheap once it is).
for (const ev of ["pointerdown", "touchend", "click", "keydown"]) window.addEventListener(ev, () => audioRunning() || unlockAudio(), { passive: true });
// (Fair play's ban notice sits over any screen: PLAY, a new lobby or joining one can bring it up.)
render(
  <>
    <App />
    <BanNotice />
  </>,
  document.getElementById("app")!,
);
