import { BOSS_POWERS } from "@chessroyale/core";
import { bannerLeadMs, fenAtPly, powerFxMs } from "@chessroyale/chess";
import { EFFECTS, animLength } from "../characters/power-art.ts";
import { BLOT_MS, CREASE_IN_MS, CREASE_OUT_MS, FOLD_MS, STRIKE_MS, type CreaseSide, type LineDir } from "../characters/effects/folio.ts";
import type { BossView } from "../game.ts";
import { BoardEffects, prewarm, type BoardItem } from "./BossEffect.tsx";
import { SoundAt, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Folio's powers on screen (its rules: packages/chess/src/bosses/folio.ts; docs/decisions/2026-10-27-folio-rules.md; the wiring:
 * docs/decisions/2026-10-27-folio-wired.md), all from the battle's shared view and each moment's start, so everyone online sees
 * the same thing, and a reload draws each mark as it stands without playing its moment again. Its marks are in its ink and
 * its paper (characters/effects/folio.ts), on two canvases: under the pieces (the ink mark, the attack's line, the pencil line,
 * the crease) and over them (the paper over a folded piece, Revision's strokes). Nothing it draws moves the board, the dock, the
 * HUD or the move list (Eric's rule: nothing shifts).
 * - **Draft** (`draft`, as your turn after its move begins): banner DRAFT; it points its wing at the board (`check`), and at its
 *   `ink` cue a blot of ink spreads under the marked piece, the attack's line in faint dots on the squares between; its line,
 *   "I'll be honest: that piece is next." Then drawn from the view's `draft` for as long as the mark stands, with a small ink
 *   numeral at the corner: your moves left to end the attack (2, then 1). Gone (it dries away) as soon as the view's `draft` is.
 * - **The fold** (`fold`, at the start of its turn, while it thinks; its move waits): banner FOLDED; its polite bow (`smug`),
 *   and at its `glint` a sheet of its paper folds over the piece from the corner: see-through, creased, a corner turned down,
 *   its red seal at the foot; "Folded. It'll keep." Then drawn while the view's `folded` holds the square; it opens again when
 *   it's free. (A tap on its moves: "That piece is folded.", refused.ts.)
 * - **The Crease's warning** (`creaseWarn`, with the RAGE warning): a faint pencil line along the crease's line, the whole length
 *   of the board, from the view's `creaseNext` until it lands. "Mind the crease." is the warning's own line, said once.
 * - **The Crease** (`crease`, as your next turn begins): banner CREASE!; its wing sweeps toward the board (`move`) and at its
 *   `sweep` the board folds along the line: a crisp dark crease on the squares' edges, a highlight on its lit side (left or
 *   top) and a thin shadow on the other. Drawn while the view's `crease` holds. **creaseEnd**: it unfolds (no banner; the dock
 *   says so).
 * - **Revision** (`revision`, at the start of its turn, while it thinks; its move waits): the board keeps the position after
 *   your move until it's taken back (the game's board is already the one before: a base). Banner REVISION; its wing edges curl
 *   (`rattled`), a stroke of ink crosses out its move's two squares, then your move's; then the page turns and the pieces slide
 *   back (its move and yours undone, a captured piece back on its square), and its new move plays as its ordinary move. "Let me
 *   write that again." The move list strikes both moves through (MovePanel.tsx, the base's `from`).
 */

type Orientation = "white" | "black";

/** Every banner's window in its moment's beats (POWER_BANNERS: [0, 1500]): what each moment does comes after it. */
const BANNER = 1500;
/** Its moments' beats (ms into each moment's own clock); the lengths in FOLIO_FX are measured against them (folio-wired.test.ts). */
export const FOLIO_BEATS = {
  banner: BANNER,
  /** The Draft: the ink lands at the `check`'s `ink` cue; the attack's line shows as the blot has spread. */
  draft: { inkAt: BANNER, lineAt: BANNER + BLOT_MS },
  /** The fold: the paper folds over at the `smug`'s `glint` cue. */
  fold: { foldAt: BANNER },
  /** The Crease: the board folds at the `move`'s `sweep` cue. */
  crease: { pressAt: BANNER },
  /** Revision: its move's squares struck out, then yours, 100 ms between squares; the page turns and the pieces go back. */
  revision: { strikeAt: [BANNER, BANNER + 100, BANNER + 300, BANNER + 400] as const, backAt: BANNER + 800 },
} as const;
const B = FOLIO_BEATS;

/** The words under its banners (and the dock's when the crease unfolds): what each means for you. */
export const FOLIO_WORDS = {
  draft: `End the attack in ${BOSS_POWERS.draftWindow} moves, or it folds`,
  fold: `It can't move for ${BOSS_POWERS.foldTurns} turns`,
  crease: `Your pieces can't cross it for ${BOSS_POWERS.creaseTurns} turns`,
  revision: "Both moves crossed out",
  creaseEnd: "The crease unfolds. Your pieces may cross again.",
} as const;

