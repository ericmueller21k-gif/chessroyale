/**
 * MOCKUP ONLY (town-shop-mockup, Nov 28): the chessboard skins the Pawn Shop's board keeper would sell. Data and CSS for the stills;
 * nothing in the game reads this file.
 *
 * A skin is the board's own color variables (styles.css, "Board colors": --sq-light, --sq-dark, --sq-last, ...) and, for a rank's
 * board, a thin inlaid frame drawn over the outer edge of the edge squares, under the pieces: one pseudo-element, backgrounds only.
 */
export type Motif = "dash" | "dots" | "checks" | "rope" | "rays" | "pearls" | "stars";

export interface Skin {
  id: string;
  name: string;
  kind: "rank" | "basic";
  /** A rank board: its tier's name and the emblem shown on its row (emblems/rank-emblems.ts). */
  tier?: string;
  emblem?: string;
  light: string;
  dark: string;
  /** The last move's tint, the picked square's, the move dot's and the capture ring's (as the board's own variables). */
  last: string;
  select: string;
  dot: string;
  ring: string;
  coordOnDark: string;
  coordOnLight: string;
  /** A rank board's frame: the band's deep color, its metal, its motif, and the corner studs. */
  frame?: { deep: string; metal: string; motif: Motif; stud: string };
  /** Coins. */
  price: number;
}

const ink = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const marks = (deep: string) => ({ select: ink(deep, 0.5), dot: ink(deep, 0.5), ring: ink(deep, 0.38) });

