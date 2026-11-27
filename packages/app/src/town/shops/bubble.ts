import { bubbleSize } from "./challenge.ts";

/**
 * A line in the town's speech bubble on a room's canvas (white, rounded, its tail pointing down at the speaker's head `ax`, `ay`), sized
 * for a figure drawn `px` tall (challenge.ts bubbleSize), kept inside a view `W` wide. The look of a boss's challenge line
 * (ShopRoom.tsx drawBubble, which draws its own the same way), for a scene that says a line of its own: the Battle Tower floor's, the
 * Stranger's entrance (tower-floor-scene.ts). Its lines are wrapped once for its words and size.
 */
const wrapped = new Map<string, { lines: string[]; w: number }>();
export function paintBubble(g: CanvasRenderingContext2D, W: number, text: string, ax: number, ay: number, px: number): void {
  const z = bubbleSize(px);
  const s = z.s;
  g.font = `500 ${z.font}px Archivo, system-ui, sans-serif`;
  const key = `${z.font}|${text}`;
  let b = wrapped.get(key);
  if (!b) {
    const lines: string[] = [];
    let line = "";
    for (const w of text.split(" ")) {
      const tt = line ? `${line} ${w}` : w;
      if (g.measureText(tt).width > z.wrap && line) {
        lines.push(line);
        line = w;
      } else line = tt;
    }
    if (line) lines.push(line);
    b = { lines, w: Math.max(...lines.map((l) => g.measureText(l).width)) + 16 * s };
    if (wrapped.size > 40) wrapped.clear();
    wrapped.set(key, b);
  }
  const lh = 14 * s;
  const h = b.lines.length * lh + 8 * s;
  const bx = Math.max(6, Math.min(W - b.w - 6, ax - b.w / 2));
  const by = Math.max(6, ay - z.gap - h - 7 * s);
  g.save();
  g.shadowColor = "rgba(0,0,0,.25)";
  g.shadowBlur = 8 * s;
  g.shadowOffsetY = 2 * s;
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(bx, by, b.w, h, 12 * s);
  g.fill();
  const tx = Math.max(bx + 14 * s, Math.min(bx + b.w - 14 * s, ax));
  g.beginPath();
  g.moveTo(tx - 6 * s, by + h - 1);
  g.lineTo(tx + 6 * s, by + h - 1);
  g.lineTo(tx, by + h + 7 * s);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = "#1d1b19";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < b.lines.length; i++) g.fillText(b.lines[i]!, bx + b.w / 2, by + 5 * s + lh / 2 + i * lh);
}
