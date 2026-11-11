import { useLayoutEffect, useRef } from "preact/hooks";
import { BOSS_POWERS, type DoughLump, type DoughPiece } from "@chessroyale/core";
import { ZEBRA_ANIM, bannerLeadMs, powerFxMs, withoutPiece, zebraStop } from "@chessroyale/chess";
import { pickLine } from "../characters/boss-beats.ts";
import { bossKit } from "../characters/kits.ts";
import { frameImage } from "./BossEffect.tsx";
import { ZEBRA_TIMER } from "../characters/zebra-dough.ts";
import { goldClose, goldFor, openingLine } from "../characters/zebra-lines.ts";
import type { BossView } from "../game.ts";
import { play } from "../sound.ts";
import { bossVoice, CRITICAL } from "../speech.tsx";
import { BoardEffects, type BoardItem } from "./BossEffect.tsx";
import type { BoardLayerProps, BossUi, Moment, MomentProps, MomentUi } from "./PowerParts.tsx";

/**
 * Don Dough's powers on screen (his rules: packages/chess/src/bosses/zebra.ts; docs/decisions/2026-11-11-don-dough.md), all from the
 * battle's shared view, so everyone online sees the same dough and the same gold. Nothing he draws moves the board, the dock or the
 * bar (Eric's rule: nothing shifts).
 * - **The oven timers** (`OvenTimers`, the boss bar's prop slot, right of his bars, the same place on a phone and a computer): one
 *   slot for each lump the rules allow on the board at once (doughLive), each a kitchen timer with its dough's kind on it showing
 *   its minutes (`kNN`). Each move its minute drops (`kRollNN`, a quarter second, as the view's `left` goes down); at 00:00 it rings
 *   (`kDing`) as the dough rises. An empty slot is a faint outline. Drawn on a timer of their own frames: nothing per frame.
 * - **A drop** (`doughDrop`, as your turn after his begins): his `drop` (the lump from his apron pocket, lobbed), and as it lands the
 *   dough's `land` on its square, then its kind proofing (`k`) until it rises or is squashed. The God King: "Squash it before it rises!"
 * - **A rise** (`doughRise`: as your turn begins after his move, or at the start of his turn after yours): the timer's ding, then the
 *   dough's `kRise`, his piece on the square from its pop (the board leaves it off until then: `zebraFen`); his cheer (a queen: the
 *   big one). **A squash** (`doughSquash`, as your piece lands on it): `kSquash` under your piece, his grumble.
 * - **Gold Plate** (`goldPlate`, at the start of his turn after the warning: 10 s, his move waits for it): banner GOLD PLATE!; his cast
 *   (`goldPlate`: the glaze stirred, three strokes at the board, a chef's kiss), on the piece the gilding (`gild`), the gold piece in
 *   at its fourth frame (the board's `gold` from then: `zebraGold`), its shine, then his brag (`goldBrag`) and his line: your pawns
 *   are worthless against it. From then on the piece is drawn in gold wherever the board is drawn (OwnBoard's `gold`), with its
 *   glint. A pawn of yours that tries to take it bounces off: the clink on its square and his line (`goldClink`).
 * - **His opening comment** (`openingTalk`): a line in his voice, no moment of its own.
 */

type Orientation = "white" | "black";

/** His moments' beats (ms into each moment's own clock): ZEBRA_ANIM's, the art's. */
export const ZEBRA_BEATS = {
  drop: { landAt: ZEBRA_ANIM.landAt },
  rise: { riseAt: ZEBRA_ANIM.ding, popAt: ZEBRA_ANIM.ding + ZEBRA_ANIM.riseAt },
  gold: { gildAt: ZEBRA_ANIM.gildAt, swapAt: ZEBRA_ANIM.swapAt, shineAt: ZEBRA_ANIM.shineAt, glintAt: ZEBRA_ANIM.glintAt, bragAt: ZEBRA_ANIM.bragAt, lineAt: ZEBRA_ANIM.lineAt },
} as const;
const B = ZEBRA_BEATS;

