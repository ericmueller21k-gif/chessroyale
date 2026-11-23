import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { TIMBER_ANIM, costOf, withPiece, withoutPiece, workshopAt, workshopClosed, type WorkshopView } from "@chessroyale/chess";
import { WORKSHOP_PIECES, type WorkshopPiece } from "@chessroyale/core";
import { pickLine } from "../characters/boss-beats.ts";
import { bossKit } from "../characters/kits.ts";
import { renderFrame } from "../characters/sprite.ts";
import { sidekickBeaver } from "../characters/sidekicks/timber.ts";
import type { BossView } from "../game.ts";
import { gardenNow, realMs } from "../garden-clock.ts";
import { figureBusy, playInPlace } from "./BossCharacter.tsx";
import { onSquare, type BoardLayerProps, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Timber's powers on screen (his rules: packages/chess/src/bosses/timber.ts; docs/decisions/2026-11-01-timber.md), all from the
 * battle's shared view and the battle's clock (garden-clock.ts: the server's online, the page's visible time solo), so everyone
 * online sees the same workshop. Nothing he draws moves the board, the dock or the bar (Eric's rule: nothing shifts).
 * - **The workshop strip** (`WorkshopStrip`, the boss bar's prop slot, right of his bars under the status, the same place on a
 *   phone and a computer): his five pieces in a row, pawn, knight, bishop, rook, queen, each with its scraps so far and its cost
 *   ("1/2") and a thin bar filling toward it; his woodpecker foreman at its end. Read from the real-time meter (workshopAt) on a
 *   timer that waits for the next scrap's time, never per frame. A scrap landing: its piece's slot bumps, the foreman pecks,
 *   and Timber catches it and hammers it in where he stands (`scrap`, played in place when he isn't busy). A finished piece
 *   glows until it drops. After his last drop it's closed: greyed, "Closed".
 * - **A drop** (`build`, as your turn after his begins): a plank off his back (`build`), and at its `drop` cue a plank falls onto
 *   the square, a puff of sawdust, his piece on it (the board leaves it off until then: `timberFen`). The dock says what landed.
 * - **The Gnaw** (`gnaw`, as your turn after his begins, after the RAGE warning a turn before): banner GNAW!; his chomps (`gnaw`),
 *   and his buck teeth gnawing their way across the board from his side to your pawn, which is gone at the last chomp in a burst
 *   of splinters (the board keeps it on until then: `timberFen`). None of your pawns left: "Nothing to gnaw."
 */

type Orientation = "white" | "black";

/** Every banner's window in its moment's beats (POWER_BANNERS: [0, 1500]): the Gnaw comes after it. */
const BANNER = 1500;
/** His moments' beats (ms into each moment's own clock). */
export const TIMBER_BEATS = {
  /** A drop: his `build`, the plank landing at its `drop` cue. */
  build: { dropAt: TIMBER_ANIM.buildDropAt, fallMs: 320 },
  /** The Gnaw: after its banner his chomps; his teeth cross the board until the last chomp, when the pawn is gone. */
  gnaw: { castAt: BANNER, eatAt: BANNER + TIMBER_ANIM.gnawEatAt, splinterMs: 520 },
} as const;
const B = TIMBER_BEATS;

const PIECE_NAME: Record<WorkshopPiece, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };
/** The words under his banner and in the dock: what each means for you. */
export const TIMBER_WORDS = {
  gnaw: `He ate a pawn: scraps for his workshop`,
  gnawNone: "None of your pawns left to gnaw",
} as const;

// ---------------- The board under his moments ----------------

const drawnAt = (sq: string, o: Orientation) => {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  return { col: o === "white" ? f : 7 - f, row: o === "white" ? 7 - r : r };
};

/**
 * The position the board shows during his moments: a piece he dropped isn't on its square until his `build`'s `drop` cue, and a
 * pawn he gnaws is on its square until his last chomp. Null with neither among `moments` (the plain position: Boss.tsx).
 */
export function timberFen(boss: Pick<BossView, "id" | "crowdSide" | "powers">, moments: readonly Moment[], now: number, fen: string): { fen: string } | null {
  if (boss.id !== "timber") return null;
  let out = fen;
  const build = moments.find((m) => m.kind === "build");
  if (build?.square && now < build.at + B.build.dropAt) out = withoutPiece(out, build.square);
  const gnaw = moments.find((m) => m.kind === "gnaw");
  if (gnaw?.square && now < gnaw.at + B.gnaw.eatAt) out = withPiece(out, gnaw.square, { color: boss.crowdSide, type: "p" });
  return out === fen ? null : { fen: out };
}

/** His teeth on their way across the board, the plank falling, the sawdust and the splinters: CSS, timed from each moment's start. */
function TimberLayer({ moments, now, orientation }: BoardLayerProps) {
  const out: preact.JSX.Element[] = [];
  const gnaw = moments.find((m) => m.kind === "gnaw");
  if (gnaw?.square && now >= gnaw.at + B.gnaw.castAt && now < gnaw.at + B.gnaw.eatAt + B.gnaw.splinterMs) {
    const { col, row } = drawnAt(gnaw.square, orientation);
    // (From the board's edge on his side, above or below the pawn's file, to the pawn: his side is the top as you see it.)
    const start = -1;
    const travel = B.gnaw.eatAt - B.gnaw.castAt;
    const style = { "--x0": String(col / 8), "--y0": String(start / 8), "--x1": String(col / 8), "--y1": String(row / 8), animationDuration: `${travel}ms`, animationDelay: `${gnaw.at + B.gnaw.castAt - now}ms` };
    if (now < gnaw.at + B.gnaw.eatAt) out.push(<span key={`teeth-${gnaw.key}`} class="tb-teeth" data-square={gnaw.square} style={style} />);
    else out.push(<span key={`splinters-${gnaw.key}`} class="tb-splinters" data-square={gnaw.square} style={{ ...onSquare(gnaw.square, orientation), animationDelay: `${gnaw.at + B.gnaw.eatAt - now}ms` }} />);
  }
  const build = moments.find((m) => m.kind === "build");
  if (build?.square && now >= build.at + B.build.dropAt - B.build.fallMs && now < build.at + B.build.dropAt + 600) {
    const style = { ...onSquare(build.square, orientation), animationDelay: `${build.at + B.build.dropAt - B.build.fallMs - now}ms` };
    out.push(<span key={`plank-${build.key}`} class="tb-plank" data-square={build.square} style={style} />);
  }
  return <div class="tb-layer">{out}</div>;
}

// ---------------- The workshop strip ----------------

/** The woodpecker foreman's still (his idle's first frame), drawn once a page. */
let foremanImage: ImageData | null = null;
function Foreman({ peck }: { peck: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    if (!foremanImage) {
      const r = renderFrame(sidekickBeaver, sidekickBeaver.anims.idle!.frames[0]!);
      foremanImage = new ImageData(new Uint8ClampedArray(r.data), r.w, r.h);
    }
    g.putImageData(foremanImage, 0, 0);
  }, []);
  // (Each scrap that lands, a peck: the class's animation plays again on a new key.)
  return (
    <span class="ws-foreman" aria-hidden="true">
      <canvas key={peck} ref={cv} class={peck ? "ws-peck" : ""} width={sidekickBeaver.w} height={sidekickBeaver.h} />
    </span>
  );
}

/** When this device last saw each slot's count rise (its bump plays then), by battle. */
const bumped = new Map<string, { counts: number[]; at: number[]; pecks: number }>();

/**
 * The workshop's reading now: each piece's scraps (workshopAt on the battle's clock), and when the next scrap lands (null:
 * closed). `view`: the battle's.
 */
export function workshopReading(view: WorkshopView, now: number): { prog: number[]; next: number | null; closed: boolean } {
  const r = workshopAt(view, now);
  return { prog: r.prog, next: r.next, closed: workshopClosed(view) };
}

/**
 * The workshop strip: five slots and the foreman, in the boss bar's prop slot. Drawn again only when a scrap lands (a timer
 * set for the next one's time) or the battle's view changes; nothing per frame.
 */
export function WorkshopStrip({ boss }: { boss: BossView }) {
  const w = boss.powers?.workshop ?? null;
  const [, bump] = useState(0);
  const key = `${boss.id}:${boss.startMove}:${boss.board.generation}`;
  const r = w ? workshopReading(w, gardenNow()) : null;
  const live = !!r && r.next !== null && !boss.result;
  useEffect(() => {
    if (!w || !live) return;
    let timer = 0;
    const step = () => {
      clearTimeout(timer);
      const now = gardenNow();
      const next = workshopAt(w, now).next;
      bump((n) => n + 1);
      if (next !== null) timer = window.setTimeout(step, Math.max(0, realMs(next - now)) + 40);
    };
    const first = workshopAt(w, gardenNow()).next;
    if (first !== null) timer = window.setTimeout(step, Math.max(0, realMs(first - gardenNow())) + 40);
    const visible = () => document.visibilityState === "visible" && step();
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [w?.since, w?.n, w?.drops, live, key]);
  // A slot whose count rose since this device last looked: its bump, the foreman's peck, and Timber's hammer where he stands.
  const seen = bumped.get(key);
  const nowWall = Date.now();
  let landed = false;
  if (r) {
    if (!seen) bumped.set(key, { counts: [...r.prog], at: r.prog.map(() => 0), pecks: 0 });
    else {
      r.prog.forEach((c, k) => {
        if (c > seen.counts[k]!) {
          seen.at[k] = nowWall;
          landed = true;
        }
        seen.counts[k] = c;
      });
      if (landed) seen.pecks++;
    }
    if (bumped.size > 8) bumped.delete(bumped.keys().next().value!);
  }
  useEffect(() => {
    if (!landed || document.visibilityState === "hidden") return;
    const kit = bossKit(boss.name);
    if (kit && !figureBusy(kit.ch)) playInPlace(`${key}:scrap:${bumped.get(key)?.pecks ?? 0}`, ["scrap"]);
  });
  if (!w || !r) return null;
  const his = boss.crowdSide === "w" ? "black" : "white";
  const s = bumped.get(key)!;
  return (
    <span class={`ws-strip${r.closed ? " closed" : ""}`} role="group" aria-label={r.closed ? "Timber's workshop, closed" : "Timber's workshop"} data-prog={r.prog.join(",")} data-drops={w.drops} data-closed={r.closed ? "1" : "0"}>
      {WORKSHOP_PIECES.map((piece, k) => {
        const cost = costOf(piece);
        const n = Math.min(cost, r.prog[k]!);
        const done = n >= cost;
        const fresh = nowWall - (s.at[k] ?? 0) < 700;
        return (
          <span key={piece} class={`ws-slot${done ? " done" : ""}`} data-piece={piece} aria-label={`${PIECE_NAME[piece]} ${n} of ${cost}`}>
            <span key={fresh ? `b${s.at[k]}` : "rest"} class={`ws-piece hb-pieces${fresh ? " ws-bump" : ""}`} aria-hidden="true">
              <piece class={`${his} ${PIECE_NAME[piece]}`} />
            </span>
            <span class="ws-meta" aria-hidden="true">
              <span class="ws-bar">
                <i style={{ width: `${Math.round((100 * n) / cost)}%` }} />
              </span>
              <b class="ws-count">
                {n}/{cost}
              </b>
            </span>
          </span>
        );
      })}
      <Foreman peck={s.pecks} />
      {r.closed && <span class="ws-closed">Closed</span>}
    </span>
  );
}

// ---------------- His moments ----------------

function gnawMoment({ moment, banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-gnaw" data-square={moment.square ?? ""}>
      {banner("GNAW!", moment.square ? TIMBER_WORDS.gnaw : TIMBER_WORDS.gnawNone, "timber")}
      {cast("chomp", B.gnaw.castAt + 240)}
    </div>
  );
}

function buildMoment({ moment, cast }: MomentProps) {
  return <div class="power-moment pm-build" data-square={moment.square ?? ""}>{cast("drop", B.build.dropAt)}</div>;
}

const MOMENTS: Record<"build" | "gnaw", MomentUi> = {
  // (None of your pawns to eat: his grumble instead.)
  gnaw: { order: 2, kit: "ultimate", lineAt: B.gnaw.castAt, view: gnawMoment, line: (kit, m) => (kit && !(m as Moment).square ? pickLine(kit, "gnawNone", m.key) : null) ?? (kit ? pickLine(kit, "ultimate", m.key) : null) },
  build: { order: 3, kit: "power", lineAt: B.build.dropAt, view: buildMoment },
};

export const TIMBER_UI = {
  id: "timber",
  // (His Gnaw comes after his move on his turn after the warning, as Babur's hoops.)
  ultimate: { name: "Gnaw", when: "After his next move" },
  moments: MOMENTS,
  // His workshop, in the boss bar's free room right of his bars.
  barProp: ({ boss }) => <WorkshopStrip boss={boss} />,
  board: (p) => ({ over: <TimberLayer {...p} /> }),
} satisfies BossUi;
