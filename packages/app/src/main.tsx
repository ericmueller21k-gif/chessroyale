import { render } from "preact";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import { App } from "./App.tsx";
import { setUpInstall } from "./install.ts";
import { unlockAudio } from "./sound.ts";
import "./styles.css";

setUpInstall();
// Browsers allow sound only after a tap: the first tap anywhere turns it on.
window.addEventListener("pointerdown", unlockAudio, { once: true });
render(<App />, document.getElementById("app")!);
