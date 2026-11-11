/**
 * The landing reel's captions and its last scene: the Hidden Boss as pixel art (Eric, Nov 11: "an ominous figure aka hidden boss in
 * all black sitting on a stool in the iconic [brooding chess] pose"). A hooded silhouette, no face and no likeness of anyone: hunched
 * on a stool at a little table and its board, elbow on his knee, chin on his fist, under one bare bulb in the dark. Its loop: a breath
 * (his shoulders rise one pixel) and a glint of his eye. Drawn on a 156 × 280 grid, scaled to the phone's top 700 CSS px (the part the
 * reel shows).
 */

/** Scenes 1 to 3's captions (scene 2 has two: the park, then Big Boy). */
export const REEL_CAPTIONS = [
  "100 players.\nOne board.",
  "Explore the town.",
  "Challenge bosses.\nUnlock gear.",
  "Climb the\nranked ladder.",
] as const;
export const HIDDEN_BOSS_CAPTION = "…and the most powerful\nof them all.";
/** Scene 3's second caption, over the run up the ranks (its top rank). */
export const RANKS_CAPTION = "Become\nTranscendent.";

/** Runs in the page (page.evaluate): self-contained, no imports. Replaces the page with the scene, animating until the page closes. */
export function drawHiddenBoss(wide = false) {
  // The phone's portrait (156 × 280 over its top 700 CSS px), or a computer's 16:9 (384 × 216 over 1920 × 1080: the same scene in
  // the middle, the room wider). The scene's own coordinates are the portrait's; (OX, OY) moves them onto the grid.
  const W = wide ? 384 : 156;
  const H = wide ? 216 : 280;
  const OX = wide ? 97 : 0;
  const OY = wide ? -20 : 0;
  const CSS_W = wide ? 1920 : 390;
  const CSS_H = wide ? 1080 : 700;
  const PX = (CSS_W * devicePixelRatio) / W;
  document.body.innerHTML = "";
  document.body.style.cssText = "margin:0;background:#050507;overflow:hidden";
  const view = document.createElement("canvas");
  view.width = Math.round(W * PX);
  view.height = Math.round(H * PX);
  view.style.cssText = `position:fixed;left:0;top:0;width:${CSS_W}px;height:${CSS_H}px;image-rendering:pixelated`;
  document.body.append(view);
  const out = view.getContext("2d")!;
  out.imageSmoothingEnabled = false;
  const art = document.createElement("canvas");
  art.width = W;
  art.height = H;
  const ctx = art.getContext("2d")!;

  type P = [number, number];
  /** A shape's pixels: drawn soft on a mask, kept where it's at least half covered (crisp pixel edges). */
  const mask = document.createElement("canvas");
  mask.width = W;
  mask.height = H;
  const m = mask.getContext("2d", { willReadFrequently: true })!;
  function pixels(draw: (c: CanvasRenderingContext2D) => void): Uint8Array {
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.clearRect(0, 0, W, H);
    m.setTransform(1, 0, 0, 1, OX, OY);
    m.fillStyle = "#fff";
    draw(m);
    const d = m.getImageData(0, 0, W, H).data;
    const on = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) on[i] = d[i * 4 + 3]! >= 128 ? 1 : 0;
    return on;
  }
  const poly = (c: CanvasRenderingContext2D, pts: P[], dy = 0) => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y + dy) : c.moveTo(x, y + dy)));
    c.closePath();
    c.fill();
  };
  const disc = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    rx: number,
    ry = rx,
  ) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  };

  /** His silhouette, his upper body raised `dy` (0 or -1: the breath). The elbow stays on the knee. */
  function figure(dy: number) {
    return pixels((c) => {
      // The stool: a round seat, three legs and a rung.
      c.fillRect(38, 170, 36, 4);
      poly(c, [
        [42, 174],
        [45, 174],
        [41, 205],
        [38, 205],
      ]);
      poly(c, [
        [55, 174],
        [58, 174],
        [58, 205],
        [55, 205],
      ]);
      poly(c, [
        [68, 174],
        [71, 174],
        [75, 205],
        [72, 205],
      ]);
      c.fillRect(42, 190, 31, 2);
      // His seat, then the far leg (its shin and foot behind), then the near one: thigh up to the knee, shin, foot.
      disc(c, 56, 165, 13, 7);
      poly(c, [
        [80, 160],
        [86, 160],
        [86, 201],
        [80, 201],
      ]);
      poly(c, [
        [76, 199],
        [92, 200],
        [93, 205],
        [76, 205],
      ]);
      poly(c, [
        [50, 158],
        [89, 149],
        [93, 159],
        [52, 169],
      ]);
      disc(c, 91, 154, 5);
      poly(c, [
        [86, 155],
        [96, 155],
        [96, 200],
        [89, 200],
      ]);
      poly(c, [
        [87, 199],
        [104, 200],
        [105, 205],
        [87, 205],
      ]);
      // The hunched back and chest, the hood bowed over the board (the breath lifts these).
      poly(
        c,
        [
          [44, 165],
          [40, 148],
          [43, 132],
          [53, 119],
          [65, 111],
          [74, 111],
          [79, 121],
          [77, 137],
          [71, 153],
          [62, 165],
        ],
        dy,
      );
      poly(
        c,
        [
          [71, 106],
          [79, 98],
          [91, 100],
          [97, 109],
          [96, 117],
          [91, 121],
          [82, 122],
          [74, 117],
        ],
        dy,
      );
      // The arm: shoulder down to the elbow on his knee, the forearm up to the fist under his chin.
      poly(
        c,
        [
          [63, 121],
          [72, 114],
          [93, 147],
          [85, 153],
        ],
        dy / 2,
      );
      poly(c, [
        [85, 152],
        [93, 150],
        [101, 126 + dy],
        [94, 123 + dy],
      ]);
      disc(c, 97, 122 + dy, 5, 4);
    });
  }
  const bodies = [figure(0), figure(-1)];

  // The table and its board (the board seen a little from above: 8 × 8 squares, each 6 × 2), a few pieces on it.
  const BX = 104;
  const BY = 134;
  const piece = (x: number, base: number, h: number, w: number): P[] => [
    [x - w, base],
    [x + w, base],
    [x + w - 1, base - 2],
    [x + 1, base - h + 2],
    [x + 1, base - h],
    [x - 1, base - h],
    [x - 1, base - h + 2],
    [x - w + 1, base - 2],
  ];
  const tablePx = pixels((c) => {
    c.fillRect(BX - 2, 150, 52, 3);
    c.fillRect(BX, 153, 48, 3);
    c.fillRect(BX + 3, 156, 3, 49);
    c.fillRect(BX + 42, 156, 3, 49);
  });
  const blackPieces = pixels((c) => {
    poly(c, piece(BX + 15, 142, 10, 3));
    poly(c, piece(BX + 27, 140, 6, 2));
    poly(c, piece(BX + 8, 146, 6, 2));
  });
  const whitePieces = pixels((c) => {
    poly(c, piece(BX + 34, 146, 9, 3));
    poly(c, piece(BX + 22, 148, 6, 2));
  });

  const bulb: P = [98, 40];
  /** How lit a pixel is by the bulb (0 to 1): a cone down to the floor, brightest near its middle and nearer the bulb. */
  const light = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dy = y - OY - bulb[1];
      if (dy < -4) continue;
      const half = 6 + dy * 0.42;
      const off = Math.abs(x - OX - bulb[0] - dy * 0.08) / half;
      const cone = Math.max(0, 1 - off * off);
      const near = 1 / (1 + Math.max(0, dy) / 120);
      light[y * W + x] = cone * near;
    }
  // A faint halo of the room's dark behind him, so his unlit side still reads against it.
  const halo = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x - OX - 66) / 70;
      const dy = (y - OY - 140) / 85;
      halo[y * W + x] = 0.3 * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
    }
  // A 4 × 4 ordered dither, for the light's steps (pixel-art shading, no gradients).
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x: number, y: number) =>
    (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
  const step = (v: number, x: number, y: number, n: number) =>
    Math.min(n - 1, Math.floor(v * (n - 1) + dith(x, y)));
  const hex = (s: string) =>
    [
      parseInt(s.slice(1, 3), 16),
      parseInt(s.slice(3, 5), 16),
      parseInt(s.slice(5, 7), 16),
    ] as const;
  const AIR = ["#050507", "#0c0b11", "#17151e", "#24202c"].map(hex);
  const FLOOR = ["#070709", "#0f0e12", "#1b1916", "#2a2620", "#3a332a"].map(
    hex,
  );
  const WOOD = ["#0d0a08", "#22180f", "#3a2a1a"].map(hex);
  const SQ_LIGHT = ["#2a2620", "#5e5340", "#8e7f62"].map(hex);
  const SQ_DARK = ["#141210", "#2c241b", "#463829"].map(hex);
  const BODY = hex("#010102");
  const RIM = ["#15131c", "#2e293c", "#4f4766"].map(hex);
  const PIECE_W = ["#3c3832", "#8a8070", "#d8ccb4"].map(hex);
  const GLINT = hex("#ff4436");
  const GLOW = hex("#5a1612");
  const motes = Array.from({ length: 9 }, (_, i) => ({
    x: 70 + ((i * 37) % 60),
    y: 60 + ((i * 53) % 120),
    v: 0.6 + (i % 3) * 0.25,
    p: i * 1.7,
  }));

  const img = ctx.createImageData(W, H);
  const put = (x: number, y: number, c: readonly number[]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    img.data[i] = c[0]!;
    img.data[i + 1] = c[1]!;
    img.data[i + 2] = c[2]!;
    img.data[i + 3] = 255;
  };
  const FLOOR_Y = 205;
  const start = performance.now();
  function frame(now: number) {
    const t = (now - start) / 1000;
    // The breath: up for about 1.4 s of every 3.2.
    const phase = t % 3.2;
    const body = bodies[phase > 0.9 && phase < 2.3 ? 1 : 0]!;
    const lift = phase > 0.9 && phase < 2.3 ? -1 : 0;
    // A slight flicker of the bulb now and then.
    const flick = Math.sin(t * 23) > 0.96 ? 0.85 : 1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const X = x - OX;
        const Y = y - OY;
        const l = light[i]! * flick;
        if (body[i]) {
          // His silhouette: black, rimmed where the bulb's light catches an edge from above or from the right.
          const edge =
            (!body[i - W] && l > 0.1) || (x + 1 < W && !body[i + 1] && l > 0.2);
          put(x, y, edge ? RIM[step(Math.min(1, l * 1.6), x, y, 3)]! : BODY);
        } else if (blackPieces[i]) {
          put(x, y, !blackPieces[i - W] ? RIM[2]! : BODY);
        } else if (whitePieces[i]) {
          put(
            x,
            y,
            PIECE_W[
              step(
                Math.min(1, l * 1.3 + (whitePieces[i - W] ? 0 : 0.3)),
                x,
                y,
                3,
              )
            ]!,
          );
        } else if (Y >= BY && Y < BY + 16 && X >= BX && X < BX + 48) {
          const light2 =
            (Math.floor((X - BX) / 6) + Math.floor((Y - BY) / 2)) % 2 === 0;
          put(
            x,
            y,
            (light2 ? SQ_LIGHT : SQ_DARK)[l > 0.45 ? 2 : l > 0.15 ? 1 : 0]!,
          );
        } else if (tablePx[i]) {
          put(
            x,
            y,
            WOOD[step(Math.min(1, l * (Y < 153 ? 1.3 : 0.6)), x, y, 3)]!,
          );
        } else if (Y >= FLOOR_Y) {
          // The floor: the bulb's pool on it, an oval, and its shadows (under the stool, the table and him).
          const dx = (X - 104) / 62;
          const dz = (Y - 210) / 7;
          let pool = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz)) * flick;
          if (X > 34 && X < 106 && Y < 209) pool *= 0.3;
          put(
            x,
            y,
            FLOOR[
              step(Math.min(1, pool * 1.1 + (Y - FLOOR_Y) / 140), x, y, 5)
            ]!,
          );
        } else {
          put(x, y, AIR[step(Math.min(1, l * 0.9 + halo[i]!), x, y, 4)]!);
        }
      }
    // The bulb on its cord, and its warm glow.
    const [bx, by] = [bulb[0] + OX, bulb[1] + OY];
    for (let y = 0; y < by - 2; y++) put(bx, y, [34, 32, 40]);
    for (let y = by - 3; y <= by + 2; y++)
      for (let x = bx - 1; x <= bx + 1; x++)
        put(
          x,
          y,
          y < by - 1
            ? [60, 56, 50]
            : flick < 1
              ? [200, 160, 90]
              : [255, 222, 150],
        );
    put(bx, by + 3, [255, 200, 120]);
    // Dust in the light.
    for (const d of motes) {
      const y =
        (Math.round(d.y + ((t * d.v * 6 + d.p * 10) % 120)) % 170) + 50 + OY;
      const x = Math.round(d.x + Math.sin(t * 0.7 + d.p) * 2) + OX;
      if (light[y * W + x]! > 0.25 && !body[y * W + x]) put(x, y, [74, 66, 54]);
    }
    // The glint of his eye: twice a loop, under the hood.
    const g = t % 3.2;
    if ((g > 1.25 && g < 1.6) || (g > 2.6 && g < 2.75)) {
      const ey = 110 + lift + OY;
      put(91 + OX, ey, GLINT);
      put(92 + OX, ey, GLINT);
      put(90 + OX, ey, GLOW);
      put(93 + OX, ey, GLOW);
    }
    ctx.putImageData(img, 0, 0);
    out.drawImage(art, 0, 0, view.width, view.height);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
