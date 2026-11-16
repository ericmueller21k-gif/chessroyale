/**
 * The Hidden Boss's phase 2 online, as this device shows it (Nov 13; the server runs it: packages/server/src/bosses/recluse.ts).
 * The server sends the whole of it on every change (`phase2`); this keeps it, turns the server's times into this device's, switches
 * the match's phase at the server's moments (the cutscene's hold, his phase change from `at`, the boards and their countdown, the
 * clocks from `clocksAt`), so everyone in the fight sees each at the same time, and plays his words and sounds as solo's do
 * (solo.ts: startPhaseChange, startClocks, phase2Slow, phase2Ult, phase2Result, phase2Done). Your move is shown at once and sent,
 * and kept over the server's word until that has it, decides your board, or refuses it (a word sent before it got your move, from
 * another board's, never puts your piece back). The screens are solo's (screens/Recluse2.tsx), through NetMatch's GameView.
 */
import { applyMove, legalMoves, sideToMove, type ClientMessage, type NetPhase2 } from "@chessroyale/chess";
import type { Phase, SimulView } from "./game.ts";
import { PHASE2_ULT_ANIMS, PHASE_CHANGE, phaseChangeRun } from "./recluse-phase2.ts";
import { RECLUSE_LINES } from "./characters/recluse-lines.ts";
import { playInPlace, setSuitAt, setFigureRun } from "./components/BossCharacter.tsx";
import { play, warmSounds } from "./sound.ts";
import { CRITICAL, LOW, NORMAL, bossVoice } from "./speech.tsx";
import { resetKingSpeech } from "./godKing.ts";

/** What phase 2 uses of its match (NetMatch). */
export interface OnlinePhase2Match {
  myId(): string | null;
  /** A server time as this device's. */
  local(serverTime: number): number;
  phase(): Phase;
  setPhase(p: Phase): void;
  emit(): void;
  send(m: ClientMessage): void;
  /** Your board's turn has begun (fair play counts look-aways from here), and your move made (how many there were). */
  turnBegins(): void;
  turnEnds(): number;
}

