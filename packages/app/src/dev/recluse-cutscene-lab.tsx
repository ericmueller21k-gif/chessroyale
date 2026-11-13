import { render } from "preact";
import { RecluseCutscene, recluseCutsceneTimeline } from "../components/RecluseCutscene.tsx";

/**
 * Dev only: the Hidden Boss's cutscene played over whatever board is on screen. Nothing in the app imports
 * this: `scripts/preview-recluse-cutscene.mjs` loads it through the Vite dev server into a real boss battle mid-game, so
 * it can't reach production. His figure in its usual place is hidden while the scene plays (he kneels in the light).
 */
export function playCutscene(): { at: number; timeline: ReturnType<typeof recluseCutsceneTimeline> } {
  const boards = [...document.querySelectorAll<HTMLElement>(".board-wrap")].filter((b) => b.offsetParent);
  const board = boards.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] ?? null;
  const style = document.createElement("style");
  style.textContent = ".boss-char canvas, .bc-bubble:not(.cs-say) { visibility: hidden !important; }";
  document.head.appendChild(style);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const at = Date.now();
  const timeline = recluseCutsceneTimeline();
  render(<RecluseCutscene at={at} until={at + timeline.endAt} board={board} />, host);
  return { at, timeline };
}