const PIECE_NAME: Record<DoughPiece, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };
/** The words in the dock and under his banner: what each means for you. */
export const ZEBRA_WORDS = {
  drop: "Land on his dough to squash it.",
  rise: "His dough rose.",
  gold: "Your pawns can't take his gold piece.",
  goldNone: "Nothing of his to gild.",
} as const;

// ---------------- The board under his moments ----------------

/**
 * The position the board shows during his moments: a piece risen from his dough isn't on its square until the rise's pop. Null with
 * none among `moments` (the plain position: Boss.tsx).
 */
export function zebraFen(boss: Pick<BossView, "id">, moments: readonly Moment[], now: number, fen: string): { fen: string } | null {
  if (boss.id !== "zebra") return null;
  let out = fen;
  for (const m of moments) if (m.kind === "doughRise" && m.square && now < m.at + B.rise.popAt) out = withoutPiece(out, m.square);
  return out === fen ? null : { fen: out };
}

/** His gold pieces' squares as the board draws them now: a piece Gold Plate is gilding turns gold at the gilding's fourth frame. */
export function zebraGold(boss: Pick<BossView, "id" | "powers"> | null | undefined, moments: readonly Moment[] = [], now = Date.now()): string[] | undefined {
  const gold = boss?.id === "zebra" ? boss.powers?.zebra?.gold : undefined;
  if (!gold?.length) return undefined;
  const g = moments.find((m) => m.kind === "goldPlate");
  return g?.square && now < g.at + B.gold.swapAt ? gold.filter((sq) => sq !== g.square) : [...gold];
}

/** What his dough and gold put on the squares now: a lump proofing, landing, rising or squashed; a gold piece's gilding and glint. */
export function zebraItems(boss: BossView, moments: readonly Moment[], now: number): BoardItem[] {
  const z = boss.powers?.zebra;
  if (!z) return [];
  const out: BoardItem[] = [];
  const drop = moments.find((m) => m.kind === "doughDrop");
  for (const l of z.lumps) {
    if (drop && drop.square === l.square && now < drop.at + B.drop.landAt) continue;
    if (drop && drop.square === l.square) out.push({ square: l.square, name: "zebraDough", anim: "land", then: l.piece, since: drop.at + B.drop.landAt });
    else out.push({ square: l.square, name: "zebraDough", anim: l.piece, since: 0 });
  }
  for (const m of moments) {
    const k = m.shape as DoughPiece | undefined;
    if (!m.square || !k) continue;
    if (m.kind === "doughRise" && now < m.at + B.rise.riseAt) out.push({ square: m.square, name: "zebraDough", anim: k, since: 0 });
    else if (m.kind === "doughRise" && now < m.at + m.ms + 200) out.push({ square: m.square, name: "zebraDough", anim: `${k}Rise`, since: m.at + B.rise.riseAt });
    else if (m.kind === "doughSquash" && now < m.at + m.ms) out.push({ square: m.square, name: "zebraDough", anim: `${k}Squash`, since: m.at });
  }
  const gild = moments.find((m) => m.kind === "goldPlate");
  for (const sq of z.gold) {
    if (gild?.square === sq && now < gild.at + B.gold.gildAt) continue;
    if (gild?.square === sq && now < gild.at + B.gold.shineAt) out.push({ square: sq, name: "goldFx", anim: "gild", since: gild.at + B.gold.gildAt, quiet: true });
    else if (gild?.square === sq && now < gild.at + B.gold.glintAt) out.push({ square: sq, name: "goldFx", anim: "shine", since: gild.at + B.gold.shineAt });
    // (Quiet: it glints every 2.6 s for the rest of the battle.)
    else out.push({ square: sq, name: "goldFx", anim: "glint", since: 0, quiet: true });
  }
  const c = clinkNow(boss, now);
  if (c) out.push({ square: c.square, name: "goldFx", anim: "clink", since: c.at });
  return out;
}