// ---------------- Where its marks go ----------------

const FILES = "abcdefgh";
/** A square's column and row as drawn (0 at the top left). */
const drawnAt = (sq: string, o: Orientation) => {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  return { col: o === "white" ? f : 7 - f, row: o === "white" ? 7 - r : r };
};

/** The way the attack's line runs across each square between, from the attacker to the marked piece, as drawn (either way up). */
export function lineDir(attacker: string, mark: string): LineDir {
  const df = Math.sign(mark.charCodeAt(0) - attacker.charCodeAt(0));
  const dr = Math.sign(Number(mark[1]) - Number(attacker[1]));
  if (dr === 0) return "h";
  if (df === 0) return "v";
  // (Up and to the right, or down and to the left, as White sees it: the same slope either way up.)
  return df * dr > 0 ? "d1" : "d2";
}

/**
 * The squares beside a crease's line and the edge of each the crease runs along, as drawn: "d|e" between the d and e files,
 * "4|5" between the 4th and 5th ranks. `lit`: the square on the light side (the left, or the top, as drawn), where the pencil
 * line of a warning goes and the crease's highlight.
 */
export function creaseSquares(line: string, o: Orientation): { square: string; side: CreaseSide; lit: boolean }[] {
  const [a, b] = line.split("|") as [string, string];
  const out: { square: string; side: CreaseSide; lit: boolean }[] = [];
  if (/[a-h]/.test(a)) {
    for (let r = 1; r <= 8; r++)
      for (const f of [a, b]) {
        const sq = `${f}${r}`;
        // (The file on the left as drawn has the crease on its right edge.)
        const left = drawnAt(sq, o).col < drawnAt(`${f === a ? b : a}${r}`, o).col;
        out.push({ square: sq, side: left ? "E" : "W", lit: left });
      }
  } else {
    for (const f of FILES)
      for (const r of [a, b]) {
        const sq = `${f}${r}`;
        const top = drawnAt(sq, o).row < drawnAt(`${f}${r === a ? b : a}`, o).row;
        out.push({ square: sq, side: top ? "S" : "N", lit: top });
      }
  }
  return out;
}

/** Your moves left to end the marked attack (2, then 1): its last turn to answer it less the moves you've made. */
export const movesLeft = (until: number, crowdMoves: number): 1 | 2 => Math.max(1, Math.min(2, until - crowdMoves)) as 1 | 2;

// ---------------- What stays drawn after it goes ----------------

/**
 * A mark that has just gone (the mark answered, a piece unfolded): remembered for the length of its going away, a battle at a
 * time, across screens, so it dries or opens wherever the next screen draws it.
 */
const shown = new Map<string, { square: string; since: number }>();
function going(kind: "mark" | "fold", boss: Pick<BossView, "id" | "startMove">, square: string | null, now: number, ms: number): { square: string; since: number } | null {
  const key = `${boss.id}:${boss.startMove}:${kind}`;
  if (square) {
    shown.set(`${key}:now`, { square, since: 0 });
    shown.delete(`${key}:going`);
    return null;
  }
  const last = shown.get(`${key}:now`);
  if (last) {
    shown.delete(`${key}:now`);
    shown.set(`${key}:going`, { square: last.square, since: now });
  }
  const g = shown.get(`${key}:going`) ?? null;
  if (g && now >= g.since + ms) {
    shown.delete(`${key}:going`);
    return null;
  }
  if (shown.size > 40) shown.delete(shown.keys().next().value!);
  return g;
}

