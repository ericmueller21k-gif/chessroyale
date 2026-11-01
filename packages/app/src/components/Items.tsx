import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { aboveHat, behindPiece, isShiny, secondColor, type ItemLook, type ItemSlot } from "@chessroyale/core";
import { LINE, Region, darken, isLight, lighten, lw, mirror, usePaint as paintIn, type Finish, type Paint } from "./item-paint.tsx";

import { rideOf, type RiderDraft } from "./rides/kit.ts";
import { rideScale, scaledAt, scaledSeat, seatAnchor } from "./rides/scale.ts";

export { type Finish } from "./item-paint.tsx";
export { blotchPath } from "./blotches.ts";

/**
 * Crate items, drawn. Every item is drawn once, on a pawn's 100 × 100 square (head centered at 50, 20), with its
 * *paint regions* marked: those get the item's color automatically, then its blemish (dark blotches over exactly
 * that share of the color, shaped by the item's seed; at 0% purity, all of it, a darker shade) and, at 90%+
 * purity, a sweeping shine. Outlines and fixed parts (white fur, coal, ice) stay as drawn. A new item is one
 * drawing; every color comes free.
 */

/** An item's paint, its shine rolling across the item's own box (SHINE_BOX, or its frame). */
const usePaint = (finish: Finish, def: string): Paint => paintIn(finish, SHINE_BOX[def] ?? FRAMES[def] ?? [0, 0, 100, 100]);

// ---------------- The items ----------------

function SantaHat({ p }: { p: Paint }) {
  return (
    <g>
      <Region p={p} name="cone" d={["M37 21 Q39 6 54 5 Q67 5 72 15 L67 18 Q62 12 56 12 Q61 16 63 21 Z"]} />
      <rect x="33" y="18" width="34" height="8" rx="4" fill="#f8fafc" {...LINE} />
      <circle cx="70" cy="18" r="4.6" fill="#f8fafc" {...LINE} />
    </g>
  );
}

const ANTLER = "M47 16 L44 19 L37 12 L29 11 L27 7 L34 7 L31 0 L35 -2 L38 6 L40 7 L39 -4 L43 -4 L44 7 L50 13 Z";
function Antlers({ p }: { p: Paint }) {
  return <Region p={p} name="antlers" d={[ANTLER, mirror(ANTLER)]} />;
}

function SantaBeard({ p }: { p: Paint }) {
  return (
    <g>
      <Region p={p} name="beard" d={["M39 21 Q39 31 43 37 Q46 42 50 44 Q54 42 57 37 Q61 31 61 21 Q57 27 53 25 Q50 28 47 25 Q43 27 39 21 Z"]} />
      <path d="M45.5 26.5 Q50 30 54.5 26.5" fill="none" stroke="#1d1d1f" {...lw(2)} stroke-linecap="round" />
    </g>
  );
}

function Snowman({ p, side }: { p: Paint; side: "w" | "b" }) {
  const snow = side === "w" ? "#f8fafc" : "#4b5262";
  const coal = side === "w" ? "#1d1d1f" : "#e5e7eb";
  return (
    <g>
      {/* Stick arms, behind the body. */}
      <path d="M38 45 L22 34 M27 37 L24 30 M62 45 L78 34 M73 37 L76 30" fill="none" stroke="#6b4423" {...lw(2.6)} stroke-linecap="round" />
      <ellipse class="skin-shadow" cx="50" cy="88" rx="26" ry="3.5" fill="#000" opacity="0.12" />
      <circle cx="50" cy="69" r="20" fill={snow} {...LINE} />
      <circle cx="50" cy="44" r="14" fill={snow} {...LINE} />
      <circle cx="50" cy="20" r="10.5" fill={snow} {...LINE} />
      <circle cx="46" cy="18" r="1.6" fill={coal} />
      <circle cx="54" cy="18" r="1.6" fill={coal} />
      <path d="M50 21 L59 23.2 L50 24.6 Z" fill="#f97316" stroke="#9a3412" {...lw(1)} stroke-linejoin="round" />
      <circle cx="50" cy="42" r="1.7" fill={coal} />
      <circle cx="50" cy="49" r="1.7" fill={coal} />
      <circle cx="50" cy="64" r="1.7" fill={coal} />
      {/* The scarf: the painted part. */}
      <Region p={p} name="scarf" d={["M38 29 Q50 35 62 29 L63 35 Q50 41 37 35 Z", "M54 35 L60 50 L54 52 L50 38 Z"]} />
    </g>
  );
}

/**
 * The Gift-Wrap Tube (a weapon): a slim roll of wrapping paper, three candy stripes repeating its whole length (Eric,
 * Oct 15: no end caps, thinner and a little longer). One stripe is always white; the other two take the item's color
 * and its second color, which the item's seed gives (`secondColor`). Drawn upright here, tilted in its group.
 */
export const TUBE = { x0: 78, x1: 86, top: 16, bottom: 100 };
/** The tube's stripes, [white, first color, second color]: bands `BAND` tall that climb `RISE` across the tube. */
export const TUBE_STRIPES = (() => {
  const BAND = 4.6;
  const RISE = 6;
  const out: string[][] = [[], [], []];
  /** One edge of a band, cut where it leaves the tube's top or bottom (Sutherland-Hodgman, two horizontal lines). */
  const cut = (poly: number[][], y: number, keepBelow: boolean) => {
    const inside = (q: number[]) => (keepBelow ? q[1]! >= y : q[1]! <= y);
    const res: number[][] = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      if (inside(a)) res.push(a);
      if (inside(a) !== inside(b)) res.push([a[0]! + ((b[0]! - a[0]!) * (y - a[1]!)) / (b[1]! - a[1]!), y]);
    });
    return res;
  };
  let k = 0;
  for (let y = TUBE.top - BAND; y < TUBE.bottom + RISE; y += BAND, k++) {
    const band = [
      [TUBE.x0, y],
      [TUBE.x1, y - RISE],
      [TUBE.x1, y - RISE + BAND],
      [TUBE.x0, y + BAND],
    ];
    const poly = cut(cut(band, TUBE.top, true), TUBE.bottom, false);
    if (poly.length >= 3) out[k % 3]!.push(`M${poly.map((q) => q.map((n) => +n.toFixed(2)).join(" ")).join(" L")} Z`);
  }
  return out;
})();
function GiftTube({ p, p2 }: { p: Paint; p2: Paint }) {
  const [white, first, second] = TUBE_STRIPES;
  return (
    <g transform="rotate(16 82 58)">
      {white!.map((d) => (
        <path key={d} d={d} fill="#fbfbf8" />
      ))}
      <Region p={p} name="stripes" d={first!} outline={false} />
      <Region p={p2} name="stripes2" d={second!} outline={false} />
      <rect x={TUBE.x0} y={TUBE.top} width={TUBE.x1 - TUBE.x0} height={TUBE.bottom - TUBE.top} rx="1.2" fill="none" {...LINE} {...lw(2.4)} />
    </g>
  );
}

function FireIceCrown({ p }: { p: Paint }) {
  const id = p.id;
  const flame = (x: number, y: number, s: number) =>
    `M${x} ${y} C${x - 5 * s} ${y - 4 * s} ${x - 2 * s} ${y - 9 * s} ${x} ${y - 13 * s} C${x + 1 * s} ${y - 8 * s} ${x + 6 * s} ${y - 6 * s} ${x} ${y} Z`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-ice`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f0fbff" />
          <stop offset="1" stop-color="#8fd3f4" />
        </linearGradient>
      </defs>
      <Region p={p} name="flames" fill={p.flameFill} d={[flame(39, 14, 0.8), flame(50, 9, 1), flame(61, 14, 0.8)]} />
      <path d="M33 26 L33 14 L39 18 L44 9 L50 15 L56 9 L61 18 L67 14 L67 26 Z" fill={`url(#${id}-ice)`} {...LINE} />
      <path d="M36 22 L64 22" stroke="#bae6fd" {...lw(1.6)} />
      <circle cx="50" cy="21" r="2.2" fill="#38bdf8" stroke="#1d1d1f" {...lw(1.2)} />
    </g>
  );
}

/** The present's visor: an oval cut out of the box (wound the other way, so it's a hole); the ribbon stops at it. */
const VISOR = "M41 30.5 a9 4 0 1 0 18 0 a9 4 0 1 0 -18 0 Z";
/**
 * A present, worn as a helmet: the box over the head down to the neck, with a visor to see the face through; its
 * ribbon and bow in the second color.
 */
function Present({ p, p2 }: { p: Paint; p2: Paint }) {
  return (
    <g>
      <Region p={p} name="box" d={[`M37 22 L63 22 L63 38 Q63 39.5 61.5 39.5 L38.5 39.5 Q37 39.5 37 38 Z ${VISOR}`, "M35 15.5 Q35 14.5 36 14.5 L64 14.5 Q65 14.5 65 15.5 L65 22 L35 22 Z"]} />
      <Region
        p={p2}
        name="ribbon"
        d={["M47 14.5 H53 V26.73 A9 4 0 0 0 47 26.73 Z", "M47 39.5 V34.27 A9 4 0 0 0 53 34.27 V39.5 Z", "M50 14.5 C44 4 34 7 40 14.5 Z", "M50 14.5 C56 4 66 7 60 14.5 Z"]}
      />
      {/* A hint of glass, and a glint. */}
      <path d={VISOR} fill="#fff" opacity="0.12" />
      <path d="M44 28.6 Q46.5 27.4 49 27.3" fill="none" stroke="#fff" opacity="0.7" stroke-linecap="round" {...lw(1.3)} />
      <path d="M47 22 H53" fill="none" {...LINE} {...lw(2)} />
      <Region p={p2} name="knot" d={["M47.4 13.6 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 Z"]} outline={false} />
      <circle cx="50" cy="13.6" r="2.6" fill="none" {...LINE} {...lw(2)} />
    </g>
  );
}

/** A candy cane at the pawn's side: white, striped in its color. */
const CANE = "M86 94 L86 30 A14 14 0 0 0 58 30 L58 33 A3 3 0 0 0 64 33 L64 30 A8 8 0 0 1 80 30 L80 94 A3 3 0 0 0 86 94 Z";
function CandyCane({ p }: { p: Paint }) {
  const stripes = [];
  for (let y = -6; y < 112; y += 10) stripes.push(`M50 ${y} L100 ${y + 22} L100 ${y + 27} L50 ${y + 5} Z`);
  return (
    <g transform="rotate(14 80 60)">
      <clipPath id={`${p.id}-cane`}>
        <path d={CANE} />
      </clipPath>
      <path d={CANE} fill="#fbfbf8" />
      <g clip-path={`url(#${p.id}-cane)`}>
        <Region p={p} name="stripes" d={stripes} outline={false} />
        <path d="M84.5 34 V90" stroke="#fff" opacity="0.55" {...lw(1.6)} stroke-linecap="round" />
      </g>
      <path d={CANE} fill="none" {...LINE} />
    </g>
  );
}