export class OnlinePhase2 {
  /** Phase 2 as the server last said (its times), with your move shown ahead of its word. */
  p: NetPhase2 | null = null;
  /** Its clocks are running (from `clocksAt`, this device's clock). */
  playing = false;
  /** The cutscene's hold before his phase change (this device's times), once told; the cutscene's scene reads it. */
  cutscene: { at: number; until: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cache: { p: NetPhase2; playing: boolean; me: string | null; view: SimulView } | null = null;
  private lines = { won: 0, lost: 0, slow: 0 };
  /** Your board's turn the look-aways count for (its move count), so a new turn starts them once (a pause ending isn't one). */
  private turnFrom: number | null = null;
  /**
   * The look-aways are counting (your turn, not paused), and those of this turn counted before a pause: one while the clocks are
   * paused (his move late) never counts, as your clock doesn't run then.
   */
  private counting = false;
  private awayHeld = 0;
  /**
   * Your move sent and shown, until the server's word has it (its board's history past `ply`), decides the board, or refuses it
   * (the review of #677, m2): its key, board, the move count it was made on, the move, and your board as shown with it.
   */
  private pending: { key: string; board: number; ply: number; move: string; shown: NetPhase2["boards"][number] } | null = null;

  constructor(private readonly m: OnlinePhase2Match) {}

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** The cutscene's hold: from `at` to `until` (server times). */
  onCutscene(at: number, until: number) {
    this.cutscene = { at: this.m.local(at), until: this.m.local(until) };
    this.m.emit();
  }

  /** The server's word: phase 2 as it stands (`refused`: your move wasn't played). Your move still on its way stays shown over it. */
  onMessage(p: NetPhase2, refused = false) {
    const prev = this.p?.key === p.key ? this.p : null;
    this.p = this.withPending(p, refused);
    if (!prev) this.begins(p);
    else this.cues(prev, p);
    this.show();
  }

  /** The server's word with your move on its way shown over it, until the server has it, decides your board, or refuses it. */
  private withPending(p: NetPhase2, refused: boolean): NetPhase2 {
    const w = this.pending;
    const b = w && p.boards.find((x) => x.id === w.board);
    if (!w || !b || refused || w.key !== p.key || b.result || b.history.length !== w.ply) {
      this.pending = null;
      return p;
    }
    return { ...p, boards: p.boards.map((x) => (x === b ? w.shown : x)) };
  }

  /** The connection is back: your move on its way, sent again (the server refuses it if it has it already: its `ply`). */
  onWelcome() {
    const w = this.pending;
    if (w) this.m.send({ t: "phase2Move", key: w.key, board: w.board, move: w.move, ply: w.ply });
  }

  /** Its first word (or this device's first, joining late): his figure's run through the phase change, his look, the sounds made ahead. */
  private begins(p: NetPhase2) {
    const at = this.m.local(p.at);
    // (The cutscene's hold, from his fall's end to his phase change: also for a device back during it, which missed its event.)
    this.cutscene = { at: this.m.local(p.cutAt), until: at };
    this.lines = { won: 0, lost: 0, slow: 0 };
    this.playing = false;
    // (Phase 1's words are over: the God King says nothing more; his mumbling carries on into the phase change, as solo's.)
    resetKingSpeech();
    warmSounds(["recluseSlow", "recluseSpark", "recluseArc"]);
    setFigureRun(phaseChangeRun(at));
    setSuitAt(at + PHASE_CHANGE.whiteFull);
  }

  /** The match's phase for now: the fall held through the cutscene's hold, his phase change, then the boards (counting down, then play). */
  private show() {
    const p = this.p;
    if (!p) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const now = Date.now();
    const at = this.m.local(p.at);
    const clocks = this.m.local(p.clocksAt);
    const boardsAt = clocks - PHASE_CHANGE.countdownMs;
    const cur = this.m.phase();
    const later = (t: number) => {
      this.timer = setTimeout(() => this.show(), Math.max(0, t - Date.now()));
    };
    if (now < at) {
      // (The cutscene's hold: the fall's screen stays, his scene over it.)
      later(at);
      return this.m.emit();
    }
    if (now < boardsAt && !p.done) {
      if (cur.kind !== "phaseChange" || cur.at !== at) this.m.setPhase({ kind: "phaseChange", at, splitAt: at + PHASE_CHANGE.crackAt });
      else this.m.emit();
      return later(boardsAt);
    }
    const playing = now >= clocks;
    if (playing && !this.playing) this.clocksStart();
    this.playing = playing;
    if (cur.kind !== "simul" || cur.at !== clocks) this.m.setPhase({ kind: "simul", at: clocks });
    else this.m.emit();
    if (!playing) later(clocks);
    this.turns();
  }

  /** The clocks start: his line (the God King stays greyed in his place). */
  private clocksStart() {
    const p = this.p!;
    const lines = RECLUSE_LINES.phase2;
    bossVoice.say(lines[Math.abs(hash(p.key)) % lines.length]!, `recluse:phase2:${p.key}`, NORMAL);
  }

  /** Your board's turn begun: fair play's look-aways count from it, but not while the clocks are paused. */
  private turns() {
    const b = this.mine();
    const t = this.playing && b && !b.result && b.turnAt !== null && sideToMove(b.fen) === "w" ? b.history.length : null;
    const on = t !== null && this.p?.paused === undefined && !this.p?.done;
    if (t !== this.turnFrom) this.awayHeld = 0;
    if (on && (!this.counting || t !== this.turnFrom)) {
      this.m.turnBegins();
      this.counting = true;
    } else if (!on && this.counting) {
      this.awayHeld += this.m.turnEnds();
      this.counting = false;
    }
    this.turnFrom = t;
  }

  /** What changed since its last word: a slow move, his ultimate, a board decided, every board decided. As solo's. */
  private cues(prev: NetPhase2, p: NetPhase2) {
    if (p.slow > prev.slow) {
      play("recluseSlow");
      // (The one that brings his ultimate: his ultimate's line instead.)
      if (p.ultAt === null || prev.ultAt !== null) {
        const lines = RECLUSE_LINES.slow;
        bossVoice.say(lines[this.lines.slow++ % lines.length]!, `recluse:p2:slow:${p.key}:${p.slow}`, LOW);
      }
    }
    if (p.ultAt !== null && prev.ultAt === null) {
      const at = this.m.local(p.ultAt);
      playInPlace(`recluse:ult2:${p.key}`, PHASE2_ULT_ANIMS, at);
      const lines = RECLUSE_LINES.ult2;
      bossVoice.say(lines[Math.abs(hash(p.key)) % lines.length]!, `recluse:p2:ult:${p.key}`, CRITICAL);
    }
    if (!p.done)
      for (const b of p.boards) {
        const was = prev.boards.find((x) => x.id === b.id);
        if (!b.result || was?.result || b.result.winner === "draw") continue;
        const key = `recluse:p2:${p.key}:${b.id}`;
        if (b.result.winner === "boss") bossVoice.say(RECLUSE_LINES.boardWon[this.lines.lost++ % RECLUSE_LINES.boardWon.length]!, key, CRITICAL);
        else bossVoice.say(RECLUSE_LINES.boardLost[this.lines.won++ % RECLUSE_LINES.boardLost.length]!, key, CRITICAL);
      }
    // (No result: his move never came. He says nothing; the screen says why.)
    if (p.done && !prev.done && !p.done.noResult) {
      const now = Date.now();
      const pickLine = (lines: readonly string[]) => lines[Math.abs(hash(p.key)) % lines.length]!;
      if (p.done.beaten) {
        setFigureRun({ since: now, anims: ["spellbook2"], loop: "spellLoop2" });
        bossVoice.say(pickLine(RECLUSE_LINES.beaten2), `recluse:p2:beaten:${p.key}`, CRITICAL);
      } else {
        setFigureRun({ since: now, anims: ["laugh2"], loop: "idle2" });
        bossVoice.say(pickLine(RECLUSE_LINES.victory), `recluse:p2:victory:${p.key}`, CRITICAL);
      }
    }
  }

  /** Your board (null: none, a Crowd final's watcher). */
  private mine() {
    const me = this.m.myId();
    return this.p?.boards.find((b) => b.player === me) ?? null;
  }

  /** You play a board of it (the match's leaving is resigning then: a bot plays it on). */
  get onBoard(): boolean {
    return !!this.mine() && !this.p?.done;
  }

  /** Your move on your board: sent, and shown at once (the server's next word confirms it, or puts it back). */
  move(boardId: number, mv: string) {
    const p = this.p;
    const b = p?.boards.find((x) => x.id === boardId);
    if (!p || !b || !this.playing || p.done || p.paused !== undefined || b.player !== this.m.myId() || b.result || sideToMove(b.fen) !== "w" || !legalMoves(b.fen).includes(mv)) return;
    const ply = b.history.length;
    this.m.send({ t: "phase2Move", key: p.key, board: boardId, move: mv, ply, away: this.awayHeld + (this.counting ? this.m.turnEnds() : 0) });
    this.counting = false;
    this.awayHeld = 0;
    const now = Date.now();
    const left = b.turnAt === null || p.ultAt !== null ? b.bankMs : Math.max(0, b.bankMs - (now - this.m.local(b.turnAt)));
    const shown = { ...b, fen: applyMove(b.fen, mv), lastMove: mv, history: [...b.history, mv], turnAt: null, bankMs: left };
    this.pending = { key: p.key, board: boardId, ply, move: mv, shown };
    this.p = { ...p, boards: p.boards.map((x) => (x === b ? shown : x)) };
    this.turnFrom = null;
    this.m.emit();
  }

  /** The screens' view (SimulView): your board first, every time this device's. */
  view(): SimulView | null {
    const p = this.p;
    if (!p) return null;
    const me = this.m.myId();
    const c = this.cache;
    if (c && c.p === p && c.playing === this.playing && c.me === me) return c.view;
    const mine = p.boards.find((b) => b.player === me);
    const order = mine ? [mine, ...p.boards.filter((b) => b !== mine)] : p.boards;
    const won = p.boards.filter((b) => b.result?.winner === "crowd").length;
    const lost = p.boards.filter((b) => b.result?.winner === "boss").length;
    const drawn = p.boards.filter((b) => b.result?.winner === "draw").length;
    const of = p.boards.length;
    const noResult = !!p.done?.noResult;
    const decided = won + lost + drawn === of || noResult;
    const view: SimulView = {
      from: p.from,
      playing: this.playing,
      won,
      lost,
      drawn,
      of,
      decided,
      beaten: !noResult && decided && won === of,
      slow: p.slow,
      lastSlow: p.lastSlow ? { board: p.lastSlow.board, at: this.m.local(p.lastSlow.at) } : null,
      ultAt: p.ultAt === null ? null : this.m.local(p.ultAt),
      paused: p.paused === undefined ? null : this.m.local(p.paused),
      ...(noResult ? { noResult: true } : {}),
      boards: order.map((b) => ({
        id: b.id,
        you: b.player === me,
        name: b.player === me ? "You" : b.name,
        number: b.number,
        fen: b.fen,
        lastMove: b.lastMove,
        history: b.history,
        bases: b.bases,
        bankMs: b.bankMs,
        turnAt: this.playing && b.turnAt !== null ? this.m.local(b.turnAt) : null,
        toMove: this.playing && !b.result ? (sideToMove(b.fen) === "w" ? "crowd" : "boss") : null,
        result: b.result,
      })),
    };
    this.cache = { p, playing: this.playing, me, view };
    return view;
  }

  /** The boss bar's word: nothing in the phase change, then how many are won (as solo's bossNote). */
  note(): string | null {
    const v = this.view();
    if (!v) return null;
    return v.playing ? `${v.won} of ${v.of} won` : "";
  }
}

/** A string's stable number (which of his lines this fight's moments say: the same on every screen). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
