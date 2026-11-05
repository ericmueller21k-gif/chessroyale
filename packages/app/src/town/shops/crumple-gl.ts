/**
 * Folio's crumple into the match (Nov 5, Eric's idea; the art's notes, intro-folio-nov5.md beat 5; its maths, crumple.ts): the screen
 * as it is, taken as a picture (snap.ts: the room's canvas and the page's DOM over it, the header and the chat), crumpled over black
 * into a ball in the middle (a WebGL mesh: 16 x 34 on a phone, Lambert shading, the paper's back cream-grey with the screen through it
 * at 13%), held a beat, and opened back up as the real match screen: the match is shown under the cover, taken as a picture the same
 * way, cross-faded in on the small ball, and opened; flat, the creases' shade lingers over the live match screen (the cover multiplies
 * over the page there) and fades, and the cover is gone.
 *
 * Never stuck, never in the match's way:
 * - No WebGL (or a shader, a texture or the context failing; or the room's picture failing): a short cross-fade through black instead
 *   (`fade`): to black, held while the match loads, up from black onto it.
 * - It holds as a ball for as long as the match takes to load (as Hollow's dark holds black); once the match shows, its picture has
 *   `maxHoldMs`: past it (or if it fails) the ball fades to black and the match comes up from black.
 * - Every phase goes by the clock; a last limit takes the cover away whatever happens.
 *
 * As the other transitions (intro.ts Storm): a canvas over the whole page, outside the town's tree, taking every tap; `covered` resolves
 * once it shows (the battle starts under it), `out()` once the battle shows and resolves once the cover is gone. Its state is on the
 * element for tests: `data-phase` (crumple, hold, open, linger, fade-in, covered, fade-out), `data-mode` ("gl" or "fade"), `data-dom`
 * ("1" when the room's DOM layer made it into its picture), `data-match` ("1" once the match's picture is on the ball), and its frame
 * times (`window.__crumpleFrames`, test switches on).
 */
import { play, type SoundName } from "../../sound.ts";
import { testSwitchesAllowed } from "../../test-switches.ts";
import { CHALLENGE_FEEL } from "./challenge.ts";
import { CRUMPLE_DEFAULTS, crumpleBeat, fillMesh, lingerShadeP, meshBuf, type MeshBuf } from "./crumple.ts";
import type { LoadedIntro, Storm } from "./intro.ts";
import { compose, domLayer, snapPage, type DomLayer } from "./snap.ts";

const T = CHALLENGE_FEEL.folio.crumple;
/** The DOM's picture may take this long (ms) before the crumple goes on without it: the room's, then the match's. */
const ROOM_DOM_MS = 900;
const MATCH_DOM_MS = 1500;
/** The pictures (and the cover) are drawn at most at this many device pixels a CSS pixel: a phone's memory and upload time. */
const MAX_DPR = 2;
/** Whatever happens, the cover is gone this long (ms) after `out()`: past every beat and limit. */
const LAST_MS = T.maxHoldMs + T.holdMs + T.openMs + T.lingerMs + T.fadeMs * 2 + 3000;

/** The room's DOM layer, taken ahead (`prepareCrumple`: as the quiet line goes, while nothing on the page changes). */
let ahead: DomLayer | null = null;
/** Starts taking the room's DOM layer now, for the crumple to come (ShopRoom, as Folio's quiet line ends). */
export function prepareCrumple(): void {
  ahead = domLayer(innerWidth, innerHeight, ROOM_DOM_MS);
}