/** A gingerbread man (a skin): the whole cookie takes the color; white icing, gumdrop buttons. */
const GINGER =
  "M56 34.5 Q60 38 66 39 L78 40 Q84 41 84 47 Q84 53 78 53 L64 53 L64 62 L74 82 Q77 89 70 91 Q65 92 63 87 L53 73 Q50 68 47 73 L37 87 Q35 92 30 91 Q23 89 26 82 L36 62 L36 53 L22 53 Q16 53 16 47 Q16 41 22 40 L34 39 Q40 38 44 34.5 A13 13 0 1 1 56 34.5 Z";
function Gingerbread({ p, side }: { p: Paint; side: "w" | "b" }) {
  const icing = side === "w" ? "#fffdf7" : "#2b1d16";
  const zig = (x: number, y: number, dx: number, dy: number, n: number) => {
    let d = `M${x} ${y}`;
    for (let i = 1; i <= n; i++) d += ` L${x + dx * i} ${y + (i % 2 ? dy : 0)}`;
    return d;
  };
  return (
    <g>
      <ellipse class="skin-shadow" cx="50" cy="92" rx="26" ry="3" fill="#000" opacity="0.12" />
      <Region p={p} name="cookie" d={[GINGER]} />
      <g fill="none" stroke={icing} stroke-linecap="round" stroke-linejoin="round" {...lw(1.8)}>
        <path d="M22.5 42 Q25 46.5 22.5 51" />
        <path d={"M77.5 42 Q75 46.5 77.5 51"} />
        <path d={zig(27, 82.5, 2, 2.4, 4)} />
        <path d={zig(65, 82.5, 2, 2.4, 4)} />
        <path d="M45 27 Q50 31 55 27" />
      </g>
      <circle cx="45.5" cy="21" r="1.9" fill={icing} />
      <circle cx="54.5" cy="21" r="1.9" fill={icing} />
      {[44, 52, 60].map((y, i) => (
        <circle key={y} cx="50" cy={y} r="2.6" fill={["#e11d48", "#16a34a", "#e11d48"][i]} stroke="#1d1d1f" {...lw(1.2)} />
      ))}
    </g>
  );
}

/** The cburnett pawn (Colin M.L. Burnett, BSD: board/pieces/LICENSE.txt), on the 100 × 100 square (for skins that show the pawn itself). */
const PAWN_PATH =
  "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z";

/**
 * A chimney (a skin): the pawn sitting in a brick chimney up to its chest. The bricks and the cap take the color;
 * the mortar is a shade of it (lighter on a dark color, darker on a light one), so the bricks still read.
 */
function Chimney({ p, side }: { p: Paint; side: "w" | "b" }) {
  const bricks = [];
  for (let row = 0, y = 64; y < 96; row++, y += 6.5) {
    bricks.push(<path key={`h${y}`} d={`M24 ${y} H76`} />);
    for (let x = row % 2 ? 31 : 37.5; x < 76; x += 13) bricks.push(<path key={`v${y}-${x}`} d={`M${x} ${y} v6.5`} />);
  }
  const mortar = isLight(p.hex) ? darken(p.hex, 0.3) : lighten(p.hex, 0.55);
  return (
    <g>
      <g transform="scale(2.2222)">
        <path d={PAWN_PATH} fill={side === "w" ? "#fff" : "#000"} stroke="#000" stroke-width="1.5" stroke-linecap="round" />
      </g>
      <ellipse class="skin-shadow" cx="50" cy="95" rx="30" ry="3" fill="#000" opacity="0.12" />
      <Region
        p={p}
        name="bricks"
        d={["M24 61 H76 V94 H24 Z"]}
        over={
          <g fill="none" stroke={mortar} {...lw(1.5)}>
            {bricks}
          </g>
        }
      />
      <Region p={p} name="cap" d={["M19 55 Q19 53.5 20.5 53.5 L79.5 53.5 Q81 53.5 81 55 L81 62.5 L19 62.5 Z"]} />
    </g>
  );
}

/** A plain knit beanie: the crown and a ribbed cuff, snug on the head. */
function Beanie({ p }: { p: Paint }) {
  const ribs = [];
  for (let x = 42.5; x < 58; x += 2.5) ribs.push(<path key={x} d={`M${x} 22.5 V26.5`} />);
  return (
    <g>
      <Region p={p} name="crown" d={["M41 23 C41 11.5 59 11.5 59 23 Z"]} />
      <Region
        p={p}
        name="cuff"
        d={["M42.5 21.5 H57.5 Q60.5 21.5 60.5 24.25 Q60.5 27 57.5 27 H42.5 Q39.5 27 39.5 24.25 Q39.5 21.5 42.5 21.5 Z"]}
        over={
          <g stroke="#000" opacity="0.22" {...lw(1)}>
            {ribs}
          </g>
        }
      />
    </g>
  );
}

/**
 * Ski goggles: the frame (and its strap) in the color, a see-through lens in the second color. Thinner outlines
 * than usual, so the frame still shows on a pawn-sized avatar.
 */
const LENS = "M43 25.6 Q39.8 25.6 39.8 28.4 V29.7 Q39.8 32.4 43 32.4 H46.6 Q47.5 32.4 48.2 31.2 Q50 28.9 51.8 31.2 Q52.5 32.4 53.4 32.4 H57 Q60.2 32.4 60.2 29.7 V28.4 Q60.2 25.6 57 25.6 Z";
const GOGGLES =
  "M42.5 23.2 H57.5 Q62.8 23.2 62.8 28 V30 Q62.8 34.8 57.5 34.8 H54 Q52.3 34.8 51.4 33.2 Q50 31.4 48.6 33.2 Q47.7 34.8 46 34.8 H42.5 Q37.2 34.8 37.2 30 V28 Q37.2 23.2 42.5 23.2 Z";
function SkiGoggles({ p, p2 }: { p: Paint; p2: Paint }) {
  const thin = { ...LINE, ...lw(1.6) };
  return (
    <g>
      <Region p={p} name="strap" d={["M34 27.2 H66 V30.8 H34 Z"]} outline={false} />
      <path d="M34 27.2 H66 V30.8 H34 Z" fill="none" {...thin} />
      <g opacity="0.6">
        <Region p={p2} name="lens" d={[LENS]} outline={false} />
      </g>
      <path d="M43.2 31 L47 26.7 M46.4 31 L48.8 28.4" fill="none" stroke="#fff" opacity="0.7" stroke-linecap="round" {...lw(1.2)} />
      <Region p={p} name="frame" d={[`${GOGGLES} ${LENS}`]} outline={false} />
      <path d={`${GOGGLES} ${LENS}`} fill="none" {...thin} />
    </g>
  );
}

/**
 * A Christmas tree T-shirt (a skin): the pawn in a T-shirt, white on the white side and nearly black on the black
 * side, printed with a tree whose bulbs take the color.
 */
function TreeTee({ p, side }: { p: Paint; side: "w" | "b" }) {
  const shirt = side === "w" ? "#fbfbf8" : "#2e323b";
  const bulbs = [
    [49.5, 52.5],
    [53, 58.2],
    [46.4, 59],
    [56.4, 64.8],
    [50, 64.2],
    [43.4, 65.4],
  ].map(([x, y]) => `M${x! - 1.9} ${y} a1.9 1.9 0 1 0 3.8 0 a1.9 1.9 0 1 0 -3.8 0 Z`);
  return (
    <g>
      <g transform="scale(2.2222)">
        <path d={PAWN_PATH} fill={side === "w" ? "#fff" : "#000"} stroke="#000" stroke-width="1.5" stroke-linecap="round" />
      </g>
      <path
        d="M44.5 37 Q50 41.5 55.5 37 L61.5 38.8 L71 46 L67.5 52 L63.6 49.5 L73.5 76 Q50 78.5 26.5 76 L36.4 49.5 L32.5 52 L29 46 L38.5 38.8 Z"
        fill={shirt}
        {...LINE}
      />
      <path d="M63.6 49.5 L64.8 46.2 M36.4 49.5 L35.2 46.2" fill="none" {...LINE} {...lw(1.6)} />
      <path d="M50 46.5 L56 54.5 L53.5 54.5 L59 61 L56 61 L61.5 68 L38.5 68 L44 61 L41 61 L46.5 54.5 L44 54.5 Z" fill="#1f8a4c" stroke="#14532d" stroke-linejoin="round" {...lw(1.2)} />
      <rect x="47.5" y="68" width="5" height="4.5" fill="#7a4a24" stroke="#3b230f" {...lw(1)} />
      <path d="M50 42.6 L51 45.2 L53.7 45.3 L51.6 47 L52.3 49.6 L50 48.1 L47.7 49.6 L48.4 47 L46.3 45.3 L49 45.2 Z" fill="#f5c542" stroke="#8a6a12" stroke-linejoin="round" {...lw(0.8)} />
      <Region p={p} name="bulbs" d={bulbs} outline={false} />
      {bulbs.map((b) => (
        <path key={b} d={b} fill="none" stroke="#1d1d1f" {...lw(1)} />
      ))}
    </g>
  );
}

/** A long knit scarf (Winter), wrapped at the neck with one end hanging down the front; light knit stripes on the end. */
function Scarf({ p }: { p: Paint }) {
  const stripes = (
    <g fill={lighten(p.hex, 0.55)}>
      <path d="M50 44 L58.6 41.6 L59.6 44.4 L51 46.8 Z" />
      <path d="M52 49.6 L60.6 47.2 L61.6 50 L53 52.4 Z" />
    </g>
  );
  return (
    <g>
      <Region p={p} name="end" d={["M52 36 L59.5 36 L63 54.5 L54.5 57 Z"]} over={stripes} line={2.4} />
      <path d="M55.6 57.2 L56 59.6 M58.4 56.4 L58.8 58.8 M61.2 55.6 L61.6 58" fill="none" {...LINE} {...lw(1.6)} />
      <Region p={p} name="wrap" d={["M38.5 31.5 Q50 36.5 61.5 31.5 L63 37.5 Q50 43 37 37.5 Z"]} line={2.4} />
    </g>
  );
}

/** A party hat (Beta: the old shop's): the cone in its color, stripes a light tint of it, a white pom-pom. */
function PartyHat({ p }: { p: Paint }) {
  return (
    <g>
      <Region
        p={p}
        name="cone"
        d={["M50 6 L61 26 L39 26 Z"]}
        over={
          <g fill={lighten(p.hex, 0.6)}>
            <path d="M44.6 15.8 L55.4 15.8 L57 18.8 L43 18.8 Z" />
            <path d="M41.3 21.8 L58.7 21.8 L60.2 24.6 L39.8 24.6 Z" />
          </g>
        }
      />
      <circle cx="50" cy="6" r="3.6" fill="#fbfbf8" {...LINE} {...lw(2.4)} />
    </g>
  );
}

/** A wizard's hat (Beta: the old shop's): a wide brim and a bent cone in its color, a gold star. */
function WizardHat({ p }: { p: Paint }) {
  return (
    <g>
      <Region p={p} name="cone" d={["M37.5 25 Q45 15 52.5 3.5 Q55.5 15 62.5 25 Z"]} />
      <Region p={p} name="brim" d={["M31 25.5 Q50 20.5 69 25.5 L65.5 29 Q50 25 34.5 29 Z"]} />
      <path d="M50.5 12.5 l1.3 2.7 2.9 .4 -2.1 2 .5 2.9 -2.6-1.4 -2.6 1.4 .5-2.9 -2.1-2 2.9-.4 Z" fill="#fde047" stroke="#1d1d1f" stroke-linejoin="round" {...lw(1)} />
    </g>
  );
}