/**
 * His dough and gold on the board, each a canvas for every square, drawn only where a frame changes: the dough proofing, landing and
 * squashed under the pieces (your piece stands on the pancake); a rise's pop, the gilding, the glint and a clink over them.
 */
function ZebraLayer({ boss, orientation, moments, now }: BoardLayerProps) {
  const items = zebraItems(boss, moments, now);
  const under = items.filter((i) => i.name === "zebraDough" && !/Rise$/.test(i.anim ?? ""));
  const over = items.filter((i) => !under.includes(i));
  return {
    under: under.length > 0 ? <BoardEffects items={under} orientation={orientation} class="zb-under" /> : null,
    over: over.length > 0 ? <BoardEffects items={over} orientation={orientation} class="pw-fire-board zb-over" /> : null,
  };
}

// ---------------- A pawn bouncing off gold ----------------

/** The last pawn of yours that bounced off his gold, by battle: where and when (the clink plays for GOLD_FX's `clink`). */
const clinks = new Map<string, { square: string; at: number }>();
const battleKey = (boss: Pick<BossView, "id" | "startMove">) => `${boss.id}:${boss.startMove}`;
const CLINK_MS = 500;
function clinkNow(boss: BossView, now: number): { square: string; at: number } | null {
  const c = clinks.get(battleKey(boss));
  return c && now < c.at + CLINK_MS ? c : null;
}

/**
 * A move of yours the rules refused (Play.tsx's onRefused): a pawn's capture of his gold piece bounces off it, the clink on its
 * square and his line ("Ha! Pawns can't touch gold."). Nothing for any other refusal.
 */
export function goldClink(boss: BossView | null | undefined, fen: string, move: string, now = Date.now()): void {
  if (!boss || boss.id !== "zebra") return;
  const z = boss.powers?.zebra;
  if (!z || zebraStop(z, fen, move) !== "gold") return;
  const key = battleKey(boss);
  clinks.set(key, { square: move.slice(2, 4), at: now });
  if (clinks.size > 8) clinks.delete(clinks.keys().next().value!);
  const kit = bossKit(boss.name);
  const line = kit ? pickLine(kit, "clink", `${key}:clink:${now}`) : null;
  if (line) bossVoice.say(goldFor(line, true), `${key}:clink:${now}`, CRITICAL);
}

// ---------------- The oven timers ----------------

/** When this device last saw each lump's minutes (its roll plays as they drop), by battle and lump. */
const seenLeft = new Map<string, number>();
const nn = (n: number) => String(Math.max(0, Math.min(15, n))).padStart(2, "0");

/**
 * One oven timer, drawn on its own canvas from ZEBRA_TIMER's frames on a chain of timeouts (its roll's or ding's frames, then its
 * still): nothing per frame. `play`: the animation to run from now (`kRollNN`, `kDing`), else the still `kNN`.
 */
function TimerCanvas({ kind, left, run }: { kind: DoughPiece; left: number; run: string | null }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    const still = `${kind}${nn(left)}`;
    const draw = (anim: string, i: number) => {
      const a = ZEBRA_TIMER.anims[anim];
      const f = a?.frames[i];
      if (!f) return;
      g.clearRect(0, 0, ZEBRA_TIMER.w, ZEBRA_TIMER.h);
      g.putImageData(frameImage(ZEBRA_TIMER, f), 0, 0);
      cv.current?.setAttribute("data-frame", `${anim}:${i}`);
    };
    if (!run || !ZEBRA_TIMER.anims[run]) {
      draw(still, 0);
      return;
    }
    const frames = ZEBRA_TIMER.anims[run]!.frames;
    let timer = 0;
    const step = (i: number) => {
      if (i >= frames.length) {
        // (A ding ends on the timer's last look: the rise takes the lump away.)
        if (!run.endsWith("Ding")) draw(still, 0);
        return;
      }
      draw(run, i);
      if (frames[i]!.cue === "roll") play("zebraRoll");
      if (frames[i]!.cue === "ding") play("zebraDing");
      timer = window.setTimeout(() => step(i + 1), frames[i]!.ms);
    };
    step(0);
    return () => clearTimeout(timer);
  }, [kind, left, run]);
  return <canvas ref={cv} class="dd-timer" width={ZEBRA_TIMER.w} height={ZEBRA_TIMER.h} data-kind={kind} data-left={left} aria-hidden="true" />;
}

