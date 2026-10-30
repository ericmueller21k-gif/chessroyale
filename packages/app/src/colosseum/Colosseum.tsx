/**
 * Inside the Colosseum, the first look (Eric, Oct 30; docs/decisions/2026-10-30-colosseum-look.md, docs/areas/colosseum.md):
 * the arena from a seat in the stands (one of eight; "Change seat" picks another at random), or a player's view
 * (`?view=white` / `?view=black`), two town bots playing 3+2 on the giant board, and the overlay over it, as Eric's mockup:
 * each player's card (portrait, name, ELO, the pieces taken, the clock), the middle (the turn, the viewers, the last moves),
 * the flat board with its eval bar (this device's Stockfish, a low depth, only while this screen is open), the chat's box
 * (empty for now), Exit, Change seat and the gear.
 *
 * The arena is WebGL 2 (arena-gl.ts): three draw calls a frame, nothing allocated a frame, the crowd still but for its jump
 * (a queen taken). No WebGL 2: a still of the stands in its place, everything else the same.
 *
 * Test hooks (e2e, with the test switches on): `window.__colosseum` (`state()`, `seat(i)`, `flag()`, `jump()`, `sample()`),
 * and `?fast` makes the bots move at once and the next game come quickly.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Board } from "../components/Board.tsx";
import { Avatar } from "../components/Items.tsx";
import { MatchMenu, SwitchRow } from "../components/MatchMenu.tsx";
import { crowdAnimations, onPrefsChange } from "../prefs.ts";
import { testParams, testSwitchesAllowed } from "../test-switches.ts";
import { COLISEUM_PLACE, isSprite } from "../town/world.ts";
import { BLACK_VIEW, SEAT_VIEWS, VIEWS, otherSeat, seats, turnLimits, viewFor } from "./arena.ts";
import { ArenaGL, SLIDE_S, buildCrowd } from "./arena-gl.ts";
import { PIECE_URL, crowdArt, propArt, sceneArt } from "./art.ts";
import { floorEngine, type FloorEngine } from "./floor-engine.ts";
import { FLOOR, FloorMatch, clockText, evalText, resultText, thinkMs, viewersText, type FloorState } from "./match.ts";
import still from "./still.jpg";
import "./colosseum.css";

/** Ambient crowd noise (no sound yet: the switch only), remembered on this device. */
const AMBIENT_KEY = "colosseum-ambient";
const ambientOn = () => {
  try {
    return localStorage.getItem(AMBIENT_KEY) !== "off";
  } catch {
    return true;
  }
};

/** The pieces' order in a taken row, the pawns first (as the mockup's cards). */
const ORDER = "pnbrq";
/** The computer layout (colosseum.css): the arena under the overlay. */
const WIDE = "(min-width: 900px) and (min-height: 600px)";
/** A drag's turn: radians per CSS pixel. */
const TURN_PER_PX = 0.0025;

type Hooks = {
  __colosseum?: {
    state: () => object;
    seat: (i: number) => void;
    flag: () => void;
    jump: () => void;
    sample: () => { sky: number; hash: number } | null;
  };
};