/** A top hat (Beta: the old shop's): the hat in its color, its band a shade of it. */
function TopHat({ p }: { p: Paint }) {
  const band = isLight(p.hex) ? darken(p.hex, 0.45) : lighten(p.hex, 0.5);
  return (
    <g>
      <Region
        p={p}
        name="crown"
        d={["M40 6 Q40 4.5 41.5 4.5 H58.5 Q60 4.5 60 6 V24 H40 Z"]}
        over={<rect x="38" y="17" width="24" height="4.5" fill={band} />}
      />
      <path d="M40 17 H60 M40 21.5 H60" fill="none" stroke="#1d1d1f" {...lw(1.2)} />
      <Region p={p} name="brim" d={["M33 23.5 Q33 22 34.5 22 H65.5 Q67 22 67 23.5 V26 Q67 27.5 65.5 27.5 H34.5 Q33 27.5 33 26 Z"]} />
    </g>
  );
}

/** A Viking helm (Beta: the old shop's): the helmet in its color, cream horns and a brass rim. */
function VikingHelm({ p }: { p: Paint }) {
  return (
    <g>
      <path d="M36 21 Q25 18 23.5 4 Q30 14 37.5 15.5 Z" fill="#fef3c7" {...LINE} {...lw(2.4)} />
      <path d="M64 21 Q75 18 76.5 4 Q70 14 62.5 15.5 Z" fill="#fef3c7" {...LINE} {...lw(2.4)} />
      <Region p={p} name="dome" d={["M35 25 Q35 6.5 50 6.5 Q65 6.5 65 25 Z"]} over={<path d="M50 6.5 V22" stroke="#000" opacity="0.25" {...lw(2)} />} />
      <rect x="34" y="21.5" width="32" height="5" rx="2" fill="#b07d1e" {...LINE} {...lw(2.4)} />
      <g fill="#7a5410">
        <circle cx="39" cy="24" r="0.9" />
        <circle cx="45" cy="24" r="0.9" />
        <circle cx="55" cy="24" r="0.9" />
        <circle cx="61" cy="24" r="0.9" />
      </g>
    </g>
  );
}

/** A little crown (Beta: the old shop's): the crown in its color (Yellow is the gold one), a blue jewel. */
function LittleCrown({ p }: { p: Paint }) {
  return (
    <g>
      <Region p={p} name="crown" d={["M36 26 L34.5 9 L42.5 16 L50 4.5 L57.5 16 L65.5 9 L64 26 Z"]} over={<path d="M35.5 22 H64.5" stroke="#000" opacity="0.2" {...lw(1.6)} />} />
      <circle cx="50" cy="20" r="2.6" fill="#38bdf8" stroke="#1d1d1f" {...lw(1.2)} />
      <g fill="#fbfbf8" stroke="#1d1d1f" {...lw(1)}>
        <circle cx="34.5" cy="8.5" r="1.6" />
        <circle cx="50" cy="4" r="1.6" />
        <circle cx="65.5" cy="8.5" r="1.6" />
      </g>
    </g>
  );
}

/** An eyepatch (Beta, pirate): the patch in its color, stitched in a light shade of it, over one eye; a dark strap. */
function Eyepatch({ p }: { p: Paint }) {
  return (
    <g>
      <path d="M40.6 23 L50.2 26.4" fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(1.8)} />
      <Region p={p} name="patch" d={["M49.4 25.6 Q54.6 23.6 59.8 25.8 Q60.4 31.6 54.6 34.8 Q48.8 31.6 49.4 25.6 Z"]} line={1.8} />
      {/* A stitched edge in a light shade, so the patch has some detail in any color (and shows on a black pawn). */}
      <path d="M50.9 26.6 Q54.6 25.2 58.4 26.8 Q58.8 31 54.6 33.3 Q50.4 31 50.9 26.6 Z" fill="none" stroke={lighten(p.hex, 0.55)} stroke-dasharray="1.1 1" opacity="0.8" {...lw(0.8)} />
    </g>
  );
}

/** Dark shades (Beta, agent): chunky frames in its color, dark lenses with a glint. Thin outlines, like the goggles. */
const SHADES_LENS = "M41 27.4 L41.7 30.8 Q42 32 43.4 32 H46 Q47.4 32 47.8 30.8 L48.6 28.3 Q48.8 27.4 47.8 27.4 Z M52.2 27.4 Q51.2 27.4 51.4 28.3 L52.2 30.8 Q52.6 32 54 32 H56.6 Q58 32 58.3 30.8 L59 27.4 Z";
const SHADES = "M39.2 25.6 H60.8 Q61.8 25.6 61.6 26.8 L60.5 31.4 Q59.9 33.6 57.4 33.6 H53.6 Q51.6 33.6 51 31.8 L50.6 30.4 Q50 29.2 49.4 30.4 L49 31.8 Q48.4 33.6 46.4 33.6 H42.6 Q40.1 33.6 39.5 31.4 L38.4 26.8 Q38.2 25.6 39.2 25.6 Z";
function DarkShades({ p }: { p: Paint }) {
  const thin = { ...LINE, ...lw(1.4) };
  return (
    <g>
      <path d="M38.6 26.6 L36.8 27.4 M61.4 26.6 L63.2 27.4" fill="none" {...thin} />
      <path d={SHADES_LENS} fill="#15171d" />
      <path d="M43 30.6 L45.6 28.4 M54.2 30.6 L56.8 28.4" fill="none" stroke="#fff" opacity="0.6" stroke-linecap="round" {...lw(1)} />
      <Region p={p} name="frame" d={[`${SHADES} ${SHADES_LENS}`]} outline={false} />
      <path d={`${SHADES} ${SHADES_LENS}`} fill="none" {...thin} />
    </g>
  );
}

/**
 * A smiley face (Beta, a one-off): a flat round dot smiley over the whole head, in its color; dark dot eyes and smile.
 * A third bigger than first drawn (Eric, Oct 15), around the same middle (50, 29), lines and all.
 */
function SmileyFace({ p }: { p: Paint }) {
  const n = parseInt(p.hex.slice(1), 16);
  const dark = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.25;
  const ink = dark ? "#f8fafc" : "#1d1d1f";
  return (
    <g>
      <Region p={p} name="face" d={["M36 29 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 Z"]} line={3.2} />
      <ellipse cx="45.08" cy="24.74" rx="1.8" ry="2.66" fill={ink} />
      <ellipse cx="54.92" cy="24.74" rx="1.8" ry="2.66" fill={ink} />
      <path d="M42.02 31.13 Q50 39.64 57.98 31.13" fill="none" stroke={ink} stroke-linecap="round" {...lw(2.5)} />
    </g>
  );
}

/**
 * A suit and tie (Beta, agent; a skin): the pawn in a suit jacket in its color, a white shirt, the tie in the second
 * color, a pocket square. The pawn's head and base show, so it reads as white or black.
 */
const SUIT = "M44.2 36.4 Q50 39.6 55.8 36.4 L63.5 38.6 Q68.6 40.6 68.8 46.5 L70.4 74.5 Q50 79 29.6 74.5 L31.2 46.5 Q31.4 40.6 36.5 38.6 Z";
function SuitAndTie({ p, p2, side }: { p: Paint; p2: Paint; side: "w" | "b" }) {
  return (
    <g>
      <g transform="scale(2.2222)">
        <path d={PAWN_PATH} fill={side === "w" ? "#fff" : "#000"} stroke="#000" stroke-width="1.5" stroke-linecap="round" />
      </g>
      <Region p={p} name="suit" d={[SUIT]} />
      {/* The shirt in the jacket's V, then the lapels and the arms' seams. */}
      <path d="M44.6 37 Q50 40.2 55.4 37 L50 56 Z" fill="#fbfbf8" stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.4)} />
      <g fill="none" stroke="#1d1d1f" stroke-linejoin="round" stroke-linecap="round" {...lw(1.4)}>
        <path d="M44.2 36.6 L41.6 43.4 L44.4 44.6 L42.6 46.8 L50 56.2" />
        <path d="M55.8 36.6 L58.4 43.4 L55.6 44.6 L57.4 46.8 L50 56.2" />
        <path d="M37.4 46.5 L36.6 72 M62.6 46.5 L63.4 72" opacity="0.65" />
      </g>
      <Region p={p2} name="tie" d={["M48.3 38.9 H51.7 L51 41.6 H49 Z", "M49 41.6 H51 L52.5 51.6 L50 54.6 L47.5 51.6 Z"]} line={1.3} />
      <path d="M55.8 48.2 L60.8 47.4 L60.2 45 L58.6 46.4 L57.4 44.8 Z" fill="#fbfbf8" stroke="#1d1d1f" stroke-linejoin="round" {...lw(1)} />
      <path d="M55.4 48.4 L61.6 47.4" fill="none" stroke="#1d1d1f" {...lw(1.2)} />
      <circle cx="50" cy="60" r="1.25" fill="#1d1d1f" />
      <circle cx="50" cy="66" r="1.25" fill="#1d1d1f" />
    </g>
  );
}

/**
 * A Tommy gun (Beta, agent; Mythic): held upright at the pawn's side. The metal (receiver, drum, finned barrel) in
 * its color, the wood (stock and grips) in the second. Drawn along its own x axis (stock at 0, muzzle at 82), then
 * tilted. Thinner outlines, so the barrel shows on a small pawn.
 */
function TommyGun({ p, p2 }: { p: Paint; p2: Paint }) {
  const fins = [];
  for (let x = 51.5; x < 64; x += 2) fins.push(<path key={x} d={`M${x} -3.2 V3.2`} />);
  return (
    <g transform="translate(64 90) rotate(-66)">
      <Region p={p2} name="stock" d={["M0 -3 L20 -2.6 L20 3.8 L0 9 Q-1.6 9 -1.6 7.4 L-1.6 -1.4 Q-1.6 -3 0 -3 Z"]} line={2} />
      <Region p={p2} name="grip" d={["M24 3 H30 L32 12.6 Q32.4 14.8 30.4 14.8 H27.4 Q25.6 14.8 25.3 13.2 Z", "M65.8 1.8 H71 L70.4 11.6 Q70.3 13.4 68.6 13.4 H67.8 Q66.2 13.4 66.2 11.8 Z"]} line={2} />
      <path d="M30.4 3 Q31 8.4 35.6 8.4 L36.8 3" fill="none" {...LINE} {...lw(1.6)} />
      <Region p={p} name="barrel" d={["M47 -1.8 H78 V1.8 H47 Z", "M76.8 -2.7 H82 V2.7 H76.8 Z"]} line={1.8} />
      <Region p={p} name="fins" d={["M50 -3.4 H64.5 V3.4 H50 Z"]} over={<g stroke="#000" opacity="0.4" {...lw(0.9)}>{fins}</g>} line={1.8} />
      <Region p={p} name="receiver" d={["M19 -4.6 H22 L23 -6.6 H25.4 L26.4 -4.6 H46 Q47.6 -4.6 47.6 -3 V3 Q47.6 4.2 46.4 4.2 H19 Z"]} line={2} />
      <Region p={p} name="drum" d={["M33 11.6 a7.8 7.8 0 1 0 15.6 0 a7.8 7.8 0 1 0 -15.6 0 Z"]} line={2} />
      <circle cx="40.8" cy="11.6" r="3.4" fill="none" stroke="#000" opacity="0.35" {...lw(1.2)} />
      <circle cx="40.8" cy="11.6" r="1.1" fill="#1d1d1f" />
      <path d="M79.6 -2.7 V-4.6" fill="none" {...LINE} {...lw(1.6)} />
    </g>
  );
}

