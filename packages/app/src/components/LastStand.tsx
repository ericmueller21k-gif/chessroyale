import { useEffect, useMemo, useState } from "preact/hooks";
import { LAST_STAND, lastStandHits, pieceAt } from "@chessroyale/chess";
import { useFrameNow } from "./Countdown.tsx";
import { GodKingFallen, GodKingPortrait, GodKingSprite, squareXY } from "./GodKing.tsx";
import { play, type SoundName } from "../sound.ts";
import { KING_LINES, kingSay, lastStandLine } from "../godKing.ts";

const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const;
const pct = (v: number) => `${v / 8}%`;
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const clamp01 = (p: number) => Math.max(0, Math.min(1, p));

/** The slash that hit him on the i-th blow: its angle (degrees) and where its damage number floats off. */
function blow(i: number) {
  const angle = (i * 137.5 + 20) % 180;
  const side = i % 2 === 0 ? -1 : 1;
  return { angle, dx: side * (22 + ((i * 29) % 34)), dy: -18 - ((i * 17) % 30) };
}
/** Slashes that send a stylised red drop flying (a few, no more). */
const DROPS = [5, 11, 17, 22];

/**
 * A position with one square emptied (for the board while he stands there): no chess rules involved, and no
 * en passant square (it could point at the pawn just taken off).
 */
export function clearSquare(fen: string, square: string): string {
  const [placement, ...rest] = fen.split(" ");
  const rows = placement!.split("/").map((r) => [...r.replace(/\d/g, (d) => ".".repeat(Number(d)))]);
  rows[8 - Number(square[1])]![square.charCodeAt(0) - 97] = ".";
  const packed = rows.map((r) => r.join("").replace(/\.+/g, (m) => String(m.length))).join("/");
  return [packed, rest[0], rest[1], "-", ...rest.slice(3)].join(" ");
}

/** What the board shows during his Last Stand, `t` ms after the move lands. */
export function lastStandBoard(t: number): "after" | "pushed" | "back" | "before" {
  const L = LAST_STAND;
  if (t < L.crashAt) return "after";
  if (t < L.slideAt + 400) return "pushed";
  if (t < L.fadeAt + L.fadeMs) return "back";
  return "before";
}

/**
 * The God King's Last Stand, over the board, from the moment the crowd's disastrous move lands (`startAt`):
 * everything freezes; he leaps out of the dock (the dock plays that part) and crashes down onto the piece's
 * square (flash, dust; the screen shakes); his cut-in banner with a line; the piece slides back to where it came
 * from; the blow meant for it lands on him instead, 25 rapid slashes with red damage numbers while his armour
 * cracks; he staggers, collapses and fades. Timings: LAST_STAND (boss-timing.ts). `fen` is the position before
 * the move. The board itself (what it shows when) follows lastStandBoard.
 */