export function ColosseumScreen({ onExit }: { onExit: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fpsEl = useRef<HTMLDivElement>(null);
  const [gl, setGl] = useState<boolean | null>(null);
  const [view, setView] = useState(() => viewFor(new URLSearchParams(location.search).get("view"), Math.floor(Math.random() * SEAT_VIEWS)));
  const viewRef = useRef(view);
  viewRef.current = view;
  const turn = useRef({ yaw: 0, pitch: 0 });
  const jumpAt = useRef(-1e9);
  const arenaRef = useRef<ArenaGL | null>(null);
  const t0 = useRef(performance.now());
  const [, setTick] = useState(0);
  const match = useRef<FloorMatch | null>(null);
  const [portraits, setPortraits] = useState<Map<number, string>>(new Map());
  const [viewers, setViewers] = useState(() => seats().length);
  const [ambient, setAmbient] = useState(ambientOn);
  const [anim, setAnim] = useState(crowdAnimations);
  const animRef = useRef(anim);
  animRef.current = anim;
  useEffect(() => onPrefsChange(() => setAnim(crowdAnimations())), []);

  // The arena: WebGL 2, its art, its frame loop, the drag to turn.
  useLayoutEffect(() => {
    const cv = canvas.current!;
    const el = box.current!;
    const arena = ArenaGL.create(cv);
    arenaRef.current = arena;
    setGl(!!arena);
    if (!arena) return;
    let live = true;
    arena.setScene(sceneArt());
    void propArt().then(({ canvas: c, statueFoot }) => {
      if (!live) return;
      arena.setProps(c, statueFoot);
      arena.setPieces(match.current?.state.pieces ?? [], -1e9);
    });
    void crowdArt().then((art) => {
      if (!live) return;
      arena.setCrowd(art, buildCrowd(art));
      setViewers(arena.crowdCount);
      setPortraits(art.portraits);
    });
    // Its size, and on a computer (the overlay over the arena) the lens's shift: the board in the middle of what the overlay leaves.
    const wide = matchMedia(WIDE);
    const side = el.parentElement!.querySelector<HTMLElement>(".col-side");
    const top = el.parentElement!.querySelector<HTMLElement>(".col-top");
    const fit = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const W = Math.max(1, el.clientWidth);
      const H = Math.max(1, el.clientHeight);
      arena.size(Math.max(1, Math.round(W * dpr)), Math.max(1, Math.round(H * dpr)));
      arena.shift.x = wide.matches && side ? (side.offsetWidth + 10) / W : 0;
      arena.shift.y = wide.matches && top ? (top.offsetHeight + 10) / H : 0;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    // The fps pill (`?fps`): plain counters, the text set twice a second.
    const showFps = new URLSearchParams(location.search).has("fps");
    let n = 0;
    let at = 0;
    let raf = 0;
    const frame = (now: number) => {
      const t = turn.current;
      const jump = reduced.matches || !animRef.current ? 99 : (now - jumpAt.current) / 1000;
      arena.draw(VIEWS[viewRef.current]!, t.yaw, t.pitch, (now - t0.current) / 1000, jump);
      if (showFps && fpsEl.current) {
        n++;
        if (!at) at = now;
        else if (now - at >= 500) {
          fpsEl.current.textContent = `${Math.round((n * 1000) / (now - at))} fps · ${arena.drawCalls} draws`;
          n = 0;
          at = now;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVis);
    // Drag (or swipe) to turn a little: never so far the board leaves the screen (turnLimits).
    const lim = { yaw: 0, pitch: 0 };
    let drag: { id: number; x: number; y: number; yaw: number; pitch: number } | null = null;
    const down = (e: PointerEvent) => {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: turn.current.yaw, pitch: turn.current.pitch };
      cv.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      turnLimits(VIEWS[viewRef.current]!, el.clientWidth / Math.max(1, el.clientHeight), lim);
      const c = (v: number, m: number) => Math.max(-m, Math.min(m, v));
      turn.current.yaw = c(drag.yaw - (e.clientX - drag.x) * TURN_PER_PX, lim.yaw);
      turn.current.pitch = c(drag.pitch + (e.clientY - drag.y) * TURN_PER_PX, lim.pitch);
    };
    const up = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null;
    };
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      arena.dispose();
      arenaRef.current = null;
    };
  }, []);

  // The game on the floor: this screen's Stockfish, games one after another till the screen closes.
  useEffect(() => {
    let engine: FloorEngine | null = null;
    let live = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const fast = () => testParams().has("fast");
    const m = new FloorMatch(
      {
        move: async (fen, rating, ms) => {
          if (engine) return engine.move(fen, rating, ms);
          const { legalMoves } = await import("@chessroyale/chess");
          const all = legalMoves(fen);
          return all[Math.floor(Math.random() * all.length)]!;
        },
        evaluate: (fen) => (engine ? engine.evaluate(fen) : Promise.resolve(null)),
        now: () => performance.now(),
        random: Math.random,
        wait: (ms) =>
          new Promise((ok) => {
            if (!live) return ok(false);
            const t = setTimeout(() => {
              timers.delete(t);
              ok(live);
            }, ms);
            timers.add(t);
          }),
        think: (ply, clock) => (fast() ? 30 : thinkMs(ply, clock, Math.random())),
        nextMs: () => (fast() ? 1200 : FLOOR.nextMs),
      },
      (s) => {
        const a = arenaRef.current;
        const now = (performance.now() - t0.current) / 1000;
        if (a) a.setPieces(s.pieces, animRef.current ? now : now - SLIDE_S);
        if (s.queenTaken) {
          jumpAt.current = performance.now() + SLIDE_S * 1000;
          s.queenTaken = false;
        }
        setTick((n) => n + 1);
      },
    );
    match.current = m;
    void floorEngine().then((e) => {
      if (!live) return e?.close();
      engine = e;
      void m.run();
    });
    // The clocks: drawn again five times a second (the overlay only; the arena's frame loop never sees them).
    const clock = setInterval(() => live && setTick((n) => n + 1), 200);
    return () => {
      live = false;
      m.stop();
      clearInterval(clock);
      for (const t of timers) clearTimeout(t);
      engine?.close();
      match.current = null;
    };
  }, []);

  // Test hooks.
  useEffect(() => {
    if (!testSwitchesAllowed()) return;
    const w = window as unknown as Hooks;
    w.__colosseum = {
      state: () => {
        const s = match.current?.state;
        return {
          view: viewRef.current,
          backend: arenaRef.current ? "webgl" : "still",
          drawCalls: arenaRef.current?.drawCalls ?? 0,
          crowd: arenaRef.current?.crowdCount ?? 0,
          game: s?.game ?? 0,
          plies: s?.moves.length ?? 0,
          status: s?.status ?? "waiting",
          fen: s?.fen ?? "",
        };
      },
      seat: (i) => setView(i),
      flag: () => match.current?.flag(),
      jump: () => (jumpAt.current = performance.now()),
      sample: () => {
        const a = arenaRef.current;
        if (!a) return null;
        const g = a.gl;
        a.draw(VIEWS[viewRef.current]!, turn.current.yaw, turn.current.pitch, (performance.now() - t0.current) / 1000, 99);
        const W = g.drawingBufferWidth;
        const H = g.drawingBufferHeight;
        const px = new Uint8Array(4);
        let sky = 0;
        let hash = 0;
        let n = 0;
        for (let j = 0; j < 18; j++)
          for (let i = 0; i < 32; i++) {
            g.readPixels(Math.floor(((i + 0.5) / 32) * W), Math.floor(((j + 0.5) / 18) * H), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
            n++;
            if (Math.abs(px[0]! - 140) < 6 && Math.abs(px[1]! - 179) < 6 && Math.abs(px[2]! - 219) < 6) sky++;
            hash = (Math.imul(hash, 31) + (px[0]! >> 4) * 256 + (px[1]! >> 4) * 16 + (px[2]! >> 4)) | 0;
          }
        return { sky: sky / n, hash };
      },
    };
    return () => void delete w.__colosseum;
  }, []);

  const s = match.current?.state ?? null;
  const m = match.current;
  const changeSeat = () => {
    turn.current.yaw = turn.current.pitch = 0;
    setView((v) => otherSeat(v, Math.random()));
  };
  const card = (side: "w" | "b") => {
    if (!s || !m) return <div class={`col-card col-${side}`} />;
    const i = side === "w" ? s.white : s.black;
    const b = m.bot(i);
    const pic = portraits.get(i);
    const took = [...s.took[side]].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y));
    const toMove = s.status === "playing" && s.fen.split(" ")[1] === side;
    return (
      <div class={`col-card col-${side}${toMove ? " on" : ""}`} data-side={side}>
        <div class="col-pic" aria-hidden="true">
          {isSprite(b.look) ? pic && <img src={pic} alt="" draggable={false} /> : <Avatar look={b.look.wear ?? undefined} side="w" />}
        </div>
        <div class="col-who">
          <div class="col-name">
            {b.name}
            <span class="col-bot"> (bot)</span>
          </div>
          <div class="col-elo">ELO {b.rating}</div>
          <div class="col-took" aria-label="Pieces taken">
            {took.map((k, j) => (
              <img key={j} src={PIECE_URL[(side === "w" ? "b" : "w") + k]} alt="" draggable={false} />
            ))}
          </div>
        </div>
        <div class="col-clock" data-clock={side}>
          {clockText(m.clockNow(side))}
        </div>
      </div>
    );
  };
  // The last four moves, each row a move's number, White's and Black's; the move just played lit.
  const rows = (() => {
    const out: { n: number; w: string; b: string; on: 0 | 1 | 2 }[] = [];
    if (!s) return out;
    const total = Math.ceil(s.sans.length / 2);
    for (let r = Math.max(0, total - 4); r < total; r++) {
      const last = s.sans.length - 1;
      out.push({ n: r + 1, w: s.sans[r * 2] ?? "", b: s.sans[r * 2 + 1] ?? "", on: last === r * 2 ? 1 : last === r * 2 + 1 ? 2 : 0 });
    }
    return out;
  })();
  const turnN = s ? Math.max(1, Math.ceil((s.sans.length + 1) / 2)) : 1;
  const white = s?.eval ?? 0.5;
  const evalNow = s ? evalText(s.eval, s.mate) : "";
  const lastMove = s?.moves.length ? s.moves[s.moves.length - 1]! : null;
  const status = !s ? "" : s.status === "over" ? `${resultText(s)}. Next game soon.` : `Game ${s.game} · 3+2`;

  return (
    <div class="col-screen">
      <header class="col-bar">
        <button type="button" class="col-exit" onClick={onExit}>
          <span aria-hidden="true">‹</span> Exit
        </button>
        <h1>{COLISEUM_PLACE.name}</h1>
        <button type="button" class="col-seat" onClick={changeSeat}>
          Change seat
        </button>
        <MatchMenu
          exit={null}
          extra={
            <SwitchRow
              icon="📣"
              label="Ambient crowd noise"
              on={ambient}
              onClick={() => {
                const on = !ambient;
                setAmbient(on);
                try {
                  localStorage.setItem(AMBIENT_KEY, on ? "on" : "off");
                } catch {
                  // (Not remembered: private mode.)
                }
              }}
            />
          }
        />
      </header>
      <div class="col-stage">
        <div class="col-arena" ref={box}>
          <canvas class="col-canvas" ref={canvas} aria-label={COLISEUM_PLACE.name} data-backend={gl === false ? "still" : "webgl"} />
          {gl === false && <img class="col-still" src={still} alt="" draggable={false} />}
          <div class="col-fps" ref={fpsEl} aria-hidden="true" />
        </div>
        <div class="col-top">
          {card("w")}
          <div class="col-mid">
            <div class="col-turn">Turn {turnN}</div>
            <div class="col-viewers" aria-label={`${viewers} viewers`}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2" />
                <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              {viewersText(viewers)}
            </div>
          </div>
          <ol class="col-moves" aria-label="Last moves">
            {[0, 1, 2, 3].map((k) => {
              const r = rows[k];
              return (
                <li key={k}>
                  <span class="col-n">{r ? `${r.n}.` : ""}</span>
                  <span class={r?.on === 1 ? "on" : ""}>{r?.w ?? ""}</span>
                  <span class={r?.on === 2 ? "on" : ""}>{r ? r.b || (r.on === 1 ? "…" : "") : ""}</span>
                </li>
              );
            })}
          </ol>
          {card("b")}
        </div>
        <div class="col-side">
          <div class="col-boardrow">
            <div class="col-eval" aria-label={`Eval ${evalNow}`}>
              <div class="col-eval-w" style={{ height: `${Math.round(white * 1000) / 10}%` }} />
              <span class="col-eval-n">{evalNow}</span>
            </div>
            <div class="col-board">
              <Board fen={s?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"} orientation={view === BLACK_VIEW ? "black" : "white"} lastMove={lastMove} small />
            </div>
          </div>
          <div class="col-status">{status}</div>
          <section class="col-chat" aria-label="Chat">
            <h2>Chat</h2>
            <p>Coming soon</p>
          </section>
        </div>
      </div>
    </div>
  );
}