/** Its marks on the board now, from the view and the moments playing: under the pieces and over them. */
export function folioItems(boss: BossView, moments: readonly Moment[], now: number, o: Orientation): { under: BoardItem[]; over: BoardItem[] } {
  const p = boss.powers;
  const under: BoardItem[] = [];
  const over: BoardItem[] = [];
  if (!p) return { under, over };
  const find = (kind: Moment["kind"]) => moments.find((m) => m.kind === kind) ?? null;
  // The ink mark and the attack's line (from its moment's ink on its screen; else simply there).
  const d = p.draft ?? null;
  const draft = find("draft");
  const inked = !!d && (!draft || now >= draft.at + B.draft.inkAt);
  if (d && inked) {
    const since = draft ? draft.at + B.draft.inkAt : 0;
    const left = movesLeft(d.until, boss.crowdMoves);
    under.push({ square: d.square, name: "inkMark", anim: since && now < since + BLOT_MS ? "blot" : `mark${left}`, then: `mark${left}`, since });
    if (!draft || now >= draft.at + B.draft.lineAt) {
      const dir = lineDir(d.attacker, d.square);
      for (const sq of d.line) under.push({ square: sq, name: "inkLine", anim: dir, since: 0 });
    }
  }
  const dried = going("mark", boss, inked ? d!.square : null, now, animLength(EFFECTS.inkMark.ch.anims.fade!));
  if (dried) under.push({ square: dried.square, name: "inkMark", anim: "fade", since: dried.since, quiet: true });
  // The pencil line of a crease to come; the crease; its unfolding.
  const press = find("crease");
  const pressing = !!press && now < press.at + B.crease.pressAt;
  const lineOf = (kind: "crease" | "creaseEnd") => p.events.find((e) => e.kind === kind)?.line ?? null;
  const warned = p.creaseNext ?? (pressing ? lineOf("crease") : null);
  if (warned) for (const s of creaseSquares(warned, o)) if (s.lit) under.push({ square: s.square, name: "creasePencil", anim: s.side, since: 0 });
  if (p.crease && !pressing) {
    const since = press ? press.at + B.crease.pressAt : 0;
    creaseSquares(p.crease.line, o).forEach((s, i) => under.push({ square: s.square, name: "creaseEdge", anim: since && now < since + CREASE_IN_MS ? `in${s.side}` : `held${s.side}`, then: `held${s.side}`, since, quiet: i > 0 }));
  }
  const end = find("creaseEnd");
  const ended = end ? lineOf("creaseEnd") : null;
  if (end && ended && !p.crease && now < end.at + CREASE_OUT_MS) creaseSquares(ended, o).forEach((s, i) => under.push({ square: s.square, name: "creaseEdge", anim: `out${s.side}`, since: end.at, quiet: i > 0 }));
  // The paper over a folded piece (from its moment's fold on its screen; else simply there), and opening once it's free. (While
  // it thinks, its fold's moment names the square: the view's `folded` holds it only from your next turn, the fold's first.)
  const fold = find("fold");
  const f = p.folded?.[0] ?? fold?.square ?? null;
  const covered = !!f && (!fold || now >= fold.at + B.fold.foldAt);
  if (f && covered) {
    const since = fold ? fold.at + B.fold.foldAt : 0;
    over.push({ square: f, name: "foldPaper", anim: since && now < since + FOLD_MS ? "fold" : "folded", then: "folded", since });
  }
  const opened = going("fold", boss, covered ? f : null, now, animLength(EFFECTS.foldPaper.ch.anims.unfold!));
  if (opened) over.push({ square: opened.square, name: "foldPaper", anim: "unfold", since: opened.since });
  // Revision's strokes across the two moves' squares, until the page turns.
  const rev = find("revision");
  if (rev && now < rev.at + B.revision.backAt) {
    const squares = (rev.squares ?? p.revision?.moves ?? []).flatMap((m) => [m.slice(0, 2), m.slice(2, 4)]);
    squares.forEach((sq, i) => {
      const at = rev.at + (B.revision.strikeAt[i] ?? B.revision.strikeAt[3]);
      if (now >= at) over.push({ square: sq, name: "inkStrike", anim: now < at + STRIKE_MS ? "strike" : "struck", then: "struck", since: at });
    });
  }
  return { under, over };
}

// ---------------- Revision: the board before it's taken back ----------------

/**
 * While Revision's moment plays, until the page turns: the position after your move (the game's board is already back to before
 * its move: the base at this ply), and your move as the last; null otherwise.
 */
export function revisionFen(boss: BossView, moments: readonly Moment[], now: number): { fen: string; lastMove: string } | null {
  const rev = moments.find((m) => m.kind === "revision");
  if (!rev || now >= rev.at + B.revision.backAt) return null;
  const { history, bases } = boss.board;
  const ply = history.length;
  const base = bases?.find((b) => b.ply === ply && b.from !== undefined);
  if (!base || ply < 1) return null;
  return { fen: fenAtPly(history, ply, (bases ?? []).filter((b) => b !== base)), lastMove: history[ply - 1]! };
}

/** The plies a Revision crossed out (the moves from the base's `from` up to its ply): the move list strikes them through. */
export function crossedOut(bases: readonly { ply: number; from?: number }[] | null | undefined): Set<number> {
  const out = new Set<number>();
  for (const b of bases ?? []) if (b.from !== undefined) for (let i = b.from; i < b.ply; i++) out.add(i);
  return out;
}

// ---------------- Its moments ----------------

/** When this device first saw each of its moments at the start of its turn (a screen drawn again carries on). */
const turnSeen = new Map<string, number>();

/**
 * Its fold and Revision, the moments of its thinking screen (they come as your move lands, at the start of its turn, and its
 * move waits for them: folioTurnMs), from when this device first saw them, each with its banner's hold. None for another boss.
 */
