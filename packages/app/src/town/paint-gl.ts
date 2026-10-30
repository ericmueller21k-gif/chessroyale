/**
 * The town's WebGL 2 backend (Oct 30; paint.ts has the interface, docs/decisions/2026-10-30-town-webgl.md the choices).
 *
 * `GLCtx` stands in for the part of CanvasRenderingContext2D the town draws with (paint.ts, `Ctx`), with the same state
 * (alpha, the composite, the transform, save and restore, clips, smoothing, shadows, fonts) carried from call to call and
 * frame to frame as a 2D context carries it. It records each frame as triangles in one vertex stream per target (the
 * canvas, each light layer) and draws a stream in one call when something forces it: a new clip shape for the stencil,
 * a second texture of its own in one draw, the frame's end (about 5 draw calls a frame). One shader does everything:
 *
 * - **solid** fills (premultiplied colors; paths fanned, each subpath convex as all the town's are; MSAA smooths edges);
 * - **textured** quads, any four corners, from the atlas (one array texture, a page a layer) and one texture of its own
 *   a draw (a light layer, a picture over 1024 px), each sampled nearest or smooth per quad as `imageSmoothingEnabled` said
 *   when it was drawn (nearest: the texel's middle, sampled smooth, so the two never break a batch);
 * - **soft lines**: a stroke's shadow (the table's ring, the pressed square's glow) as the stroke blurred, worked out per
 *   pixel (a Gaussian across a line has a closed form), not a blur pass;
 * - **soft pictures**: the far band's softening (render.ts's `blitSoft`: shrunk, hazed, stretched back), the two
 *   resamplings done per pixel in one draw, no scratch canvas.
 *
 * The composites the town uses all blend as premultiplied source-over (ONE, ONE_MINUS_SRC_ALPHA): "lighter" adds its
 * color with no alpha, "destination-out" (and clearRect) cuts with no color, so lights and the cuts out of them batch
 * together. Textures come from the canvases render.ts already makes: kept by their source (a WeakMap), packed into 2048 px
 * atlas pages (layers of one array texture; big ones on their own), and uploaded again only when render.ts says a canvas changed (`changed`). Text is
 * drawn once into a canvas per string and style (the tags already are; the homes' names and the bubble's lines become so
 * here). A fill with a shadow (the bubble) is drawn once into a canvas by the 2D context itself, shadow and all.
 *
 * Clips: an upright rectangle is cut on the CPU; any other shape takes a stencil bit (a bit a clip level: one pass a
 * clip, nothing to let it go, and the same shape again is still there). Kept lean for software WebGL too (SwiftShader,
 * the headless tests' renderer, runs every branch of a shader: so one or two texture reads a pixel, not sixteen).
 *
 * Nothing is allocated per frame on the hot path: the streams, the path, the state stack and the scratch vertices are
 * typed arrays and objects that grow and are reused.
 */
import type { TownGlFallback } from "@chessroyale/core";
import type { Ctx, PaintLayer, Painter } from "./paint.ts";

/** Floats a vertex: x, y, u, v, color (rgba8), flags (u32), p0 to p5. */
const VF = 12;
const PAGE = 2048;
/** A picture bigger than this either way gets a texture of its own. */
const BIG = 1024;
const PAD = 2;
/** Atlas pages at most (the array texture grows two at a time up to this; layer 7 is the shader's "a texture of its own"). */
const MAX_PAGES = 6;

// Flags: mode (bits 0-2), texture slot (3-5), smooth (6), composite (7-8), haze (16-23).
const M_SOLID = 0;
const M_TEX = 1;
const M_SOFTLINE = 2;
const M_SOFTIMG = 3;
const C_OVER = 0;
const C_ADD = 1;
const C_CUT = 2;

