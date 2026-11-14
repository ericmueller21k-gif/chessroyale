import type { MutableRef } from "preact/hooks";
import type { Character } from "../characters/sprite.ts";

/**
 * The Hidden Boss's final form (Eric, Nov 14: "put a cool visor on him that looks really robotic, and you can see little
 * matrix-style text flowing on it"): a wraparound visor of smoked glass across his eyes in a gunmetal frame, a module at
 * his temple with a light, and tiny glyphs of code flowing down the glass. An original design, drawn in his head part's
 * own pixels (25 x 35, HEAD_SIZE), so it sits on any drawing of him; it rides his head frame by frame the way the engine
 * eye did (`placeEngine`: the first child moved onto the head part's place).
 *
 * The code: three strips of glyphs (every third column each), one small picture made once, each strip sliding down at its
 * own pace in whole sub-pixels (`steps`): transform only, no drawing per frame.
 */

/** The glass, in head pixels: x 4 to 21, rows 17 to 20 (the eyes' rows). */
export const VISOR_GLASS = { x: 4, y: 17, w: 18, h: 4 } as const;
/** Sub-pixels per head pixel in the glyphs (each glyph 2 x 3 of them: a pixel wide, a pixel and a half tall). */
const SUB = 2;
/** The strip's height in sub-pixels (its loop): six glasses tall. */
const LOOP = VISOR_GLASS.h * SUB * 6;
const COLS = Math.floor((VISOR_GLASS.w * SUB) / 3);

const dice = (i: number, k: number) => {
  const v = Math.sin(i * 91.7 + k * 271.3) * 43758.5453;
  return v - Math.floor(v);
};
let STRIPS: string[] | null = null;
/** The three strips' pictures (data URLs): glyphs in falling trails, bright at the head, dimming up the trail. */
function strips(): string[] {
  if (STRIPS) return STRIPS;
  STRIPS = [0, 1, 2].map((layer) => {
    const c = document.createElement("canvas");
    c.width = VISOR_GLASS.w * SUB;
    c.height = LOOP;
    const g = c.getContext("2d")!;
    for (let col = layer; col < COLS; col += 3) {
      const x = col * 3;
      // Each column: one or two trails, each a few glyphs long, the lowest (leading) glyph brightest.
      const trails = 1 + (dice(col, 1) > 0.5 ? 1 : 0);
      for (let tr = 0; tr < trails; tr++) {
        const len = 3 + Math.floor(dice(col, 2 + tr) * 5);
        const head = Math.floor(dice(col, 5 + tr) * (LOOP / 4)) * 4 + tr * (LOOP / 2);
        for (let k = 0; k < len; k++) {
          const y0 = (((head - k * 4) % LOOP) + LOOP) % LOOP;
          const fade = 1 - k / len;
          g.fillStyle = k === 0 ? "rgba(226,255,236,1)" : `rgba(${Math.round(60 + 80 * fade)},${Math.round(200 + 55 * fade)},${Math.round(110 + 40 * fade)},${(0.35 + 0.65 * fade).toFixed(2)})`;
          // A glyph: 2 x 3 sub-pixels, at least three of them lit, its own shape.
          for (let p = 0; p < 6; p++) if (p === 0 || dice(col * 37 + k * 7 + tr, 10 + p) > 0.42) g.fillRect(x + (p % 2), y0 + Math.floor(p / 2), 1, 1);
        }
      }
    }
    return c.toDataURL();
  });
  return STRIPS;
}

/** The visor over his drawing (`ch`'s box), on from `on`. Its structure is the engine eye's: a box, then the head's box. */
export function VisorOverlay({ ch, elRef, on = false, fresh = false }: { ch: Character; elRef: MutableRef<HTMLSpanElement | null>; on?: boolean; fresh?: boolean }) {
  const g = VISOR_GLASS;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <span ref={elRef} class={`bc-engine rc-visor${on ? " on" : ""}${fresh ? " fresh" : ""}`} aria-hidden="true" style={{ "--rc-w": ch.w, "--rc-h": ch.h }}>
      <span class="rc-eng-head">
        <svg class="rc-visor-back" viewBox="0 0 25 35" shape-rendering="crispEdges">
          <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="#06150f" />
        </svg>
        <span class="rc-visor-code" style={{ left: pct(g.x, 25), top: pct(g.y, 35), width: pct(g.w, 25), height: pct(g.h, 35) }}>
          {(on ? strips() : []).map((src, i) => (
            <span key={i} class={`rc-visor-strip rc-vs${i}`} style={{ backgroundImage: `url(${src})`, height: `${(LOOP / (g.h * SUB)) * 200}%` }} />
          ))}
        </span>
        <svg class="rc-visor-frame" viewBox="0 0 25 35" shape-rendering="crispEdges">
          {/* The frame: a bright top rail, the ends wrapping past his face, the bridge on his nose, the temple module. */}
          <rect x="3" y="16" width="20" height="1" fill="#97a5bd" />
          <rect x="4" y="16" width="6" height="1" fill="#c9d4e6" />
          <rect x="2" y="17" width="1" height="3" fill="#262c38" />
          <rect x="3" y="17" width="1" height="4" fill="#4a5468" />
          <rect x="4" y="21" width="7" height="1" fill="#262c38" />
          <rect x="14" y="21" width="8" height="1" fill="#262c38" />
          <rect x="11" y="20" width="3" height="1" fill="#4a5468" />
          <rect x="11" y="21" width="3" height="1" fill="#262c38" />
          <rect x="22" y="16" width="2" height="6" fill="#4a5468" />
          <rect x="22" y="16" width="2" height="1" fill="#97a5bd" />
          <rect x="24" y="17" width="1" height="4" fill="#262c38" />
          <rect x="22" y="20" width="2" height="1" fill="#262c38" />
          {/* The glass's sheen. */}
          <rect x="5" y="17" width="2" height="1" fill="#ffffff" opacity="0.4" />
          <rect x="16" y="17" width="3" height="1" fill="#ffffff" opacity="0.18" />
          <rect class="rc-visor-led" x="22" y="18" width="1" height="1" fill="#7df9ff" />
        </svg>
      </span>
    </span>
  );
}