const VS = `attribute vec3 aPos; attribute vec2 aUv; attribute float aShade; attribute float aBack;
varying vec2 vUv; varying float vShade; varying float vBack;
void main() { gl_Position = vec4(aPos, 1.0); vUv = aUv; vShade = aShade; vBack = aBack; }`;
// (The art's shading: the paper's back cream-grey #e3dccd with the picture through it at 13%; then multiplied by the shade under 1 and
// screened with a warm sheen over 1. In `uLive`, the shade alone, as a multiply over the live page: the creases lingering.)
const FS = `precision mediump float;
uniform sampler2D uA; uniform sampler2D uB; uniform float uMix; uniform float uLive;
varying vec2 vUv; varying float vShade; varying float vBack;
void main() {
  vec3 c = mix(texture2D(uA, vUv).rgb, texture2D(uB, vUv).rgb, uMix);
  c = mix(c, mix(vec3(0.890, 0.863, 0.804), c, 0.13), vBack);
  float lo = min(vShade, 1.0);
  vec3 m = vec3(lo, lo * 0.97, lo * 0.99);
  float hi = clamp((vShade - 1.0) * 1.6, 0.0, 1.0);
  vec3 h = vec3(1.0, 0.973, 0.91) * hi;
  vec3 lit = 1.0 - (1.0 - c * m) * (1.0 - h);
  gl_FragColor = vec4(mix(lit, m, uLive), 1.0);
}`;

/** A WebGL mesh renderer on `cv`, or null where WebGL isn't there or fails to set up. */
function glOn(cv: HTMLCanvasElement) {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = cv.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return gl!.getShaderParameter(s, gl!.COMPILE_STATUS) ? s : null;
  };
  const vs = sh(gl.VERTEX_SHADER, VS);
  const fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = (name: string, size: number) => {
    const b = gl!.createBuffer()!;
    const loc = gl!.getAttribLocation(prog, name);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, b);
    gl!.enableVertexAttribArray(loc);
    gl!.vertexAttribPointer(loc, size, gl!.FLOAT, false, 0, 0);
    return b;
  };
  const bPos = buf("aPos", 3);
  const bUv = buf("aUv", 2);
  const bShade = buf("aShade", 1);
  const bBack = buf("aBack", 1);
  const uMix = gl.getUniformLocation(prog, "uMix");
  const uLive = gl.getUniformLocation(prog, "uLive");
  gl.uniform1i(gl.getUniformLocation(prog, "uA"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "uB"), 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  const tex = [gl.createTexture()!, gl.createTexture()!];
  /** Puts a picture on texture unit `i` (0 the room, 1 the match); false if it can't (a tainted picture, a lost context). */
  const upload = (i: number, img: HTMLCanvasElement): boolean => {
    try {
      gl!.activeTexture(gl!.TEXTURE0 + i);
      gl!.bindTexture(gl!.TEXTURE_2D, tex[i]!);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, img);
      return gl!.getError() === gl!.NO_ERROR && !gl!.isContextLost();
    } catch {
      return false;
    }
  };
  let uvSet = false;
  const draw = (m: MeshBuf, mix: number, live: boolean) => {
    gl!.viewport(0, 0, cv.width, cv.height);
    gl!.clearColor(live ? 1 : 0, live ? 1 : 0, live ? 1 : 0, 1);
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
    const put = (b: WebGLBuffer, a: Float32Array) => {
      gl!.bindBuffer(gl!.ARRAY_BUFFER, b);
      gl!.bufferData(gl!.ARRAY_BUFFER, a, gl!.DYNAMIC_DRAW);
    };
    put(bPos, m.pos);
    if (!uvSet) {
      put(bUv, m.uv);
      uvSet = true;
    }
    put(bShade, m.shade);
    put(bBack, m.back);
    gl!.uniform1f(uMix, mix);
    gl!.uniform1f(uLive, live ? 1 : 0);
    gl!.drawArrays(gl!.TRIANGLES, 0, m.shade.length);
    return !gl!.isContextLost();
  };
  return { upload, draw, lost: () => gl!.isContextLost() };
}