/** Whether a color is dark (so details on it should be lighter). */
const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.25;
};

/**
 * A fake mustache (Beta, agent): a curled handlebar in its color at the mouth line (under a snowman's carrot, over a
 * gingerbread man's smile), combed with light strokes (a shade of it) so it reads on a black pawn too.
 */
const MUSTACHE =
  "M50 31.7 Q53.5 29.4 57.2 30.9 Q59.5 31.9 60.8 29.9 Q62.2 30.2 61.2 32.4 Q59.5 35.2 55.8 35.4 Q52.5 35.4 50 34.1 Q47.5 35.4 44.2 35.4 Q40.5 35.2 38.8 32.4 Q37.8 30.2 39.2 29.9 Q40.5 31.9 42.8 30.9 Q46.5 29.4 50 31.7 Z";
function FakeMustache({ p }: { p: Paint }) {
  return (
    <Region
      p={p}
      name="mustache"
      d={[MUSTACHE]}
      line={1.6}
      over={
        <g fill="none" stroke={lighten(p.hex, 0.5)} stroke-linecap="round" opacity="0.85" {...lw(0.7)}>
          <path d="M43.2 33.1 Q45.8 32.2 48.2 32.9 M51.8 32.9 Q54.2 32.2 56.8 33.1" />
        </g>
      }
    />
  );
}

/** A fedora (Beta, agent): a pinched crown and a snap brim in its color, a dark band (a light shade on a dark hat). */
function Fedora({ p }: { p: Paint }) {
  const band = isDark(p.hex) ? lighten(p.hex, 0.4) : "#2a2522";
  return (
    <g>
      <Region
        p={p}
        name="crown"
        d={["M39.4 23.6 L40.8 13.6 Q41.6 10 45.6 10.4 Q50 13 54.4 10.4 Q58.4 10 59.2 13.6 L60.6 23.6 Z"]}
        over={<rect x="38" y="18.2" width="24" height="4.4" fill={band} />}
      />
      <path d="M40 18.2 H60 M39.6 22.6 H60.4" fill="none" stroke="#1d1d1f" {...lw(1.1)} />
      <path d="M46.4 12.4 Q50 15.6 53.6 12.4" fill="none" stroke="#000" opacity="0.3" stroke-linecap="round" {...lw(1.2)} />
      <Region p={p} name="brim" d={["M29.6 24.6 Q30 22 34.6 22.4 Q50 23.4 65.4 22.4 Q70 22 70.4 24.6 Q70.2 26.8 66 26.4 Q58 25.6 50 26.6 Q42 25.6 34 26.4 Q29.8 26.8 29.6 24.6 Z"]} line={2.4} />
    </g>
  );
}

/** A briefcase (Beta, agent): the case in its color at the pawn's side, a dark leather handle and gold clasps. */
function Briefcase({ p }: { p: Paint }) {
  const clasp = { fill: "#e0b43a", stroke: "#1d1d1f", ...lw(1) };
  return (
    <g transform="rotate(-6 78 74)">
      <path d="M72.5 64 V60.4 Q72.5 58.4 74.5 58.4 H81.5 Q83.5 58.4 83.5 60.4 V64" fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(4.4)} />
      <path d="M72.5 64 V60.4 Q72.5 58.4 74.5 58.4 H81.5 Q83.5 58.4 83.5 60.4 V64" fill="none" stroke="#5b3a22" stroke-linecap="round" {...lw(2)} />
      <Region
        p={p}
        name="case"
        d={["M63 66.4 Q63 63.6 65.8 63.6 H90.2 Q93 63.6 93 66.4 V85.2 Q93 88 90.2 88 H65.8 Q63 88 63 85.2 Z"]}
        over={<path d="M63 70.6 H93" stroke="#000" opacity="0.3" {...lw(1.2)} />}
      />
      <rect x="67.4" y="68.6" width="4.2" height="4.2" rx="0.8" {...clasp} />
      <rect x="84.4" y="68.6" width="4.2" height="4.2" rx="0.8" {...clasp} />
    </g>
  );
}

/**
 * A wire earpiece (Beta, agent): a bud at the side of the head and its coiled wire down to the collar, both in its
 * color. It sits just under where shades' arms go, so it shows with Dark Shades on.
 */
function WireEarpiece({ p }: { p: Paint }) {
  const coil = [];
  for (let y = 36.4; y < 49; y += 1.5) coil.push(<path key={y} d={`M58 ${y} l10 1.2`} />);
  return (
    <g>
      <Region
        p={p}
        name="wire"
        d={["M60.6 34.6 Q59.6 39.4 62.2 42.4 Q63.8 44.6 62.8 48.8 L66 49 Q67 44.2 64.8 40.8 Q63 38.2 63.6 35 Z"]}
        over={
          <g stroke={isDark(p.hex) ? lighten(p.hex, 0.5) : "#000"} opacity="0.45" {...lw(0.7)}>
            {coil}
          </g>
        }
        line={1.4}
      />
      <Region p={p} name="bud" d={["M59 32.6 a2.9 3.1 0 1 0 5.8 0 a2.9 3.1 0 1 0 -5.8 0 Z"]} line={1.6} />
      <circle cx="61.1" cy="31.6" r="0.9" fill="#fff" opacity="0.75" />
    </g>
  );
}

/** A bandana (Beta, pirate): tied over the top of the head, knotted at the side with two tails; white dots. */
function Bandana({ p }: { p: Paint }) {
  const dots = [
    [44, 21.6],
    [50, 19.6],
    [56, 21.6],
    [46.6, 22.8],
    [53.4, 22.8],
  ].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r="1" />);
  return (
    <g>
      <Region p={p} name="tails" d={["M60.2 22.4 L67.6 19.4 L66.8 24.4 Z", "M60.2 23.4 L66.2 28.8 L62.4 29.6 Z"]} line={2} />
      <Region
        p={p}
        name="cap"
        d={["M40.4 25.8 Q39.8 16.6 50 16.4 Q60.2 16.6 59.6 25.8 Q50 23.6 40.4 25.8 Z"]}
        line={2.4}
      />
      <g fill="#fbfbf8" opacity="0.95">
        {dots}
      </g>
      <Region p={p} name="knot" d={["M58.6 23 a2.1 2.1 0 1 0 4.2 0 a2.1 2.1 0 1 0 -4.2 0 Z"]} line={1.6} />
    </g>
  );
}

/** A hook (Beta, pirate): a steel hook out of a cuff in its color, at the pawn's side. */
function Hook({ p }: { p: Paint }) {
  const hook = "M74 66 V50.6 A6.4 6.4 0 1 0 61.2 50.6 L63.4 53.2";
  return (
    <g transform="rotate(10 74 70)">
      <path d={hook} fill="none" stroke="#1d1d1f" stroke-linecap="round" stroke-linejoin="round" {...lw(4.6)} />
      <path d={hook} fill="none" stroke="#cfd5dc" stroke-linecap="round" stroke-linejoin="round" {...lw(2.4)} />
      <path d="M75.2 64 V51 A5 5 0 0 0 72.4 46.4" fill="none" stroke="#fff" opacity="0.6" stroke-linecap="round" {...lw(0.8)} />
      <rect x="70.6" y="63.4" width="6.8" height="4.4" rx="1" fill="#9aa3ad" {...LINE} {...lw(1.6)} />
      <Region
        p={p}
        name="cuff"
        d={["M68.6 67.4 H79.4 L83.4 82 Q74 85.2 64.6 82 Z"]}
        over={<path d="M64 78.4 Q74 81.4 84 78.4" fill="none" stroke="#000" opacity="0.28" {...lw(1.6)} />}
        line={2.2}
      />
    </g>
  );
}

/** A cutlass (Beta, pirate): a curved steel blade, the guard, grip and pommel in its color, at the pawn's side. */
function Cutlass({ p }: { p: Paint }) {
  return (
    <g transform="rotate(12 80 60)">
      <path d="M77.2 73 L77.2 40 Q77 25 70.2 15.2 Q81.6 20 83 37 L82.4 73 Z" fill="#d6dbe1" {...LINE} {...lw(1.8)} />
      <path d="M79.4 70 L79.4 40 Q79.2 29 75 21.4" fill="none" stroke="#fff" opacity="0.7" stroke-linecap="round" {...lw(0.9)} />
      <Region p={p} name="grip" d={["M77.4 77 H82.2 L82.6 88 H77 Z"]} over={<path d="M77 80 l5.6 -1.4 M77 83 l5.6 -1.4 M77 86 l5.6 -1.4" stroke="#000" opacity="0.3" {...lw(0.8)} />} line={1.6} />
      <Region
        p={p}
        name="guard"
        d={[
          "M71.4 72.6 Q71.4 71.2 72.8 71.2 H87.2 Q88.6 71.2 88.6 72.6 V75.6 Q88.6 77 87.2 77 H72.8 Q71.4 77 71.4 75.6 Z",
          "M86 76.6 Q91.8 83 84 91.4 L82 89.6 Q87.6 83.6 83.4 77 Z",
          "M76.6 89.6 a3.2 2.6 0 1 0 6.4 0 a3.2 2.6 0 1 0 -6.4 0 Z",
        ]}
        line={1.8}
      />
    </g>
  );
}

/**
 * A spyglass (Beta, pirate): an extended brass telescope raised at the pawn's side, its barrel in its color. Drawn
 * along its own x axis (eyepiece at 0, the lens at 62), then tilted.
 */
function Spyglass({ p }: { p: Paint }) {
  const brass = { fill: "#d9a93a", ...LINE, ...lw(1.6) };
  return (
    <g transform="translate(66 90) rotate(-62)">
      <rect x="0" y="-2.2" width="7" height="4.4" rx="1" {...brass} />
      <rect x="6.4" y="-3" width="14" height="6" rx="0.6" {...brass} />
      <path d="M8.6 -3 V3 M18.2 -3 V3" stroke="#8a6416" {...lw(0.9)} />
      <Region
        p={p}
        name="barrel"
        d={["M20 -4.2 L52 -5 V5 L20 4.2 Z"]}
        over={<path d="M21 -2.2 L51 -2.8" stroke="#fff" opacity="0.45" stroke-linecap="round" {...lw(1.2)} />}
        line={1.8}
      />
      <rect x="19" y="-4.8" width="3.6" height="9.6" rx="0.8" {...brass} />
      <rect x="35" y="-5.2" width="3" height="10.4" rx="0.8" {...brass} />
      <rect x="51" y="-6.2" width="8.4" height="12.4" rx="1.2" {...brass} />
      <path d="M53.6 -6.2 V6.2" stroke="#8a6416" {...lw(0.9)} />
      <ellipse cx="59.4" cy="0" rx="1.4" ry="5" fill="#9fd3f0" stroke="#1d1d1f" {...lw(1)} />
    </g>
  );
}

