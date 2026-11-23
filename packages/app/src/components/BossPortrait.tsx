import { useLayoutEffect, useRef } from "preact/hooks";
import type { BossView } from "../game.ts";
import { SELECT_FRAMING } from "../characters/boss-select.ts";
import { portraitImage, portraitName, portraitOf } from "../characters/portraits.ts";

/**
 * A boss's face and figure outside a battle, from the first load (Nov 16, the bundle split: characters/portraits.ts), so home, the boss
 * select's tiles, the menus, the quests and the profiles draw him on their first frame without his own code. The same pixels as his kit
 * draws (portraits.test.ts). Inside a battle the screens draw his face from his kit (BossCharacter.tsx's BossFace: his look as it is now,
 * his lights).
 */
export function BossPortrait({ boss, class: cls = "", label }: { boss: Pick<BossView, "name" | "icon"> & { form?: BossView["form"] }; class?: string; /** Its name for a screen reader (the boss's own unless given; "": none, its button names it). */ label?: string }) {
  // (In a form of its own, that form's face: the Hidden Boss's child.)
  const name = portraitName(boss);
  const p = portraitOf(name);
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = name && cv.current?.getContext("2d");
    const img = g && portraitImage(name);
    if (!p || !g || !img) return;
    const [x, y, w, h] = p.face;
    g.putImageData(img, -x, -y, x, y, w, h);
  }, [name]);
  // (A boss with no drawing shows nothing here: no emoji stands in for a boss, Eric, Nov 5; BossTag says his name.)
  if (!p) return null;
  return <canvas ref={cv} class={`boss-portrait ${cls}`} width={p.face[2]} height={p.face[3]} {...(label === "" ? { "aria-hidden": "true" } : { role: "img", "aria-label": label ?? boss.name })} />;
}

/**
 * A boss's whole figure for a select tile (docs/decisions/2026-10-23-boss-select-sf.md): its portrait's frame, full size, on a
 * canvas of its own. The stylesheet (`.bs-art`) scales it and puts its neck where `SELECT_FRAMING` says; the tile's slanted
 * shape cuts off what doesn't fit. A boss without a character keeps its emoji.
 */
export function BossArt({ boss, class: cls = "" }: { boss: { id: string; name: string; icon: string }; class?: string }) {
  const name = portraitName({ name: boss.name });
  const p = portraitOf(name);
  const fit = SELECT_FRAMING[boss.id];
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const img = name && portraitImage(name);
    if (img && cv.current) cv.current.getContext("2d")?.putImageData(img, 0, 0);
  }, [name]);
  if (!p || !fit) return <>{boss.icon}</>;
  const style = { "--ax": fit.neck[0], "--ay": fit.neck[1], "--aw": p.w, "--ah": p.h, "--span": fit.span, "--at": fit.at };
  return <canvas ref={cv} class={`bs-art ${cls}`} width={p.w} height={p.h} aria-hidden="true" style={style} />;
}
