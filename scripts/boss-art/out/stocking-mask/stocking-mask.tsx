import type { ItemDraft, ArtProps } from "../../item-kit.tsx";
import { Region, LINE, lw, darken, isLight } from "../../item-kit.tsx";

const N = 8;
const PIVOT: [number, number] = [55, 12];

/** Head of the stocking, with eye and mouth holes wound the other way. */
const hole = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy} A${rx} ${ry} 0 0 0 ${cx - rx} ${cy} Z`;
const MASK =
  "M38.4 29 Q38.2 17.4 46.6 13.2 Q53 10.4 58.4 12.4 Q61.9 17.4 61.6 29 Q61.6 34.4 59.6 37.6 L40.4 37.6 Q38.4 34.4 38.4 29 Z " +
  hole(46, 29, 2.7, 2.2) +
  " " +
  hole(54, 29, 2.7, 2.2) +
  " " +
  hole(50, 33.4, 2.4, 1.35);

const FOOT = "M48.6 12.8 Q51 5.6 58.6 5 Q61.4 2.8 65.4 5.4 Q71.4 9.6 72.4 17.2 Q73.2 23.6 68 24.4 Q62.8 24.8 62.8 19.4 Q62.2 14.6 57 15.2 Q52.6 15.6 48.6 12.8 Z";
const TOE = "M62.9 18.4 Q67.6 16.4 72.5 17.4 Q73.2 23.6 68 24.4 Q62.8 24.8 62.9 18.4 Z";

/** A furry band: bumps along a top edge and a bottom edge. */
function cuffPath() {
  const x0 = 36.6, x1 = 63.4, n = 6;
  const top = (x: number) => 36.2 + 0.8 * (1 - ((x - 50) / 13.4) ** 2);
  const bot = (x: number) => 41 + 1.4 * (1 - ((x - 50) / 13.4) ** 2);
  const step = (x1 - x0) / n;
  let d = `M${x0} ${top(x0).toFixed(2)}`;
  for (let i = 1; i <= n; i++) {
    const x = x0 + i * step;
    d += ` Q${(x - step / 2).toFixed(2)} ${(top(x - step / 2) - 3).toFixed(2)} ${x.toFixed(2)} ${top(x).toFixed(2)}`;
  }
  d += ` Q${x1 + 2.4} ${((top(x1) + bot(x1)) / 2).toFixed(2)} ${x1} ${bot(x1).toFixed(2)}`;
  for (let i = n - 1; i >= 0; i--) {
    const x = x0 + i * step;
    d += ` Q${(x + step / 2).toFixed(2)} ${(bot(x + step / 2) + 2.6).toFixed(2)} ${x.toFixed(2)} ${bot(x).toFixed(2)}`;
  }
  d += ` Q${x0 - 2.4} ${((top(x0) + bot(x0)) / 2).toFixed(2)} ${x0} ${top(x0).toFixed(2)} Z`;
  return d;
}
const CUFF = cuffPath();

function Art({ p, side, f }: ArtProps) {
  const eye = side === "w" ? "#1d1d1f" : "#f8fafc";
  const a = 9 * Math.sin((2 * Math.PI * f) / N);
  const rib = isLight(p.hex) ? "#000" : "#000";
  return (
    <g>
      <Region
        p={p}
        name="mask"
        d={[MASK]}
        line={2.4}
        over={
          <g fill="none" stroke={rib} opacity="0.16" {...lw(1)}>
            <path d="M43.4 14 Q40.6 26 42.4 38" />
            <path d="M47.6 12 Q46.6 20 46.8 25.6 M46.8 32 Q46.8 35 47 38" />
            <path d="M52.6 11.6 Q53.6 20 53.2 25.6 M53.2 32 Q53.2 35 53 38" />
            <path d="M56.8 12.6 Q59.6 26 57.6 38" />
          </g>
        }
      />
      <circle cx="46.2" cy="29" r="1.25" fill={eye} />
      <circle cx="53.8" cy="29" r="1.25" fill={eye} />
      <g transform={`rotate(${a.toFixed(2)} ${PIVOT[0]} ${PIVOT[1]})`}>
        <Region
          p={p}
          name="foot"
          d={[FOOT]}
          line={2.4}
          over={
            <g fill="none" stroke="#000" opacity="0.16" {...lw(1)}>
              <path d="M55 7.6 Q63 6.4 68.6 12.6" />
              <path d="M53.4 11.4 Q61 9.8 66.4 15.6" />
            </g>
          }
        />
        <Region p={p} name="toe" d={[TOE]} fill={darken(p.hex, 0.28)} line={2.2} />
        <path d="M59.6 6.6 Q62.4 5.2 64.6 6.8" fill="none" stroke="#fff" opacity="0.5" stroke-linecap="round" {...lw(1.3)} />
      </g>
      <path d={CUFF} fill="#fbfbfd" {...LINE} {...lw(2.2)} />
      <path d="M38.4 40.4 Q50 45.4 61.6 40.4 Q50 42.6 38.4 40.4 Z" fill="#d3d4dc" />
      <g fill="#d3d4dc">
        <circle cx="41.6" cy="38.6" r="0.8" />
        <circle cx="46" cy="39.6" r="0.8" />
        <circle cx="50" cy="38.8" r="0.8" />
        <circle cx="54" cy="39.6" r="0.8" />
        <circle cx="58.4" cy="38.6" r="0.8" />
      </g>
    </g>
  );
}

export const stockingMask: ItemDraft = {
  id: "stocking-mask",
  name: "Stocking Ski Mask",
  tier: "legendary",
  slot: "head",
  description: "Santa's list says naughty. The elf in the stocking says prove it.",
  frame: [34, 1, 42, 43],
  attach: 25,
  motion: { ms: Array(N).fill(300) },
  Art,
};