/**
 * A captain's coat (Beta, pirate; a skin): the pawn in a long coat in its color, opening at the hem to show the pawn
 * (so it reads as white or black), wide cuffs and lapels a shade of it, two rows of gold buttons, a white cravat.
 */
const COAT =
  "M43.6 36.2 Q50 39.2 56.4 36.2 L64.4 38.4 Q69.8 40.6 70 47 L71.4 69 L75.4 84.2 Q64 87.6 55.6 85.6 L50 64 L44.4 85.6 Q36 87.6 24.6 84.2 L28.6 69 L30 47 Q30.2 40.6 35.6 38.4 Z";
function CaptainsCoat({ p, side }: { p: Paint; side: "w" | "b" }) {
  const shade = isDark(p.hex) ? lighten(p.hex, 0.3) : darken(p.hex, 0.25);
  const buttons = [46, 52, 58].flatMap((y) => [
    <circle key={`l${y}`} cx="44.6" cy={y} r="1.35" />,
    <circle key={`r${y}`} cx="55.4" cy={y} r="1.35" />,
  ]);
  return (
    <g>
      <g transform="scale(2.2222)">
        <path d={PAWN_PATH} fill={side === "w" ? "#fff" : "#000"} stroke="#000" stroke-width="1.5" stroke-linecap="round" />
      </g>
      <Region
        p={p}
        name="coat"
        d={[COAT]}
        over={
          <g fill={shade}>
            <path d="M43.6 36.2 L39.4 46 L43 46.6 L41.2 49.6 L47.4 54 L46.6 38 Z" />
            <path d="M56.4 36.2 L60.6 46 L57 46.6 L58.8 49.6 L52.6 54 L53.4 38 Z" />
            <path d="M27.8 64.6 L37.4 64.2 L37.8 70.6 L27.4 71.2 Z" />
            <path d="M72.2 64.6 L62.6 64.2 L62.2 70.6 L72.6 71.2 Z" />
          </g>
        }
      />
      <g fill="none" stroke="#1d1d1f" stroke-linejoin="round" stroke-linecap="round" {...lw(1.2)}>
        <path d="M43.6 36.4 L39.4 46 L43 46.6 L41.2 49.6 L47.4 54" />
        <path d="M56.4 36.4 L60.6 46 L57 46.6 L58.8 49.6 L52.6 54" />
        <path d="M27.8 64.6 L37.4 64.2 L37.8 70.6 L27.4 71.2 M72.2 64.6 L62.6 64.2 L62.2 70.6 L72.6 71.2" />
        <path d="M37.6 47 L37.4 64.2 M62.4 47 L62.6 64.2" opacity="0.6" />
      </g>
      <path d="M46 36.8 Q50 39 54 36.8 L55 40.6 Q52.6 42.6 53.6 46 L50 48.6 L46.4 46 Q47.4 42.6 45 40.6 Z" fill="#fbfbf8" stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.1)} />
      <path d="M47.6 42.4 Q50 44 52.4 42.4 M48 45.4 Q50 46.8 52 45.4" fill="none" stroke="#9ca3af" stroke-linecap="round" {...lw(0.8)} />
      <g fill="#f2c14e" stroke="#7a5410" {...lw(0.8)}>
        {buttons}
      </g>
    </g>
  );
}

/**
 * A pirate hat (Beta, pirate; Legendary): a tricorn seen from the front, its brim turned up to a point at each side,
 * in its color; gold trim along the brim, a white skull and crossbones.
 */
const TRICORN = "M25 9.4 Q32 15 38.4 14.6 Q45 13.8 50 17 Q55 13.8 61.6 14.6 Q68 15 75 9.4 Q73.8 19.6 67 24.2 Q50 27.8 33 24.2 Q26.2 19.6 25 9.4 Z";
const TRIM = "M27.6 12.8 Q33 17.2 38.4 16.8 Q45 16 50 19.2 Q55 16 61.6 16.8 Q67 17.2 72.4 12.8";
function PirateHat({ p }: { p: Paint }) {
  return (
    <g>
      <Region p={p} name="crown" d={["M38.4 16 Q39.4 7.2 50 7.2 Q60.6 7.2 61.6 16 Z"]} line={2.4} />
      <Region
        p={p}
        name="brim"
        d={[TRICORN]}
        line={2.4}
      />
      <g fill="none" stroke-linecap="round">
        <path d={TRIM} stroke="#1d1d1f" {...lw(2.8)} />
        <path d={TRIM} stroke="#f0c040" {...lw(1.6)} />
      </g>
      <path d="M45.2 20.2 L54.8 27.2 M54.8 20.2 L45.2 27.2" stroke="#1d1d1f" stroke-linecap="round" {...lw(2.8)} />
      <path d="M45.2 20.2 L54.8 27.2 M54.8 20.2 L45.2 27.2" stroke="#fbfbf8" stroke-linecap="round" {...lw(1.5)} />
      <path d="M46.6 22.8 Q46.6 19 50 19 Q53.4 19 53.4 22.8 Q53.4 24.2 52.2 24.8 V26 H47.8 V24.8 Q46.6 24.2 46.6 22.8 Z" fill="#fbfbf8" stroke="#1d1d1f" stroke-linejoin="round" {...lw(0.8)} />
      <circle cx="48.6" cy="22.6" r="1" fill="#1d1d1f" />
      <circle cx="51.4" cy="22.6" r="1" fill="#1d1d1f" />
    </g>
  );
}

/**
 * A parrot (Beta, pirate; Mythic): perched on the pawn's left shoulder (as we see it), facing out, so it leaves the
 * eyepatch and the earpiece side clear. Its body in the first color,
 * its wing and long tail in the second; a hooked beak and a ringed eye.
 */
function Parrot({ p, p2 }: { p: Paint; p2: Paint }) {
  return (
    <g transform="translate(102.6 -0.4) scale(-1 1)">
      <Region p={p2} name="tail" d={["M64 35.4 L68 34.8 L74.6 55.4 L71 56.4 Z", "M67 35 L70.4 34.2 L79.4 52 L76.2 53.4 Z"]} line={1.7} />
      <Region
        p={p}
        name="body"
        d={["M59.6 29.4 Q59.6 20.4 66.6 20.4 Q73.2 20.8 72.6 29.8 Q71.8 37.8 64.4 40.6 Q59.6 36.8 59.6 29.4 Z"]}
        line={2}
      />
      <Region p={p} name="head" d={["M60.4 16.6 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z"]} line={2} />
      <Region p={p2} name="wing" d={["M61.8 25.4 Q66.8 23.6 69.8 28 Q70 34.8 64.4 40 Q60.6 34.4 61.8 25.4 Z"]} line={1.5} />
      <path d="M62 40.2 l-1.8 1.4 M62 40.2 l0.6 1.8 M66.2 39.6 l-1.2 1.6 M66.2 39.6 l1.2 1.6" fill="none" stroke="#3f3f46" stroke-linecap="round" {...lw(1.2)} />
      <path d="M71.6 13.4 Q77.6 13.6 77.2 19.8 Q75.6 17.6 72.2 18.4 Z" fill="#f2c14e" stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.2)} />
      <circle cx="68.4" cy="15.2" r="2.1" fill="#fbfbf8" stroke="#1d1d1f" {...lw(0.8)} />
      <circle cx="68.9" cy="15.2" r="1" fill="#1d1d1f" />
    </g>
  );
}

/** A ninja headband (Beta, ninja): a band across the forehead, knotted at the side, its long tails flying out; all in its color. */
function NinjaHeadband({ p }: { p: Paint }) {
  return (
    <g>
      <Region p={p} name="tails" d={["M58.4 23.6 Q64 20.4 72.4 17.2 Q69.4 20.8 71 22.4 Q65 22.8 59.4 26.2 Z", "M58.8 25.4 Q64.6 25.6 70.6 29.8 Q67.4 30.4 67.2 32.4 Q62.8 28.4 58.6 27.4 Z"]} line={1.8} />
      <Region p={p} name="band" d={["M40.6 22.4 Q50 20.2 59.4 22.4 L59.8 26.8 Q50 24.8 40.2 26.8 Z"]} line={2} />
      <Region p={p} name="knot" d={["M57.4 24.6 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z"]} line={1.6} />
    </g>
  );
}

/** A shuriken (Beta, ninja): a four-pointed throwing star in its color, a hole in the middle, at the pawn's side. */
function Shuriken({ p }: { p: Paint }) {
  const star = "M77 45 L80.8 58.2 L94 62 L80.8 65.8 L77 79 L73.2 65.8 L60 62 L73.2 58.2 Z";
  const hole = "M75.2 62 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 Z";
  return (
    <g transform="rotate(18 77 62)">
      <Region
        p={p}
        name="star"
        d={[`${star} ${hole}`]}
        over={<path d="M77 49.2 L77 74.8 M64.2 62 L89.8 62" stroke={lighten(p.hex, 0.5)} opacity="0.7" {...lw(0.9)} />}
        line={1.8}
      />
    </g>
  );
}

/** A ninja mask (Beta, ninja): a cloth over everything below the eyes, in its color, with a fold or two. */
function NinjaMask({ p }: { p: Paint }) {
  return (
    <Region
      p={p}
      name="mask"
      d={["M40.6 29.2 Q50 31.2 59.4 29.2 Q59.8 35.4 55.8 38.2 Q50 40.4 44.2 38.2 Q40.2 35.4 40.6 29.2 Z"]}
      over={<path d="M44.6 34.6 Q50 36.2 55.4 34.6" fill="none" stroke="#000" opacity="0.3" stroke-linecap="round" {...lw(1)} />}
      line={1.8}
    />
  );
}

/** Nunchucks (Beta, ninja): two sticks in its color joined by a short steel chain, hanging at the pawn's side. */
function Nunchucks({ p }: { p: Paint }) {
  const stick = (x: number, y: number, r: number) => `M${x - 2.6} ${y} H${x + 2.6} V${y + 24} Q${x + 2.6} ${y + 26} ${x} ${y + 26} Q${x - 2.6} ${y + 26} ${x - 2.6} ${y + 24} Z`;
  const links = [
    [72.6, 47.4],
    [74.8, 44.6],
    [78, 43.4],
    [81.2, 44.6],
    [83.4, 47.4],
  ];
  return (
    <g>
      <g fill="none" stroke="#1d1d1f" {...lw(2.2)}>
        {links.map(([x, y]) => (
          <ellipse key={x} cx={x} cy={y} rx="1.4" ry="1" />
        ))}
      </g>
      <g fill="none" stroke="#cfd5dc" {...lw(1)}>
        {links.map(([x, y]) => (
          <ellipse key={x} cx={x} cy={y} rx="1.4" ry="1" />
        ))}
      </g>
      <g transform="rotate(14 71 50)">
        <Region p={p} name="left" d={[stick(71, 49, 0)]} over={<path d="M68 66 h6 M68 69 h6 M68 72 h6" stroke="#000" opacity="0.3" {...lw(0.8)} />} line={1.8} />
      </g>
      <g transform="rotate(-24 85 50)">
        <Region p={p} name="right" d={[stick(85, 49, 0)]} over={<path d="M82 66 h6 M82 69 h6 M82 72 h6" stroke="#000" opacity="0.3" {...lw(0.8)} />} line={1.8} />
      </g>
    </g>
  );
}