/**
 * His oven timers: a slot for each lump the rules allow at once (doughLive), in the boss bar's prop slot. A lump's slot shows its
 * minutes, rolling down each move; at 00:00 it rings as its dough rises (the rise's moment); an empty slot is a faint outline.
 */
export function OvenTimers({ boss, moments }: { boss: BossView; moments: () => Moment[] }) {
  const z = boss.powers?.zebra;
  if (!z) return null;
  const key = battleKey(boss);
  const ms = moments();
  const now = Date.now();
  // (A rise playing now: its lump's timer rings in its slot, though the lump has left the view. A drop: its timer shows as the lump
  // lands.)
  const rising = ms.filter((m) => m.kind === "doughRise" && now < m.at + m.ms);
  const landing = ms.find((m) => m.kind === "doughDrop" && now < m.at + B.drop.landAt)?.square;
  const slots: { lump: DoughLump | null; run: string | null; ding?: boolean }[] = [];
  for (let slot = 0; slot < BOSS_POWERS.doughLive; slot++) {
    const lump = z.lumps.find((l) => l.slot === slot && l.square !== landing) ?? null;
    if (lump) {
      const k = `${key}:${lump.n}`;
      const before = seenLeft.get(k);
      seenLeft.set(k, lump.left);
      if (seenLeft.size > 32) seenLeft.delete(seenLeft.keys().next().value!);
      // (Its minute dropped since this device last looked: the roll from the minute before, a quarter second.)
      const run = before !== undefined && lump.left === before - 1 && before >= 1 ? `${lump.piece}Roll${nn(before)}` : null;
      slots.push({ lump, run: run ?? (lump.left === 0 ? null : null) });
      continue;
    }
    slots.push({ lump: null, run: null });
  }
  return (
    <span class="dd-timers" role="group" aria-label="Don Dough's oven timers" data-lumps={z.lumps.length}>
      {slots.map((s, i) => {
        const ring = !s.lump ? rising.find((m) => m.square && slotOfRise(z, m.square) === i) : null;
        if (ring && ring.shape) return <span key={`r${i}`} class="dd-slot" data-slot={i} data-ring="1"><TimerCanvas kind={ring.shape as DoughPiece} left={0} run={`${ring.shape}Ding`} /></span>;
        if (!s.lump) return <span key={`e${i}`} class="dd-slot empty" data-slot={i} />;
        const l = s.lump;
        return (
          <span key={`l${l.n}`} class="dd-slot" data-slot={i} data-square={l.square} aria-label={`${PIECE_NAME[l.piece]} dough on ${l.square}: ${l.left} ${l.left === 1 ? "move" : "moves"} left`}>
            <TimerCanvas kind={l.piece} left={l.left} run={s.run} />
          </span>
        );
      })}
    </span>
  );
}

/** Which slot a lump that just rose on `square` had (this device's memory of the slots; 0 if it never saw it). */
const slotOf = new Map<string, number>();
function slotOfRise(z: { lumps: readonly DoughLump[] }, square: string): number {
  for (const l of z.lumps) slotOf.set(l.square, l.slot);
  return slotOf.get(square) ?? 0;
}

// ---------------- His moments ----------------

function dropMoment({ moment, cast }: MomentProps) {
  return <div class="power-moment pm-dough" data-square={moment.square ?? ""} data-kind={moment.shape ?? ""}>{cast("drop", B.drop.landAt - 260)}</div>;
}

function riseMoment({ moment }: MomentProps) {
  return <div class="power-moment pm-stay pm-rise" data-square={moment.square ?? ""} data-kind={moment.shape ?? ""} />;
}

function squashMoment({ moment }: MomentProps) {
  return <div class="power-moment pm-stay pm-squash" data-square={moment.square ?? ""} data-kind={moment.shape ?? ""} />;
}

