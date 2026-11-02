import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { bossDef, tokenBossName } from "@chessroyale/core";
import { renderFrame, type Character } from "../characters/sprite.ts";

/**
 * A boss's token (Nov 2, shops round 2): its picture from claude/boss-art (components/tokens/, one chunk loaded the first time a
 * token shows), 40 x 40 pixels drawn crisp at the box's size. `animate`: its idle plays (a glint round the rim, a blink), unless the
 * player asked for reduced motion; otherwise its first frame, still (the inventory's grid). A boss with no picture yet: a plain
 * gold coin with the boss's initial.
 */
let art: Readonly<Record<string, Character>> | null = null;
let loading: Promise<void> | null = null;
const loadArt = () => (loading ??= import("./tokens/index.ts").then((m) => void (art = m.TOKEN_ART)).catch(() => void (loading = null)));

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function TokenArt({ boss, animate = false }: { boss: string; animate?: boolean }) {
  const [, loaded] = useState(0);
  const ch = art?.[boss];
  useEffect(() => {
    if (art) return;
    let live = true;
    void loadArt().then(() => live && loaded((n) => n + 1));
    return () => void (live = false);
  }, []);
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!ch || !g) return;
    const frames = ch.anims.idle!.frames;
    const images = frames.map((f) => {
      const { w, h, data } = renderFrame(ch, f);
      return new ImageData(new Uint8ClampedArray(data), w, h);
    });
    let i = 0;
    g.putImageData(images[0]!, 0, 0);
    if (!animate || frames.length < 2 || reduced()) return;
    let t = setTimeout(function next() {
      i = (i + 1) % frames.length;
      g.clearRect(0, 0, ch.w, ch.h);
      g.putImageData(images[i]!, 0, 0);
      t = setTimeout(next, frames[i]!.ms);
    }, frames[0]!.ms);
    return () => clearTimeout(t);
  }, [ch, animate]);
  const name = `${tokenBossName(boss)} token`;
  return (
    <span class="token-art" role="img" aria-label={name} data-token={boss} data-drawn={ch ? "1" : art ? "plain" : undefined}>
      {ch ? <canvas ref={cv} width={ch.w} height={ch.h} /> : art ? <span class="token-plain">{(bossDef(boss)?.name ?? boss).replace(/^The /, "")[0]}</span> : null}
    </span>
  );
}