/**
 * A katana (Beta, ninja): in its scabbard at the pawn's side, a hand's width of steel showing. The hilt's wrap and the
 * scabbard in its color, a dark diamond pattern on the wrap, a gold guard. Drawn along its own x axis (pommel at 0,
 * the scabbard's tip at 84), then tilted.
 */
function Katana({ p }: { p: Paint }) {
  const diamonds = [];
  for (let x = 3; x < 17; x += 3.4) diamonds.push(<path key={x} d={`M${x} 0 L${x + 1.7} -1.6 L${x + 3.4} 0 L${x + 1.7} 1.6 Z`} />);
  return (
    <g transform="translate(63 92) rotate(-68)">
      <Region
        p={p}
        name="hilt"
        d={["M1 -2.4 H18 V2.4 H1 Z"]}
        over={
          <g fill="#000" opacity="0.32">
            {diamonds}
          </g>
        }
        line={1.6}
      />
      <rect x="-1.4" y="-2.8" width="2.8" height="5.6" rx="1" fill="#2a2522" {...LINE} {...lw(1.3)} />
      <rect x="23" y="-2" width="5" height="4" fill="#dfe4ea" {...LINE} {...lw(1.3)} />
      <path d="M23.6 -0.9 H27.6" stroke="#fff" opacity="0.8" {...lw(0.7)} />
      <Region p={p} name="scabbard" d={["M27.6 -2.6 Q56 -3.4 84 -1.2 Q86 0.2 84 1.6 Q56 3.4 27.6 2.6 Z"]} over={<path d="M38 -2.8 V2.8 M41 -2.8 V2.8" stroke="#000" opacity="0.35" {...lw(0.9)} />} line={1.7} />
      <ellipse cx="20.6" cy="0" rx="2.2" ry="5.6" fill="#d9a93a" {...LINE} {...lw(1.4)} />
    </g>
  );
}

/**
 * A ninja hood (Beta, ninja; Epic): a hood over the whole head and down to the shoulders, in its color, with one slit
 * for the eyes. The piece shows through the slit (so it's still white or black), and two eyes look out.
 */
/** (The slit is wound the other way from the hood, so it's a hole.) */
const HOOD_SLIT = "M41.6 29 Q50 32.8 58.4 29 Q50 25.4 41.6 29 Z";
function NinjaHood({ p, side }: { p: Paint; side: "w" | "b" }) {
  const eye = side === "w" ? "#1d1d1f" : "#f8fafc";
  return (
    <g>
      <Region
        p={p}
        name="hood"
        d={[`M50 16.2 Q62.4 16.2 62.6 29 Q62.6 35 60 38 Q66 40.2 66.4 43.6 Q50 47.6 33.6 43.6 Q34 40.2 40 38 Q37.4 35 37.4 29 Q37.6 16.2 50 16.2 Z ${HOOD_SLIT}`]}
        over={<path d="M40.4 38.2 Q50 41.4 59.6 38.2" fill="none" stroke="#000" opacity="0.28" {...lw(1.2)} />}
        line={2.2}
      />
      <circle cx="46.2" cy="29" r="1.25" fill={eye} />
      <circle cx="53.8" cy="29" r="1.25" fill={eye} />
    </g>
  );
}

/**
 * A ninja gi (Beta, ninja; Epic; a skin): the pawn in a wrap-front gi in its color with wide sleeves, the collar a
 * shade of it, and a black belt, knotted, its ends hanging. The pawn's head, its base and the V at the neck show.
 */
const GI = "M44 36.4 L50 43.4 L56 36.4 L64.2 38.4 Q70.2 40.6 72.4 47 L76.6 59.6 L69.6 61.6 L70 75.2 Q50 79.4 30 75.2 L30.4 61.6 L23.4 59.6 L27.6 47 Q29.8 40.6 35.8 38.4 Z";
function NinjaGi({ p, side }: { p: Paint; side: "w" | "b" }) {
  const collar = isDark(p.hex) ? lighten(p.hex, 0.35) : darken(p.hex, 0.22);
  return (
    <g>
      <g transform="scale(2.2222)">
        <path d={PAWN_PATH} fill={side === "w" ? "#fff" : "#000"} stroke="#000" stroke-width="1.5" stroke-linecap="round" />
      </g>
      <Region
        p={p}
        name="gi"
        d={[GI]}
        over={
          <g fill={collar}>
            <path d="M43.6 36.6 L46.2 36.4 L57.4 58.6 L54.4 58.6 Z" />
            <path d="M56.4 36.6 L53.8 36.4 L50 43.4 L51.4 46.4 Z" />
          </g>
        }
      />
      <g fill="none" stroke="#1d1d1f" stroke-linejoin="round" stroke-linecap="round" {...lw(1.2)}>
        <path d="M43.6 36.6 L57.4 58.6 M46.2 36.4 L54.6 52.8" />
        <path d="M56.4 36.6 L51.4 46.4" />
        <path d="M34.6 47.6 L31.6 60.4 M65.4 47.6 L68.4 60.4" opacity="0.6" />
      </g>
      <path d="M30.3 58.2 Q50 61.4 69.7 58.2 L69.8 62.6 Q50 65.8 30.2 62.6 Z" fill="#17171a" stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.2)} />
      <path d="M48.4 62.8 L45 72 L47.6 72.4 L50.2 64 Z M51.6 62.8 L55.6 71.6 L53 72.2 L50 64 Z" fill="#17171a" stroke={side === "w" ? "#1d1d1f" : "#6b7280"} stroke-linejoin="round" {...lw(0.9)} />
      <rect x="47.6" y="59.2" width="4.8" height="4.6" rx="1" fill="#17171a" stroke={side === "w" ? "#1d1d1f" : "#6b7280"} {...lw(0.9)} />
    </g>
  );
}

const ITEM_ART: Record<string, (p: { p: Paint; p2: Paint; side: "w" | "b" }) => ComponentChildren> = {
  "santa-hat": SantaHat,
  antlers: Antlers,
  "santa-beard": SantaBeard,
  snowman: Snowman,
  "gift-tube": GiftTube,
  "fire-ice-crown": FireIceCrown,
  present: Present,
  "candy-cane": CandyCane,
  gingerbread: Gingerbread,
  chimney: Chimney,
  beanie: Beanie,
  "ski-goggles": SkiGoggles,
  "tree-tee": TreeTee,
  scarf: Scarf,
  "party-hat": PartyHat,
  "wizard-hat": WizardHat,
  "top-hat": TopHat,
  "viking-helm": VikingHelm,
  "little-crown": LittleCrown,
  eyepatch: Eyepatch,
  "dark-shades": DarkShades,
  "smiley-face": SmileyFace,
  "suit-and-tie": SuitAndTie,
  "tommy-gun": TommyGun,
  "fake-mustache": FakeMustache,
  fedora: Fedora,
  briefcase: Briefcase,
  "wire-earpiece": WireEarpiece,
  bandana: Bandana,
  hook: Hook,
  cutlass: Cutlass,
  spyglass: Spyglass,
  "captains-coat": CaptainsCoat,
  "pirate-hat": PirateHat,
  parrot: Parrot,
  "ninja-headband": NinjaHeadband,
  shuriken: Shuriken,
  "ninja-mask": NinjaMask,
  nunchucks: Nunchucks,
  katana: Katana,
  "ninja-hood": NinjaHood,
  "ninja-gi": NinjaGi,
};

/** The shine's box where an item is drawn in its own coordinates (the tube is drawn tilted, in a group). */
const SHINE_BOX: Record<string, [number, number, number, number]> = {
  "gift-tube": [78, 16, 8, 84],
  "candy-cane": [56, 14, 32, 84],
  "tommy-gun": [-2, -7, 85, 23],
  briefcase: [62, 57, 32, 32],
  hook: [58, 42, 28, 44],
  cutlass: [64, 12, 30, 82],
  spyglass: [-1, -7, 62, 14],
  // (The parrot is drawn on the right and mirrored onto the left shoulder.)
  parrot: [58, 9, 23, 49],
  shuriken: [59, 44, 36, 36],
  katana: [-2, -6, 89, 12],
};

/** Where each item sits on the pawn's square, to frame it alone (a card, the strip): x, y, w, h. */
const FRAMES: Record<string, [number, number, number, number]> = {
  "santa-hat": [30, 0, 46, 30],
  antlers: [26, -4, 48, 22],
  "santa-beard": [36, 18, 28, 28],
  snowman: [16, 6, 68, 88],
  "gift-tube": [65, 15, 34, 86],
  "fire-ice-crown": [30, -6, 40, 34],
  present: [31, 1, 38, 41],
  "candy-cane": [60, 12, 38, 88],
  gingerbread: [14, 8, 72, 86],
  chimney: [16, 14, 68, 84],
  beanie: [38, 10, 24, 18],
  "ski-goggles": [33, 22, 34, 14],
  "tree-tee": [20, 15, 60, 76],
  scarf: [35, 30, 30, 30],
  "party-hat": [37, 1, 26, 26],
  "wizard-hat": [30, 2, 40, 28],
  "top-hat": [32, 3, 36, 26],
  "viking-helm": [22, 3, 56, 25],
  "little-crown": [33, 2, 34, 25],
  eyepatch: [39, 21, 23, 15],
  "dark-shades": [36, 24, 28, 11],
  "smiley-face": [34, 13, 32, 32],
  "suit-and-tie": [20, 15, 60, 76],
  "tommy-gun": [60, 12, 40, 84],
  "fake-mustache": [37, 27, 26, 11],
  fedora: [29, 8, 42, 20],
  briefcase: [61, 55, 34, 36],
  "wire-earpiece": [52, 28, 20, 22],
  bandana: [38, 15, 31, 16],
  hook: [56, 40, 32, 46],
  cutlass: [62, 12, 34, 84],
  spyglass: [62, 30, 36, 62],
  "captains-coat": [20, 15, 60, 76],
  "pirate-hat": [23.5, 5.5, 53, 23.5],
  parrot: [21.5, 8.5, 23, 49],
  "ninja-headband": [39, 15, 35, 19],
  shuriken: [58, 43, 38, 38],
  "ninja-mask": [39, 28, 22, 13],
  nunchucks: [62, 40, 34, 40],
  katana: [60, 10, 36, 84],
  "ninja-hood": [32, 15, 36, 34],
  "ninja-gi": [20, 15, 60, 76],
};