export function LastStand({ side, orientation, fen, move, startAt }: { side: "w" | "b"; orientation: "white" | "black"; fen: string; move: string; startAt: number }) {
  const now = useFrameNow();
  const L = LAST_STAND;
  const t = now - startAt;
  const seed = fen + move;
  const hits = useMemo(() => lastStandHits(seed), [seed]);
  const line = lastStandLine(seed);
  const to = squareXY(move.slice(2, 4), orientation);
  const from = squareXY(move.slice(0, 2), orientation);
  const piece = pieceAt(fen, move.slice(0, 2));
  // His sounds, in time with the animation (cues already past stay silent), and his last words as he goes.
  useEffect(() => {
    const at = (ms: number) => startAt + ms;
    const blowAt = (i: number) => at(L.slashAt + i * L.slashEveryMs);
    const cues: [SoundName, number][] = [
      ["gkLastLeap", at(L.leapAt)],
      ["gkLastCrash", at(L.crashAt)],
      ["gkCutIn", at(L.bannerAt + 60)],
      ["move", at(L.slideAt)],
      ["gkLastSlashes", blowAt(0)],
      ["gkLastGrunt1", blowAt(1)],
      ["gkLastGrunt2", blowAt(10)],
      ["gkLastGrunt1", blowAt(19)],
      ["gkLastGroan", at(L.collapseAt)],
    ];
    const timers = cues.filter(([, ms]) => ms > Date.now() - 300).map(([name, ms]) => setTimeout(() => play(name), Math.max(0, ms - Date.now())));
    const words = at(L.fadeAt + 150);
    if (words > Date.now() - 1000) timers.push(setTimeout(() => kingSay("lastWords", `last-words-${seed}`), Math.max(0, words - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, [startAt]);
  if (t < 0 || t > L.endMs + 300) return null;

  // He falls from above the board onto the square, then stands there until he fades.
  const falling = t >= L.fallAt && t < L.crashAt;
  const present = t >= L.fallAt && t < L.fadeAt + L.fadeMs;
  const drop = falling ? 1 - Math.pow(clamp01((t - L.fallAt) / (L.crashAt - L.fallAt)), 2) : 0;
  const godY = to.y - drop * (to.y + 160);
  const blowsIn = t >= L.slashAt ? Math.floor((t - L.slashAt) / L.slashEveryMs) + 1 : 0;
  const lastBlow = Math.min(L.slashes, blowsIn) - 1;
  const sinceBlow = lastBlow >= 0 ? t - (L.slashAt + lastBlow * L.slashEveryMs) : Infinity;
  const hurt = sinceBlow < 70;
  const cracks = L.crackAt.filter((c) => t >= c).length;
  const fade = t >= L.fadeAt ? clamp01(1 - (t - L.fadeAt) / L.fadeMs) : 1;
  const pose = t >= L.collapseAt ? " collapse" : t >= L.staggerAt ? " stagger" : "";
  const jolt = hurt ? (lastBlow % 2 === 0 ? -1.2 : 1.2) : 0;
  // The piece he takes the blow for: knocked a little aside as he lands, then sliding back to where it came from.
  const len = Math.hypot(from.x - to.x, from.y - to.y) || 1;
  const pushed = { x: to.x + ((from.x - to.x) / len) * 26, y: to.y + ((from.y - to.y) / len) * 26 };
  const knock = clamp01((t - L.crashAt) / 120);
  const slide = ease(clamp01((t - L.slideAt) / 400));
  const px = t < L.slideAt ? to.x + (pushed.x - to.x) * knock : pushed.x + (from.x - pushed.x) * slide;
  const py = t < L.slideAt ? to.y + (pushed.y - to.y) * knock : pushed.y + (from.y - pushed.y) * slide;
  const showPiece = piece && t >= L.crashAt && t < L.slideAt + 400;
  const crash = t - L.crashAt;
  return (
    <div class="last-stand" role="alert" aria-label={`The God King's Last Stand: ${line}`}>
      {/* 1. Everything freezes: a flash, and the board goes cold and grey until he lands. */}
      {t >= L.freezeAt && t < L.crashAt + 200 && <div class="ls-freeze" style={{ opacity: Math.min(1, (t - L.freezeAt) / 120) * (t > L.crashAt ? 1 - (t - L.crashAt) / 200 : 1) }} />}
      {t >= L.freezeAt && t < L.freezeAt + 260 && <div class="ls-flash" style={{ opacity: 0.7 * (1 - (t - L.freezeAt) / 260) }} />}
      <svg class="ls-fx" viewBox="0 0 800 800" preserveAspectRatio="none" aria-hidden="true">
        {t >= L.freezeAt && t < L.freezeAt + 500 && <circle class="ls-frost" cx={to.x} cy={to.y} r={30 + (t - L.freezeAt) / 3} style={{ opacity: 1 - (t - L.freezeAt) / 500 }} />}
        {/* 2. His fall: a streak of light above him. */}
        {falling && <rect class="ls-streak" x={to.x - 22} y={-40} width={44} height={Math.max(0, godY + 10)} style={{ opacity: 0.85 }} />}
        {/* The crash: a flash, a shockwave and dust. */}
        {crash >= 0 && crash < 380 && <circle class="ls-impact" cx={to.x} cy={to.y + 20} r={40 + crash / 2.2} style={{ opacity: 1 - crash / 380 }} />}
        {crash >= 0 && crash < 560 && <circle class="ls-ring" cx={to.x} cy={to.y + 30} r={30 + crash / 1.6} style={{ opacity: 1 - crash / 560 }} />}
        {crash >= 0 &&
          crash < 800 &&
          Array.from({ length: 8 }, (_, i) => {
            const a = Math.PI * (0.05 + (0.9 * i) / 7);
            const d = 20 + crash / 6;
            return <circle key={i} class="ls-dust" cx={to.x + Math.cos(a) * d * (i % 2 ? 1.3 : 1)} cy={to.y + 38 - Math.sin(a) * d * 0.35} r={10 + crash / 40 + (i % 3) * 3} style={{ opacity: 0.75 * (1 - crash / 800) }} />;
          })}
        {/* 5. The blow meant for the piece: rapid slashes across him, each a red-white cut and a hit. */}
        {Array.from({ length: L.slashes }, (_, i) => {
          const age = t - (L.slashAt + i * L.slashEveryMs);
          if (age < -30 || age > 240) return null;
          const { angle } = blow(i);
          const r = 52;
          const a = (angle * Math.PI) / 180;
          const sweep = clamp01((age + 30) / 70);
          const x1 = to.x - Math.cos(a) * r;
          const y1 = to.y - Math.sin(a) * r;
          return (
            <g key={i}>
              <line class="ls-slash" x1={x1} y1={y1} x2={x1 + Math.cos(a) * 2 * r * sweep} y2={y1 + Math.sin(a) * 2 * r * sweep} style={{ opacity: age < 110 ? 1 : 1 - (age - 110) / 130 }} />
              {age >= 0 && age < 160 && <circle class="ls-hit" cx={to.x + Math.cos(a * 3) * 10} cy={to.y + Math.sin(a * 2) * 10} r={10 + age / 8} style={{ opacity: 1 - age / 160 }} />}
            </g>
          );
        })}
      </svg>
      {showPiece && (
        <span class="ls-piece cg-wrap" style={{ left: pct(px - 50), top: pct(py - 50) }} aria-hidden="true">
          <piece class={`${side === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}`} />
        </span>
      )}
      {present && (
        <div class={`ls-god${falling ? " falling" : ""}${pose}`} style={{ left: pct(to.x - 50), top: pct(godY - 50), opacity: fade, translate: `${jolt}% 0` }}>
          <GodKingSprite side={side} cracks={cracks} class={hurt ? "hurt" : ""} />
        </div>
      )}
      {Array.from({ length: L.slashes }, (_, i) => {
        const age = t - (L.slashAt + i * L.slashEveryMs);
        if (age < 0 || age > 760) return null;
        const b = blow(i);
        return (
          <span key={i} class="ls-dmg" style={{ left: pct(to.x + b.dx), top: pct(to.y + b.dy) }}>
            −{hits[i]}
          </span>
        );
      })}
      {DROPS.map((i) => {
        const age = t - (L.slashAt + i * L.slashEveryMs);
        if (age < 0 || age > 700) return null;
        const dir = i % 2 === 0 ? 1 : -1;
        const p = age / 700;
        return <span key={i} class="ls-drop" style={{ left: pct(to.x + dir * (14 + 70 * p)), top: pct(to.y - 10 - 90 * p + 190 * p * p), opacity: 1 - p * p, rotate: `${dir * (30 + 90 * p)}deg` }} />;
      })}
      {/* 3. His cut-in: LAST STAND, his battle-worn portrait and his line. */}
      {t >= L.bannerAt && t < L.bannerAt + L.bannerMs && <LastStandCutIn side={side} line={line} />}
    </div>
  );
}

/**
 * The Last Stand's cut-in: the God King's banner, darker (blood red and black, gold trim), his battle-worn
 * portrait, "LAST STAND" and his line in his own pixel type. A little longer than his usual cut-in, so the line
 * can be read.
 */
export function LastStandCutIn({ side, line }: { side: "w" | "b"; line: string }) {
  return (
    <div class="fight-banner king-cut last-stand-cut" role="alert" aria-label={`Last stand: ${line}`}>
      <div class="fb-flash" />
      <div class="fb-band">
        <div class="fb-lines" />
        <span class="kc-portrait">
          <GodKingPortrait side={side} hurt />
        </span>
        <span class="fb-words kc-words">
          <span class="fb-text kc-text">LAST STAND</span>
          <span class="ls-line">{line}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The result screen after his Last Stand. The crowd won: his fallen figure rises again in holy light ("A god
 * does not stay down."). Otherwise he stays down, greyed, without a word.
 */
export function GodKingEpilogue({ side, rises }: { side: "w" | "b"; rises: boolean }) {
  const now = useFrameNow();
  const [start] = useState(Date.now());
  const t = now - start;
  const up = rises && t >= 1500;
  useEffect(() => {
    if (!rises) return;
    const timers = [setTimeout(() => play("gkSummon"), 600), setTimeout(() => play("gkAppear"), 1450)];
    return () => timers.forEach(clearTimeout);
  }, []);
  const words = KING_LINES.rise[0]!;
  const shown = rises && t >= 2100 ? Math.min(words.length, Math.floor((t - 2100) / 28) + 1) : 0;
  return (
    <div class={`gk-epilogue${rises ? " rises" : " down"}${up ? " up" : ""}`} aria-label={rises ? `The God King rises: ${words}` : "The God King stays down"}>
      {rises && t >= 600 && <span class="gk-epilogue-beam" aria-hidden="true" />}
      {up ? <GodKingSprite side={side} class="idle" /> : <GodKingFallen side={side} />}
      {shown > 0 && (
        <span class="gk-bubble gk-epilogue-bubble" role="status">
          <span aria-hidden="true">{words.slice(0, shown)}</span>
          <span class="gk-bubble-rest" aria-hidden="true">
            {words.slice(shown)}
          </span>
        </span>
      )}
    </div>
  );
}
