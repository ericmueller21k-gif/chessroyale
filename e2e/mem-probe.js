// What a memory check measures in the page (e2e/battle-tower.spec.ts, "memory across two floors"). Plain JS, installed before the
// app's own scripts (page.addInitScript). iOS reloads a tab that runs out of memory, and canvases, images and WebGL textures are most of
// a page's memory there: so it keeps a weak reference to every canvas given a context, every ImageBitmap and every image given an
// address, and every WebGL context's textures by their size. `window.__mem()` sums what's still alive (call it after a forced GC).

export function memProbe() {
  const live = (list) => list.map((r) => r.deref()).filter(Boolean);
  const canvases = [];
  const seen = new WeakSet();
  const contexts = [];
  const who = new WeakMap();
  const note = (c) => {
    if (seen.has(c)) return;
    seen.add(c);
    canvases.push(new WeakRef(c));
    if (window.__memWhoOn) who.set(c, (new Error().stack ?? "").split("\n").slice(3, 7).map((l) => l.replace(/^.*\/assets\//, "").replace(/\)$/, "")).join(" < "));
  };
  for (const C of [window.HTMLCanvasElement, window.OffscreenCanvas])
    if (C) {
      const get = C.prototype.getContext;
      C.prototype.getContext = function (kind, o) {
        const x = get.call(this, kind, o);
        if (x) {
          note(this);
          if (/webgl/.test(kind) && !x.__tex) ((x.__tex = new Map()), (x.__bound = {}), (x.__unit = 0), contexts.push(new WeakRef(x)));
        }
        return x;
      };
    }
  const bitmaps = [];
  const cib = window.createImageBitmap;
  window.createImageBitmap = function (...a) {
    return cib.apply(this, a).then((b) => (bitmaps.push(new WeakRef(b)), b));
  };
  const images = [];
  const imgSeen = new WeakSet();
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    ...src,
    set(v) {
      if (!imgSeen.has(this)) (imgSeen.add(this), images.push(new WeakRef(this)));
      src.set.call(this, v);
    },
  });
  // (Each texture's level-0 bytes, 4 a pixel, set where it's bound: an atlas's layers are depth.)
  const size = (s) => (s ? (s.width || s.videoWidth || s.naturalWidth || 0) * (s.height || s.videoHeight || s.naturalHeight || 0) : 0);
  for (const G of [window.WebGLRenderingContext, window.WebGL2RenderingContext])
    if (G) {
      const p = G.prototype;
      const at = (gl, target) => gl.__bound?.[`${gl.__unit}:${target === 0x8513 || (target >= 0x8515 && target <= 0x851a) ? 0x8513 : target}`];
      const set = (gl, target, level, bytes) => {
        const t = level === 0 && at(gl, target);
        if (!t) return;
        const faces = target >= 0x8515 && target <= 0x851a ? 6 : 1;
        gl.__tex?.set(t, faces > 1 ? Math.max(gl.__tex.get(t) ?? 0, bytes * 6) : bytes);
      };
      const wrap = (name, f) => {
        const o = p[name];
        if (o) p[name] = function (...a) {
          try {
            f(this, a);
          } catch {
            // (A probe's miss never breaks the app.)
          }
          return o.apply(this, a);
        };
      };
      wrap("activeTexture", (gl, [u]) => (gl.__unit = u));
      wrap("bindTexture", (gl, [target, t]) => gl.__bound && (gl.__bound[`${gl.__unit}:${target}`] = t));
      wrap("deleteTexture", (gl, [t]) => gl.__tex?.delete(t));
      wrap("texImage2D", (gl, a) => set(gl, a[0], a[1], (a.length >= 8 ? a[3] * a[4] : size(a[5])) * 4));
      wrap("texStorage2D", (gl, a) => set(gl, a[0], 0, a[3] * a[4] * 4));
      wrap("texImage3D", (gl, a) => set(gl, a[0], a[1], a[3] * a[4] * a[5] * 4));
      wrap("texStorage3D", (gl, a) => set(gl, a[0], 0, a[3] * a[4] * a[5] * 4));
    }
  const MB = (b) => Math.round(b / 1e5) / 10;
  window.__memWho = () => {
    const g = new Map();
    for (const c of live(canvases)) {
      const k = who.get(c) ?? "?";
      const e = g.get(k) ?? { n: 0, mb: 0 };
      e.n++;
      e.mb += (c.width * c.height * 4) / 1e6;
      g.set(k, e);
    }
    return [...g].sort((a, b) => b[1].mb - a[1].mb).slice(0, 25).map(([k, e]) => `${e.mb.toFixed(1)} MB ${e.n} ${k}`);
  };
  window.__mem = () => {
    const cs = live(canvases);
    const gls = live(contexts).filter((g) => !g.isContextLost());
    const bms = live(bitmaps).filter((b) => b.width > 0);
    const ims = live(images).filter((i) => i.complete && i.naturalWidth > 0);
    let tex = 0;
    for (const g of gls) for (const b of g.__tex.values()) tex += b;
    return {
      canvasMB: MB(cs.reduce((s, c) => s + c.width * c.height * 4, 0)),
      canvases: cs.filter((c) => c.width * c.height > 0).length,
      bitmapMB: MB(bms.reduce((s, b) => s + b.width * b.height * 4, 0)),
      imageMB: MB(ims.reduce((s, i) => s + i.naturalWidth * i.naturalHeight * 4, 0)),
      glContexts: gls.length,
      textureMB: MB(tex),
    };
  };
}