/**
 * Fitting items to the piece. A piece (the pawn, or a skin) has anchor points on its 100 × 100 square: where a
 * hat's brim sits (a few points below the top of its head, like a real hat), where a beard starts (just below the
 * middle of its head) and its eye line. Each item names the line in its own drawing that meets its anchor (a hat's
 * brim, a beard's top edge, goggles' lens line, a scarf's middle at the neck), and the avatar lines them up. A head or face item meets its slot's
 * anchor, unless `ATTACH_TO` names another (goggles are a face item worn at the eyes). A new item needs only that
 * number; a new skin, its anchors. (The cburnett pawn's head: top at y 20, center 29, radius 9.)
 */
type Anchors = { head: number; face: number; eyes: number; neck: number; mouth: number };
/**
 * (The pawn's neck: where its head meets its collar, y 34.2. Its mouth line, where a mustache goes: y 33, a little
 * below the middle of its head; a snowman's is under its carrot nose, a gingerbread man's at his smile.)
 */
const PAWN_ANCHORS: Anchors = { head: 25, face: 40, eyes: 29, neck: 34, mouth: 33 };
const SKIN_ANCHORS: Record<string, Anchors> = {
  snowman: { head: 14, face: 22, eyes: 18, neck: 30, mouth: 27 },
  gingerbread: { head: 15, face: 26, eyes: 21, neck: 34, mouth: 28 },
  // The chimney, the T-shirt and the suit show the pawn itself, so their anchors are the pawn's.
  chimney: PAWN_ANCHORS,
  "tree-tee": PAWN_ANCHORS,
  "suit-and-tie": PAWN_ANCHORS,
  "captains-coat": PAWN_ANCHORS,
  "ninja-gi": PAWN_ANCHORS,
};
/** The line in each item's drawing that meets its anchor (head and face items). */
const ATTACH: Record<string, number> = {
  "santa-hat": 22,
  antlers: 16,
  "fire-ice-crown": 24,
  "santa-beard": 23,
  present: 25,
  beanie: 25,
  "ski-goggles": 29,
  scarf: 34,
  "party-hat": 25,
  "wizard-hat": 25,
  "top-hat": 25,
  "viking-helm": 25,
  "little-crown": 25,
  eyepatch: 29,
  "dark-shades": 29,
  "smiley-face": 29,
  "fake-mustache": 33,
  fedora: 25,
  "wire-earpiece": 29,
  bandana: 25,
  "pirate-hat": 25,
  "ninja-headband": 25,
  "ninja-mask": 29,
  "ninja-hood": 29,
};
/** Items that meet another anchor than their slot's. */
const ATTACH_TO: Record<string, keyof Anchors> = {
  "ski-goggles": "eyes",
  scarf: "neck",
  eyepatch: "eyes",
  "dark-shades": "eyes",
  "smiley-face": "eyes",
  "fake-mustache": "mouth",
  // (The earpiece is a head item, but it sits at the ear: it follows the eye line, which tracks each head's middle.)
  "wire-earpiece": "eyes",
  "ninja-mask": "eyes",
  // (The hood's eye slit meets the piece's own eyes: a snowman's coal, a gingerbread man's icing.)
  "ninja-hood": "eyes",
};
/** A piece's anchors (a skin's, or the pawn's). */
const anchorsFor = (skin?: string) => (skin && SKIN_ANCHORS[skin]) || PAWN_ANCHORS;

/** One item, drawn into an existing svg on the pawn's square. */
export function ItemLayer({ def, finish, side = "w" }: { def: string; finish: Finish; side?: "w" | "b" }) {
  const p = usePaint(finish, def);
  // The second color (two-color items): the same blemish, its own blotches.
  const p2 = usePaint({ color: secondColor({ def, ...finish }) ?? finish.color, blemish: finish.blemish, seed: finish.seed + 101 }, def);
  const Art = ITEM_ART[def];
  if (!Art) return null;
  return (
    <g>
      <defs>
        {p.defs}
        {p2.defs}
      </defs>
      <Art p={p} p2={p2} side={side} />
    </g>
  );
}

/** One item on its own, framed square (cards, the strip, the reveal). A sparkle when shiny. A ride: with a pawn on it. */
export function ItemArt({ def, finish, side = "w", class: cls }: { def: string; finish: Finish; side?: "w" | "b"; class?: string }) {
  const ride = rideOf(def);
  const [x, y, w, h] = FRAMES[def] ?? ride?.frame ?? [0, 0, 100, 100];
  const s = Math.max(w, h) * 1.12;
  const vb = `${x + w / 2 - s / 2} ${y + h / 2 - s / 2} ${s} ${s}`;
  return (
    <span class={`item-art${isShiny(finish.blemish) ? " shiny" : ""}${cls ? ` ${cls}` : ""}`} style={{ "--sw": String(Math.max(0.4, s / 100)) }}>
      <svg viewBox={vb} aria-hidden="true">
        {ride ? (
          <RideLayers d={ride} finish={{ ...finish, def }} side={side} anim="idle" f={0}>
            <PawnShape side={side} />
          </RideLayers>
        ) : (
          <ItemLayer def={def} finish={finish} side={side} />
        )}
      </svg>
    </span>
  );
}

// ---------------- Rides (Oct 31) ----------------

/** The plain pawn on its 100 × 100 square (the board's cburnett pawn, as the chimney draws it), in SVG: what rides a ride. */
function PawnShape({ side }: { side: "w" | "b" }) {
  return (
    <g transform="scale(2.2222)">
      <path d={PAWN_PATH} fill={side === "w" ? "#fff" : "#000"} stroke="#000" stroke-width="1.5" stroke-linecap="round" />
    </g>
  );
}

/** A ride's saddle on its first idle frame: the point it's drawn at its scale about (rides/scale.ts). */
const rideAnchor = (d: RiderDraft): [number, number] => {
  const p = d.pose("idle", 0);
  return seatAnchor([p.pawnX, p.pawnY, p.pawnTilt ?? 0, p.cut]);
};
/** Where the pawn sits on each frame of a ride drawn at `k` (x, y, tilt, cut), worked out once a ride and size. */
const rideSeats = new Map<string, { idle: [number, number, number, number][]; move: [number, number, number, number][] }>();
function seatsAt(d: RiderDraft, k: number) {
  const key = `${d.id}|${k}`;
  let v = rideSeats.get(key);
  if (!v) {
    const a = rideAnchor(d);
    const at = (anim: "idle" | "move") =>
      d[anim].ms.map((_, f) => {
        const p = d.pose(anim, f);
        return scaledSeat([p.pawnX, p.pawnY, p.pawnTilt ?? 0, p.cut], a, k);
      });
    rideSeats.set(key, (v = { idle: at("idle"), move: at("move") }));
  }
  return v;
}

/**
 * A ride with its rider, on the pawn's square (rides/kit.ts): the ride's back, then the rider (`children`: the pawn and what
 * it wears, on its own square) raised onto the seat, tilted round its base and hidden below the seat (the pose's `cut`),
 * then the ride's front. The ride's own move across a square (`dx`, `dy`) isn't drawn here: the town moves it. `k` (Nov 1):
 * the ride's size, drawn about its saddle, the pawn at its own size on the scaled saddle (rides/scale.ts); the tiles keep 1.
 */
export function RideLayers({ d, finish, side, anim, f, k = 1, children }: { d: RiderDraft; finish: Finish & { def: string }; side: "w" | "b"; anim: "idle" | "move"; f: number; k?: number; children: ComponentChildren }) {
  const p = paintIn(finish, d.frame);
  const p2 = paintIn({ color: secondColor(finish) ?? finish.color, blemish: finish.blemish, seed: finish.seed + 101 }, d.frame);
  const [pawnX, pawnY, tilt, cut] = seatsAt(d, k)[anim][f]!;
  const a = rideAnchor(d);
  const sized = k === 1 ? undefined : `translate(${a[0]} ${a[1]}) scale(${k}) translate(${-a[0]} ${-a[1]})`;
  const seat = `${p.id}-seat`;
  return (
    <g>
      <defs>
        {p.defs}
        {p2.defs}
        <clipPath id={seat}>
          <rect x="-60" y="-60" width="220" height={60 + cut} />
        </clipPath>
      </defs>
      <g transform={sized}>{d.Back({ p, p2, side, f, anim })}</g>
      <g transform={`translate(${pawnX} ${pawnY}) rotate(${tilt} 50 88)`}>
        <g clip-path={`url(#${seat})`}>{children}</g>
      </g>
      <g transform={sized}>{d.Front({ p, p2, side, f, anim })}</g>
    </g>
  );
}

/**
 * The square a riding avatar shows (x, y, side, in the pawn's square's units): the ride's frame and its rider raised onto
 * it, its items' cap included, standing on the square's foot. The rider is smaller than a pawn alone in the same box, so a
 * box never grows when its pawn mounts (Eric's "nothing shifts"). With the ride at `k` (Nov 1) the box is the same; the pawn
 * keeps its size in it (the square is never smaller than at 1, bigger only if a bigger ride needs it) and the ride stands on its foot.
 */
const rideViews = new Map<string, { s: number; v: string }>();
function rideSquare(d: RiderDraft, k: number): { s: number; v: string } {
  const key = `${d.id}|${k}`;
  let v = rideViews.get(key);
  if (v) return v;
  const a = rideAnchor(d);
  const [fx, fy, fw, fh] = d.frame;
  const [rx, ry] = [scaledAt(fx, a[0], k), scaledAt(fy, a[1], k)];
  const lift = Math.min(...seatsAt(d, k).idle.map((s) => s[1]));
  const x0 = Math.min(rx, -12);
  const x1 = Math.max(rx + fw * k, 112);
  const y0 = Math.min(ry, -9 + lift);
  // (Its foot: the ride's, at its size.)
  const y1 = scaledAt(Math.max(fy + fh, 100), a[1], k);
  const s = Math.max(x1 - x0, y1 - y0, k === 1 ? 0 : rideSquare(d, 1).s);
  v = { s, v: `${((x0 + x1) / 2 - s / 2).toFixed(1)} ${(y1 - s).toFixed(1)} ${s.toFixed(1)} ${s.toFixed(1)}` };
  rideViews.set(key, v);
  return v;
}
export const rideView = (d: RiderDraft, k = 1): string => rideSquare(d, k).v;

/** A ride's idle, frame by frame on its own times (still under reduced motion): one timer per riding avatar on the screen. */
function useIdleFrame(ms: readonly number[]): number {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (ms.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        i = (i + 1) % ms.length;
        setF(i);
        next();
      }, ms[i]);
    };
    next();
    return () => clearTimeout(t);
  }, [ms]);
  return f;
}

