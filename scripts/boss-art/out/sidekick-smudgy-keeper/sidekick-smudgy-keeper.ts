/**
 * The gallery owner of Smudgy's Art Gallery (id "sidekick-smudgy-keeper", Nov 6; the director's call: Eric named no shopkeeper): an
 * older chameleon, gray-green and a little faded, in a deep oxblood smock and small gold half-moon glasses perched on its snout, behind
 * the counter. Not a town bot: Dabble (sidekicks/smudgy.ts) stays Smudgy's kid.
 *
 * Dabble's rig, as drawn (its parts, its poses: idle, walk, sit, wave), recolored, with the smock over its body and the glasses over
 * its snout on every frame (where Dabble's head is that frame). Nothing here changes Dabble.
 */
import { type Character, type Frame, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";
import { DABBLE_GROUND, DABBLE_PARTS, SIDEKICK_PALETTE, dabblePartAt, sidekickSmudgy } from "../../../../packages/app/src/characters/sidekicks/smudgy.ts";

const PALETTE: Record<string, string> = {
  ...SIDEKICK_PALETTE,
  // Its skin: Dabble's green gone gray with age.
  a: "#33402f",
  b: "#4f5f47",
  c: "#6f8263",
  d: "#93a584",
  e: "#bccaae",
  // The smock: oxblood, deep to lit.
  "3": "#4a1620",
  "4": "#6e2230",
  "5": "#93374a",
  // The glasses: gold rims, a pale glint.
  "6": "#c99a45",
  "7": "#f3efe2",
};

/** The smock: a round apron over the body, to the knees, a pocket, a fleck or two of paint. */
const SMOCK: Part = (() => {
  const w = 19;
  const h = 15;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = "";
    for (let x = 0; x < w; x++) {
      const d = ((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2;
      if (d > 1) r += ".";
      else if (x >= 8 && x <= 12 && y >= 8 && y <= 11) r += y === 8 ? "3" : "4";
      else if ((x === 5 && y === 4) || (x === 13 && y === 6)) r += x === 5 ? "v" : "R";
      else r += x < 6 ? "5" : x > 13 || y > 11 ? "3" : "4";
    }
    rows.push(r);
  }
  return { grid: rows };
})();
/** Small half-moon glasses, perched on the snout: two rims and a bridge, the lenses' upper halves catching the light. */
const GLASSES: Part = { grid: ["6666.6666", "6776.6776", "6..666..6", ".66...66."], outline: false };

/** Where the glasses sit on the head (frame pixels, with the head unmoved) and the smock on the body. */
const GLASSES_AT = [30, 29] as const;
const SMOCK_AT = [1, 3] as const;

const parts = new Proxy({} as Record<string, Part>, {
  get: (_, k) => (k === "smock" ? SMOCK : k === "glasses" ? GLASSES : typeof k === "string" ? DABBLE_PARTS[k] : undefined),
  has: (_, k) => k === "smock" || k === "glasses" || (typeof k === "string" && k in DABBLE_PARTS),
});

/** A Dabble frame worn by the keeper: the smock just over the body, the glasses over the near eye (where the head is this frame). */
function dressed(f: Frame): Frame {
  const out: Layer[] = [];
  let head: Layer | null = null;
  for (const l of f.layers) {
    out.push(l);
    if (l.part === "body") out.push({ part: "smock", x: l.x + SMOCK_AT[0], y: l.y + SMOCK_AT[1] });
    if (l.part.startsWith("head:")) head = l;
    if (l.part.startsWith("eyeN:") && head) {
      const at = dabblePartAt(head.part) ?? [head.x, head.y];
      out.push({ part: "glasses", x: GLASSES_AT[0] + head.x - at[0], y: GLASSES_AT[1] + head.y - at[1] });
    }
  }
  return { ...f, layers: out };
}
const anim = (name: "idle" | "walk" | "sit" | "wave") => {
  const a = sidekickSmudgy.anims[name]!;
  return { ...a, frames: a.frames.map(dressed) };
};

export const sidekickSmudgyKeeper: Character = {
  id: "sidekick-smudgy-keeper",
  name: "Smudgy's gallery owner",
  w: sidekickSmudgy.w,
  h: sidekickSmudgy.h,
  foot: [26, DABBLE_GROUND],
  palette: PALETTE,
  halo: "#26301f",
  parts,
  anims: { idle: anim("idle"), walk: anim("walk"), sit: anim("sit"), wave: anim("wave") },
};
