/**
 * A room's back through WebGL (Nov 11, docs/decisions/2026-11-11-room-smooth.md). Eric, inside a building on his iPhone: "it's not
 * moving as smoothly as the town... It's not going up and down, but it's just like capped. It seems like it's just a slower speed
 * inside." While the view moved, the room's 2D canvas laid its floor as some hundreds of clipped, stretched triangles every frame; the
 * canvas's own drawing of them (after our code: "Outside our code" in `?report`) put a walking frame past 16.7 ms, so the phone ran the
 * room at 30 fps.
 *
 * Here the back (the ceiling's picture, a cave's rock past its squares, the bright day past the front wall, the floor) is drawn by the
 * GPU into one opaque picture the size of the room's canvas, and ShopRoom copies it onto its canvas in one `drawImage`, where the back
 * was: everything drawn after it (the pools of light, the figures, the darks) lands on it as before. A walking frame costs the 2D canvas
 * one copy, as a frame standing still already did (ShopRoom's kept back, Nov 11).
 *
 * - The floor's picture (every tile, and the plans lying flat on it that never change) is uploaded once; each frame its squares go to
 *   the GPU as one mesh: each corner through the room's camera (`corner`, the room's own `P`), two triangles a square, one draw call.
 *   Each triangle's picture is stretched straight across as the 2D canvas's were; single squares everywhere (the 2D way took two
 *   squares a block far off: the same picture to a pixel or so).
 * - The ceiling's picture is uploaded again only when it's drawn again (a new size).
 * - The cave's rock and the day outside are flat colors, as the 2D way filled them.
 *
 * Null when WebGL isn't there; while the context is lost (`lost`) ShopRoom draws its back the 2D way.
 */

const VS = `attribute vec2 p;
attribute vec2 t;
uniform vec2 sz;
varying vec2 v;
void main() {
  gl_Position = vec4(p.x / sz.x * 2.0 - 1.0, 1.0 - p.y / sz.y * 2.0, 0.0, 1.0);
  v = t;
}`;
// (`solid` > 0: the flat color `col`; otherwise the bound picture.)
const FS = `precision highp float;
uniform sampler2D s;
uniform vec4 col;
uniform float solid;
varying vec2 v;
void main() {
  gl_FragColor = solid > 0.5 ? col : texture2D(s, v);
}`;

/** A place on screen (CSS pixels). */
export interface XY {
  x: number;
  y: number;
}

export interface BackGl {
  /** What ShopRoom copies onto its canvas: opaque, the room's canvas's size (device pixels). */
  readonly canvas: HTMLCanvasElement;
  /** The context is lost (until it's restored): ShopRoom draws its back the 2D way. */
  readonly lost: boolean;
  /** The floor's triangles in the last frame (tests). */
  readonly tris: number;
  /** The ceiling's picture was drawn again: uploaded before the next frame. */
  roofChanged(): void;
  /** A frame of `W` x `H` CSS pixels at `dpr`: the ceiling's picture over all of it. */
  begin(W: number, H: number, dpr: number): void;
  /** A flat `color` (CSS) over the polygon of `k` points (CSS pixels) fanned from (fx, fy). */
  fan(
    color: string,
    xs: ArrayLike<number>,
    ys: ArrayLike<number>,
    k: number,
    fx: number,
    fy: number,
  ): void;
  /**
   * The floor, `n` x `n` squares: `corner(c, r, out)` the corner north-west of square (c, r) on screen (c, r from 0 to n), false when
   * it's behind the camera.
   */
  floor(n: number, corner: (c: number, r: number, out: XY) => boolean): void;
  dispose(): void;
}

/** A CSS color as RGBA from 0 to 1 (premultiplied, as the canvas is). */
const rgba = (() => {
  let g: CanvasRenderingContext2D | null = null;
  const seen = new Map<string, Float32Array>();
  return (css: string): Float32Array => {
    let c = seen.get(css);
    if (c) return c;
    g ??= Object.assign(document.createElement("canvas"), {
      width: 1,
      height: 1,
    }).getContext("2d", { willReadFrequently: true })!;
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = css;
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    const a = d[3]! / 255;
    c = new Float32Array([
      (d[0]! / 255) * a,
      (d[1]! / 255) * a,
      (d[2]! / 255) * a,
      a,
    ]);
    seen.set(css, c);
    return c;
  };
})();