/** A pawn riding (Avatar with `ride`): the ride's idle, the pawn and its items on the seat, all in one picture fitted to the box. */
function RidingAvatar({ d, mount, side, rider }: { d: RiderDraft; mount: NonNullable<ItemLook["ride"]>; side: "w" | "b"; rider: ComponentChildren }) {
  const f = useIdleFrame(d.idle.ms);
  // (Its size: RIDES.scale, or an admin's `?rideScale=`.)
  const k = rideScale(d.id);
  return (
    <span class="avatar riding" aria-hidden="true" data-ride={d.id} data-scale={k}>
      <svg class="avatar-ride" viewBox={rideView(d, k)}>
        <defs>
          <clipPath id="avatar-cap">
            <rect x="-12" y="-9" width="124" height="112" />
          </clipPath>
        </defs>
        <RideLayers d={d} finish={mount} side={side} anim="idle" f={f} k={k}>
          {rider}
        </RideLayers>
      </svg>
    </span>
  );
}

/**
 * A player as a pawn (or a snowman) wearing their items: skin, then face, head and a weapon at their side. Used in
 * the votes, the cut screen, the queue and profiles. `ride` (the locker and the profiles, Oct 31): on their ride, if they
 * have one on, in its idle; everywhere else a ride isn't drawn (a match's screens, the crowd, home's pawn).
 */
export function Avatar({ look, side = "w", ride = false }: { look?: ItemLook; side?: "w" | "b"; ride?: boolean }) {
  const at = (slot: ItemSlot) => look?.[slot];
  const skin = at("skin");
  // Worn items in drawing order (face, head, then a weapon; a face item tagged "above" goes over a hat: goggles, shades;
  // crates.ts's `faceLayer`), split by layer: behind the piece or in front of it.
  const order = (slot: ItemSlot, def: string) => (slot === "face" ? (aboveHat(def) ? 2 : 0) : slot === "head" ? 1 : 3);
  const worn = (["face", "head", "weapon"] as const)
    .flatMap((slot) => {
      const it = at(slot);
      return it ? [{ slot, it }] : [];
    })
    .sort((a, b) => order(a.slot, a.it.def) - order(b.slot, b.it.def));
  const anchors = anchorsFor(skin?.def);
  /** How far to move an item so its attach line meets its anchor on this piece. */
  const shift = (slot: ItemSlot, def: string) =>
    (slot === "head" || slot === "face") && ATTACH[def] !== undefined ? anchors[ATTACH_TO[def] ?? slot] - ATTACH[def]! : 0;
  // (Items may rise a little above the square, never more: the clip caps their height.)
  const items = (back: boolean) => (
    <g clip-path="url(#avatar-cap)">
      {worn
        .filter(({ it }) => behindPiece(it.def) === back)
        .map(({ slot, it }) => (
          <g key={slot} transform={`translate(0 ${shift(slot, it.def)})`}>
            <ItemLayer def={it.def} finish={it} side={side} />
          </g>
        ))}
    </g>
  );
  const mount = ride ? at("ride") : undefined;
  const d = rideOf(mount?.def);
  if (mount && d)
    return (
      <RidingAvatar
        d={d}
        mount={mount}
        side={side}
        rider={
          <>
            {items(true)}
            {skin ? <ItemLayer def={skin.def} finish={skin} side={side} /> : <PawnShape side={side} />}
            {items(false)}
          </>
        }
      />
    );
  const layer = (back: boolean) => (
    <svg class={`avatar-items ${back ? "back" : "front"}`} viewBox="0 0 100 100">
      <defs>
        <clipPath id="avatar-cap">
          <rect x="-12" y="-9" width="124" height="112" />
        </clipPath>
      </defs>
      {items(back)}
    </svg>
  );
  return (
    <span class="avatar hb-pieces" aria-hidden="true">
      {layer(true)}
      {skin ? (
        <svg class="avatar-skin" viewBox="0 0 100 100">
          <ItemLayer def={skin.def} finish={skin} side={side} />
        </svg>
      ) : (
        <piece class={`${side === "w" ? "white" : "black"} pawn`} />
      )}
      {layer(false)}
    </span>
  );
}

/** Fischer Random's tile: a solid gold king's crown with a question mark. */
export function FischerArt() {
  return (
    <span class="item-art fischer-art">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="fischer-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffe58a" />
            <stop offset="1" stop-color="#d49b12" />
          </linearGradient>
        </defs>
        <path d="M18 78 L14 34 L32 50 L50 22 L68 50 L86 34 L82 78 Z" fill="url(#fischer-gold)" {...LINE} />
        <rect x="16" y="76" width="68" height="10" rx="3" fill="url(#fischer-gold)" {...LINE} />
        <circle cx="50" cy="16" r="6" fill="url(#fischer-gold)" {...LINE} />
        <text x="50" y="72" text-anchor="middle" font-size="34" font-weight="900" fill="#3b2a00" font-family="system-ui, sans-serif">
          ?
        </text>
      </svg>
    </span>
  );
}

/** A tier's present (the crate's strip): a gift box in the tier's color, the lid a shade darker, a white ribbon. */
export function PresentArt({ color }: { color: string }) {
  return (
    <span class="item-art present-art">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <rect x="19" y="44" width="62" height="42" rx="4" fill={color} {...LINE} />
        <rect x="14" y="31" width="72" height="15" rx="4" fill={darken(color, 0.18)} {...LINE} />
        <path d="M45 31 H55 V86 H45 Z" fill="#fbfbf8" stroke="#1d1d1f" {...lw(2)} />
        <path d="M50 31 C40 12 22 17 33 30 Z M50 31 C60 12 78 17 67 30 Z" fill="#fbfbf8" {...LINE} {...lw(2.4)} />
        <circle cx="50" cy="30" r="5" fill="#fbfbf8" {...LINE} {...lw(2.4)} />
      </svg>
    </span>
  );
}

/**
 * A tier's supply box (Beta's strip): a wooden crate with metal corners, a band in the tier's color and a stenciled
 * star. Same size and place as a present, so the strip, the odds and the unwrap use either.
 */
export function SupplyBoxArt({ color }: { color: string }) {
  const corner = (x: number, y: number, sx: number, sy: number) => `M${x} ${y + 9 * sy} V${y} H${x + 9 * sx}`;
  return (
    <span class="item-art present-art supply-art">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <rect x="14" y="34" width="72" height="52" rx="3" fill="#b07a45" {...LINE} />
        <g fill="none" stroke="#6b4423" {...lw(1.6)}>
          <path d="M16 47 H84 M16 73 H84" />
          <path d="M30 36 V47 M58 36 V47 M42 73 V84 M70 73 V84" opacity="0.7" />
        </g>
        <rect x="14" y="48" width="72" height="24" fill={color} stroke="#1d1d1f" {...lw(2.2)} />
        <path d="M50 51.5 l3.3 6.7 7.4 1.1 -5.35 5.2 1.26 7.36 -6.6-3.48 -6.6 3.48 1.26-7.36 -5.35-5.2 7.4-1.1 Z" fill="#fbfbf8" opacity="0.92" transform="translate(0 -1.2)" />
        <rect x="10" y="24" width="80" height="12" rx="3" fill="#8f5f33" {...LINE} />
        <path d="M14 30 H86" stroke="#6b4423" {...lw(1.4)} />
        <g fill="none" stroke="#4b5563" stroke-linecap="square" {...lw(4)}>
          <path d={corner(16.5, 38, 1, 1)} />
          <path d={corner(83.5, 38, -1, 1)} />
          <path d={corner(16.5, 83.5, 1, -1)} />
          <path d={corner(83.5, 83.5, -1, -1)} />
        </g>
        <g fill="#9ca3af">
          <circle cx="19" cy="40.5" r="1.3" />
          <circle cx="81" cy="40.5" r="1.3" />
          <circle cx="19" cy="81" r="1.3" />
          <circle cx="81" cy="81" r="1.3" />
        </g>
      </svg>
    </span>
  );
}

/** A Beta Crate: an olive-drab supply crate, stenciled BETA 001, with rope handles and steel corners. */
export function BetaCrateArt() {
  return (
    <span class="item-art crate-art beta-crate-art">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M6 52 Q2 52 2 58 Q2 64 6 64 M94 52 Q98 52 98 58 Q98 64 94 64" fill="none" stroke="#c9a66b" stroke-linecap="round" {...lw(3.2)} />
        <rect x="8" y="30" width="84" height="58" rx="4" fill="#556b3a" {...LINE} />
        <rect x="4" y="20" width="92" height="14" rx="4" fill="#64803f" {...LINE} />
        <g fill="none" stroke="#3b4a27" {...lw(1.6)}>
          <path d="M10 46 H90 M10 72 H90" />
        </g>
        <text x="50" y="65" text-anchor="middle" font-size="19" font-weight="900" letter-spacing="2" fill="#e8dcb4" font-family="ui-monospace, Menlo, Consolas, monospace" opacity="0.92">
          BETA
        </text>
        <text x="50" y="84" text-anchor="middle" font-size="11" font-weight="900" letter-spacing="3" fill="#e8dcb4" font-family="ui-monospace, Menlo, Consolas, monospace" opacity="0.8">
          001
        </text>
        <path d="M50 37 l1.9 3.8 4.2 .6 -3 3 .7 4.2 -3.8-2 -3.8 2 .7-4.2 -3-3 4.2-.6 Z" fill="#fbbf24" stroke="#1d1d1f" stroke-linejoin="round" {...lw(1)} />
        <g fill="#9ca3af" stroke="#1d1d1f" {...lw(1.6)}>
          <path d="M8 76 V88 H20 V84 H12 V76 Z" />
          <path d="M92 76 V88 H80 V84 H88 V76 Z" />
          <path d="M4 30 V20 H16 V24 H8 V30 Z" />
          <path d="M96 30 V20 H84 V24 H92 V30 Z" />
        </g>
      </svg>
    </span>
  );
}

/** A Winter Crate: a frosted box with a ribbon and a snowflake. */
export function WinterCrateArt() {
  return (
    <span class="item-art crate-art">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="crate-ice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#3b6fd8" />
            <stop offset="1" stop-color="#1b2f74" />
          </linearGradient>
        </defs>
        <rect x="14" y="34" width="72" height="52" rx="5" fill="url(#crate-ice)" {...LINE} />
        <rect x="10" y="24" width="80" height="14" rx="4" fill="#4f86f0" {...LINE} />
        <rect x="45" y="24" width="10" height="62" fill="#e11d48" stroke="#1d1d1f" {...lw(2)} />
        <path d="M50 24 C40 10 30 16 38 22 Z M50 24 C60 10 70 16 62 22 Z" fill="#e11d48" {...LINE} {...lw(2)} />
        <g stroke="#e0f2fe" {...lw(2.4)} stroke-linecap="round">
          <path d="M28 52 v18 M20 61 h16 M22.5 55.5 l11 11 M33.5 55.5 l-11 11" />
          <path d="M72 52 v18 M64 61 h16 M66.5 55.5 l11 11 M77.5 55.5 l-11 11" />
        </g>
      </svg>
    </span>
  );
}

/** A key. */
export function KeyArt() {
  return (
    <span class="item-art key-art">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="32" cy="50" r="16" fill="#fbbf24" {...LINE} />
        <circle cx="32" cy="50" r="6" fill="#1b2f74" stroke="#1d1d1f" {...lw(2)} />
        <path d="M47 46 H86 V54 H80 V62 H72 V54 H66 V60 H58 V54 H47 Z" fill="#fbbf24" {...LINE} />
      </svg>
    </span>
  );
}
