import { render } from "preact";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import { App } from "./App.tsx";
import { setUpInstall } from "./install.ts";
import { audioRunning, unlockAudio } from "./sound.ts";
import "./styles.css";

setUpInstall();
// Browsers allow sound only after a tap. iPhones don't count every event as one (a pointerdown alone isn't
// enough), so every tap tries until sound is on (cheap once it is).
for (const ev of ["pointerdown", "touchend", "click", "keydown"]) window.addEventListener(ev, () => audioRunning() || unlockAudio(), { passive: true });
render(<App />, document.getElementById("app")!);