const VS = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
in vec4 a_col;
in uint a_flags;
in vec4 a_p0;
in vec2 a_p1;
uniform vec2 u_size;
uniform float u_flip;
out vec2 v_uv;
out vec4 v_col;
flat out uint v_flags;
out vec4 v_p0;
out vec2 v_p1;
void main() {
  vec2 c = a_pos / u_size * 2.0 - 1.0;
  gl_Position = vec4(c.x, c.y * u_flip, 0.0, 1.0);
  v_uv = a_uv;
  v_col = a_col;
  v_flags = a_flags;
  v_p0 = a_p0;
  v_p1 = a_p1;
}`;

/**
 * The fragment shader, in three builds that differ only in which modes they can draw (the same code for each mode): solid
 * fills alone, solid and textured, and everything (soft lines and pictures too). A draw uses the least one that covers the
 * modes its triangles use (`Stream.modes`): the same pixels, but a software renderer (SwiftShader, which runs every branch of
 * a shader for every pixel) spends far less on the ground's and the sky's solid fills. A GPU barely notices.
 */
const fsFor = (tex: boolean, soft: boolean) => `#version 300 es
#define TEX ${tex ? 1 : 0}
#define SOFT ${soft ? 1 : 0}
precision highp float;
precision highp int;
// The atlas pages (layers 0 to 6 of one array texture) and one texture of its own (layer 7: a light layer, a big picture).
uniform highp sampler2DArray A;
uniform sampler2D T;
uniform vec2 u_tsize;
in vec2 v_uv;
in vec4 v_col;
flat in uint v_flags;
in vec4 v_p0;
in vec2 v_p1;
out vec4 o;
vec4 smoothAt(uint s, vec2 uv) {
  return s == 7u ? texture(T, uv) : texture(A, vec3(uv, float(s)));
}
// Nearest: the middle of the texel under uv (what NEAREST picks; smooth sampling there reads that texel alone).
vec2 nearUv(uint s, vec2 uv) {
  vec2 n = s == 7u ? u_tsize : vec2(${PAGE}.0);
  return (floor(uv * n) + 0.5) / n;
}
float erf1(float x) {
  float t = 1.0 / (1.0 + 0.3275911 * abs(x));
  float y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x);
  return x >= 0.0 ? y : -y;
}
float phi(float x) { return 0.5 * (1.0 + erf1(x * 0.70710678)); }
// The soft picture's scratch pixel j (whole numbers; the picture drawn into it from (1, 1), v_p1 wide and high): the source
// sampled smooth at its middle, or nothing outside the picture.
vec4 scratch(uint s, vec2 j) {
  vec2 q = j - 0.5;
  if (q.x < 0.0 || q.y < 0.0 || q.x >= v_p1.x || q.y >= v_p1.y) return vec4(0.0);
  return smoothAt(s, v_p0.xy + q * v_p0.zw);
}
void main() {
  uint mode = v_flags & 7u;
  uint slot = (v_flags >> 3u) & 7u; // (the texture: an atlas page's layer, or 7)
  bool smoothed = ((v_flags >> 6u) & 1u) == 1u;
  uint comp = (v_flags >> 7u) & 3u;
  // (Mode 0, solid: the color.)
  vec4 c = v_col;
#if TEX
  if (mode == 1u) {
    c = smoothAt(slot, smoothed ? v_uv : nearUv(slot, v_uv)) * v_col;
  }
#endif
#if SOFT
  if (mode == 2u) {
    // A line blurred: its half width p0.x, the blur's sigma p0.y; v_uv.x the distance across it.
    float d = v_uv.x;
    float a = phi((v_p0.x - d) / v_p0.y) - phi((-v_p0.x - d) / v_p0.y);
    c = v_col * clamp(a, 0.0, 1.0);
  } else if (mode == 3u) {
    // A soft picture: v_uv the scratch's pixels; shrunk (scratch), hazed, stretched back (smooth or nearest).
    vec2 s = v_uv;
    if (smoothed) {
      vec2 b = s - 0.5;
      vec2 j = floor(b);
      vec2 t = b - j;
      vec4 a0 = scratch(slot, j);
      vec4 a1 = scratch(slot, j + vec2(1.0, 0.0));
      vec4 b0 = scratch(slot, j + vec2(0.0, 1.0));
      vec4 b1 = scratch(slot, j + vec2(1.0, 1.0));
      c = mix(mix(a0, a1, t.x), mix(b0, b1, t.x), t.y);
    } else {
      c = scratch(slot, floor(s));
    }
    float h = float((v_flags >> 16u) & 255u) / 255.0;
    c.rgb = c.rgb * (1.0 - h) + v_col.rgb * (h * c.a);
    c *= v_col.a;
  }
#endif
  if (comp == 1u) c.a = 0.0;
  else if (comp == 2u) c = vec4(0.0, 0.0, 0.0, c.a);
  o = c;
}`;

/** One build of the shader (`fsFor`) and where its uniforms are. */
interface Prog {
  p: WebGLProgram;
  uSize: WebGLUniformLocation | null;
  uFlip: WebGLUniformLocation | null;
  uTSize: WebGLUniformLocation | null;
}

/** A GL texture: an atlas page (a layer of the atlas's array texture), a big picture's own, or a light layer's. */
interface Tex {
  t: WebGLTexture | null;
  w: number;
  h: number;
  /** A light layer's: its stream (drawn before the canvas draws the layer). */
  stream: Stream | null;
  /** An atlas page's layer in the array (0 to MAX_PAGES - 1); -1: a texture of its own. */
  layer: number;
}

/** An atlas page: shelves of pictures, each with PAD transparent pixels round it. */
interface Page {
  tex: Tex;
  shelves: { y: number; h: number; x: number }[];
  top: number;
  used: number;
  entries: Entry[];
}

/** A source picture's place in the textures: which, where (texels), uploaded in which generation, and whether it changed. */
interface Entry {
  src: object;
  tex: Tex | null;
  page: Page | null;
  x: number;
  y: number;
  w: number;
  h: number;
  gen: number;
  dirty: boolean;
  used: number;
}

/** A target's recorded triangles: its vertices, how many, whether they read the atlas, and the texture of its own they read (one a draw). */
interface Stream {
  f: Float32Array;
  u: Uint32Array;
  n: number;
  /** The modes its triangles use (bit 1 << mode), for the least shader that draws them (`fsFor`). */
  modes: number;
  atlas: boolean;
  big: Tex | null;
  /** The framebuffer drawn into (null: the canvas), its size, and its y (the canvas is drawn top down, a layer bottom up). */
  fb: WebGLFramebuffer | null;
  w: number;
  h: number;
  flip: number;
}

const newStream = (fb: WebGLFramebuffer | null, flip: number): Stream => {
  const f = new Float32Array(VF * 6 * 2048);
  return { f, u: new Uint32Array(f.buffer), n: 0, modes: 0, atlas: false, big: null, fb, w: 1, h: 1, flip };
};

/** A color parsed into premultiplied-ready parts (0 to 1). */
interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000", transparent: "rgba(0,0,0,0)" };
/** Parses the CSS colors the town writes (#rgb, #rrggbb, rgb(), rgba(), a few names) into `out`. */
function parseColor(s: string, out: RGBA): RGBA {
  s = NAMED[s] ?? s;
  if (s.charCodeAt(0) === 35) {
    const hex = s.length === 4 ? (c: number) => parseInt(s[c]! + s[c]!, 16) : (c: number) => parseInt(s.substr(1 + (c - 1) * 2, 2), 16);
    out.r = hex(1) / 255;
    out.g = hex(2) / 255;
    out.b = hex(3) / 255;
    out.a = s.length === 9 ? parseInt(s.substr(7, 2), 16) / 255 : 1;
    return out;
  }
  // rgb(r, g, b) / rgba(r, g, b, a): read the numbers in place (no split).
  let i = s.indexOf("(") + 1;
  let k = 0;
  const v = [0, 0, 0, 1];
  while (i < s.length && k < 4) {
    while (i < s.length && (s[i] === " " || s[i] === ",")) i++;
    let j = i;
    while (j < s.length && s[j] !== "," && s[j] !== ")" && s[j] !== " ") j++;
    if (j > i) v[k++] = parseFloat(s.slice(i, j));
    i = j + 1;
  }
  out.r = v[0]! / 255;
  out.g = v[1]! / 255;
  out.b = v[2]! / 255;
  out.a = v[3]!;
  return out;
}

/** A linear gradient, as the town makes them (top to bottom; sky-draw.ts). */
class GLGradient {
  readonly at: number[] = [];
  readonly col: RGBA[] = [];
  constructor(
    readonly x0: number,
    readonly y0: number,
    readonly x1: number,
    readonly y1: number,
  ) {}
  addColorStop(at: number, color: string): void {
    let i = this.at.length;
    while (i > 0 && this.at[i - 1]! > at) i--;
    this.at.splice(i, 0, at);
    this.col.splice(i, 0, parseColor(color, { r: 0, g: 0, b: 0, a: 1 }));
  }
}

/** One saved state (save/restore). */
interface State {
  globalAlpha: number;
  globalCompositeOperation: string;
  fillStyle: string | GLGradient;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: string;
  lineCap: string;
  imageSmoothingEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  m: Float64Array;
  clip: Float64Array;
  clipOn: boolean;
  level: number;
}
const newState = (): State => ({
  globalAlpha: 1,
  globalCompositeOperation: "source-over",
  fillStyle: "#000000",
  strokeStyle: "#000000",
  lineWidth: 1,
  lineJoin: "miter",
  lineCap: "butt",
  imageSmoothingEnabled: true,
  shadowColor: "rgba(0,0,0,0)",
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  font: "10px sans-serif",
  textAlign: "start",
  textBaseline: "alphabetic",
  m: new Float64Array([1, 0, 0, 1, 0, 0]),
  clip: new Float64Array(4),
  clipOn: false,
  level: 0,
});

/** A string drawn once (fillText/strokeText): its canvas, where its anchor is in it, and when it was last drawn. */
interface TextArt {
  text: string;
  font: string;
  align: string;
  base: string;
  style: string;
  stroke: number;
  join: string;
  scale: number;
  cv: HTMLCanvasElement;
  ox: number;
  oy: number;
  used: number;
}
const TEXT_MAX = 160;

/** A filled path with a shadow, drawn once by a 2D context (the bubble): its canvas, where it goes, its key. */
interface Baked {
  key: number;
  cv: HTMLCanvasElement;
  ox: number;
  oy: number;
  used: number;
}
const BAKE_MAX = 24;

/**
 * The WebGL 2 painter for the town's canvas, or why there's none (Town.tsx falls back to Canvas 2D, silently, and reports
 * the reason once: problems.ts, `reportTownFallback`): no WebGL 2 in this browser, no context to be had, or the shader
 * failed. `onLost`: the context was lost (nothing is drawn until it's back) or restored.
 */
export function painterGL(cv: HTMLCanvasElement, onLost: (lost: boolean) => void): Painter | TownGlFallback {
  if (typeof WebGL2RenderingContext === "undefined") return "no-webgl2";
  let gl: WebGL2RenderingContext | null = null;
  try {
    // A GPU's context, with 4x multisampling for the edges (the picture as designed). Where the browser would draw it in
    // software instead (no GPU, or one it won't use: SwiftShader, the headless tests' renderer), that one fails, and the
    // context is made without multisampling: the same picture but for the edges, at about half a frame's cost there
    // (SwiftShader clears and resolves four samples a pixel on the CPU). docs/decisions/2026-10-30-town-webgl.md.
    const attrs = { alpha: true, premultipliedAlpha: true, stencil: true, depth: false, preserveDrawingBuffer: false };
    gl = cv.getContext("webgl2", { ...attrs, antialias: true, failIfMajorPerformanceCaveat: true }) ?? cv.getContext("webgl2", { ...attrs, antialias: false });
  } catch {
    gl = null;
  }
  if (!gl) return "no-context";
  const p = new GLPainter(cv, gl, onLost);
  if (p.init()) return p;
  p.dispose(); // (its context goes now: Town.tsx draws on a new canvas)
  return "shader";
}

class GLPainter implements Painter {
  readonly kind = "webgl" as const;
  readonly ctx: Ctx;
  /** The canvas's stand-in (`ctx`, typed as itself). */
  readonly g: GLCtx;
  drawCalls = 0;
  lost = false;
  private calls = 0;
  /** (Tests and the frame-rate check) Pictures uploaded in the last frame, and atlas pages started again so far. */
  uploads = 0;
  resets = 0;
  private ups = 0;
  frameNo = 0;
  gen = 1;
  /** The shader's three builds (`fsFor`): solid fills; solid and textured; everything. */
  private progs: Prog[] = [];
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;
  private vboSize = 0;
  private sLinear: WebGLSampler | null = null;
  /** The atlas: one array texture, `cap` pages deep; and a blank texture for "none of its own". */
  private atlas: WebGLTexture | null = null;
  private cap = 0;
  private dummy: WebGLTexture | null = null;
  private readFb: WebGLFramebuffer | null = null;
  readonly main: Stream = newStream(null, -1);
  private readonly reg = new WeakMap<object, Entry>();
  private readonly live: Entry[] = [];
  private pages: Page[] = [];
  /** The light layers' textures, by the stand-in each one's `src` is. */
  private readonly layers = new Map<object, { tex: Tex; fb: WebGLFramebuffer | null; stream: Stream; g: GLCtx }>();
  /** The same, as a list (walked every frame: no iterator made). */
  private readonly layerList: { tex: Tex; fb: WebGLFramebuffer | null; stream: Stream; g: GLCtx }[] = [];
  private disposed = false;
  private readonly onLostEv = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.onLost(true);
  };
  private readonly onRestoredEv = () => {
    this.lost = false;
    this.gen++;
    this.pages = [];
    this.init();
    // (The layers' textures and framebuffers, made again at their sizes, clear.)
    for (const l of this.layerList) {
      l.tex.t = null;
      l.fb = null;
      this.layerTex(l);
    }
    this.onLost(false);
  };

  constructor(
    readonly cv: HTMLCanvasElement,
    readonly gl: WebGL2RenderingContext,
    private readonly onLost: (lost: boolean) => void,
  ) {
    this.g = new GLCtx(this, this.main, cv);
    this.ctx = this.g as unknown as Ctx;
    cv.addEventListener("webglcontextlost", this.onLostEv);
    cv.addEventListener("webglcontextrestored", this.onRestoredEv);
  }

  /** Makes (or, after a loss, makes again) the program, the buffer and the samplers. */
  init(): boolean {
    const { gl } = this;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) console.warn("town gl:", gl.getShaderInfoLog(s));
      return s;
    };
    // (All three made now, as the town opens: never a compile on the frame loop.)
    const vs = sh(gl.VERTEX_SHADER, VS);
    this.progs = [];
    for (const [tex, soft] of [[false, false], [true, false], [true, true]] as const) {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsFor(tex, soft)));
      for (const [i, n] of ["a_pos", "a_uv", "a_col", "a_flags", "a_p0", "a_p1"].entries()) gl.bindAttribLocation(prog, i, n);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        if (!gl.isContextLost()) console.warn("town gl:", gl.getProgramInfoLog(prog));
        return false;
      }
      gl.useProgram(prog);
      gl.uniform1i(gl.getUniformLocation(prog, "A"), 0);
      gl.uniform1i(gl.getUniformLocation(prog, "T"), 1);
      this.progs.push({ p: prog, uSize: gl.getUniformLocation(prog, "u_size"), uFlip: gl.getUniformLocation(prog, "u_flip"), uTSize: gl.getUniformLocation(prog, "u_tsize") });
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    this.vboSize = 0;
    const B = VF * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, B, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, B, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, B, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribIPointer(3, 1, gl.UNSIGNED_INT, B, 20);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, B, 24);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 2, gl.FLOAT, false, B, 40);
    const sampler = (f: number) => {
      const s = gl.createSampler()!;
      gl.samplerParameteri(s, gl.TEXTURE_MIN_FILTER, f);
      gl.samplerParameteri(s, gl.TEXTURE_MAG_FILTER, f);
      gl.samplerParameteri(s, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.samplerParameteri(s, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return s;
    };
    this.sLinear = sampler(gl.LINEAR);
    gl.bindSampler(0, this.sLinear);
    gl.bindSampler(1, this.sLinear);
    this.atlas = null;
    this.cap = 0;
    this.dummy = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dummy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    return true;
  }

  frame(): void {
    if (this.lost) return;
    const { gl, cv, main } = this;
    this.frameNo++;
    this.calls = 0;
    this.ups = 0;
    main.w = cv.width;
    main.h = cv.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.colorMask(true, true, true, true);
    gl.disable(gl.STENCIL_TEST);
    gl.stencilMask(0xff);
    gl.clearColor(0, 0, 0, 0);
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    this.g.level = 0;
    this.chains.fill(0);
    this.stale.fill(0);
  }

  done(): void {
    if (this.lost) return;
    for (let i = 0; i < this.layerList.length; i++) this.flush(this.layerList[i]!.stream);
    this.flush(this.main);
    this.drawCalls = this.calls;
    this.uploads = this.ups;
    if (this.frameNo % 300 === 0) this.sweep();
  }

  layer(): PaintLayer {
    const src = document.createElement("canvas"); // (only its identity: the layer's texture is found by it)
    src.width = src.height = 1;
    const tex: Tex = { t: null, w: 0, h: 0, stream: null, layer: -1 };
    const stream = newStream(null, 1);
    tex.stream = stream;
    const g = new GLCtx(this, stream, { width: 0, height: 0 } as HTMLCanvasElement);
    const l = { tex, fb: null as WebGLFramebuffer | null, stream, g };
    this.layers.set(src, l);
    this.layerList.push(l);
    const self = this;
    return {
      g: g as unknown as Ctx,
      src,
      get width() {
        return tex.w;
      },
      get height() {
        return tex.h;
      },
      size(w: number, h: number) {
        tex.w = w;
        tex.h = h;
        stream.w = w;
        stream.h = h;
        self.layerTex(l);
      },
    };
  }

  /** A layer's texture and framebuffer (made, or made again at its size; a new one is clear). */
  private layerTex(l: { tex: Tex; fb: WebGLFramebuffer | null; stream: Stream }): void {
    const { gl } = this;
    if (this.lost) return;
    this.flush(l.stream);
    if (!l.tex.t) l.tex.t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, l.tex.t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, Math.max(1, l.tex.w), Math.max(1, l.tex.h), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    if (!l.fb) l.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, l.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, l.tex.t, 0);
    l.stream.fb = l.fb;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  changed(src: CanvasImageSource): void {
    const e = this.reg.get(src);
    if (e) e.dirty = true;
  }

  /** The texture (and the place in it) for `src`, uploaded if it's new, changed or lost; null for an empty picture. */
  entry(src: CanvasImageSource): Entry | Tex | null {
    const l = this.layers.get(src);
    if (l) {
      if (!l.tex.t) this.layerTex(l);
      return l.tex;
    }
    let e = this.reg.get(src);
    if (!e) {
      e = { src, tex: null, page: null, x: 0, y: 0, w: 0, h: 0, gen: 0, dirty: true, used: 0 };
      this.reg.set(src, e);
      this.live.push(e);
    }
    e.used = this.frameNo;
    if (e.dirty || e.gen !== this.gen || !e.tex) this.upload(e, src);
    if (e.page) e.page.used = this.frameNo;
    return e.tex ? e : null;
  }

  private upload(e: Entry, src: CanvasImageSource): void {
    const { gl } = this;
    const s = src as HTMLCanvasElement;
    const w = s.width;
    const h = s.height;
    e.dirty = false;
    if (!w || !h) {
      e.tex = null;
      return;
    }
    // Pending draws that read its old pixels go first.
    if (e.tex && e.gen === this.gen) this.flushUsing(e.tex);
    if (!(e.tex && e.gen === this.gen && e.w === w && e.h === h)) this.place(e, w, h);
    e.gen = this.gen;
    this.ups++;
    const t = e.tex!;
    if (t.layer >= 0) {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, t.t);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, e.x, e.y, t.layer, w, h, 1, gl.RGBA, gl.UNSIGNED_BYTE, s);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, t.t);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, e.x, e.y, gl.RGBA, gl.UNSIGNED_BYTE, s);
    }
  }

  /** A place for a w x h picture: an atlas page's shelf, or its own texture. */
  private place(e: Entry, w: number, h: number): void {
    const { gl } = this;
    e.w = w;
    e.h = h;
    if (w > BIG || h > BIG) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      if (e.tex && !e.page && e.tex.t) gl.deleteTexture(e.tex.t);
      e.tex = { t, w, h, stream: null, layer: -1 };
      e.page = null;
      e.x = e.y = 0;
      return;
    }
    if (e.tex && !e.page && e.tex.t) gl.deleteTexture(e.tex.t);
    const W = w + 2 * PAD;
    const H = h + 2 * PAD;
    for (const pg of this.pages) if (this.shelf(pg, e, W, H)) return;
    let pg: Page;
    if (this.pages.length < MAX_PAGES) {
      const layer = this.pages.length;
      this.grow(layer + 1);
      pg = { tex: { t: this.atlas, w: PAGE, h: PAGE, stream: null, layer }, shelves: [], top: 0, used: 0, entries: [] };
      this.pages.push(pg);
    } else {
      // Full: the page least lately drawn from starts again, empty (its pictures are uploaded again as they show).
      pg = this.pages.reduce((a, b) => (a.used <= b.used ? a : b));
      this.resets++;
      this.flushUsing(pg.tex);
      for (const o of pg.entries) if (o.page === pg) ((o.tex = null), (o.page = null));
      pg.entries.length = 0;
      pg.shelves.length = 0;
      pg.top = 0;
      // (Cleared through a framebuffer on its layer.)
      gl.bindFramebuffer(gl.FRAMEBUFFER, (this.readFb ??= gl.createFramebuffer()));
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.atlas, 0, pg.tex.layer);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    this.shelf(pg, e, W, H);
  }

  /**
   * The atlas's array texture at least `n` pages deep: made, or made again deeper (two pages more at a time, up to
   * MAX_PAGES), the pages it held copied over on the GPU.
   */
  private grow(n: number): void {
    const { gl } = this;
    if (this.cap >= n && this.atlas) return;
    const cap = Math.min(MAX_PAGES, Math.max(n, this.cap + 2));
    const old = this.atlas;
    if (old) for (let i = 0; i < this.pages.length; i++) this.flushUsing(this.pages[i]!.tex);
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, PAGE, PAGE, cap);
    if (old) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, (this.readFb ??= gl.createFramebuffer()));
      for (let i = 0; i < this.cap; i++) {
        gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, old, 0, i);
        gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, 0, 0, PAGE, PAGE);
      }
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.deleteTexture(old);
    }
    this.atlas = t;
    this.cap = cap;
    for (const pg of this.pages) pg.tex.t = t;
  }

  private shelf(pg: Page, e: Entry, W: number, H: number): boolean {
    let s = pg.shelves.find((sh) => sh.h >= H && sh.h <= H * 1.5 + 8 && PAGE - sh.x >= W);
    if (!s) {
      if (pg.top + H > PAGE) return false;
      s = { y: pg.top, h: H, x: 0 };
      pg.shelves.push(s);
      pg.top += H;
    }
    e.tex = pg.tex;
    e.page = pg;
    e.x = s.x + PAD;
    e.y = s.y + PAD;
    s.x += W;
    pg.entries.push(e);
    pg.used = this.frameNo;
    return true;
  }

  /** Lets go of pictures not drawn for a while (a big one's own texture is freed; a page's place comes back when the page starts again). */
  private sweep(): void {
    const { gl, live } = this;
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i]!;
      if (this.frameNo - e.used < 600) continue;
      if (e.tex && !e.page && e.tex.t) gl.deleteTexture(e.tex.t);
      e.tex = null;
      e.page = null;
      this.reg.delete(e.src);
      live[i] = live[live.length - 1]!;
      live.pop();
    }
  }

  /** Where the shader finds `tex` in `st`'s next draw: an atlas page's layer, or 7 (one texture of its own a draw: another one draws what `st` holds first). */
  slot(st: Stream, tex: Tex): number {
    if (tex.layer >= 0) {
      st.atlas = true;
      return tex.layer;
    }
    if (st.big === tex) return 7;
    if (tex.stream && tex.stream.n > 0) this.flush(tex.stream); // (a layer: its own draws go first)
    if (st.big) this.flush(st);
    st.big = tex;
    return 7;
  }

  /** Room for `n` more vertices in `st`. */
  room(st: Stream, n: number): void {
    // (A layer about to be drawn on while the canvas still holds a draw of it: the canvas's draws go first.)
    if (st !== this.main && st.n === 0 && this.main.big?.stream === st) this.flush(this.main);
    if ((st.n + n) * VF <= st.f.length) return;
    if (n * VF * 2 > st.f.length || st.n * VF > st.f.length / 2) {
      const f = new Float32Array(Math.max(st.f.length * 2, (st.n + n) * VF * 2));
      f.set(st.f.subarray(0, st.n * VF));
      st.f = f;
      st.u = new Uint32Array(f.buffer);
    } else this.flush(st);
  }

  /** Draws what's pending that reads `tex` (before its pixels change). */
  private flushUsing(tex: Tex): void {
    this.flushIfUses(this.main, tex);
    for (let i = 0; i < this.layerList.length; i++) this.flushIfUses(this.layerList[i]!.stream, tex);
  }
  private flushIfUses(st: Stream, tex: Tex): void {
    if (tex.layer >= 0 ? st.atlas : st.big === tex) this.flush(st);
  }

  /** Draws a stream's triangles in one call. */
  flush(st: Stream): void {
    if (st.n === 0 || this.lost) {
      st.n = 0;
      st.modes = 0;
      st.atlas = false;
      st.big = null;
      return;
    }
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, st.fb);
    gl.viewport(0, 0, st.w, st.h);
    // The least build of the shader that draws every mode the stream holds (the same pixels: `fsFor`).
    const pg = this.progs[st.modes & (1 << M_SOFTLINE | 1 << M_SOFTIMG) ? 2 : st.modes & (1 << M_TEX) ? 1 : 0]!;
    gl.useProgram(pg.p);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(pg.uSize, st.w, st.h);
    gl.uniform1f(pg.uFlip, st.flip);
    // The atlas on unit 0, the draw's texture of its own (or a blank one: a layer's left bound while that layer is drawn
    // into would be a feedback loop) on unit 1.
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, st.big?.t ?? this.dummy);
    if (st.big) gl.uniform2f(pg.uTSize, st.big.w, st.big.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
    const bytes = st.n * VF * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (bytes > this.vboSize) {
      this.vboSize = Math.max(bytes, this.vboSize * 2, 1 << 20);
      gl.bufferData(gl.ARRAY_BUFFER, this.vboSize, gl.STREAM_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, st.f, 0, st.n * VF);
    // (The canvas's draws keep to its stencil's clip; a layer has none.)
    if (st === this.main && this.g.level > 0) {
      gl.enable(gl.STENCIL_TEST);
      const m = (1 << this.g.level) - 1;
      gl.stencilMask(0xff);
      gl.stencilFunc(gl.EQUAL, m, m);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    } else gl.disable(gl.STENCIL_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, st.n);
    this.calls++;
    st.n = 0;
    st.modes = 0;
    st.atlas = false;
    st.big = null;
  }

  /**
   * The canvas's clips in the stencil, a bit a level (level k: bit k - 1; inside at level L: the low L bits all set). A clip
   * one level deeper, `level`, whose shape is the canvas's stream's triangles from `from` on (`hash`: its shape, box x0 to
   * y1): its bit is flipped by the shape inside the clip above it (even-odd), one pass. A level let go costs nothing (draws
   * test only the bits of their own level); its bit is cleared, in its box, only when another shape takes that level. The
   * same shape again on the same clips (the ground's, for the haze) is still there: nothing drawn. The pending draws go
   * first, at their clip.
   */
  stencil(from: number, level: number, hash: number, x0: number, y0: number, x1: number, y1: number): void {
    const { gl, main } = this;
    const n = main.n;
    const k = n - from;
    main.n = from;
    const chain = (level > 1 ? Math.imul(this.chains[level - 1]! ^ hash, 16777619) >>> 0 : hash) || 1;
    // (The draws pending, at the clip they were drawn in.)
    this.flush(main);
    if ((this.chains[level] === chain && !this.stale[level]) || this.lost) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, main.w, main.h);
    // (The solid build: only the stencil is written, the colors masked.)
    const pg = this.progs[0]!;
    gl.useProgram(pg.p);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(pg.uSize, main.w, main.h);
    gl.uniform1f(pg.uFlip, main.flip);
    gl.colorMask(false, false, false, false);
    gl.enable(gl.STENCIL_TEST);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const need = (k + 6) * VF * 4;
    if (need > this.vboSize) {
      this.vboSize = Math.max(need, this.vboSize * 2, 1 << 20);
      gl.bufferData(gl.ARRAY_BUFFER, this.vboSize, gl.STREAM_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, main.f, from * VF, k * VF);
    const bit = 1 << (level - 1);
    const B = this.clipBoxes;
    const o = level * 4;
    if (this.chains[level] !== 0) {
      // Another shape had this level: its bit cleared in its box.
      const f = this.full;
      f[0] = f[6] = f[10] = B[o]!;
      f[1] = f[3] = f[7] = B[o + 1]!;
      f[2] = f[4] = f[8] = B[o + 2]!;
      f[5] = f[9] = f[11] = B[o + 3]!;
      for (let i = 0; i < 6; i++) {
        this.fullV[i * VF] = f[i * 2]!;
        this.fullV[i * VF + 1] = f[i * 2 + 1]!;
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, k * VF * 4, this.fullV);
      gl.stencilMask(bit);
      gl.stencilFunc(gl.ALWAYS, 0, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
      gl.drawArrays(gl.TRIANGLES, k, 6);
      this.calls++;
    }
    // (Deeper levels were cut inside the old shape: they're stale now.)
    for (let l = level + 1; l < this.chains.length; l++) if (this.chains[l]) this.stale[l] = 1;
    gl.stencilMask(bit);
    gl.stencilFunc(gl.EQUAL, bit - 1, bit - 1);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
    gl.drawArrays(gl.TRIANGLES, 0, k);
    this.calls++;
    this.chains[level] = chain;
    this.stale[level] = 0;
    B[o] = Math.max(0, Math.floor(x0) - 1);
    B[o + 1] = Math.max(0, Math.floor(y0) - 1);
    B[o + 2] = Math.min(main.w, Math.ceil(x1) + 1);
    B[o + 3] = Math.min(main.h, Math.ceil(y1) + 1);
    gl.stencilMask(0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.colorMask(true, true, true, true);
    gl.disable(gl.STENCIL_TEST);
  }
  /** What each level's bit holds (its shapes' hash, down from the top; 0: nothing), and the levels whose shape was cut under another. */
  private readonly chains = new Uint32Array(8);
  private readonly stale = new Uint8Array(8);
  private readonly full = new Float32Array(12);
  /** Each clip level's box (device pixels: x0, y0, x1, y1). */
  private readonly clipBoxes = new Float32Array(4 * 8);
  private readonly fullV = new Float32Array(6 * VF);

  soft = (img: CanvasImageSource, x: number, y: number, w: number, h: number, k: number, haze: number, horizon: string): void => this.g.softImage(img, x, y, w, h, k, haze, horizon);

  pixels(x: number, y: number, w: number, h: number): ImageData {
    const { gl, cv } = this;
    const out = new ImageData(Math.max(1, w), Math.max(1, h));
    if (this.lost) return out;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(x, cv.height - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const d = out.data;
    for (let row = 0; row < h; row++) {
      const s = (h - 1 - row) * w * 4;
      for (let i = 0; i < w * 4; i += 4) {
        const a = buf[s + i + 3]!;
        const o = row * w * 4 + i;
        d[o + 3] = a;
        for (let c = 0; c < 3; c++) d[o + c] = a === 0 ? 0 : a === 255 ? buf[s + i + c]! : Math.min(255, Math.round((buf[s + i + c]! * 255) / a));
      }
    }
    return out;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cv.removeEventListener("webglcontextlost", this.onLostEv);
    this.cv.removeEventListener("webglcontextrestored", this.onRestoredEv);
    // (Its canvas is gone from the page: its GPU memory goes now, not when the page's garbage is collected.)
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/** Scratch: a polygon's vertices (x, y, u, v, r, g, b, a, p0 to p5), before it's clipped and fanned into a stream. */
const RF = 14;

/**
 * The stand-in for a 2D context (one per target: the canvas, each light layer). Its state fields are plain properties,
 * read when something is drawn, as a 2D context's are.
 */
class GLCtx {
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = "source-over";
  fillStyle: string | CanvasGradient | CanvasPattern = "#000000";
  strokeStyle: string | CanvasGradient | CanvasPattern = "#000000";
  lineWidth = 1;
  lineJoin: CanvasLineJoin = "miter";
  lineCap: CanvasLineCap = "butt";
  imageSmoothingEnabled = true;
  shadowColor = "rgba(0,0,0,0)";
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  font = "10px sans-serif";
  textAlign: CanvasTextAlign = "start";
  textBaseline: CanvasTextBaseline = "alphabetic";
  filter = "none";
  /** The transform (a, b, c, d, e, f), the clip's rectangle (device pixels) when there is one, the stencil's level (the canvas's). */
  private readonly m = new Float64Array([1, 0, 0, 1, 0, 0]);
  private readonly clipR = new Float64Array(4);
  private clipOn = false;
  level = 0;
  private readonly stack: State[] = [];
  private depth = 0;
  // The path, in device pixels: points, where each subpath starts, and whether it's closed.
  private px = new Float32Array(2048);
  private np = 0;
  private sub = new Int32Array(256);
  private closed = new Uint8Array(256);
  private nSub = 0;
  private open = false;
  private readonly col: RGBA = { r: 0, g: 0, b: 0, a: 1 };
  private readonly col2: RGBA = { r: 0, g: 0, b: 0, a: 1 };
  private readonly col3: RGBA = { r: 0, g: 0, b: 0, a: 1 };
  private colStr = "";
  private readonly colorCache = new Map<string, RGBA>();
  // Scratch polygons (and their clipped copies).
  private poly = new Float32Array(RF * 64);
  private polyB = new Float32Array(RF * 64);
  private readonly texts = new Map<string, TextArt[]>();
  private nTexts = 0;
  private textGen = 0;
  private static fontsGen = 0;
  private readonly baked: Baked[] = [];
  private measure: CanvasRenderingContext2D | null = null;

  constructor(
    private readonly P: GLPainter,
    private readonly st: Stream,
    readonly canvas: HTMLCanvasElement,
  ) {
    if (!GLCtx.listening && typeof document !== "undefined") {
      GLCtx.listening = true;
      document.fonts?.addEventListener?.("loadingdone", () => GLCtx.fontsGen++);
    }
  }
  private static listening = false;

  // ---- State.

  save(): void {
    let s = this.stack[this.depth];
    if (!s) this.stack.push((s = newState()));
    this.depth++;
    s.globalAlpha = this.globalAlpha;
    s.globalCompositeOperation = this.globalCompositeOperation;
    s.fillStyle = this.fillStyle as string;
    s.strokeStyle = this.strokeStyle as string;
    s.lineWidth = this.lineWidth;
    s.lineJoin = this.lineJoin;
    s.lineCap = this.lineCap;
    s.imageSmoothingEnabled = this.imageSmoothingEnabled;
    s.shadowColor = this.shadowColor;
    s.shadowBlur = this.shadowBlur;
    s.shadowOffsetX = this.shadowOffsetX;
    s.shadowOffsetY = this.shadowOffsetY;
    s.font = this.font;
    s.textAlign = this.textAlign;
    s.textBaseline = this.textBaseline;
    s.m.set(this.m);
    s.clip.set(this.clipR);
    s.clipOn = this.clipOn;
    s.level = this.level;
  }

  restore(): void {
    if (this.depth === 0) return;
    const s = this.stack[--this.depth]!;
    this.globalAlpha = s.globalAlpha;
    this.globalCompositeOperation = s.globalCompositeOperation as GlobalCompositeOperation;
    this.fillStyle = s.fillStyle as string;
    this.strokeStyle = s.strokeStyle;
    this.lineWidth = s.lineWidth;
    this.lineJoin = s.lineJoin as CanvasLineJoin;
    this.lineCap = s.lineCap as CanvasLineCap;
    this.imageSmoothingEnabled = s.imageSmoothingEnabled;
    this.shadowColor = s.shadowColor;
    this.shadowBlur = s.shadowBlur;
    this.shadowOffsetX = s.shadowOffsetX;
    this.shadowOffsetY = s.shadowOffsetY;
    this.font = s.font;
    this.textAlign = s.textAlign as CanvasTextAlign;
    this.textBaseline = s.textBaseline as CanvasTextBaseline;
    this.m.set(s.m);
    this.clipR.set(s.clip);
    this.clipOn = s.clipOn;
    if (s.level < this.level) {
      // (What was drawn inside the clip goes first; letting the clip go costs nothing more.)
      if (this.st.n) this.P.flush(this.st);
      this.level = s.level;
    }
  }

  setTransform(a: number | DOMMatrix2DInit = 1, b = 0, c = 0, d = 1, e = 0, f = 0): void {
    const m = this.m;
    m[0] = a as number;
    m[1] = b;
    m[2] = c;
    m[3] = d;
    m[4] = e;
    m[5] = f;
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    const m = this.m;
    const A = m[0]!;
    const B = m[1]!;
    const C = m[2]!;
    const D = m[3]!;
    const E = m[4]!;
    const F = m[5]!;
    m[0] = A * a + C * b;
    m[1] = B * a + D * b;
    m[2] = A * c + C * d;
    m[3] = B * c + D * d;
    m[4] = A * e + C * f + E;
    m[5] = B * e + D * f + F;
  }

  translate(x: number, y: number): void {
    const m = this.m;
    m[4] = m[0]! * x + m[2]! * y + m[4]!;
    m[5] = m[1]! * x + m[3]! * y + m[5]!;
  }

  scale(x: number, y: number): void {
    const m = this.m;
    m[0] = m[0]! * x;
    m[1] = m[1]! * x;
    m[2] = m[2]! * y;
    m[3] = m[3]! * y;
  }

  rotate(a: number): void {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const m = this.m;
    const A = m[0]!;
    const B = m[1]!;
    m[0] = A * c + m[2]! * s;
    m[1] = B * c + m[3]! * s;
    m[2] = m[2]! * c - A * s;
    m[3] = m[3]! * c - B * s;
  }

  /** How many device pixels a unit is (for line widths and text). */
  private unit(): number {
    const m = this.m;
    return Math.sqrt(Math.abs(m[0]! * m[3]! - m[1]! * m[2]!));
  }

  // ---- Paths (kept in device pixels, as a 2D context transforms each point as it's added).

  beginPath(): void {
    this.np = 0;
    this.nSub = 0;
    this.open = false;
  }

  private add(x: number, y: number): void {
    if (this.np * 2 + 2 > this.px.length) {
      const n = new Float32Array(this.px.length * 2);
      n.set(this.px);
      this.px = n;
    }
    const m = this.m;
    this.px[this.np * 2] = m[0]! * x + m[2]! * y + m[4]!;
    this.px[this.np * 2 + 1] = m[1]! * x + m[3]! * y + m[5]!;
    this.np++;
  }

  private startSub(): void {
    if (this.nSub === this.sub.length) {
      const s = new Int32Array(this.sub.length * 2);
      s.set(this.sub);
      this.sub = s;
      const c = new Uint8Array(this.closed.length * 2);
      c.set(this.closed);
      this.closed = c;
    }
    this.sub[this.nSub] = this.np;
    this.closed[this.nSub] = 0;
    this.nSub++;
    this.open = true;
  }

  moveTo(x: number, y: number): void {
    this.startSub();
    this.add(x, y);
  }

  lineTo(x: number, y: number): void {
    if (!this.open) {
      // (After closePath, a line starts a new subpath at the last one's start.)
      if (this.nSub > 0) {
        const s = this.sub[this.nSub - 1]!;
        const sx = this.px[s * 2]!;
        const sy = this.px[s * 2 + 1]!;
        this.startSub();
        this.addDevice(sx, sy);
      } else return this.moveTo(x, y);
    }
    this.add(x, y);
  }

  private addDevice(x: number, y: number): void {
    if (this.np * 2 + 2 > this.px.length) {
      const n = new Float32Array(this.px.length * 2);
      n.set(this.px);
      this.px = n;
    }
    this.px[this.np * 2] = x;
    this.px[this.np * 2 + 1] = y;
    this.np++;
  }

  closePath(): void {
    if (this.nSub > 0 && this.open) {
      this.closed[this.nSub - 1] = 1;
      this.open = false;
    }
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.moveTo(x, y);
    this.add(x + w, y);
    this.add(x + w, y + h);
    this.add(x, y + h);
    this.closePath();
  }

  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    if (!this.open || this.np === 0) return this.moveTo(x, y);
    // From the last point (back in the current transform's space: the town's paths keep one transform throughout).
    const m = this.m;
    const det = m[0]! * m[3]! - m[1]! * m[2]!;
    const lx = this.px[(this.np - 1) * 2]! - m[4]!;
    const ly = this.px[(this.np - 1) * 2 + 1]! - m[5]!;
    const x0 = (m[3]! * lx - m[2]! * ly) / det;
    const y0 = (-m[1]! * lx + m[0]! * ly) / det;
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      this.add(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y);
    }
  }

  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): void {
    this.ellipse(x, y, r, r, 0, a0, a1, ccw);
  }

  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false): void {
    let sweep = a1 - a0;
    if (!ccw && sweep < 0) sweep = (sweep % (2 * Math.PI)) + 2 * Math.PI;
    if (ccw && sweep > 0) sweep = (sweep % (2 * Math.PI)) - 2 * Math.PI;
    if (Math.abs(a1 - a0) >= 2 * Math.PI) sweep = ccw ? -2 * Math.PI : 2 * Math.PI;
    const r = Math.max(rx, ry) * this.unit();
    const step = r > 0.2 ? Math.acos(Math.max(-1, 1 - 0.2 / r)) * 2 : Math.PI / 4;
    const n = Math.max(8, Math.min(160, Math.ceil(Math.abs(sweep) / step)));
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      const ex = rx * Math.cos(a);
      const ey = ry * Math.sin(a);
      const X = x + ex * cr - ey * sr;
      const Y = y + ex * sr + ey * cr;
      if (i === 0 && !this.open) this.moveTo(X, Y);
      else this.add(X, Y);
    }
  }

  // ---- Colors.

  private color(s: string, out: RGBA): RGBA {
    let c = this.colorCache.get(s);
    if (!c) {
      c = parseColor(s, { r: 0, g: 0, b: 0, a: 1 });
      // (Colors made fresh each frame, such as a pulse's alpha, aren't kept: the cache stays small.)
      if (this.colorCache.size > 600) this.colorCache.clear();
      this.colorCache.set(s, c);
    }
    out.r = c.r;
    out.g = c.g;
    out.b = c.b;
    out.a = c.a;
    return out;
  }

  /** The composite as the shader's: over, add ("lighter"), cut ("destination-out"). */
  private comp(): number {
    const g = this.globalCompositeOperation;
    return g === "lighter" ? C_ADD : g === "destination-out" ? C_CUT : C_OVER;
  }

  // ---- Emitting: a polygon (RF floats a vertex in `poly`), clipped to the clip's rectangle, fanned into the stream.

  private polyRoom(n: number): void {
    if ((n + 8) * RF > this.poly.length) {
      this.poly = new Float32Array((n + 8) * RF * 2);
      this.polyB = new Float32Array((n + 8) * RF * 2);
    }
  }

  private emitPoly(n: number, flags: number): void {
    if (this.clipOn && !this.insideClip(n)) {
      n = this.clipPoly(n);
      if (n < 3) return;
    }
    const st = this.st;
    this.P.room(st, (n - 2) * 3);
    // Each vertex's color packed once (most polygons are one color: packed once for all).
    const src = this.poly;
    if (this.packed.length < n) this.packed = new Uint32Array(n * 2);
    const pk = this.packed;
    pk[0] = this.pack(0);
    for (let k = 1; k < n; k++) {
      const s = k * RF;
      pk[k] = src[s + 4] === src[4] && src[s + 5] === src[5] && src[s + 6] === src[6] && src[s + 7] === src[7] ? pk[0]! : this.pack(k);
    }
    let o = st.n * VF;
    for (let t = 1; t < n - 1; t++) {
      this.put(o, 0, flags, pk[0]!);
      this.put(o + VF, t, flags, pk[t]!);
      this.put(o + 2 * VF, t + 1, flags, pk[t + 1]!);
      o += 3 * VF;
    }
    st.n += (n - 2) * 3;
    st.modes |= 1 << (flags & 7);
  }
  private packed = new Uint32Array(64);

  /** Whether the polygon lies wholly inside the clip's rectangle (nothing to cut). */
  private insideClip(n: number): boolean {
    const P = this.poly;
    const c = this.clipR;
    for (let k = 0; k < n; k++) {
      const x = P[k * RF]!;
      const y = P[k * RF + 1]!;
      if (x < c[0]! || x > c[2]! || y < c[1]! || y > c[3]!) return false;
    }
    return true;
  }

  /** Vertex `k`'s color (premultiplied, 0 to 1) as four bytes. */
  private pack(k: number): number {
    const src = this.poly;
    const s = k * RF + 4;
    const r = Math.round(Math.min(1, Math.max(0, src[s]!)) * 255);
    const g = Math.round(Math.min(1, Math.max(0, src[s + 1]!)) * 255);
    const b = Math.round(Math.min(1, Math.max(0, src[s + 2]!)) * 255);
    const a = Math.round(Math.min(1, Math.max(0, src[s + 3]!)) * 255);
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  /** Vertex `k` of `poly` into the stream at float `o`, with its packed color. */
  private put(o: number, k: number, flags: number, color: number): void {
    const { f, u } = this.st;
    const src = this.poly;
    const s = k * RF;
    f[o] = src[s]!;
    f[o + 1] = src[s + 1]!;
    f[o + 2] = src[s + 2]!;
    f[o + 3] = src[s + 3]!;
    u[o + 4] = color;
    u[o + 5] = flags;
    f[o + 6] = src[s + 8]!;
    f[o + 7] = src[s + 9]!;
    f[o + 8] = src[s + 10]!;
    f[o + 9] = src[s + 11]!;
    f[o + 10] = src[s + 12]!;
    f[o + 11] = src[s + 13]!;
  }

  /** Clips `poly` (n vertices) to the clip's rectangle, every attribute along (Sutherland–Hodgman); the result back in `poly`. */
  private clipPoly(n: number): number {
    const c = this.clipR;
    for (let edge = 0; edge < 4; edge++) {
      const a = this.poly;
      const b = this.polyB;
      const lim = c[edge]!;
      const axis = edge & 1; // (x0, y0, x1, y1: 0 and 2 on x, 1 and 3 on y)
      const sign = edge < 2 ? 1 : -1;
      let m = 0;
      for (let i = 0; i < n; i++) {
        const j = i + 1 === n ? 0 : i + 1;
        const di = (a[i * RF + axis]! - lim) * sign;
        const dj = (a[j * RF + axis]! - lim) * sign;
        if (di >= 0) {
          for (let k = 0; k < RF; k++) b[m * RF + k] = a[i * RF + k]!;
          m++;
        }
        if (di >= 0 !== dj >= 0) {
          const t = di / (di - dj);
          for (let k = 0; k < RF; k++) b[m * RF + k] = a[i * RF + k]! + (a[j * RF + k]! - a[i * RF + k]!) * t;
          m++;
        }
      }
      this.poly = b;
      this.polyB = a;
      n = m;
      if (n < 3) return n;
    }
    return n;
  }

  /** Sets vertex i of `poly`: position, uv, color, params. */
  private v(i: number, x: number, y: number, u: number, w: number, c: RGBA, a: number, p0 = 0, p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0): void {
    const o = i * RF;
    const P = this.poly;
    P[o] = x;
    P[o + 1] = y;
    P[o + 2] = u;
    P[o + 3] = w;
    // Premultiplied, times `a`.
    P[o + 4] = c.r * c.a * a;
    P[o + 5] = c.g * c.a * a;
    P[o + 6] = c.b * c.a * a;
    P[o + 7] = c.a * a;
    P[o + 8] = p0;
    P[o + 9] = p1;
    P[o + 10] = p2;
    P[o + 11] = p3;
    P[o + 12] = p4;
    P[o + 13] = p5;
  }

  // ---- Fills.

  fillRect(x: number, y: number, w: number, h: number): void {
    const fs = this.fillStyle;
    if (fs instanceof GLGradient) return this.gradientRect(fs, x, y, w, h);
    const c = this.color(fs as string, this.col);
    this.quadSolid(x, y, w, h, c, this.globalAlpha, M_SOLID | (this.comp() << 7));
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    // (Cuts everything there: a 2D context's clearRect ignores alpha and the composite.)
    this.col2.r = this.col2.g = this.col2.b = 0;
    this.col2.a = 1;
    this.quadSolid(x, y, w, h, this.col2, 1, M_SOLID | (C_CUT << 7));
  }

  private quadSolid(x: number, y: number, w: number, h: number, c: RGBA, a: number, flags: number): void {
    if (a * c.a <= 0) return;
    const m = this.m;
    this.polyRoom(4);
    for (let i = 0; i < 4; i++) {
      const X = i === 1 || i === 2 ? x + w : x;
      const Y = i >= 2 ? y + h : y;
      this.v(i, m[0]! * X + m[2]! * Y + m[4]!, m[1]! * X + m[3]! * Y + m[5]!, 0, 0, c, a);
    }
    this.emitPoly(4, flags);
  }

  /** A rectangle filled with a top-to-bottom gradient (the sky): a band per pair of stops, their colors at its corners. */
  private gradientRect(gr: GLGradient, x: number, y: number, w: number, h: number): void {
    const m = this.m;
    const a = this.globalAlpha;
    const flags = M_SOLID | (this.comp() << 7);
    const n = gr.at.length;
    if (!n) return;
    // The band edges: the rectangle's top and bottom and every stop between. (The town's gradients run straight down under a
    // scale and a move: positions along y.)
    let top = y;
    const bot = y + h;
    const edges = this.gradEdges;
    let ne = 0;
    edges[ne++] = top;
    for (let i = 0; i < n; i++) {
      const Y = gr.y0 + (gr.y1 - gr.y0) * gr.at[i]!;
      if (Y > top && Y < bot) edges[ne++] = Y;
    }
    edges[ne++] = bot;
    this.polyRoom(4);
    const pts = this.gradPts;
    for (let i = 0; i + 1 < ne; i++) {
      top = edges[i]!;
      const b = edges[i + 1]!;
      const c0 = this.colorAt(gr, top, this.col);
      const c1 = this.colorAt(gr, b, this.col2);
      pts[0] = pts[6] = x;
      pts[2] = pts[4] = x + w;
      pts[1] = pts[3] = top;
      pts[5] = pts[7] = b;
      for (let k = 0; k < 4; k++) {
        const X = pts[k * 2]!;
        const Y = pts[k * 2 + 1]!;
        this.v(k, m[0]! * X + m[2]! * Y + m[4]!, m[1]! * X + m[3]! * Y + m[5]!, 0, 0, k < 2 ? c0 : c1, a);
      }
      this.emitPoly(4, flags);
    }
  }
  /** The gradient's color at `Y` (along its line), into `out`. */
  private colorAt(gr: GLGradient, Y: number, out: RGBA): RGBA {
    const n = gr.at.length;
    const t = gr.y1 === gr.y0 ? 0 : (Y - gr.y0) / (gr.y1 - gr.y0);
    let i = 0;
    while (i < n && gr.at[i]! < t) i++;
    if (i === 0) return Object.assign(out, gr.col[0]);
    if (i === n) return Object.assign(out, gr.col[n - 1]);
    const t0 = gr.at[i - 1]!;
    const t1 = gr.at[i]!;
    const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
    const c0 = gr.col[i - 1]!;
    const c1 = gr.col[i]!;
    out.r = c0.r + (c1.r - c0.r) * k;
    out.g = c0.g + (c1.g - c0.g) * k;
    out.b = c0.b + (c1.b - c0.b) * k;
    out.a = c0.a + (c1.a - c0.a) * k;
    return out;
  }
  private readonly gradEdges = new Float64Array(64);
  /** A band's corners (reused: nothing made per frame). */
  private readonly gradPts = new Float64Array(8);

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    return new GLGradient(x0, y0, x1, y1) as unknown as CanvasGradient;
  }

  private shadowOn(): boolean {
    if (this.shadowBlur <= 0 && !this.shadowOffsetX && !this.shadowOffsetY) return false;
    return this.color(this.shadowColor, this.col2).a > 0;
  }

  fill(_rule?: CanvasFillRule | Path2D): void {
    if (this.np < 3) return;
    const fs = this.fillStyle;
    const c = typeof fs === "string" ? this.color(fs, this.col) : this.color("#000000", this.col);
    if (this.shadowOn()) return this.bakeFill();
    const a = this.globalAlpha;
    if (a * c.a <= 0) return;
    const flags = M_SOLID | (this.comp() << 7);
    // Each subpath fanned from its first point (the town's are convex: squares, ellipses, rounded boxes).
    for (let s = 0; s < this.nSub; s++) {
      const p0 = this.sub[s]!;
      const p1 = s + 1 < this.nSub ? this.sub[s + 1]! : this.np;
      const k = p1 - p0;
      if (k < 3) continue;
      this.polyRoom(k);
      for (let i = 0; i < k; i++) this.v(i, this.px[(p0 + i) * 2]!, this.px[(p0 + i) * 2 + 1]!, 0, 0, c, a);
      this.emitPoly(k, flags);
    }
  }

  /**
   * A fill with a shadow (the speech bubble): drawn once into a canvas by a 2D context, shadow and all, kept by its shape,
   * colors and shadow, and laid on at the nearest device pixel.
   */
  private bakeFill(): void {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < this.np; i++) {
      const x = this.px[i * 2]!;
      const y = this.px[i * 2 + 1]!;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    const bx = Math.floor(x0);
    const by = Math.floor(y0);
    // Its key: the shape (a quarter pixel) from its corner, its fill, its shadow, its alpha.
    let h = 2166136261;
    const mixIn = (v: number) => (h = Math.imul(h ^ (v | 0), 16777619));
    for (let i = 0; i < this.np; i++) {
      mixIn(Math.round((this.px[i * 2]! - bx) * 4));
      mixIn(Math.round((this.px[i * 2 + 1]! - by) * 4));
    }
    for (let s = 0; s < this.nSub; s++) mixIn(this.sub[s]! * 31 + this.closed[s]!);
    const fs = this.fillStyle as string;
    for (let i = 0; i < fs.length; i++) mixIn(fs.charCodeAt(i));
    for (let i = 0; i < this.shadowColor.length; i++) mixIn(this.shadowColor.charCodeAt(i));
    mixIn(Math.round(this.shadowBlur * 16));
    mixIn(Math.round(this.shadowOffsetX * 16));
    mixIn(Math.round(this.shadowOffsetY * 16));
    const key = h >>> 0;
    let b: Baked | undefined;
    for (const e of this.baked) if (e.key === key) b = e;
    if (!b) {
      const blur = this.shadowBlur;
      const pad = Math.ceil(blur * 1.6 + Math.max(Math.abs(this.shadowOffsetX), Math.abs(this.shadowOffsetY)) * this.unit()) + 2;
      const old = this.baked.length >= BAKE_MAX ? this.baked.reduce((a, e) => (a.used <= e.used ? a : e)) : null;
      const cv = old?.cv ?? document.createElement("canvas");
      cv.width = Math.ceil(x1 - bx) + 2 * pad + 1;
      cv.height = Math.ceil(y1 - by) + 2 * pad + 1;
      const g = cv.getContext("2d")!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.shadowColor = this.shadowColor;
      g.shadowBlur = blur;
      // (Shadow offsets are in the canvas's pixels, whatever the transform: as on the town's canvas.)
      g.shadowOffsetX = this.shadowOffsetX;
      g.shadowOffsetY = this.shadowOffsetY;
      g.fillStyle = this.fillStyle as string;
      g.beginPath();
      for (let s = 0; s < this.nSub; s++) {
        const p0 = this.sub[s]!;
        const p1 = s + 1 < this.nSub ? this.sub[s + 1]! : this.np;
        for (let i = p0; i < p1; i++) {
          const X = this.px[i * 2]! - bx + pad;
          const Y = this.px[i * 2 + 1]! - by + pad;
          if (i === p0) g.moveTo(X, Y);
          else g.lineTo(X, Y);
        }
        if (this.closed[s]) g.closePath();
      }
      g.fill();
      if (old) {
        old.key = key;
        old.ox = pad;
        old.oy = pad;
        b = old;
        this.P.changed(cv);
      } else this.baked.push((b = { key, cv, ox: pad, oy: pad, used: 0 }));
    }
    b.used = this.P.frameNo;
    this.deviceImage(b.cv, bx - b.ox, by - b.oy, this.globalAlpha);
  }

  /** A canvas laid on 1:1 at device pixel (x, y), nearest (text, baked fills). */
  private deviceImage(cv: HTMLCanvasElement, x: number, y: number, a: number): void {
    const e = this.P.entry(cv);
    if (!e || a <= 0) return;
    const { tex, u0, v0, u1, v1 } = this.uvOf(e, 0, 0, cv.width, cv.height);
    const slot = this.P.slot(this.st, tex);
    const flags = M_TEX | (slot << 3) | (this.comp() << 7);
    const c = this.white(a);
    this.polyRoom(4);
    const w = cv.width;
    const h = cv.height;
    this.v(0, x, y, u0, v0, c, 1);
    this.v(1, x + w, y, u1, v0, c, 1);
    this.v(2, x + w, y + h, u1, v1, c, 1);
    this.v(3, x, y + h, u0, v1, c, 1);
    this.emitPoly(4, flags);
  }

  private white(a: number): RGBA {
    const c = this.col2;
    c.r = c.g = c.b = 1;
    c.a = a;
    return c;
  }

  private readonly uv = { tex: null as unknown as Tex, u0: 0, v0: 0, u1: 0, v1: 0, ox: 0, oy: 0, tw: 1, th: 1 };
  /** Texture coordinates of the source rectangle (sx, sy, sw, sh) of an entry (or a layer's texture). */
  private uvOf(e: Entry | Tex, sx: number, sy: number, sw: number, sh: number) {
    const r = this.uv;
    if ("src" in e) {
      const t = e.tex!;
      r.tex = t;
      r.ox = e.x;
      r.oy = e.y;
      r.tw = t.w;
      r.th = t.h;
    } else {
      r.tex = e;
      r.ox = 0;
      r.oy = 0;
      r.tw = e.w;
      r.th = e.h;
    }
    r.u0 = (r.ox + sx) / r.tw;
    r.v0 = (r.oy + sy) / r.th;
    r.u1 = (r.ox + sx + sw) / r.tw;
    r.v1 = (r.oy + sy + sh) / r.th;
    return r;
  }

  // ---- Strokes: each subpath as a strip of quads, mitred at the joins (the town's lines bend gently or meet square).

  stroke(): void {
    if (this.np < 2) return;
    const c = this.color(this.strokeStyle as string, this.col);
    const a = this.globalAlpha;
    const hw = (this.lineWidth * this.unit()) / 2;
    // Its shadow first (a 2D context draws a shape's shadow, then the shape): the line blurred, worked out per pixel.
    if (this.shadowBlur > 0 && this.shadowOn()) {
      const sc = this.color(this.shadowColor, this.col2);
      const sigma = this.shadowBlur / 2;
      const k = this.col3;
      k.r = sc.r;
      k.g = sc.g;
      k.b = sc.b;
      k.a = sc.a * c.a;
      this.strokeStrip(hw, hw + 3 * sigma, k, a, M_SOFTLINE | (this.comp() << 7), sigma, this.shadowOffsetX, this.shadowOffsetY);
    }
    this.strokeStrip(hw, hw, c, a, M_SOLID | (this.comp() << 7), 0, 0, 0);
  }

  /** Each subpath's strip, `half` wide each side of the line (the line `hw`), offset by (ox, oy): a soft line carries its distance across. */
  private strokeStrip(hw: number, half: number, c: RGBA, a: number, flags: number, sigma: number, ox: number, oy: number): void {
    const P = this.px;
    const soft = (flags & 7) === M_SOFTLINE;
    for (let s = 0; s < this.nSub; s++) {
      const p0 = this.sub[s]!;
      let p1 = s + 1 < this.nSub ? this.sub[s + 1]! : this.np;
      const closed = this.closed[s] === 1;
      // (A closed subpath that ends where it began: the last point is the first.)
      if (closed && p1 - p0 > 2 && P[(p1 - 1) * 2] === P[p0 * 2] && P[(p1 - 1) * 2 + 1] === P[p0 * 2 + 1]) p1--;
      const n = p1 - p0;
      if (n < 2) continue;
      const segs = closed ? n : n - 1;
      // Each point's offset: the miter of the normals either side (a square end's own normal at an open end).
      const off = this.offs.length < n * 2 ? (this.offs = new Float64Array(n * 4)) : this.offs;
      for (let i = 0; i < n; i++) {
        const ip = i === 0 ? (closed ? n - 1 : -1) : i - 1;
        const inx = i === n - 1 && !closed ? -1 : (i + 1) % n;
        let nx = 0;
        let ny = 0;
        let n1x = 0;
        let n1y = 0;
        let have = 0;
        if (ip >= 0) {
          const dx = P[(p0 + i) * 2]! - P[(p0 + ip) * 2]!;
          const dy = P[(p0 + i) * 2 + 1]! - P[(p0 + ip) * 2 + 1]!;
          const l = Math.hypot(dx, dy) || 1;
          n1x = -dy / l;
          n1y = dx / l;
          nx += n1x;
          ny += n1y;
          have++;
        }
        if (inx >= 0) {
          const dx = P[(p0 + inx) * 2]! - P[(p0 + i) * 2]!;
          const dy = P[(p0 + inx) * 2 + 1]! - P[(p0 + i) * 2 + 1]!;
          const l = Math.hypot(dx, dy) || 1;
          if (!have) ((n1x = -dy / l), (n1y = dx / l));
          nx += -dy / l;
          ny += dx / l;
        }
        const l = Math.hypot(nx, ny);
        if (l < 1e-6) {
          off[i * 2] = n1x;
          off[i * 2 + 1] = n1y;
          continue;
        }
        nx /= l;
        ny /= l;
        // The miter's length (limited, as a 2D context's miterLimit 10 is).
        const cos = nx * n1x + ny * n1y;
        const k = 1 / Math.max(0.1, cos);
        off[i * 2] = nx * k;
        off[i * 2 + 1] = ny * k;
      }
      this.polyRoom(4);
      for (let i = 0; i < segs; i++) {
        const A = i;
        const B = (i + 1) % n;
        const ax = P[(p0 + A) * 2]! + ox;
        const ay = P[(p0 + A) * 2 + 1]! + oy;
        const bx = P[(p0 + B) * 2]! + ox;
        const by = P[(p0 + B) * 2 + 1]! + oy;
        const aox = off[A * 2]! * half;
        const aoy = off[A * 2 + 1]! * half;
        const box = off[B * 2]! * half;
        const boy = off[B * 2 + 1]! * half;
        const d = soft ? half : 0;
        this.v(0, ax - aox, ay - aoy, -d, 0, c, a, hw, sigma);
        this.v(1, bx - box, by - boy, -d, 0, c, a, hw, sigma);
        this.v(2, bx + box, by + boy, d, 0, c, a, hw, sigma);
        this.v(3, ax + aox, ay + aoy, d, 0, c, a, hw, sigma);
        this.emitPoly(4, flags);
      }
    }
  }
  private offs = new Float64Array(256);

  // ---- Clips: an upright rectangle is kept as numbers (everything drawn is cut to it before it's sent); any other shape
  // goes into the stencil (the canvas's), even-odd.

  clip(_rule?: CanvasFillRule | Path2D): void {
    if (this.np < 3) return;
    if (this.nSub === 1 && this.np >= 4 && this.np <= 5 && this.uprightRect()) return;
    if (this.st !== this.P.main) {
      // (A layer has no stencil: its clips are rectangles in the town's drawing. Anything else is cut to its box.)
      this.boxClip();
      return;
    }
    // (Fanned, unclipped: the stencil's even-odd counts each pixel's crossings.)
    let total = 0;
    for (let s = 0; s < this.nSub; s++) total += Math.max(0, (s + 1 < this.nSub ? this.sub[s + 1]! : this.np) - this.sub[s]! - 2) * 3;
    this.P.room(this.st, total);
    const from = this.st.n;
    const f = this.st.f;
    const u = this.st.u;
    let o = from * VF;
    for (let s = 0; s < this.nSub; s++) {
      const p0 = this.sub[s]!;
      const k = (s + 1 < this.nSub ? this.sub[s + 1]! : this.np) - p0;
      for (let t = 1; t < k - 1; t++)
        for (let q = 0; q < 3; q++) {
          const j = q === 0 ? 0 : q === 1 ? t : t + 1;
          f[o] = this.px[(p0 + j) * 2]!;
          f[o + 1] = this.px[(p0 + j) * 2 + 1]!;
          u[o + 5] = M_SOLID;
          o += VF;
        }
    }
    this.st.n = from + total;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < this.np; i++) {
      const x = this.px[i * 2]!;
      const y = this.px[i * 2 + 1]!;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    let h = 2166136261;
    for (let i = 0; i < this.np; i++) h = Math.imul(Math.imul(h ^ Math.round(this.px[i * 2]! * 8), 16777619) ^ Math.round(this.px[i * 2 + 1]! * 8), 16777619);
    for (let i = 0; i < this.nSub; i++) h = Math.imul(h ^ this.sub[i]!, 16777619);
    if (this.level >= 7) {
      // (Deeper than the stencil holds: its box instead. The town never nests clips more than two deep.)
      this.st.n = from;
      this.clipTo(x0, y0, x1, y1);
      return;
    }
    this.P.stencil(from, this.level + 1, h >>> 0, x0, y0, x1, y1);
    this.level++;
    // (What's drawn inside it is cut to its box on the way, too: no work where the stencil would refuse it all.)
    this.clipTo(x0, y0, x1, y1);
  }

  private uprightRect(): boolean {
    const P = this.px;
    const n = this.np === 5 ? 4 : this.np;
    if (n !== 4) return false;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 4; i++) {
      x0 = Math.min(x0, P[i * 2]!);
      x1 = Math.max(x1, P[i * 2]!);
      y0 = Math.min(y0, P[i * 2 + 1]!);
      y1 = Math.max(y1, P[i * 2 + 1]!);
    }
    for (let i = 0; i < 4; i++) {
      const x = P[i * 2]!;
      const y = P[i * 2 + 1]!;
      if ((Math.abs(x - x0) > 1e-3 && Math.abs(x - x1) > 1e-3) || (Math.abs(y - y0) > 1e-3 && Math.abs(y - y1) > 1e-3)) return false;
    }
    this.clipTo(x0, y0, x1, y1);
    return true;
  }

  private boxClip(): void {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < this.np; i++) {
      x0 = Math.min(x0, this.px[i * 2]!);
      x1 = Math.max(x1, this.px[i * 2]!);
      y0 = Math.min(y0, this.px[i * 2 + 1]!);
      y1 = Math.max(y1, this.px[i * 2 + 1]!);
    }
    this.clipTo(x0, y0, x1, y1);
  }

  private clipTo(x0: number, y0: number, x1: number, y1: number): void {
    const c = this.clipR;
    if (this.clipOn) {
      x0 = Math.max(x0, c[0]!);
      y0 = Math.max(y0, c[1]!);
      x1 = Math.min(x1, c[2]!);
      y1 = Math.min(y1, c[3]!);
    }
    c[0] = x0;
    c[1] = y0;
    c[2] = Math.max(x0, x1);
    c[3] = Math.max(y0, y1);
    this.clipOn = true;
  }

  // ---- Pictures.

  drawImage(img: CanvasImageSource, a1: number, a2: number, a3?: number, a4?: number, a5?: number, a6?: number, a7?: number, a8?: number): void {
    const e = this.P.entry(img);
    if (!e) return;
    const s = img as HTMLCanvasElement;
    const iw = e.w;
    const ih = e.h;
    let sx = 0;
    let sy = 0;
    let sw = iw;
    let sh = ih;
    let dx: number;
    let dy: number;
    let dw: number;
    let dh: number;
    if (a5 !== undefined) {
      sx = a1;
      sy = a2;
      sw = a3!;
      sh = a4!;
      dx = a5;
      dy = a6!;
      dw = a7!;
      dh = a8!;
    } else if (a3 !== undefined) {
      dx = a1;
      dy = a2;
      dw = a3;
      dh = a4!;
    } else {
      dx = a1;
      dy = a2;
      dw = s.width;
      dh = s.height;
    }
    const a = this.globalAlpha;
    if (a <= 0 || !dw || !dh) return;
    const { tex, u0, v0, u1, v1 } = this.uvOf(e, sx, sy, sw, sh);
    const slot = this.P.slot(this.st, tex);
    const flags = M_TEX | (slot << 3) | (this.imageSmoothingEnabled ? 64 : 0) | (this.comp() << 7);
    const c = this.white(a);
    const m = this.m;
    this.polyRoom(4);
    for (let i = 0; i < 4; i++) {
      const X = i === 1 || i === 2 ? dx + dw : dx;
      const Y = i >= 2 ? dy + dh : dy;
      this.v(i, m[0]! * X + m[2]! * Y + m[4]!, m[1]! * X + m[3]! * Y + m[5]!, i === 1 || i === 2 ? u1 : u0, i >= 2 ? v1 : v0, c, 1);
    }
    this.emitPoly(4, flags);
  }

  /**
   * The far band's softening (render.ts's `blitSoft`) in one draw: the picture as it would be shrunk to `k` scratch pixels
   * a CSS pixel (sampled smooth), hazed toward `horizon` by `haze`, and stretched back (smooth or nearest, as now set).
   */
  softImage(img: CanvasImageSource, bx: number, by: number, bw: number, bh: number, k: number, haze: number, horizon: string): void {
    const e = this.P.entry(img);
    if (!e) return;
    const a = this.globalAlpha;
    if (a <= 0) return;
    const ex = bw * k;
    const ey = bh * k;
    const pw = Math.ceil(ex) + 2;
    const ph = Math.ceil(ey) + 2;
    const { tex, u0, v0, u1, v1 } = this.uvOf(e, 0, 0, e.w, e.h);
    const slot = this.P.slot(this.st, tex);
    const hz = Math.round(Math.min(1, Math.max(0, haze)) * 255);
    const flags = M_SOFTIMG | (slot << 3) | (this.imageSmoothingEnabled ? 64 : 0) | (this.comp() << 7) | (hz << 16);
    const hc = this.color(horizon, this.col);
    // (The vertex color carries the horizon's color, unpremultiplied, and the alpha.)
    const c = this.col2;
    c.r = hc.r;
    c.g = hc.g;
    c.b = hc.b;
    c.a = 1;
    const m = this.m;
    const x0 = bx - 1 / k;
    const y0 = by - 1 / k;
    const w = pw / k;
    const h = ph / k;
    const su = (u1 - u0) / ex;
    const sv = (v1 - v0) / ey;
    this.polyRoom(4);
    for (let i = 0; i < 4; i++) {
      const r = i === 1 || i === 2;
      const d = i >= 2;
      const X = r ? x0 + w : x0;
      const Y = d ? y0 + h : y0;
      const o = i * RF;
      this.v(i, m[0]! * X + m[2]! * Y + m[4]!, m[1]! * X + m[3]! * Y + m[5]!, r ? pw : 0, d ? ph : 0, c, 1, u0, v0, su, sv, ex, ey);
      // (Not premultiplied: the shader mixes toward this color by the picture's own alpha.)
      this.poly[o + 4] = c.r;
      this.poly[o + 5] = c.g;
      this.poly[o + 6] = c.b;
      this.poly[o + 7] = a;
    }
    this.emitPoly(4, flags);
  }

  // ---- Text: each string drawn once into a canvas (per font, style and alignment), laid on at the nearest device pixel.

  measureText(text: string): TextMetrics {
    const g = this.measuring();
    if (g.font !== this.font) g.font = this.font;
    return g.measureText(text);
  }

  private measuring(): CanvasRenderingContext2D {
    return (this.measure ??= document.createElement("canvas").getContext("2d")!);
  }

  fillText(text: string, x: number, y: number): void {
    this.text(text, x, y, 0);
  }

  strokeText(text: string, x: number, y: number): void {
    this.text(text, x, y, this.lineWidth);
  }

  private text(text: string, x: number, y: number, stroke: number): void {
    const a = this.globalAlpha;
    if (a <= 0) return;
    if (this.textGen !== GLCtx.fontsGen) {
      // (A web font came: what was drawn in the fallback is drawn again.)
      this.textGen = GLCtx.fontsGen;
      for (const list of this.texts.values()) for (const t of list) t.used = -1;
      this.texts.clear();
      this.nTexts = 0;
    }
    const style = (stroke ? this.strokeStyle : this.fillStyle) as string;
    const scale = Math.round(this.unit() * 100) / 100;
    let list = this.texts.get(text);
    let art: TextArt | undefined;
    if (list)
      for (const t of list)
        if (t.font === this.font && t.align === this.textAlign && t.base === this.textBaseline && t.style === style && t.stroke === stroke && t.scale === scale && (!stroke || t.join === this.lineJoin)) {
          art = t;
          break;
        }
    if (!art) {
      art = this.drawText(text, style, stroke, scale);
      if (!list) this.texts.set(text, (list = []));
      list.push(art);
      this.nTexts++;
      if (this.nTexts > TEXT_MAX) this.forgetTexts();
    }
    art.used = this.P.frameNo;
    const m = this.m;
    const X = m[0]! * x + m[2]! * y + m[4]!;
    const Y = m[1]! * x + m[3]! * y + m[5]!;
    this.deviceImage(art.cv, Math.round(X) - art.ox, Math.round(Y) - art.oy, a);
  }

  private drawText(text: string, style: string, stroke: number, scale: number): TextArt {
    const g = this.measuring();
    g.font = this.font;
    g.textAlign = this.textAlign;
    g.textBaseline = this.textBaseline;
    const mt = g.measureText(text);
    const pad = stroke + 2;
    const left = Math.ceil((mt.actualBoundingBoxLeft + pad) * scale);
    const top = Math.ceil((mt.actualBoundingBoxAscent + pad) * scale);
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, left + Math.ceil((mt.actualBoundingBoxRight + pad) * scale));
    cv.height = Math.max(1, top + Math.ceil((mt.actualBoundingBoxDescent + pad) * scale));
    const c = cv.getContext("2d")!;
    c.setTransform(scale, 0, 0, scale, left, top);
    c.font = this.font;
    c.textAlign = this.textAlign;
    c.textBaseline = this.textBaseline;
    if (stroke) {
      c.lineWidth = stroke;
      c.lineJoin = this.lineJoin;
      c.strokeStyle = style;
      c.strokeText(text, 0, 0);
    } else {
      c.fillStyle = style;
      c.fillText(text, 0, 0);
    }
    return { text, font: this.font, align: this.textAlign, base: this.textBaseline, style, stroke, join: this.lineJoin, scale, cv, ox: left, oy: top, used: 0 };
  }

  /** Drops the strings least lately drawn (half of them). */
  private forgetTexts(): void {
    const all: TextArt[] = [];
    for (const l of this.texts.values()) all.push(...l);
    all.sort((a, b) => a.used - b.used);
    const cut = all[Math.floor(all.length / 2)]!.used;
    for (const [k, l] of this.texts) {
      const keep = l.filter((t) => t.used > cut);
      if (keep.length) this.texts.set(k, keep);
      else this.texts.delete(k);
    }
    this.nTexts = 0;
    for (const l of this.texts.values()) this.nTexts += l.length;
  }
}