function goldMoment({ moment, banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-gold" data-square={moment.square ?? ""}>
      {banner("GOLD PLATE!", moment.square ? ZEBRA_WORDS.gold : ZEBRA_WORDS.goldNone, "zebra")}
      {cast("gild", B.gold.gildAt)}
    </div>
  );
}

const MOMENTS: Record<"doughDrop" | "doughRise" | "doughSquash" | "goldPlate" | "openingTalk", MomentUi> = {
  goldPlate: {
    order: 2,
    kit: "ultimate",
    // (Eric, Nov 11: his line at the end, how your pawns are worthless against it; "her" for his queen, "it" for any other.)
    lineAt: B.gold.lineAt,
    line: (_, m) => goldClose(m.key, (m as Moment).shape === "q"),
    view: goldMoment,
  },
  doughSquash: { order: 3, kit: "power", line: (kit, m) => (kit ? pickLine(kit, "squashed", m.key) : null), view: squashMoment },
  doughRise: {
    order: 4,
    kit: "cheer",
    lineAt: B.rise.popAt,
    dock: () => ZEBRA_WORDS.rise,
    line: (kit, m) => (kit ? pickLine(kit, (m as Moment).shape === "q" ? "bigCheer" : "cheer", m.key) : null),
    view: riseMoment,
  },
  doughDrop: { order: 5, kit: "power", lineAt: B.drop.landAt, dock: () => ZEBRA_WORDS.drop, view: dropMoment },
  // (His comment on your opening: a line in his voice, no moment of its own.)
  openingTalk: { order: 6, kit: "power", line: (_, m) => openingLine((m as Moment).opening, m.pick ?? 0), view: () => null },
};

/** When this device first saw each of his moments at the start of his turn (they play from then), by battle and turn. */
const turnSeen = new Map<string, number>();

/**
 * His moments at the start of his turn, after your move (as your move lands: a squash, a rise, then Gold Plate), from this turn's
 * events marked `by` the crowd (and his `goldPlate`), each timed from when this device first saw it, one after another; his move
 * waits for them (zebraTurnMs).
 */
export function zebraTurnMoments(boss: BossView, now = Date.now()): Moment[] {
  const p = boss.powers;
  if (boss.id !== "zebra" || !p) return [];
  const list = p.events.filter((e) => e.turn === p.turn && (e.kind === "goldPlate" || ((e.kind === "doughRise" || e.kind === "doughSquash") && e.by === "crowd")));
  if (!list.length) return [];
  const seenKey = `${boss.id}:${boss.startMove}:${p.turn}`;
  let at = turnSeen.get(seenKey);
  if (at === undefined) {
    turnSeen.set(seenKey, (at = now));
    if (turnSeen.size > 20) turnSeen.delete(turnSeen.keys().next().value!);
  }
  const order = (k: string) => MOMENTS[k as keyof typeof MOMENTS].order;
  let t = at;
  return [...list]
    .sort((a, b) => order(a.kind) - order(b.kind))
    .map((e) => {
      // (Its banner's hold first, as momentsOf's: GOLD PLATE!.)
      const lead = bannerLeadMs(e.kind);
      const m: Moment = { kind: e.kind, key: `${boss.id}:${e.kind}:${e.turn}:crowd`, at: t + lead, ms: powerFxMs(e) - lead, ...(lead ? { lead } : {}), ...(e.square ? { square: e.square } : {}), ...(e.shape ? { shape: e.shape } : {}) };
      t += lead + m.ms;
      return m;
    });
}

export const ZEBRA_UI = {
  id: "zebra",
  // (Gold Plate comes at the start of his turn after the warning: after your move.)
  ultimate: { name: "Gold Plate", when: "After your move" },
  moments: MOMENTS,
  // His oven timers, in the boss bar's free room right of his bars.
  barProp: ({ boss, moments }) => <OvenTimers boss={boss} moments={moments} />,
  board: (p) => ZebraLayer(p),
} satisfies BossUi;