const cover = (home: string) => {
  const cv = document.createElement("canvas");
  cv.className = "boss-crumple";
  cv.setAttribute("aria-hidden", "true");
  cv.dataset.boss = home;
  // (Its own styles, inline, as the other covers': over everything, taking every tap; hidden until its first frame is drawn.)
  cv.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483000;touch-action:none;pointer-events:auto;background:#000;visibility:hidden";
  document.body.append(cv);
  return cv;
};
const wait = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
/** The open waits at most this long (ms) for the page's thread to be idle. */
const IDLE_MS = 700;
/** Resolves once the page's thread is idle (or after `IDLE_MS`; at once where there's no idle callback). */
const idle = () => new Promise<void>((ok) => ("requestIdleCallback" in window ? requestIdleCallback(() => ok(), { timeout: IDLE_MS }) : ok()));
const cue = (intro: LoadedIntro, name: string) => {
  const s = intro.def.cues[name];
  if (s) play(s as SoundName);
};
/** Each frame's time and phase, for the frame-rate check (test switches on), from the crumple's start to its end. */
const frameLog = (): { t: number; phase: string; js: number }[] | null => {
  if (!testSwitchesAllowed()) return null;
  const w = window as unknown as { __crumpleFrames?: { t: number; phase: string; js: number }[] };
  return (w.__crumpleFrames = []);
};

/** The fallback: a cross-fade through black (to black over `fadeMs`, held, up from black over `fadeMs` once the match shows). */
function startFade(intro: LoadedIntro, cv: HTMLCanvasElement, why: string): Storm {
  cv.dataset.mode = "fade";
  cv.dataset.why = why;
  cv.style.transition = `opacity ${T.fadeMs}ms linear`;
  cv.style.opacity = "0";
  cv.style.visibility = "visible";
  cv.dataset.phase = "fade-in";
  void cv.offsetWidth;
  cv.style.opacity = "1";
  cue(intro, "crumple");
  const covered = wait(T.fadeMs).then(() => {
    cv.dataset.phase = "covered";
    cv.dataset.covered = "1";
  });
  const out = async () => {
    await covered;
    cv.dataset.phase = "fade-out";
    cv.style.opacity = "0";
    cue(intro, "open");
    await wait(T.fadeMs);
    cv.remove();
  };
  return { covered, out };
}