export function folioMoments(boss: BossView, now = Date.now()): Moment[] {
  const p = boss.powers;
  if (boss.id !== "folio" || !p) return [];
  let t = 0;
  return p.events
    .filter((e) => (e.kind === "fold" || e.kind === "revision") && e.turn === p.turn)
    .map((e): Moment => {
      const key = `${boss.id}:${e.kind}:${e.turn}`;
      const seenKey = `${boss.startMove}:${key}`;
      let seen = turnSeen.get(seenKey);
      if (seen === undefined) {
        turnSeen.set(seenKey, (seen = now));
        if (turnSeen.size > 20) turnSeen.delete(turnSeen.keys().next().value!);
      }
      const lead = bannerLeadMs(e.kind);
      const m: Moment = { kind: e.kind, key, at: seen + t + lead, ms: powerFxMs(e) - lead, ...(lead ? { lead } : {}), ...(e.square ? { square: e.square } : {}), ...(e.moves ? { squares: [...e.moves] } : {}) };
      t += lead + m.ms;
      return m;
    });
}

function draftMoment({ banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-draft">
      {banner("DRAFT", FOLIO_WORDS.draft, "folio")}
      {cast("ink", B.draft.inkAt)}
    </div>
  );
}

function foldMoment({ banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-fold">
      {banner("FOLDED", FOLIO_WORDS.fold, "folio")}
      {cast("glint", B.fold.foldAt)}
    </div>
  );
}

function creaseMoment({ banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-crease">
      {banner("CREASE!", FOLIO_WORDS.crease, "folio")}
      {cast("sweep", B.crease.pressAt)}
    </div>
  );
}

function revisionMoment({ boss, moment, now, banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-revision" data-back={now >= moment.at + B.revision.backAt ? "1" : "0"}>
      {banner("REVISION", FOLIO_WORDS.revision, "folio")}
      {cast("flutter", B.revision.strikeAt[0])}
      <SoundAt id={`${moment.key}:${boss.startMove}:page`} at={moment.at + B.revision.backAt} now={now} sound="folioPage" />
    </div>
  );
}

const nothing = () => null;

const MOMENTS: Record<"draft" | "fold" | "creaseWarn" | "crease" | "creaseEnd" | "revision", MomentUi> = {
  // (Its lines as its banner goes: the bubble never says the same moment as the banner at once.)
  draft: { order: 0, kit: "power", lineAt: BANNER, view: draftMoment },
  fold: { order: 0, kit: "fold", lineAt: BANNER, view: foldMoment },
  // (The warning's line is the RAGE warning's own, "Mind the crease.": said once, never again for the line.)
  creaseWarn: { order: 1, kit: "ultimateWarn", line: () => null, view: nothing },
  crease: { order: 2, kit: "ultimate", view: creaseMoment },
  creaseEnd: { order: 2, kit: "ultimateHit", dock: () => FOLIO_WORDS.creaseEnd, view: nothing },
  revision: { order: 0, kit: "revision", lineAt: BANNER, view: revisionMoment },
};

// ---------------- Drawn ahead ----------------

let warmed = false;
/** Its marks' frames drawn ahead as its battle starts, a slice a frame (a first showing never stalls a slow phone). */
export function prewarmFolio(): void {
  if (warmed) return;
  warmed = true;
  for (const fx of ["inkMark", "inkLine", "foldPaper", "creaseEdge", "creasePencil", "inkStrike"] as const) prewarm(fx, Object.entries(EFFECTS[fx].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

export const FOLIO_UI = {
  id: "folio",
  ultimate: { name: "Crease" },
  moments: MOMENTS,
  board: ({ boss, moments, now, orientation }) => {
    const { under, over } = folioItems(boss, moments, now, orientation);
    const p = boss.powers;
    return {
      under: under.length > 0 && <BoardEffects items={under} orientation={orientation} class="pw-shadow-board fo-ink" />,
      over: (
        <>
          {over.length > 0 && <BoardEffects items={over} orientation={orientation} class="pw-fire-board fo-paper" />}
          {/* (Markers for tests and readers: what's drawn where.) */}
          <span class="fo-marks" hidden data-draft={p?.draft ? `${p.draft.square}:${movesLeft(p.draft.until, boss.crowdMoves)}:${p.draft.line.join(",")}` : ""} data-folded={p?.folded?.join(",") ?? ""} data-crease={p?.crease?.line ?? ""} data-pencil={p?.creaseNext ?? ""} data-under={under.map((i) => `${i.name}@${i.square}`).join(" ")} data-over={over.map((i) => `${i.name}@${i.square}`).join(" ")} />
        </>
      ),
    };
  },
} satisfies BossUi;
