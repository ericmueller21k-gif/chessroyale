/**
 * Birdie's ultimate, Scene B: Armored Birdie revealed. A full-bleed cutscene picture (200 x 260), not an arena piece:
 * a low camera looking up at Armored Birdie (variant A, sleek) in his hero pose, the train's yellow, charcoal and red
 * on him, his shoulder headlights blazing, steam billowing round his feet and sparks flying, a banded night sky behind.
 *
 * Rig: the backdrop is one part; his body is the parts of the approved design, painted at this size; the steam is
 * puffs (circles shaded from the top left, their edges and thin wisps ordered-dithered) made into parts per frame;
 * the headlights' bloom is a part (normal or wide); sparks and the eye's twinkle are specks.
 *
 * Copied as drawn from the art branch `claude/boss-art` (scripts/boss-art/out/arena-birdie-armored/arena-birdie-armored.ts at b6d604fe, Nov 23, 2026: Armored Birdie's reveal in the
 * fall's cutscene, Eric's design): every animation as drawn. Changed: the import paths, and the whole drawing made the first time
 * it is read (`build`). Played by components/BirdieFall.tsx. The run's report: scripts/boss-art/out/arena-birdie-armored/summary.md on that branch.
 */
import { canvas, inEllipse, inPoly, toGrid, type Canvas } from "./paint.ts";
import { lazyAnim, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

/** The drawing as drawn, made the first time it is read (its parts and frames: about a second of work at import otherwise). */
function build(): Character {

  const PALETTE: Record<string, string> = {
    k: "#1d1411", // outline
    a: "#3d2e27", // his brown: deep shadow to light
    b: "#5c4638",
    c: "#7c624f",
    d: "#9c8069",
    e: "#bfa58b",
    f: "#8f6c5b", // face and throat: warm buff, dark to light
    g: "#b08773",
    h: "#cea58c",
    s: "#2b1f1b", // dark marks
    o: "#cfd8d6", // the pale ring round his eye
    x: "#0d0909", // the eye
    w: "#fffaf0", // the glint, the lamps' core, the sparks' heads
    B: "#3e373c", // beak
    C: "#7a7075",
    "1": "#0f1328", // the cap: navy, dark to light
    "2": "#1c2850",
    "3": "#2d3f7c",
    "4": "#4a60a8",
    K: "#a87414", // gold
    L: "#f2c14e",
    R: "#6a1222", // tie: burgundy, dark to light
    T: "#a52238",
    U: "#d64a5a",
    t: "#5e4206", // the armor: the train's yellow, dark to light
    u: "#9a6a08",
    v: "#d49a12",
    y: "#f4c21e",
    Y: "#ffe27a",
    m: "#23232b", // the roof's charcoal
    n: "#3b3b46",
    N: "#5a5a68",
    q: "#cc2a2a", // the red stripe
    W: "#fff3b8", // headlights: the near one's glass, the far one's
    V: "#fff3b8",
    J: "#ffe9a6", // the lamps' bloom
    "6": "#070916", // the night: navy to blue-violet
    A: "#0c1024",
    D: "#131939",
    E: "#1c2150",
    F: "#28265f",
    H: "#372b6e",
    X: "#4c428e", // the backlight round him
    M: "#121119", // the cutting's ground, dark
    G: "#0a0a0f",
    P: "#2e1d1a", // the sparks' glow on the ground
    O: "#5a3418",
    S: "#e9ebf1", // steam: light, shade, deep shade
    Q: "#b9bdcc",
    Z: "#878ca2",
  };

  type Pt = readonly [number, number];
  type Inside = (x: number, y: number) => boolean;
  type Key = (x: number, y: number) => string | null;
  type Fill = (inside: Inside, key: Key) => void;
  type Stamp = (rows: readonly string[], x: number, y: number) => void;

  const E = inEllipse;
  const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
  const BAY = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  /** Ordered-dither threshold of a pixel, 0..1. */
  const bay = (x: number, y: number) => (BAY[y & 3]![x & 3]! + 0.5) / 16;

  const WD = 200;
  const HT = 260;

  const PARTS: Record<string, Part> = {};
  const AT: Record<string, Pt> = {};

  /** A part painted in frame pixels: its canvas covers (x0, y0) to (x0 + w, y0 + h). */
  function painted(name: string, x0: number, y0: number, w: number, h: number, draw: (F: Fill, S: Stamp) => void, outline = true) {
    const cv: Canvas = canvas(w, h);
    const F: Fill = (inside, key) => {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (inside(x + x0, y + y0)) {
            const k = key(x + x0, y + y0);
            if (k) cv[y]![x] = k;
          }
    };
    const S: Stamp = (rows, sx, sy) =>
      rows.forEach((row, j) =>
        [...row].forEach((k, i) => {
          const X = Math.round(sx) + i - x0;
          const Y = Math.round(sy) + j - y0;
          if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
        }),
      );
    draw(F, S);
    PARTS[name] = { grid: toGrid(cv), outline };
    AT[name] = [x0, y0];
    return name;
  }
  const ALL: Inside = () => true;

  // ---- The backdrop: banded night sky, the cutting's dark walls, the track in shadow, a faint glow from the sparks.

  const HORIZON = 186;
  const SKY: [number, string][] = [
    [28, "A"],
    [58, "D"],
    [94, "E"],
    [130, "F"],
    [162, "H"],
  ];
  function skyKey(x: number, y: number): string {
    let k = "6";
    for (const [b, key] of SKY) {
      if (y >= b + 3) k = key;
      else if (y >= b - 3 && bay(x, y) < (y - (b - 3) + 0.5) / 6) k = key;
    }
    return k;
  }
  const STARS: Pt[] = [[12, 10], [34, 24], [58, 8], [150, 12], [176, 30], [188, 8], [22, 52], [170, 58], [128, 6], [8, 78], [192, 84], [44, 40]];
  painted(
    "bg",
    0,
    0,
    WD,
    HT,
    (F, S) => {
      F(ALL, (x, y) => (y < HORIZON ? skyKey(x, y) : y < 200 ? "M" : "G"));
      for (const [x, y] of STARS) S([y % 3 ? "4" : "Q"], x, y);
      // The cutting's walls: dark banks either side, a dim violet edge on their tops.
      const left = inPoly([[0, 136], [20, 146], [46, 164], [74, 182], [84, HORIZON], [0, HORIZON]]);
      const right = inPoly([[200, 128], [180, 140], [154, 160], [128, 180], [118, HORIZON], [200, HORIZON]]);
      F((x, y) => left(x, y) || right(x, y), (x, y) => (!left(x, y - 1) && !right(x, y - 1) ? "F" : "M"));
      // A signal mast on the left bank, its lamp a dim red; a gantry's post and beam on the right.
      F((x, y) => x >= 14 && x <= 16 && y >= 96 && y < 150, (x) => (x === 14 ? "n" : "m"));
      F((x, y) => x >= 10 && x <= 20 && y >= 88 && y <= 100, (x, y) => (x === 10 || y === 88 ? "n" : "m"));
      S(["qq", "qq"], 13, 91);
      F((x, y) => x >= 184 && x <= 188 && y >= 64 && y < 140, (x) => (x === 184 ? "n" : "m"));
      F((x, y) => x >= 150 && y >= 62 && y <= 66, (x, y) => (y === 62 ? "n" : "m"));
      F((x, y) => x >= 152 && x < 184 && y > 66 && y < 72 && (x - y + 400) % 8 < 2, () => "m");
      // The track: two rails running at him out of the dark, sleepers between, a little lit by the glow.
      for (let y = HORIZON; y < HT; y++) {
        const t = (y - HORIZON) / (HT - HORIZON);
        const wv = 1 + Math.floor(t * 3);
        const lx = Math.round(97 - t * 74);
        const rx = Math.round(103 + t * 74);
        for (let i = 0; i < wv; i++) {
          S([i === 0 ? "N" : "n"], lx - i, y);
          S([i === 0 ? "N" : "n"], rx + i, y);
        }
      }
      for (const sy of [190, 195, 201, 209, 219, 231, 246]) {
        const t = (sy - HORIZON) / (HT - HORIZON);
        const th = 1 + Math.floor(t * 4);
        F((x, y) => y >= sy && y < sy + th && x > 92 - t * 82 && x < 108 + t * 82, (x, y) => (y === sy ? "n" : "m"));
      }
      // The glow of the sparks on the ground, thickest low in the middle.
      F(
        (x, y) => y >= 196,
        (x, y) => {
          const dens = Math.min(1, (y - 196) / 64) * Math.max(0, 1 - Math.abs(x + 0.5 - 100) / 110);
          if (bay(x, y) < dens * 0.7 - 0.1) return "O";
          if (bay(x + 2, y + 1) < dens * 1.6) return "P";
          return null;
        },
      );
    },
    false,
  );

  // ---- Him. Birdie's head, at cutscene size.

  const HX = 100;
  const HY = 68;
  const HRX = 30;
  const HRY = 28;
  /** The eye's middle, and its glint's top-left. */
  const EYE: Pt = [87, 63];
  const GLINT: Pt = [82, 57];

  const BODY: string[] = [];
  const body = (n: string) => (BODY.push(n), n);

  body(
    painted("head", 50, 38, 90, 72, (F, S) => {
      // The neck below the head, buff on the lit side.
      F(E(103, 96, 21, 11), (x, y) => (x < 98 ? ramp("fgh", 0.82 - 0.03 * (y - 86)) : ramp("bcd", 0.78 - 0.022 * (x - 98) - 0.01 * (y - 90))));
      F(E(HX, HY, HRX, HRY), (x, y) => {
        const nx = (x + 0.5 - HX) / HRX;
        const ny = (y + 0.5 - HY) / HRY;
        const dd = nx * nx + ny * ny;
        const l = 0.42 - 0.32 * nx - 0.42 * ny + 0.3 * (1 - dd);
        if (nx < -0.1 && ny > -0.25) return ramp("fgh", l + 0.05);
        return ramp("abcde", l - 0.02);
      });
      // The beak: slim, grey, pointing to our left; the upper ridge lit.
      F(inPoly([[75, 64], [64, 66], [55, 70], [75, 71]]), (x, y) => (y <= 66 && x > 58 ? "C" : "B"));
      F(inPoly([[75, 71], [57, 71], [62, 74], [75, 76]]), (x, y) => (y === 71 ? "s" : "B"));
      // The eye: the pale ring, the big dark eye, the glint.
      F(E(EYE[0], EYE[1], 10.5, 11), (x, y) => (x + y > EYE[0] + EYE[1] + 12 ? "e" : "o"));
      F(E(EYE[0], EYE[1], 7.5, 8), () => "x");
      S([".ww.", "wwww", "wwww", ".ww."], GLINT[0], GLINT[1]);
      S(["oo", "oo"], 90, 66);
      // The dark mark on his cheek.
      S([".s", "ss", "ss", "ss", "s."], 105, 77);
    }),
  );

  /** The cap: the short round navy crown perched jaunty, the gold band and gold visor, a small gold diamond in front. */
  body(
    painted("cap", 52, 18, 76, 36, (F, S) => {
      const crown = inPoly([[74, 41], [75, 33], [81, 26], [92, 22], [106, 22], [116, 26], [122, 33], [123, 41]]);
      F(crown, (x, y) => {
        const nx = (x + 0.5 - 97) / 25;
        const ny = (y + 0.5 - 31) / 10;
        if (!crown(x, y - 1)) return x < 108 ? "4" : "3";
        return ramp("1234", 0.62 - 0.45 * nx - 0.45 * ny);
      });
      F((x, y) => x >= 72 && x <= 124 && y >= 40 && y <= 45, (x, y) => (y === 45 || x >= 119 ? "K" : y === 40 && x < 110 ? "Y" : "L"));
      F(inPoly([[58, 48], [65, 44.5], [86, 44.5], [86, 47], [76, 50], [59, 50]]), (x, y) => (y >= 49 ? "K" : "L"));
      S(["..K..", ".KLK.", "KLLLK", ".KLK.", "..K.."], 90, 29);
    }),
  );

  /** The tie at his throat, over the collar. */
  body(
    painted("tie", 90, 94, 20, 32, (F) => {
      F(inPoly([[94, 96], [106, 96], [104, 103], [96, 103]]), (x, y) => (x < 98 && y < 99 ? "U" : x > 103 ? "R" : "T"));
      F(inPoly([[96, 104], [104, 104], [107, 116], [100.5, 123], [94, 116]]), (x, y) => (x < 98 ? "U" : x > 103 || y > 119 ? "R" : "T"));
    }),
  );

  // ---- The armor.

  /** The chest plate: a locomotive's rounded nose, yellow, the charcoal collar, the red stripe down the middle. */
  const CHEST: Pt[] = [[70, 98], [130, 98], [138, 106], [138, 122], [132, 138], [122, 153], [112, 160], [88, 160], [78, 153], [68, 138], [62, 122], [62, 106]];
  body(
    painted("chest", 60, 96, 82, 68, (F) => {
      const inside = inPoly(CHEST);
      F(inside, (x, y) => {
        const nx = (x + 0.5 - 100) / 38;
        const ny = (y + 0.5 - 124) / 34;
        const l = 0.62 - 0.38 * nx - 0.42 * ny;
        if (y <= 103) return y === 98 && x < 118 ? "N" : y === 103 ? "m" : "n";
        // The warm rim light along the top edge.
        if (y === 104) return x < 124 ? "Y" : "y";
        if (y === 105 && x < 116) return "Y";
        if (x >= 99 && x <= 100 && y >= 107) return "q";
        if (x === 101 && y >= 107) return "T";
        // Grille slits on the nose, either side of the stripe.
        if ((y === 146 || y === 149) && Math.abs(x + 0.5 - 100) > 6 && Math.abs(x + 0.5 - 100) < 16) return "m";
        if ((y === 147 || y === 150) && Math.abs(x + 0.5 - 100) > 6 && Math.abs(x + 0.5 - 100) < 16) return "u";
        // The belly seam, curving down at the sides.
        if (y === 139 + Math.round(Math.abs(x + 0.5 - 100) / 6)) return "u";
        // The pectoral seams sweeping out from the collar.
        if (y >= 108 && y <= 132 && (x === 80 - Math.round((y - 108) / 5) || x === 120 + Math.round((y - 108) / 5))) return x < 100 ? "v" : "u";
        // The shade side, away from the light: the right and the bottom edges.
        if (!inside(x + 2, y) || !inside(x, y + 2)) return "t";
        if (!inside(x + 4, y) || !inside(x, y + 4)) return "u";
        if (!inside(x - 1, y)) return "Y";
        return ramp("tuvyY", l + 0.08);
      });
    }),
  );

  /** The waist and hips: charcoal, a gold buckle. */
  body(
    painted("hips", 70, 150, 60, 32, (F, S) => {
      const inside = inPoly([[80, 152], [120, 152], [126, 166], [128, 180], [72, 180], [74, 166]]);
      F(inside, (x, y) => (y >= 159 && y <= 162 ? (y === 159 ? "N" : "m") : !inside(x - 1, y) ? "N" : ramp("mnN", 0.85 - 0.012 * (x - 74) - 0.012 * (y - 152))));
      S(["KKKKKKKKKKKK", "KLLLLLLLLLLK", "KLKKKKKKKKLK", "KLKmmmmmmKLK", "KLKKKKKKKKLK", "KLLLLLLLLLLK", "KKKKKKKKKKKK"], 94, 157);
      // A small yellow plate below the buckle, like the locomotive's pilot.
      const pilot = inPoly([[89, 166], [111, 166], [107, 179], [93, 179]]);
      F(pilot, (x, y) => (y === 166 ? "Y" : !pilot(x + 2, y) || y >= 177 ? "u" : x === 100 ? "q" : !pilot(x - 1, y) ? "Y" : ramp("uvyY", 0.8 - 0.02 * (x - 90) - 0.02 * (y - 166))));
    }),
  );

  /** A leg: a charcoal thigh, a yellow knee plate, a tall yellow boot with a red stripe and a charcoal toe cap. */
  function leg(name: string, top: [number, number], bx: number, far: boolean) {
    return body(
      painted(name, Math.min(bx - 8, top[0] - 2), 172, 60, 66, (F) => {
        const thigh = inPoly([[top[0], 174], [top[0] + 18, 174], [bx + 21, 208], [bx + 5, 208]]);
        F(thigh, (x, y) => (!thigh(x - 1, y) || !thigh(x - 2, y) ? "N" : !thigh(x + 2, y) ? "m" : ramp("nN", 0.9 - 0.05 * (x - bx - 4 - (y - 174) * ((bx + 5 - top[0]) / 34)) - (far ? 0.15 : 0))));
        const boot = inPoly([[bx, 206], [bx + 26, 206], [bx + 26, 223], [bx + 31, 227], [bx + 31, 236], [bx - 5, 236], [bx - 5, 227], [bx, 223]]);
        F(boot, (x, y) => {
          if (y >= 234) return "m";
          if (y >= 227) return y === 227 ? "N" : !boot(x - 1, y) ? "N" : !boot(x + 2, y) ? "m" : "n";
          if (y === 226) return "m";
          if (y === 218 || y === 219) return "q";
          if (!boot(x + 2, y)) return "t";
          if (!boot(x - 1, y)) return "Y";
          return ramp("tuvyY", 0.82 - 0.022 * (x - bx) - 0.006 * (y - 206) - (far ? 0.12 : 0));
        });
        const kx = bx + 13;
        const knee = E(kx, 205, 12, 7);
        F(knee, (x, y) => (!knee(x, y + 1) ? "u" : !knee(x, y - 1) ? "Y" : ramp("uvyY", 0.85 - 0.025 * (x - kx + 10) - 0.06 * (y - 200) - (far ? 0.1 : 0))));
      }),
    );
  }

  /** A wing held a little out from his side: thin yellow plates with scalloped edges, a pale fringe, dark flight feathers. */
  function wing(name: string, poly: Pt[], far: boolean) {
    const inside0 = inPoly(poly);
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs));
    const y0 = Math.floor(Math.min(...ys));
    const x1 = Math.ceil(Math.max(...xs));
    const y1 = Math.ceil(Math.max(...ys));
    const cx = (x0 + x1) / 2;
    const P = 17;
    // The flight feathers' fingers: notches along the bottom.
    const inside: Inside = (x, y) => inside0(x, y) && !(y >= y1 - 6 && !inside0(x, y + 5) && (x - x0) % 5 === 0);
    return body(
      painted(name, x0, y0, x1 - x0 + 1, y1 - y0 + 1, (F) => {
        F(inside, (x, y) => {
          const v = y - y0;
          const l = 0.62 - (0.5 * (x + 0.5 - cx)) / (x1 - x0) - (0.25 * v) / (y1 - y0) - (far ? 0.1 : 0);
          const sc = [0, 1, 2, 3, 3, 2, 1, 0][(x - x0 + (far ? 4 : 0)) & 7]!;
          const vv = Math.max(0, v - sc);
          if (vv < 2 * P) {
            const band = Math.floor(vv / P);
            const r = vv % P;
            if (r >= P - 2) return r === P - 1 ? "e" : "d";
            if (r === P - 3) return "u";
            if (r <= 1) return v <= 1 ? (far ? "y" : "Y") : ramp("vyY", l + 0.3);
            if (band === 0 && (r === 8 || r === 9) && !far) return "q";
            if (!inside(x + 2, y)) return "t";
            if (!inside(x - 1, y)) return "Y";
            return ramp("tuvyY", l + 0.06);
          }
          return (x - x0 + (far ? 2 : 0)) % 5 === 0 ? "a" : ramp("bcd", l + 0.12);
        });
      }),
    );
  }

  /** A pauldron: a rounded charcoal roof over a yellow band, the red stripe between, a headlight in the band. */
  const LAMP_F: Pt = [58, 115];
  const LAMP_N: Pt = [142, 115];
  const GLASS_F: Pt = [5.5, 4.5];
  const GLASS_N: Pt = [7, 5];
  function pauldron(name: string, cx: number, cy: number, rx: number, ry: number, lamp: Pt, glass: Pt, far: boolean) {
    return body(
      painted(name, Math.floor(cx - rx) - 1, Math.floor(cy - ry) - 1, Math.ceil(rx * 2) + 3, Math.ceil(ry * 2) + 3, (F) => {
        const inside = E(cx, cy, rx, ry);
        F(inside, (x, y) => {
          const nx = (x + 0.5 - cx) / rx;
          const ny = (y + 0.5 - cy) / ry;
          const l = 0.62 - 0.4 * nx - 0.4 * ny - (far ? 0.08 : 0);
          const band = y - Math.round(cy - 3 + nx * 2);
          if (band < 0) return !inside(x, y - 1) || !inside(x, y - 2) ? (nx < 0.3 ? "N" : "n") : ramp("mnN", l + 0.05);
          if (band <= 1) return "q";
          if (!inside(x, y + 2)) return "t";
          if (!inside(x, y + 3)) return "u";
          if (band === 2) return nx < 0.4 ? "Y" : "y";
          return ramp("tuvyY", l + 0.15);
        });
        const g = far ? "V" : "W";
        const [lx, ly] = lamp;
        const rim = E(lx, ly, glass[0] + 2, glass[1] + 2);
        F(rim, (x, y) => (x + y > lx + ly + 1 ? "m" : "n"));
        F(E(lx, ly, glass[0], glass[1]), () => g);
        F(E(lx - 1.5, ly - 1.2, glass[0] * 0.45, glass[1] * 0.45), () => "w");
      }),
    );
  }

  /** His long dove's tail sweeping behind him to our right: grey-brown, banded, a dark band and a pale tip. */
  const tailName = body(
    painted("tail", 96, 150, 102, 92, (F) => {
      // A long wedge from behind his hips down to our right, widening, its tip rounded to a point.
      const [x0, y0] = [102, 166];
      const ux = 0.2;
      const uy = 0.98;
      const LEN = 64;
      const coords = (x: number, y: number) => {
        const along = (x + 0.5 - x0) * ux + (y + 0.5 - y0) * uy;
        const across = -(x + 0.5 - x0) * uy + (y + 0.5 - y0) * ux;
        return [along, across] as const;
      };
      // Fanning out toward the end, which is cut into rounded feather tips.
      const hw = (a: number) => 6 + a * 0.2;
      const endAt = (c: number) => LEN - (c * c) / 30 - Math.abs(((c + 60) % 6) - 3) * 1.4;
      const inside: Inside = (x, y) => {
        const [a, c] = coords(x, y);
        return a >= 0 && Math.abs(c) < hw(a) && a < endAt(c);
      };
      F(inside, (x, y) => {
        const [a, c] = coords(x, y);
        const end = endAt(c);
        if (a > end - 6) return c < -2 ? "e" : "d";
        if (a > end - 12) return "s";
        if (Math.abs(c) > 1 && Math.round(c + 60) % 6 === 0) return "b";
        return ramp("bcde", 0.6 - (0.45 * c) / hw(a) - a * 0.002);
      });
    }),
  );

  wing("wingF", [[46, 114], [66, 116], [68, 132], [62, 160], [54, 184], [44, 204], [35, 190], [35, 160], [39, 132]], true);
  wing("wingN", [[134, 116], [154, 114], [161, 132], [165, 160], [165, 190], [156, 204], [146, 184], [138, 160], [132, 132]], false);
  pauldron("pauldronF", 63, 108, 19, 14, LAMP_F, GLASS_F, true);
  pauldron("pauldronN", 137, 108, 21, 15, LAMP_N, GLASS_N, false);
  leg("legF", [78, 174], 59, true);
  leg("legN", [104, 174], 115, false);

  // ---- The backlight: a violet rim round his whole silhouette, outside his outline.

  {
    const M = Array.from({ length: HT }, () => Array<boolean>(WD).fill(false));
    for (const n of BODY) {
      const [x0, y0] = AT[n]!;
      PARTS[n]!.grid.forEach((row, j) => [...row].forEach((k, i) => k !== "." && M[y0 + j]?.[x0 + i] !== undefined && (M[y0 + j]![x0 + i] = true)));
    }
    const dil = (src: boolean[][]) => src.map((r, y) => r.map((v, x) => v || !!src[y - 1]?.[x] || !!src[y + 1]?.[x] || !!r[x - 1] || !!r[x + 1]));
    const D1 = dil(M);
    const D2 = dil(D1);
    painted("halo", 0, 0, WD, HT, (F) => F((x, y) => D2[y]![x]! && !D1[y]![x]! && y < 226, () => "X"), false);
  }

  // ---- The headlights' glow: the bloom round each lamp and a short lens streak (normal, or wide for the pulse).

  function bloom(name: string, lamp: Pt, glass: Pt, wide: boolean, withGlass: boolean, far: boolean) {
    const [lx, ly] = lamp;
    const R = (wide ? 17 : 12) - (far ? 1 : 0);
    const L = (wide ? 28 : 19) - (far ? 3 : 0);
    const I = wide ? 3 : 2;
    const C = wide ? 7 : 5;
    return painted(
      name,
      lx - 30,
      ly - 24,
      61,
      49,
      (F) => {
        F(ALL, (x, y) => {
          const dx = (x + 0.5 - lx) / glass[0];
          const dy = (y + 0.5 - ly) / glass[1];
          const d = Math.sqrt(dx * dx + dy * dy); // 1 at the glass's edge
          const px = d * glass[0]; // roughly, pixels from the lamp's middle
          if (d < 1) return withGlass ? (d < 0.5 ? "w" : far ? "V" : "W") : null;
          const out = px - glass[0];
          // The lens streak: a bright horizontal line through the lamp, a shorter vertical.
          const sx = Math.abs(x + 0.5 - lx);
          const sy = Math.abs(y + 0.5 - ly);
          if ((y === ly || (wide && y === ly - 1 && sx < L * 0.5)) && sx < L) return sx < L * 0.45 ? "w" : "J";
          if (x === lx && sy < L * 0.55) return sy < L * 0.3 ? "w" : "J";
          if (out < 1) return withGlass ? "J" : "w";
          if (out < I) return "J";
          if (out < C) return bay(x, y) < 0.5 ? "J" : null;
          if (out < R) return bay(x, y) < 0.25 * (1 - (out - C) / (R - C)) + 0.04 ? "J" : null;
          return null;
        });
      },
      false,
    );
  }
  for (const wide of [false, true])
    for (const through of [false, true]) {
      bloom(`bloomN${+wide}${+through}`, LAMP_N, GLASS_N, wide, through, false);
      bloom(`bloomF${+wide}${+through}`, LAMP_F, GLASS_F, wide, through, true);
    }

  // ---- The steam: puffs [x, y, radius, density], shaded from the top left, dithered at their edges and when thin.

  type Puff = readonly [number, number, number, number];
  function steam(name: string, puffs: readonly Puff[]) {
    const sorted = [...puffs].sort((p, q) => p[1] - q[1]);
    return painted(
      name,
      0,
      0,
      WD,
      HT,
      (F) => {
        for (const [cx, cy, r, dens] of sorted) {
          if (r < 1.5 || dens <= 0.02) continue;
          F(E(cx, cy, r, r), (x, y) => {
            const nx = (x + 0.5 - cx) / r;
            const ny = (y + 0.5 - cy) / r;
            const dd = Math.sqrt(nx * nx + ny * ny);
            const edge = dd < 0.72 ? 1 : (1 - dd) / 0.28;
            if (bay(x, y) >= dens * edge) return null;
            const l = 0.55 - 0.4 * nx - 0.6 * ny;
            return l > 0.32 ? "S" : l > -0.12 ? "Q" : "Z";
          });
        }
      },
      false,
    );
  }

  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /** Behind him: a bank along the ground and columns rising at the sides, thinning up the frame. */
  const BACK: Puff[] = [];
  for (let x = -14; x <= 214; x += 20) BACK.push([x + rnd() * 6, 236 + rnd() * 10, 16 + rnd() * 7, 1]);
  for (const side of [0, 1]) {
    const col: Puff[] = [
      [10, 214, 20, 1],
      [26, 196, 15, 1],
      [4, 186, 17, 1],
      [18, 168, 13, 1],
      [2, 154, 13, 1],
      [12, 138, 10, 1],
      [-2, 126, 10, 1],
      [8, 113, 7, 1],
      [-1, 102, 7, 1],
      [6, 92, 4, 1],
      [1, 84, 3, 1],
    ];
    for (const [x, y, r, d] of col) BACK.push([side ? WD - x - 2 : x, y - side * 6, r, d]);
  }
  /** In front of him: billows round his feet, low on the ground; the drifting ones move a little in the hold. */
  const FRONT: Puff[] = [
    [-4, 252, 18, 1],
    [26, 256, 16, 1],
    [58, 254, 17, 1],
    [100, 260, 18, 1],
    [140, 255, 17, 1],
    [174, 253, 17, 1],
    [204, 250, 16, 1],
    [44, 240, 9, 0.9],
    [100, 244, 10, 0.85],
    [156, 241, 9, 0.9],
    [12, 236, 10, 0.9],
    [190, 236, 10, 0.9],
  ];
  const DRIFT: Puff[] = [
    [30, 222, 8, 0.5],
    [40, 214, 6, 0.35],
    [168, 220, 8, 0.5],
    [178, 210, 6, 0.32],
    [100, 232, 6, 0.55],
    [140, 205, 5, 0.25],
    [62, 206, 5, 0.25],
  ];
  const drift = (dx: number, dy: number) => DRIFT.map(([x, y, r, d], i): Puff => [x + (i % 2 ? dx : -dx), y + dy, r, d]);

  /** The cover the reveal blows away: a field of puffs over him, pushed out to the sides and up, thinning. */
  const COVER: Puff[] = [];
  for (let gy = 22, row = 0; gy <= 190; gy += 19, row++)
    for (let gx = row % 2 ? -4 : 8; gx <= 210; gx += 23) {
      if (gy > 178 && Math.abs(gx - 100) < 50) continue;
      COVER.push([gx + rnd() * 6 - 3, gy + rnd() * 6 - 3, 17 + rnd() * 7, 1]);
    }
  function cover(t: number): Puff[] {
    const k = t / 4;
    return COVER.map(([x, y, r, d]): Puff => {
      const dx = x - 100;
      const s = Math.sign(dx) || 1;
      const push = Math.pow(k, 1.3) * (70 + Math.abs(dx) * 0.6);
      return [x + s * push, y - push * 0.5 - k * 12, r * (1 - 0.35 * k), d * (t < 3 ? 1 : 0.55)];
    });
  }

  steam("back", BACK);
  steam("front", [...FRONT, ...drift(0, 0)]);
  steam("front1", [...FRONT, ...drift(1, 0)]);
  steam("front2", [...FRONT, ...drift(2, -1)]);
  for (let t = 0; t < 4; t++) steam(`cover${t}`, cover(t));

  // ---- Sparks: short yellow-white streaks flying off his shoulders and boots.

  type Streak = readonly [x: number, y: number, dx: number, dy: number, len: number];
  function streaks(list: readonly Streak[]): Speck[] {
    const out: Speck[] = [];
    for (const [x0, y0, dx, dy, len] of list) {
      const [x, y] = [Math.round(x0), Math.round(y0)];
      out.push([x, y, "w"]);
      for (let i = 1; i < len; i++) out.push([x - dx * i, y - dy * i, "Y"]);
    }
    return out;
  }
  const SETTLED: Streak[] = [
    [163, 93, 1, -1, 3],
    [170, 101, 1, 0, 2],
    [36, 95, -1, -1, 3],
    [28, 104, -1, 0, 2],
    [149, 224, 1, -1, 3],
    [52, 226, -1, -1, 3],
    [176, 86, 0, 0, 1],
    [22, 90, 0, 0, 1],
  ];
  const FLICKER: Streak[] = [
    [158, 86, 1, -1, 2],
    [42, 88, -1, -1, 2],
    [156, 216, 1, -1, 2],
    [46, 219, -1, -1, 2],
    [184, 96, 0, 0, 1],
  ];
  /** Flying sparks in the reveal, frame t: out and up from the shoulders and boots, fewer as he settles. */
  function flying(t: number): Speck[] {
    const list: Streak[] = [];
    const spread = 6 + t * 7;
    const shoulders: Pt[] = [LAMP_N, LAMP_F];
    for (const [i, [sx, sy]] of shoulders.entries()) {
      const s = i === 0 ? 1 : -1;
      for (let j = 0; j < 4 - Math.floor(t / 2); j++) list.push([sx + s * (14 + spread + j * 9), sy - 14 - spread * 0.6 - j * 7, s, -1, 4 - (t >> 1)]);
    }
    for (const [bx, s] of [[148, 1], [52, -1]] as const)
      for (let j = 0; j < 3 - Math.floor(t / 2); j++) list.push([bx + s * (spread + j * 8), 224 - spread * 0.5 - j * 6, s, -1, 3]);
    return streaks(list);
  }

  /** The eye's last glint: a short plus-shaped twinkle out of the glint. */
  const [gx, gy] = [GLINT[0] + 1, GLINT[1] + 1];
  const TWINKLE: Speck[] = [
    ...[2, 3, 4, 5, 6, 7, 8].map((i): Speck => [gx, gy - i, i > 6 ? "Y" : "w"]),
    ...[2, 3, 4, 5, 6, 7, 8].map((i): Speck => [gx - i, gy, i > 6 ? "Y" : "w"]),
    ...[3, 4, 5, 6].map((i): Speck => [gx + i, gy, i > 5 ? "W" : "w"]),
    ...[3, 4, 5, 6].map((i): Speck => [gx, gy + i, i > 5 ? "W" : "w"]),
    [gx - 3, gy - 3, "w"], [gx + 3, gy - 3, "W"], [gx - 3, gy + 3, "W"],
  ];

  // ---- The rig: a frame is the backdrop, the back steam, him, the glow, the front steam, then specks.

  interface Shot {
    front?: string;
    cover?: string;
    /** The lamps' bloom: 0 normal, 1 wide; `through` puts it over the steam with its own glass (the lamps glowing through). */
    bloom?: 0 | 1;
    through?: boolean;
    specks?: Speck[];
  }
  const L = (name: string): Layer => ({ part: name, x: AT[name]![0], y: AT[name]![1] });
  const HIM = [tailName, "wingF", "pauldronF", "legF", "legN", "hips", "head", "chest", "tie", "wingN", "pauldronN", "cap"];
  function shot(ms: number, s: Shot): Frame {
    const b = s.bloom ?? 0;
    const glow = [L(`bloomF${b}0`), L(`bloomN${b}0`)];
    const glowThrough = [L(`bloomF${b}1`), L(`bloomN${b}1`)];
    return {
      ms,
      layers: [
        L("bg"),
        L("back"),
        L("halo"),
        ...HIM.map(L),
        ...(s.through ? [] : glow),
        L(s.front ?? "front"),
        ...(s.cover ? [L(s.cover)] : []),
        ...(s.through ? glowThrough : []),
      ],
      specks: s.specks,
    };
  }

  /**
   * Reveal (6 frames, 1.2 s, plays once and holds the last): the steam clears off him, blown out to the sides and up;
   * frame 0 shows only his boots and the lamps glowing through; frame 4 shows him whole; frame 5, the sparks settled,
   * the last twinkle on his eye.
   */
  const reveal: Anim = {
    loop: false,
    frames: [
      shot(200, { cover: "cover0", through: true, specks: flying(0) }),
      shot(200, { cover: "cover1", through: true, specks: flying(1) }),
      shot(200, { cover: "cover2", through: true, specks: flying(2) }),
      shot(200, { cover: "cover3", specks: flying(3) }),
      shot(200, { bloom: 1, specks: flying(4) }),
      shot(200, { specks: [...streaks(SETTLED), ...TWINKLE] }),
    ],
  };

  /** Hold (3 frames, 0.9 s, loops): he stands; a few wisps drift; the headlights pulse; a spark or two flickers. */
  const hold: Anim = {
    loop: true,
    frames: [
      shot(300, { specks: streaks(SETTLED) }),
      shot(300, { front: "front1", bloom: 1, specks: streaks([...SETTLED.slice(0, 6), ...FLICKER]) }),
      shot(300, { front: "front2", specks: streaks(SETTLED.slice(2)) }),
    ],
  };

  return {
    id: "arena-birdie-armored",
    name: "Armored Birdie",
    w: WD,
    h: HT,
    foot: [100, 236],
    palette: PALETTE,
    parts: PARTS,
    anims: { reveal, hold },
  };
}

let built: Character | undefined;
const made = (): Character => (built ??= build());

export const ARENA_BIRDIE_ARMORED: Character = {
  id: "arena-birdie-armored",
  name: "Armored Birdie",
  w: 200,
  h: 260,
  foot: [100, 236],
  get palette() {
    return made().palette;
  },
  get parts() {
    return made().parts;
  },
  anims: { reveal: lazyAnim(() => made().anims.reveal!), hold: lazyAnim(() => made().anims.hold!) },
};
