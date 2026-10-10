import { useEffect, useRef, useState } from "preact/hooks";
import { ICON_SIZE, type Pixels, floodFill, remember, toHex, toRgba } from "../icon-pixels.ts";

export { ICON_SIZE };

/** A player's icon: their pixel drawing, or (older accounts) the emoji they picked. */
export function UserIcon({ icon, class: cls = "" }: { icon: string; class?: string }) {
  if (icon.startsWith("data:image/png")) return <img class={`user-icon pixel ${cls}`} src={icon} alt="" width={ICON_SIZE} height={ICON_SIZE} draggable={false} />;
  return <span class={`user-icon ${cls}`}>{icon || "♟"}</span>;
}

type Tool = "pencil" | "eraser" | "fill" | "picker";

const PALETTE = [
  "#000000", "#ffffff", "#7f7f7f", "#c3c3c3", "#880015", "#ed1c24", "#ff7f27", "#fff200",
  "#22b14c", "#00a2e8", "#3f48cc", "#a349a4", "#b97a57", "#ffaec9", "#ffc90e", "#efe4b0",
  "#b5e61d", "#99d9ea", "#7092be", "#c8bfe7", "#f2c14e", "#1e3a8a", "#5b0f24", "#0b0b14",
];

/**
 * The icon builder, like an old console emblem editor: a 48 × 48 grid and a few
 * deliberately simple tools (pencil, eraser, fill, colour picker, brush size,
 * undo, clear) with a palette and a custom colour.
 */
