// For `npm run frames:character -- <dir> ... fx`: mounts the bosses' power art over the real game screen (served by
// the app's Vite dev server at /@fs/...), so the frames script can watch it frame by frame where it will play.
import { h, render } from "preact";
import { BoardEffects, BossEffect, BossMoment, type BoardItem } from "../packages/app/src/components/BossEffect.tsx";
import type { EffectName } from "../packages/app/src/characters/power-art.ts";

export interface LabItem {
  /** An effect sprite, a boss's moment, or many square effects on one canvas over the board (`squares`). */
  kind: "effect" | "moment" | "board";
  /** The effect's name, or the boss's name for a moment. */
  name: string;
  anim?: string;
  then?: string;
  /** Page pixels. */
  box: { x: number; y: number; w: number; h: number };
  /** For "board": the square effects, and which way up the board is. */
  squares?: Omit<BoardItem, "since">[];
  orientation?: "white" | "black";
}

let host: HTMLElement | null = null;
export function mount(items: LabItem[]): void {
  if (!host) {
    host = document.createElement("div");
    host.id = "fx-lab";
    document.body.appendChild(host);
  }
  const since = Date.now();
  render(
    h(
      "div",
      null,
      items.map((it, i) =>
        h(
          "div",
          { key: `${since}:${i}`, style: { position: "fixed", left: `${it.box.x}px`, top: `${it.box.y}px`, width: `${it.box.w}px`, height: `${it.box.h}px`, zIndex: 50, pointerEvents: "none" } },
          it.kind === "effect"
            ? h(BossEffect, { name: it.name as EffectName, anim: it.anim, then: it.then, since, id: String(i) })
            : it.kind === "board"
              ? h(BoardEffects, { items: (it.squares ?? []).map((q) => ({ ...q, since })), orientation: it.orientation ?? "white" })
              : h(BossMoment, { boss: it.name, anim: it.anim!, then: it.then, since }),
        ),
      ),
    ),
    host,
  );
}
export function clear(): void {
  if (host) render(null, host);
}