export const SKINS: readonly Skin[] = [
  // ---- One board a rank, Gold and up: the rank's colors (its emblem's field and metal), a little inlaid frame.
  {
    id: "gold", name: "Gold Board", kind: "rank", tier: "Gold", emblem: "gold-d5", light: "#f8ebc8", dark: "#dcab45",
    last: "rgba(40, 150, 100, 0.46)", ...marks("#4a2604"), coordOnDark: "rgba(74, 38, 4, 0.9)", coordOnLight: "rgba(106, 58, 8, 0.8)",
    frame: { deep: "#6a3a08", metal: "#ffd94a", motif: "dash", stud: "#fff3a6" }, price: 400,
  },
  {
    id: "paragon", name: "Paragon Board", kind: "rank", tier: "Paragon", emblem: "paragon-d5", light: "#eaf5e6", dark: "#62ad80",
    last: "rgba(255, 221, 0, 0.46)", ...marks("#0b2a19"), coordOnDark: "rgba(11, 42, 25, 0.9)", coordOnLight: "rgba(26, 79, 49, 0.8)",
    frame: { deep: "#123b24", metal: "#f6c93a", motif: "dots", stud: "#94eaae" }, price: 400,
  },
  {
    id: "illustrious", name: "Illustrious Board", kind: "rank", tier: "Illustrious", emblem: "illustrious-d5", light: "#e7eefb", dark: "#7398de",
    last: "rgba(255, 205, 60, 0.5)", ...marks("#07163e"), coordOnDark: "rgba(255, 255, 255, 0.92)", coordOnLight: "rgba(18, 45, 114, 0.8)",
    frame: { deep: "#0c2157", metal: "#dfe6ee", motif: "checks", stud: "#86aeff" }, price: 400,
  },
  {
    id: "sublime", name: "Sublime Board", kind: "rank", tier: "Sublime", emblem: "sublime-d5", light: "#f4eafc", dark: "#a57fd9",
    last: "rgba(255, 214, 70, 0.5)", ...marks("#1b0b38"), coordOnDark: "rgba(255, 255, 255, 0.92)", coordOnLight: "rgba(55, 26, 120, 0.8)",
    frame: { deep: "#291058", metal: "#f6c93a", motif: "rope", stud: "#d3b0ff" }, price: 400,
  },
  {
    id: "radiant", name: "Radiant Board", kind: "rank", tier: "Radiant", emblem: "radiant-d5", light: "#ffedc7", dark: "#e58a6a",
    last: "rgba(255, 236, 80, 0.58)", ...marks("#2c040c"), coordOnDark: "rgba(44, 4, 12, 0.9)", coordOnLight: "rgba(112, 16, 32, 0.8)",
    frame: { deep: "#701020", metal: "#ffd23c", motif: "rays", stud: "#fff6b8" }, price: 400,
  },
  {
    id: "pearlescent", name: "Pearlescent Board", kind: "rank", tier: "Pearlescent", emblem: "pearlescent", light: "#fdf9fc", dark: "#bdb5d8",
    last: "rgba(240, 140, 195, 0.46)", ...marks("#2c2440"), coordOnDark: "rgba(44, 36, 64, 0.9)", coordOnLight: "rgba(76, 70, 118, 0.8)",
    frame: { deep: "#5c5486", metal: "#fbe9b4", motif: "pearls", stud: "#ffffff" }, price: 400,
  },
  {
    id: "transcendent", name: "Transcendent Board", kind: "rank", tier: "Transcendent", emblem: "transcendent", light: "#e3e8ff", dark: "#7f84e2",
    last: "rgba(90, 225, 255, 0.5)", ...marks("#0f0829"), coordOnDark: "rgba(255, 255, 255, 0.92)", coordOnLight: "rgba(39, 23, 102, 0.8)",
    frame: { deep: "#1d1052", metal: "#b9a1ff", motif: "stars", stud: "#ffffff" }, price: 400,
  },
  // ---- The basic colors: two squares, no frame.
  {
    id: "walnut", name: "Walnut", kind: "basic", light: "#f0d9b5", dark: "#b58863",
    last: "rgba(155, 199, 0, 0.45)", ...marks("#14551e"), coordOnDark: "rgba(255, 255, 255, 0.92)", coordOnLight: "rgba(72, 58, 40, 0.8)", price: 150,
  },
  {
    id: "slate", name: "Slate", kind: "basic", light: "#dee3e6", dark: "#8ca2ad",
    last: "rgba(255, 214, 70, 0.5)", ...marks("#1c2a33"), coordOnDark: "rgba(255, 255, 255, 0.92)", coordOnLight: "rgba(40, 56, 66, 0.8)", price: 150,
  },
  {
    id: "lagoon", name: "Lagoon", kind: "basic", light: "#e6f4f1", dark: "#63ada6",
    last: "rgba(255, 221, 0, 0.46)", ...marks("#0c3a36"), coordOnDark: "rgba(12, 58, 54, 0.9)", coordOnLight: "rgba(30, 90, 84, 0.8)", price: 150,
  },
  {
    id: "blossom", name: "Blossom", kind: "basic", light: "#fdeeee", dark: "#e7a3b0",
    last: "rgba(80, 190, 150, 0.5)", ...marks("#4a1826"), coordOnDark: "rgba(74, 24, 38, 0.9)", coordOnLight: "rgba(140, 60, 80, 0.8)", price: 150,
  },
  {
    id: "graphite", name: "Graphite", kind: "basic", light: "#dcdcdc", dark: "#8f949c",
    last: "rgba(255, 205, 60, 0.5)", ...marks("#16181d"), coordOnDark: "rgba(255, 255, 255, 0.92)", coordOnLight: "rgba(40, 44, 52, 0.8)", price: 150,
  },
];

export const skinOf = (id: string): Skin => SKINS.find((s) => s.id === id)!;

/** A skin's board variables (set on any element round a board). */
export function skinVars(s: Skin): Record<string, string> {
  return {
    "--sq-light": s.light,
    "--sq-dark": s.dark,
    "--sq-last": s.last,
    "--sq-select": s.select,
    "--sq-dot": s.dot,
    "--sq-ring": s.ring,
    "--sq-hover": s.ring,
    "--sq-coord-on-dark": s.coordOnDark,
    "--sq-coord-on-light": s.coordOnLight,
  };
}