export function IconEditor({ initial, onSave, onCancel }: { initial: string; onSave: (png: string) => Promise<void> | void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pixels = useRef<Pixels>(new Uint32Array(ICON_SIZE * ICON_SIZE));
  const history = useRef<Pixels[]>([]);
  const drawing = useRef(false);
  const [tool, setTool] = useState<Tool>("pencil");
  const [colour, setColour] = useState("#000000");
  const [size, setSize] = useState(1);
  const [, redraw] = useState(0);
  const [saving, setSaving] = useState(false);

  const paint = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(ICON_SIZE, ICON_SIZE);
    img.data.set(new Uint8ClampedArray(pixels.current.buffer, pixels.current.byteOffset, pixels.current.byteLength));
    ctx.putImageData(img, 0, 0);
  };
  // An existing drawing to start from.
  useEffect(() => {
    if (!initial.startsWith("data:image/png")) return paint();
    const im = new Image();
    im.onload = () => {
      const tmp = document.createElement("canvas");
      tmp.width = tmp.height = ICON_SIZE;
      const ctx = tmp.getContext("2d")!;
      ctx.drawImage(im, 0, 0, ICON_SIZE, ICON_SIZE);
      pixels.current = new Uint32Array(new Uint8ClampedArray(ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE).data).buffer);
      paint();
    };
    im.src = initial;
  }, []);

  const snapshot = () => remember(history.current, pixels.current.slice());
  const cellAt = (e: PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: Math.floor(((e.clientX - r.left) / r.width) * ICON_SIZE), y: Math.floor(((e.clientY - r.top) / r.height) * ICON_SIZE) };
  };
  const dab = (x: number, y: number) => {
    const v = tool === "eraser" ? 0 : toRgba(colour);
    const o = Math.floor((size - 1) / 2);
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) {
        const px = x - o + dx;
        const py = y - o + dy;
        if (px >= 0 && py >= 0 && px < ICON_SIZE && py < ICON_SIZE) pixels.current[py * ICON_SIZE + px] = v;
      }
  };
  const last = useRef<{ x: number; y: number } | null>(null);
  const down = (e: PointerEvent) => {
    e.preventDefault();
    // (A tap on the canvas's far edge reads as cell 48: keep it on the canvas.)
    const at = cellAt(e);
    const x = Math.min(Math.max(at.x, 0), ICON_SIZE - 1);
    const y = Math.min(Math.max(at.y, 0), ICON_SIZE - 1);
    if (tool === "picker") {
      const v = pixels.current[y * ICON_SIZE + x]!;
      if (v >>> 24) setColour(toHex(v));
      setTool("pencil");
      return;
    }
    if (tool === "fill") {
      // A fill that changes nothing (the same colour again) is not a step to undo.
      const before = pixels.current.slice();
      if (floodFill(pixels.current, x, y, toRgba(colour))) {
        remember(history.current, before);
        paint();
      }
      return;
    }
    snapshot();
    drawing.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    last.current = { x, y };
    dab(x, y);
    paint();
  };
  const move = (e: PointerEvent) => {
    if (!drawing.current) return;
    const { x, y } = cellAt(e);
    // Fill the gap from the last point, so fast strokes stay solid.
    const from = last.current ?? { x, y };
    const steps = Math.max(Math.abs(x - from.x), Math.abs(y - from.y), 1);
    for (let i = 1; i <= steps; i++) dab(Math.round(from.x + ((x - from.x) * i) / steps), Math.round(from.y + ((y - from.y) * i) / steps));
    last.current = { x, y };
    paint();
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
  };
  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    pixels.current = prev;
    paint();
    redraw((n) => n + 1);
  };
  const clear = () => {
    if (!pixels.current.some((v) => v)) return;
    snapshot();
    pixels.current = new Uint32Array(ICON_SIZE * ICON_SIZE);
    paint();
  };
  const save = async () => {
    setSaving(true);
    try {
      await onSave(canvas.current!.toDataURL("image/png"));
    } finally {
      setSaving(false);
    }
  };
  const tools: [Tool, string, string][] = [
    ["pencil", "✏️", "Pencil"],
    ["eraser", "🧽", "Eraser"],
    ["fill", "🪣", "Fill"],
    ["picker", "💧", "Pick a colour from the drawing"],
  ];
  return (
    <div class="icon-editor">
      <div class="icon-canvas-wrap">
        <canvas
          ref={canvas}
          class="icon-canvas"
          width={ICON_SIZE}
          height={ICON_SIZE}
          aria-label="Your icon, 48 by 48 pixels"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
      <div class="icon-tools" role="toolbar" aria-label="Drawing tools">
        {tools.map(([t, glyph, label]) => (
          <button type="button" key={t} class={tool === t ? "on" : ""} aria-label={label} aria-pressed={tool === t} title={label} onClick={() => setTool(t)}>
            {glyph}
          </button>
        ))}
        <span class="icon-tools-sep" />
        {[1, 2, 3].map((n) => (
          <button type="button" key={n} class={size === n ? "on" : ""} aria-label={`Brush ${n} pixel${n > 1 ? "s" : ""}`} aria-pressed={size === n} onClick={() => setSize(n)}>
            <i class="icon-brush" style={{ width: `${n * 4}px`, height: `${n * 4}px` }} />
          </button>
        ))}
        <span class="icon-tools-sep" />
        <button type="button" aria-label="Undo" title="Undo" onClick={undo}>
          ↶
        </button>
        <button type="button" aria-label="Clear" title="Clear" onClick={clear}>
          🗑️
        </button>
      </div>
      <div class="icon-palette" role="radiogroup" aria-label="Colour">
        {PALETTE.map((c) => (
          <button
            type="button"
            role="radio"
            key={c}
            aria-checked={colour === c}
            aria-label={c}
            class={colour === c ? "on" : ""}
            style={{ background: c }}
            onClick={() => {
              setColour(c);
              if (tool === "eraser" || tool === "picker") setTool("pencil");
            }}
          />
        ))}
        <label class="icon-custom" title="Any colour">
          <input type="color" value={colour} onInput={(e) => setColour(e.currentTarget.value)} aria-label="Custom colour" />
          <span style={{ background: colour }} />
        </label>
      </div>
      <div class="icon-actions">
        <button type="button" class="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" class="btn btn-primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save icon"}
        </button>
      </div>
    </div>
  );
}