/** Starts Folio's crumple (intro.ts startTransition): see the file's notes. */
export function startCrumple(intro: LoadedIntro): Storm {
  const W = innerWidth;
  const H = innerHeight;
  const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
  const cv = cover(intro.home);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const r = glOn(cv);
  if (!r) {
    ahead = null;
    return startFade(intro, cv, "no-webgl");
  }
  cv.dataset.mode = "gl";
  const mesh = meshBuf(W, H);
  const opts = { ...CRUMPLE_DEFAULTS, cols: mesh.cols, rows: mesh.rows };
  const log = frameLog();
  // ---- The room's picture: its DOM layer (taken ahead as the quiet line went, else now), its canvas read now.
  const layer = ahead ?? domLayer(W, H, ROOM_DOM_MS);
  ahead = null;
  let readyAt = Infinity;
  /** When the match showed under the cover (out()), or -1: its picture has `maxHoldMs` from then. */
  let outAt = -1;
  let failed = "";
  let t0 = 0;
  let raf = 0;
  let done!: () => void;
  const finished = new Promise<void>((ok) => (done = ok));
  let gone = false;
  const end = () => {
    if (gone) return;
    gone = true;
    cancelAnimationFrame(raf);
    cv.remove();
    done();
  };
  // (The fail path: the ball (or the flat still) fades to black, then up from black onto the live match screen once out() is called.)
  let failFrom = -1;
  const fail = (why: string) => {
    if (failed) return;
    failed = why;
    cv.dataset.why = why;
    failFrom = performance.now();
  };
  const frame = (now: number) => {
    if (gone) return;
    const t = now - t0;
    if (failed) {
      // Through black: the last drawn frame dims to black over `fadeMs` (held there until out() fades the cover off the match).
      const u = Math.min(1, (now - failFrom) / T.fadeMs);
      cv.style.filter = `brightness(${(1 - u).toFixed(3)})`;
      if (u >= 1 && cv.dataset.phase !== "fade-out") cv.dataset.phase = "covered";
      if (u < 1) raf = requestAnimationFrame(frame);
      return;
    }
    const b = crumpleBeat(t, readyAt === Infinity ? Infinity : readyAt - t0, T, outAt >= 0 && now - outAt > T.maxHoldMs);
    if (b.phase === "fail") {
      fail("match-late");
      raf = requestAnimationFrame(frame);
      return;
    }
    // (Waiting as a ball for the match's picture: nothing moves but the ball's slow turn; drawn as any frame.)
    const f0 = log ? performance.now() : 0;
    if (cv.dataset.phase !== b.phase) {
      cv.dataset.phase = b.phase;
      // (Every phase it went through, in order, for tests: a slow test's looks can miss a short one.)
      cv.dataset.phases = `${cv.dataset.phases ?? ""} ${b.phase}`.trim();
      if (b.phase === "open") cue(intro, "open");
      if (b.phase === "linger") cv.style.mixBlendMode = "multiply";
    }
    if (b.phase === "done") {
      end();
      return;
    }
    const live = b.phase === "linger";
    fillMesh(mesh, b.p, { ...opts, turn: b.turn }, live ? lingerShadeP(b.linger) : b.p);
    if (!r.draw(mesh, b.mix, live)) fail("context-lost");
    if (log) log.push({ t: now, phase: b.phase, js: performance.now() - f0 });
    raf = requestAnimationFrame(frame);
  };
  const covered = layer.img.then((img) => {
    const still = compose(W, H, dpr, layer.big, img);
    cv.dataset.dom = img ? "1" : "0";
    if (!r.upload(0, still) || !r.upload(1, still)) {
      // (The room's picture didn't go on: the plain fade.)
      cancelAnimationFrame(raf);
      cv.remove();
      const f = startFade(intro, cover(intro.home), "texture");
      fallback = f;
      return f.covered;
    }
    // Its first frame is the still, flat: just as the screen was. Then it crumples.
    t0 = performance.now();
    fillMesh(mesh, 0, opts);
    r.draw(mesh, 0, false);
    cv.style.visibility = "visible";
    cv.dataset.phase = cv.dataset.phases = "crumple";
    cue(intro, "crumple");
    raf = requestAnimationFrame(frame);
    // (Covered once it's a ball: the battle starts loading then, not during the crumple, so the crumple has the page's thread to itself.
    // By the clock, so a hidden tab still gets to the battle.)
    return wait(T.crumpleMs).then(() => {
      cv.dataset.covered = "1";
    });
  });
  let fallback: Storm | null = null;
  const out = async () => {
    await covered;
    if (fallback) return fallback.out();
    outAt = performance.now();
    const last = setTimeout(end, LAST_MS);
    // The match screen, shown under the cover now: taken as the room's was, put on the ball.
    try {
      if (failed) throw new Error(failed);
      const snap = await snapPage(innerWidth, innerHeight, dpr, MATCH_DOM_MS);
      if (!failed && r.upload(1, snap.canvas)) {
        cv.dataset.match = snap.dom ? "1" : "0";
        // (The open waits, as a ball, for the page's thread to have room (the battle starting under the cover), at most `IDLE_MS`: so it
        // opens smoothly.)
        await idle();
        readyAt = performance.now();
      } else fail("match-texture");
    } catch {
      fail(failed || "match-snap");
    }
    if (failed) {
      // (Through black onto the live match: wait for the fade to black, then fade the cover off.)
      await wait(Math.max(0, failFrom + T.fadeMs - performance.now()));
      cv.dataset.phase = "fade-out";
      cv.style.transition = `opacity ${T.fadeMs}ms linear`;
      cv.style.opacity = "0";
      await wait(T.fadeMs);
      end();
    }
    await finished;
    clearTimeout(last);
  };
  return { covered, out };
}
