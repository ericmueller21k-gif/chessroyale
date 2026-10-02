import { render } from "preact";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import { App } from "./App.tsx";
import { setUpInstall } from "./install.ts";
import "./styles.css";

setUpInstall();
render(<App />, document.getElementById("app")!);
