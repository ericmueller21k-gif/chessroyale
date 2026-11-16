import { ALFIL_BEATS, POWER_FX, landedEarlyMs, withPiece, withoutPiece } from "@chessroyale/chess";
import { bossKit } from "../characters/kits.ts";
import { EFFECTS } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { BoardEffects, prewarm, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { fireShadowItem } from "./Grex.tsx";
import { PIECE_WORD, SoundAt, onSquare, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Alfil's powers on screen (his rules: packages/chess/src/bosses/alfil.ts; the beats: ALFIL_BEATS, timed by his
 * animations' cues), all from the shared state and each moment's start, so everyone online sees the same thing:
 * - **Tusks, the cast** (its own screen at the start of his turn): "TUSKS!", then his trunk levels the ankus at the
 *   board and his two marked pawns glow (a gold glow under each), and keep glowing until the fusion or the counter.
 * - **The fusion** (his move: it plays as the crowd's turn begins): the two pawns lift off toward the board's center,
 *   meet in a ball of white light, and the elephant (a bishop drawn with its own piece art: the board's `elephants`)
 *   drops onto its square. No banner: the dock says "Alfil spent his move on the fusion."
 * - **The Mammoth Slam** (its own screen at the start of his turn): "MAMMOTH SLAM!", he leaps and crashes down, the
 *   board shakes, the crowd's pieces fly up off their squares, and a shadow (Jefferson's, reused as is) shows on each
 *   square one will land on, a size bigger each turn.
 * - **The landing** (as a crowd turn begins, or early, while he thinks): each piece drops out of the sky onto its own
 *   square, its shadow at its biggest until then, with a soft thump; one whose square was taken slides on to the square
 *   it landed on.
 * The board shows the position as it was until each piece goes, and each new piece only once it has landed (alfilFen).
 */

type Orientation = "white" | "black";
type Pt = { x: number; y: number };
const B = ALFIL_BEATS;

/** A square's middle in % of the board. */
const centreOf = (square: string, o: Orientation): Pt => {
  const { x, y } = squareXY(square, o);
  return { x: x / 8, y: y / 8 };
};
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
const r2 = (v: number) => Math.round(v * 100) / 100;
const COLOUR = { w: "white", b: "black" } as const;
const pieceCode = (color: "w" | "b", type: string) => `${COLOUR[color]} ${PIECE_WORD[type] ?? "pawn"}`;
const other = (side: "w" | "b") => (side === "w" ? "b" : "w");

/** His moment of a kind in the list, if any. */
const find = (moments: readonly Moment[], kind: Moment["kind"]) => moments.find((m) => m.kind === kind) ?? null;

/** The dock's line on the fusion's turn (Eric, Oct 17): it was his move. */
export const FUSION_LINE = "Alfil spent his move on the fusion.";

// ---------------- The landing ----------------

/** When each of the Slam's landing pieces drops (ms into the landing), comes down on its own square, and is settled. */
export function landingBeats(pieces: readonly { from: string; to: string }[]): { drop: number; down: number; settled: number }[] {
  return pieces.map((p, i) => {
    const drop = i * B.land.stagger;
    const down = drop + B.land.fallMs;
    return { drop, down, settled: down + (p.from === p.to ? 0 : B.land.slideMs) };
  });
}

/**
 * The landing his pieces made early (at the start of his turn: he'd had a mate in one only while they were up), as a
 * moment of his thinking screen, from when this device first saw it (a screen drawn again carries on); null when none.
 */
const earlySeen = new Map<string, number>();
export function earlyLanding(boss: BossView, now = Date.now()): Moment | null {
  const l = boss.powers?.landed;
  if (!l || !landedEarlyMs(boss)) return null;
  const key = `${boss.id}:land-early:${boss.startMove}:${l.at}`;
  let at = earlySeen.get(key);
  if (at === undefined) {
    earlySeen.set(key, (at = now));
    if (earlySeen.size > 20) earlySeen.delete(earlySeen.keys().next().value!);
  }
  return { kind: "land", key, at, ms: POWER_FX.land, squares: l.pieces.map((x) => x.to) };
}

// ---------------- The board under his moments ----------------

/**
 * The position the board shows during his moments, from the screen's start (each moment's own pieces drawn by the
 * moment as they move): the fusion's two pawns on their squares until they lift, the elephant only once it has landed;
 * the Slam's pieces on their squares until they fly; each landing piece only once it's settled. The plain position for
 * the rest of a moment of his (so the board doesn't animate what his moment draws: Boss.tsx); null with none of his.
 */
export function alfilFen(boss: BossView, moments: readonly Moment[], now: number, fen: string): string | null {
  const p = boss.powers;
  if (!p || boss.id !== "alfil") return null;
  let out: string | null = null;
  const fuse = find(moments, "fuse");
  if (fuse && p.fusion?.to && now < fuse.at + fuse.ms) {
    const t = now - fuse.at;
    out = fen;
    if (t < B.fuse.landAt) out = withoutPiece(out, p.fusion.to);
    if (t < B.fuse.riseAt) for (const sq of p.fusion.from) out = withPiece(out, sq, { color: other(boss.crowdSide), type: "p" });
  }
  const slam = find(moments, "slam");
  if (slam && p.slam && now < slam.at + slam.ms) {
    out ??= fen;
    if (now - slam.at < B.slam.flyAt) for (const x of p.slam.pieces) out = withPiece(out, x.square, { color: boss.crowdSide, type: x.piece.toLowerCase() });
  }
  const land = find(moments, "land");
  if (land && p.landed && now < land.at + land.ms) {
    out ??= fen;
    const beats = landingBeats(p.landed.pieces);
    p.landed.pieces.forEach((x, i) => {
      if (now - land.at < beats[i]!.settled) out = withoutPiece(out!, x.to);
    });
  }
  return out;
}

/** The board shakes as he crashes down for the Slam (Big Boy's crash jolt). */
export function alfilJolt(m: Pick<Moment, "kind" | "at"> | null, now: number): "crash" | null {
  if (!m || m.kind !== "slam") return null;
  const t = now - m.at;
  return t >= B.slam.slamAt && t < B.slam.slamAt + 320 ? "crash" : null;
}

// ---------------- His moments ----------------

/** A piece the moment draws over the board (rising, flying, dropping), in % of the board: drawn as the board draws pieces. */
function AirPiece({ code, at, square, scale = 1, rot = 0, opacity = 1, cls = "" }: { code: string; at: Pt; square: string; scale?: number; rot?: number; opacity?: number; cls?: string }) {
  return (
    <piece
      class={`al-piece ${code}${cls}`}
      style={{ left: `${r2(at.x - 6.25)}%`, top: `${r2(at.y - 6.25)}%`, scale: String(r2(scale)), rotate: `${Math.round(rot)}deg`, opacity: String(r2(opacity)) }}
      data-square={square}
    />
  );
}

/** "TUSKS!" and the cast: his trunk levels the ankus at the board as his two pawns light up (the board layer's glow). */
function tusksMoment({ moment, banner, cast }: MomentProps) {
  const [a, b] = moment.squares ?? [];
  return (
    <div class="power-moment pm-tusks">
      {banner("TUSKS!", a && b ? `${a} and ${b} fuse next turn` : undefined, "tusks", B.tusks.castAt)}
      {cast("cast", B.tusks.castAt)}
    </div>
  );
}

/** The fusion: the two pawns lift to the board's center, a ball of white light, and the elephant drops onto its square. */
function fuseMoment({ boss, moment, now, t, orientation, cast }: MomentProps) {
  const f = boss.powers?.fusion;
  if (!f?.to) return <div class="power-moment pm-fuse">{cast("rise", B.fuse.riseAt)}</div>;
  const his = other(boss.crowdSide);
  const centre: Pt = { x: 50, y: 50 };
  const u = clamp01((t - B.fuse.riseAt) / (B.fuse.flashAt - B.fuse.riseAt));
  const k = ease(u);
  const flashMs = 450;
  const tf = t - B.fuse.flashAt;
  const dropFrom = B.fuse.flashAt + 120;
  const v = clamp01((t - dropFrom) / (B.fuse.landAt - dropFrom));
  const to = centreOf(f.to, orientation);
  return (
    <div class="power-moment pm-fuse">
      {cast("rise", B.fuse.riseAt)}
      <div class="hb-pieces al-layer" aria-hidden="true" data-fuse={t < B.fuse.riseAt ? "glow" : t < B.fuse.flashAt ? "rise" : t < B.fuse.landAt ? "flash" : "landed"}>
        {t >= B.fuse.riseAt &&
          t < B.fuse.flashAt &&
          f.from.map((sq) => {
            const s = centreOf(sq, orientation);
            return <AirPiece key={`rise-${sq}`} code={pieceCode(his, "p")} square={sq} at={{ x: s.x + (centre.x - s.x) * k, y: s.y + (centre.y - s.y) * k - 9 * Math.sin(Math.PI * u) }} scale={1 - 0.3 * k} cls=" al-glowing" />;
          })}
        {tf >= 0 && tf < flashMs && <span class="al-flash" style={{ scale: String(r2(0.3 + 1.2 * Math.sqrt(tf / flashMs))), opacity: String(r2(tf < 120 ? 1 : 1 - (tf - 120) / (flashMs - 120))) }} />}
        {t >= dropFrom && t < B.fuse.landAt && (
          <AirPiece code={`${pieceCode(his, "b")} elephant`} square={f.to} at={{ x: centre.x + (to.x - centre.x) * v, y: centre.y + (to.y - centre.y) * v * v - 6 * Math.sin(Math.PI * Math.min(1, v * 1.4)) }} scale={1.25 - 0.25 * v} />
        )}
      </div>
      <SoundAt id={`${moment.key}:${boss.startMove}:landed`} at={moment.at + B.fuse.landAt} now={now} sound="alfilThump" />
    </div>
  );
}

/** "MAMMOTH SLAM!": he leaps and crashes down (the board shakes: alfilJolt), and the pieces fly up off their squares. */
function slamMoment({ boss, t, orientation, banner, cast }: MomentProps) {
  const s = boss.powers?.slam;
  const n = s?.pieces.length ?? 0;
  const turns = Math.max(1, (s?.lands ?? 0) - (s?.at ?? 0) - 1);
  const sub = n ? `${n === 1 ? "One of your pieces flies" : `${n} of your pieces fly`} up for ${turns} ${turns === 1 ? "turn" : "turns"}` : undefined;
  return (
    <div class="power-moment pm-slam">
      {banner("MAMMOTH SLAM!", sub, "tusks", B.slam.leapAt)}
      {cast("slam", B.slam.slamAt)}
      <div class="hb-pieces al-layer" aria-hidden="true" data-slam={t < B.slam.flyAt ? "slam" : t < B.slam.goneAt ? "fly" : "gone"}>
        {s?.pieces.map((x, i) => {
          const t0 = B.slam.flyAt + i * 60;
          if (t < t0 || t >= B.slam.goneAt + i * 60) return null;
          const u = clamp01((t - t0) / (B.slam.goneAt - B.slam.flyAt));
          const at = centreOf(x.square, orientation);
          const up = 1 - (1 - u) * (1 - u);
          return (
            <AirPiece
              key={`fly-${x.square}`}
              code={pieceCode(boss.crowdSide, x.piece.toLowerCase())}
              square={x.square}
              at={{ x: at.x + (i - 1) * 3 * up, y: at.y - (at.y + 20) * up }}
              scale={1 + 0.15 * Math.sin(Math.PI * Math.min(1, u * 2)) - 0.45 * up}
              rot={(i % 2 ? -1 : 1) * 300 * u}
              opacity={u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3}
            />
          );
        })}
      </div>
    </div>
  );
}

/** The landing: each piece drops out of the sky onto its own square (a soft thump), then slides on if that was taken. */
function landMoment({ boss, moment, now, t, orientation }: MomentProps) {
  const l = boss.powers?.landed;
  if (!l) return <div class="power-moment pm-land pm-stay" />;
  const beats = landingBeats(l.pieces);
  return (
    <div class="power-moment pm-land pm-stay">
      <div class="hb-pieces al-layer" aria-hidden="true" data-land={t < (beats.at(-1)?.settled ?? 0) ? "on" : "settled"}>
        {l.pieces.map((x, i) => {
          const b = beats[i]!;
          if (t < b.drop || t >= b.settled) return null;
          const own = centreOf(x.from, orientation);
          const code = pieceCode(boss.crowdSide, x.piece.toLowerCase());
          if (t < b.down) {
            const u = (t - b.drop) / B.land.fallMs;
            return <AirPiece key={`land-${x.from}`} code={code} square={x.from} at={{ x: own.x, y: own.y - 45 * (1 - u * u) }} scale={0.7 + 0.3 * u} opacity={Math.min(1, u * 3)} />;
          }
          const end = centreOf(x.to, orientation);
          const v = ease((t - b.down) / B.land.slideMs);
          return <AirPiece key={`land-${x.from}`} code={code} square={x.to} at={{ x: own.x + (end.x - own.x) * v, y: own.y + (end.y - own.y) * v }} />;
        })}
      </div>
      {l.pieces.map((x, i) => (
        <SoundAt key={x.from} id={`${moment.key}:${boss.startMove}:thump:${x.from}`} at={moment.at + beats[i]!.down} now={now} sound="alfilThump" />
      ))}
    </div>
  );
}

const MOMENTS: Record<"tusks" | "fuse" | "slam" | "land", MomentUi> = {
  // A step at the start of his turn plays on a screen of its own (as Big Boy's bounce): it's the last thing that happened.
  tusks: {
    order: 0,
    kit: "power",
    own: (boss) => boss.powers?.events.at(-1)?.kind === "tusks" && boss.powers?.tusks?.at === boss.crowdMoves,
    appearAt: (m, square) => (m.squares?.includes(square) ? m.at + B.tusks.castAt : undefined),
    view: tusksMoment,
  },
  // His fusion is his move, not a step: it plays first among the moments of the crowd's turn it begins (one that fails
  // has no moment). No banner: what it means for you, in the dock.
  fuse: { order: 0, kit: "powerHit", dock: () => FUSION_LINE, view: fuseMoment },
  slam: {
    order: 3,
    kit: "ultimate",
    own: (boss) => boss.powers?.events.at(-1)?.kind === "slam" && boss.powers?.slam?.at === boss.crowdMoves,
    appearAt: (m, square) => (m.squares?.includes(square) ? m.at + B.slam.shadowsAt : undefined),
    view: slamMoment,
  },
  // (No banner: that they're back, in the dock.)
  land: { order: 2, kit: "ultimateHit", dock: (m) => ((m.squares?.length ?? 0) === 1 ? "Your piece is back." : "Your pieces are back."), view: landMoment },
};

/** The glow under his marked pawns: the cast's (from its `cast` beat), and the fusion's until they lift. */
function glowSquares(boss: BossView, moments: readonly Moment[], now: number, appearAt: (square: string) => number): string[] {
  const p = boss.powers!;
  const out = (p.tusks?.pawns ?? []).filter((sq) => now >= appearAt(sq));
  const fuse = find(moments, "fuse");
  if (fuse && p.fusion?.to && now < fuse.at + B.fuse.riseAt) out.push(...p.fusion.from);
  return out;
}

/**
 * The shadows of the Slam's pieces as `now` (Jefferson's, as is): each square one will land on, its size by the turns
 * left, from the Slam's `shadows` beat; during the landing, the biggest until its piece comes down.
 */
function slamShadows(boss: BossView, moments: readonly Moment[], now: number, appearAt: (square: string) => number): BoardItem[] {
  const p = boss.powers!;
  const out = (p.airborne ?? []).filter((x) => now >= appearAt(x.square)).map((x) => fireShadowItem(x.square, x.lands, x.stage, now));
  const land = find(moments, "land");
  const l = p.landed;
  if (land && l) {
    const beats = landingBeats(l.pieces);
    l.pieces.forEach((x, i) => now < land.at + beats[i]!.down && out.push(fireShadowItem(x.from, l.turn, 3, now)));
  }
  return out;
}

let warmed = false;
/** His cast, fusion and Slam drawn ahead as his battle starts (the Slam is big), and the shadows' frames. */
export function prewarmAlfil(name: string): void {
  const kit = bossKit(name);
  if (!kit || warmed) return;
  warmed = true;
  const frames = (anim: string) => kit.ch.anims[anim]?.frames ?? [];
  prewarmSprite(kit.ch, [...frames("tusksCast"), ...frames("tusksFuse"), ...frames("mammothSlam")]);
  prewarm("fireShadow", Object.entries(EFFECTS.fireShadow.ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

export const ALFIL_UI = {
  id: "alfil",
  // (His Slam comes at the start of his turn, after your move, as Big Boy's bounce.)
  ultimate: { name: "the Mammoth Slam", when: "After your move" },
  moments: MOMENTS,
  // His fusion was his move: no move to show.
  noMove: (boss) => (boss.powers?.fusion?.to && boss.powers.fusion.at === boss.crowdMoves && !boss.lastMove ? FUSION_LINE : null),
  // His marked pawns' glow and the Slam's shadows, under the pieces (a piece stands on its glow, or its shadow).
  board: ({ boss, orientation, moments, now, appearAt }) => {
    const glows = glowSquares(boss, moments, now, appearAt);
    const shadows = slamShadows(boss, moments, now, appearAt);
    return {
      under: (
        <>
          {glows.length > 0 && (
            <div class="al-glows" aria-hidden="true">
              {glows.map((sq) => (
                <span key={`glow-${sq}`} class="al-glow" style={onSquare(sq, orientation)} data-square={sq} />
              ))}
            </div>
          )}
          {shadows.length > 0 && <BoardEffects items={shadows} orientation={orientation} class="pw-shadow-board" />}
        </>
      ),
      over: (
        <>
          {/* (Markers for the shadows: which squares, how big.) */}
          {shadows.map((sh) => (
            <span key={`shadow-${sh.square}`} class={`pw-shadow size-${sh.anim!.slice(-1)}`} style={onSquare(sh.square, orientation)} data-square={sh.square} data-size={sh.anim!.slice(-1)} />
          ))}
        </>
      ),
    };
  },
} satisfies BossUi;