/** A motif along one side: its picture and its tile's length along the side (in --fw, the band's width). */
function motif(m: Motif, metal: string, side: "t" | "b" | "l" | "r"): { img: string; tile: number } {
  const h = side === "t" || side === "b";
  const along = h ? "90deg" : "180deg";
  switch (m) {
    case "dash":
      return { img: `linear-gradient(${along}, ${metal} 0 64%, transparent 64%)`, tile: 3 };
    case "dots":
      return { img: `radial-gradient(circle at center, ${metal} 0 30%, transparent 36%)`, tile: 2 };
    case "pearls":
      return { img: `radial-gradient(circle at 42% 40%, #ffffff 0 16%, #f4bcd8 34%, transparent 40%)`, tile: 1.6 };
    case "checks":
      return { img: `linear-gradient(${along}, ${metal} 50%, transparent 50%)`, tile: 2 };
    case "rope":
      return { img: `linear-gradient(${h ? "45deg" : "135deg"}, transparent 32%, ${metal} 32% 68%, transparent 68%)`, tile: 1.4 };
    case "rays": {
      // (Teeth standing on the outer edge, pointing into the board.)
      const from = { t: "from 135deg at 50% 0", b: "from -45deg at 50% 100%", l: "from 45deg at 0 50%", r: "from 225deg at 100% 50%" }[side];
      return { img: `conic-gradient(${from}, ${metal} 90deg, transparent 0)`, tile: 2 };
    }
    case "stars":
      return { img: `radial-gradient(circle at center, #ffffff 0 14%, ${metal} 15% 24%, transparent 30%)`, tile: 4 };
  }
}

/** The frames' rules, one a rank board (`.skin-<id> .hb-board::after`), and the framed boards' coordinates moved in by the band. */
export function skinCss(): string {
  const out: string[] = [
    // (Every coordinate moves in by the band, so the edge ones clear it and they all still line up.)
    `.skin-framed .hb-ranks .hb-coord { padding-left: calc(var(--fw) + 0.14em); padding-top: calc(var(--fw) - 1px); }`,
    `.skin-framed .hb-files .hb-coord { padding-bottom: calc(var(--fw) - 1px); padding-right: calc(var(--fw) + 0.1em); }`,
  ];
  for (const s of SKINS) {
    if (!s.frame) continue;
    const { deep, metal, stud } = s.frame;
    const fw = "var(--fw)";
    const solid = (c: string) => `linear-gradient(${c}, ${c})`;
    const layers: string[] = [];
    // The corner studs.
    for (const pos of ["0 0", "100% 0", "0 100%", "100% 100%"]) layers.push(`${solid(stud)} ${pos} / ${fw} ${fw} no-repeat`);
    // The inner hairline.
    layers.push(`${solid(metal)} 0 calc(${fw} - 1px) / 100% 1px no-repeat`, `${solid(metal)} 0 calc(100% - ${fw} + 1px) / 100% 1px no-repeat`);
    layers.push(`${solid(metal)} calc(${fw} - 1px) 0 / 1px 100% no-repeat`, `${solid(metal)} calc(100% - ${fw} + 1px) 0 / 1px 100% no-repeat`);
    // The motif along each side, then the band under it.
    const t = motif(s.frame.motif, metal, "t");
    const b = motif(s.frame.motif, metal, "b");
    const l = motif(s.frame.motif, metal, "l");
    const r = motif(s.frame.motif, metal, "r");
    layers.push(`${t.img} 0 0 / calc(${fw} * ${t.tile}) ${fw} repeat-x`, `${b.img} 0 100% / calc(${fw} * ${b.tile}) ${fw} repeat-x`);
    layers.push(`${l.img} 0 0 / ${fw} calc(${fw} * ${l.tile}) repeat-y`, `${r.img} 100% 0 / ${fw} calc(${fw} * ${r.tile}) repeat-y`);
    layers.push(`${solid(deep)} 0 0 / 100% ${fw} no-repeat`, `${solid(deep)} 0 100% / 100% ${fw} no-repeat`, `${solid(deep)} 0 0 / ${fw} 100% no-repeat`, `${solid(deep)} 100% 0 / ${fw} 100% no-repeat`);
    out.push(`.skin-${s.id} .hb-board::after { content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none; background: ${layers.join(", ")}; box-shadow: inset 0 0 0 1px ${deep}; }`);
  }
  return out.join("\n");
}
