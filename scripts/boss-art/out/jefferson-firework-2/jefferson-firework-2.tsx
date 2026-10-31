import { Region, LINE, lw, darken, lighten, type ItemDraft } from "../../item-kit.tsx";

const N = 8;
const SPARK = ["#ffffff", "#fff3a0", "#ffd23a", "#ff9a1f", "#ee4a1a"];

export const item: ItemDraft = {
  id: "jefferson-firework-2",
  name: "Jefferson's Firework",
  tier: "epic",
  slot: "weapon",
  description: "Already lit. Jefferson says that's the fun part.",
  frame: [50, 8, 53, 90],
  motion: { ms: Array(N).fill(150) },
  Art: ({ p, f }) => {
    const n = parseInt(p.hex.slice(1), 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    const deep = lum < 0.22;
    const dark = deep ? lighten(p.hex, 0.45) : darken(p.hex, 0.5);
    const finFill = deep ? lighten(p.hex, 0.28) : darken(p.hex, 0.3);
    // sparks: a few tiny bits spitting from the fuse tip
    const tx = 84;
    const ty = 88;
    const sparks = [0, 1, 2, 3, 4, 5].map((i) => {
      const t = ((f + i * 3) % N) / N; // 0..1 life
      const a = ((i * 137 + Math.floor((f + i * 3) / N) * 61) % 360) * (Math.PI / 180);
      const r = 2.5 + t * 8;
      const x = tx + Math.cos(a) * r;
      const y = ty + Math.sin(a) * r * 0.85 + t * t * 3;
      const s = 1.6 * (1 - t) + 0.5;
      const c = SPARK[Math.min(4, Math.floor(t * 5))];
      return { x, y, s, c, i };
    });
    const pulse = f % 2 === 0 ? 1 : 0.75;
    const rot = (f * 23) % 90;
    return (
      <g transform="translate(-4 1) rotate(9 80 55) translate(80 50) scale(0.94) translate(-80 -50)">
        {/* fuse */}
        <path d="M80 73 C80 79 77 81 79 84 C80.5 86.5 83 86 84 88" fill="none" {...LINE} {...lw(4.2)} />
        <path d="M80 73 C80 79 77 81 79 84 C80.5 86.5 83 86 84 88" fill="none" stroke="#5a3a24" stroke-linecap="round" {...lw(1.8)} />
        {/* side fins */}
        <path d="M70 52 C64 58 60 67 59 80 C63 77 67 75 71 73 Z" fill={finFill} {...LINE} />
        <path d="M90 52 C96 58 100 67 101 80 C97 77 93 75 89 73 Z" fill={finFill} {...LINE} />
        {/* nozzle */}
        <path d="M73 69 L87 69 L85 75 L75 75 Z" fill="#3a3640" {...LINE} {...lw(2.2)} />
        {/* body */}
        <Region p={p} name="body" d={["M69 31 L91 31 L91 69 Q91 71 89 71 L71 71 Q69 71 69 69 Z"]} />
        <path d="M72.5 41 L72.5 60" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(2.4)} />
        {/* bands */}
        <path d="M69 33 L91 33 L91 39 L69 39 Z" fill="#fff1c9" {...LINE} {...lw(2.2)} />
        <path d="M69 61 L91 61 L91 66 L69 66 Z" fill="#f2b42a" {...LINE} {...lw(2.2)} />
        {/* star on the body */}
        <path d="M80 44 L81.6 47.6 L85.4 47.9 L82.5 50.3 L83.4 54 L80 52 L76.6 54 L77.5 50.3 L74.6 47.9 L78.4 47.6 Z" fill="#fff1c9" {...LINE} {...lw(1.6)} />
        {/* front fin */}
        <path d="M80 60 C82.5 64 83 72 82.5 81 L77.5 81 C77 72 77.5 64 80 60 Z" fill={finFill} {...LINE} {...lw(2.4)} />
        {/* nose cone */}
        <path d="M68 33 C68 23 75 15 80 9 C85 15 92 23 92 33 Z" fill={dark} {...LINE} />
        <path d="M74.5 28 C75 23 77.5 18.5 79.5 15.5" fill="none" stroke={lighten(p.hex, 0.6)} stroke-opacity="0.7" stroke-linecap="round" {...lw(2)} />
        {/* sparkler tip */}
        <g transform={`rotate(${rot} ${tx} ${ty}) translate(${tx} ${ty}) scale(${pulse})`}>
          <path d="M0 -5.5 L1.2 -1.2 L5.5 0 L1.2 1.2 L0 5.5 L-1.2 1.2 L-5.5 0 L-1.2 -1.2 Z" fill="#ffd23a" stroke="#ee4a1a" stroke-linejoin="round" {...lw(1)} />
          <circle r="1.8" fill="#fff" />
        </g>
        {sparks.map((s) => (
          <circle key={s.i} cx={s.x} cy={s.y} r={s.s} fill={s.c} stroke="#b8300f" {...lw(0.6)} />
        ))}
      </g>
    );
  },
};