/** The room's back: its floor's picture `floorPic` (n x n squares, its pixel (0, 0) square (0, 0)'s north-west corner) and its ceiling's `roofPic`. */
export function backGl(
  floorPic: HTMLCanvasElement,
  roofPic: HTMLCanvasElement,
): BackGl | null {
  const canvas = document.createElement("canvas");
  // (Opaque: copied onto the room's canvas as a plain copy. Antialiased, as the 2D way's edges were.)
  const opts: WebGLContextAttributes = {
    alpha: false,
    antialias: true,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    premultipliedAlpha: true,
  };
  const gl = canvas.getContext("webgl", opts) as WebGLRenderingContext | null;
  if (!gl) return null;
  let lost = false;
  let prog: WebGLProgram | null = null;
  let buf: WebGLBuffer | null = null;
  let floorTex: WebGLTexture | null = null;
  let roofTex: WebGLTexture | null = null;
  let roofDirty = true;
  let uSz: WebGLUniformLocation | null = null;
  let uCol: WebGLUniformLocation | null = null;
  let uSolid: WebGLUniformLocation | null = null;
  const texture = (src: HTMLCanvasElement | null): WebGLTexture | null => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (src)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return t;
  };
  const setUp = (): boolean => {
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const p = gl.createProgram();
    if (!p) return false;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false;
    prog = p;
    gl.useProgram(p);
    const aP = gl.getAttribLocation(p, "p");
    const aT = gl.getAttribLocation(p, "t");
    uSz = gl.getUniformLocation(p, "sz");
    uCol = gl.getUniformLocation(p, "col");
    uSolid = gl.getUniformLocation(p, "solid");
    gl.uniform1i(gl.getUniformLocation(p, "s"), 0);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aP);
    gl.enableVertexAttribArray(aT);
    gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(aT, 2, gl.FLOAT, false, 16, 8);
    // (Pictures as the canvas holds them, premultiplied; laid on with source-over.)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    floorTex = texture(floorPic);
    roofTex = texture(null);
    roofDirty = true;
    return !gl.isContextLost();
  };
  if (!setUp()) return null;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = !setUp();
  });

  // Scratch, grown as needed: the squares' corners (x, y, in front of the camera) and the vertices (x, y, u, v).
  let cap = 0;
  let cx = new Float32Array(0);
  let cy = new Float32Array(0);
  let ok = new Uint8Array(0);
  let verts = new Float32Array(64);
  const pt: XY = { x: 0, y: 0 };
  let tris = 0;
  let W = 1;
  let H = 1;
  const grow = (floats: number) => {
    if (verts.length < floats)
      verts = new Float32Array(Math.max(floats, verts.length * 2));
  };
  const flush = (k: number) => {
    gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, k), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, k / 4);
  };
  return {
    canvas,
    get lost() {
      return lost || gl.isContextLost();
    },
    get tris() {
      return tris;
    },
    roofChanged() {
      roofDirty = true;
    },
    begin(w, h, dpr) {
      W = w;
      H = h;
      const pw = Math.round(W * dpr);
      const ph = Math.round(H * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      gl.viewport(0, 0, pw, ph);
      gl.uniform2f(uSz, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, roofTex);
      if (roofDirty) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          roofPic,
        );
        roofDirty = false;
      }
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.uniform1f(uSolid, 0);
      verts.set([
        0,
        0,
        0,
        0,
        W,
        0,
        1,
        0,
        W,
        H,
        1,
        1,
        0,
        0,
        0,
        0,
        W,
        H,
        1,
        1,
        0,
        H,
        0,
        1,
      ]);
      flush(24);
    },
    fan(color, xs, ys, k, fx, fy) {
      if (k < 2) return;
      grow(k * 12);
      let j = 0;
      for (let i = 0; i + 1 < k; i++) {
        verts[j++] = fx;
        verts[j++] = fy;
        j += 2;
        verts[j++] = xs[i]!;
        verts[j++] = ys[i]!;
        j += 2;
        verts[j++] = xs[i + 1]!;
        verts[j++] = ys[i + 1]!;
        j += 2;
      }
      gl.uniform1f(uSolid, 1);
      gl.uniform4fv(uCol, rgba(color));
      flush(j);
      gl.uniform1f(uSolid, 0);
    },
    floor(n, corner) {
      const m = (n + 1) * (n + 1);
      if (cap < m) {
        cap = m;
        cx = new Float32Array(m);
        cy = new Float32Array(m);
        ok = new Uint8Array(m);
      }
      grow(n * n * 24);
      for (let r = 0; r <= n; r++)
        for (let c = 0; c <= n; c++) {
          const i = r * (n + 1) + c;
          ok[i] = corner(c, r, pt) ? 1 : 0;
          cx[i] = pt.x;
          cy[i] = pt.y;
        }
      let k = 0;
      const put = (i: number, u: number, v: number) => {
        verts[k++] = cx[i]!;
        verts[k++] = cy[i]!;
        verts[k++] = u;
        verts[k++] = v;
      };
      const d = 1 / n;
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const a = r * (n + 1) + c;
          const b = a + 1;
          const e = a + n + 2;
          const f = a + n + 1;
          // (A square with a corner behind the camera is left out, as the 2D way left it.)
          if (!ok[a] || !ok[b] || !ok[e] || !ok[f]) continue;
          // (Off the screen: nothing to draw.)
          if (
            Math.max(cx[a]!, cx[b]!, cx[e]!, cx[f]!) < 0 ||
            Math.min(cx[a]!, cx[b]!, cx[e]!, cx[f]!) > W
          )
            continue;
          if (
            Math.max(cy[a]!, cy[b]!, cy[e]!, cy[f]!) < 0 ||
            Math.min(cy[a]!, cy[b]!, cy[e]!, cy[f]!) > H
          )
            continue;
          const u0 = c * d;
          const v0 = r * d;
          // (The 2D way's two triangles a square: north-west, north-east, south-east; north-west, south-east, south-west.)
          put(a, u0, v0);
          put(b, u0 + d, v0);
          put(e, u0 + d, v0 + d);
          put(a, u0, v0);
          put(e, u0 + d, v0 + d);
          put(f, u0, v0 + d);
        }
      tris = k / 12;
      if (!k) return;
      gl.bindTexture(gl.TEXTURE_2D, floorTex);
      flush(k);
      gl.bindTexture(gl.TEXTURE_2D, roofTex);
    },
    dispose() {
      gl.deleteBuffer(buf);
      gl.deleteTexture(floorTex);
      gl.deleteTexture(roofTex);
      gl.deleteProgram(prog);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.width = canvas.height = 1;
    },
  };
}
