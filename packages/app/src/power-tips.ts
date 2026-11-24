import { POWER_TIPS as SCHEDULE, SPEECH, type PowerEventKind } from "@chessroyale/core";
import { account } from "./account.ts";
import { holdKing, kingBattle, kingFallen, kingVoice } from "./godKing.ts";
import { CRITICAL, bossVoice, holdMs, typeMs, type Voice } from "./speech.tsx";
import { testParams, testSwitchesAllowed } from "./test-switches.ts";

/**
 * Power tips (Eric, Nov 24; docs/decisions/2026-11-24-power-tips.md): the first time you see a boss's power, he says something to the
 * God King and the God King answers, explaining it in a line. "The worst case scenario would be just like you're not having fun because
 * you don't know what's going on." Then again now and then (POWER_TIPS in settings.ts: the 1st, 3rd and 8th battle in which you see
 * that power, then every 5th), never every game.
 *
 * - **One table** (`TIPS`): a tip is a boss, a short power key, the power event that brings it (the first such moment in a battle;
 *   `first`: only a moment with, or without, its `first` mark) and its exchange, 1 to 3 lines, each the boss's or the God King's. A new
 *   tip on an existing event kind is one more row.
 * - **When:** counted per account on this device (`brc.tips.<account id or "guest">.<boss>.<power>`), as the power's first moment in a
 *   battle comes; that battle's count says whether it plays (`tipDue`). Once a battle at most. A store that can't be read shows it
 *   (better to explain than not). Each player's own device decides, alone or in a group.
 * - **How:** through the speech bubbles (speech.tsx), at the critical priority, as the moment's own line would be (BossPowers'
 *   useMomentSpeech): the boss's lines in place of his line for that moment, the God King's once the line before has typed out
 *   (`replyMs`), each line keeping its own time. His ordinary lines are held until his part is over
 *   (godKing.ts holdKing): no double talk; mid-line as it comes, the exchange starts later, so his answer comes as that line ends.
 *   Fallen, he says nothing.
 * - The test switch `?tip=all` plays every tip in every battle (stills, e2e).
 */

export interface TipLine {
  who: "boss" | "king";
  text: string;
}
export interface PowerTip {
  /** The boss's id (BOSS_ROSTER). */
  boss: string;
  /** A short key for the power, for its count. */
  power: string;
  /** The power event that brings it; `first`, when set, must match the moment's own `first` mark. */
  trigger: { kind: PowerEventKind; first?: boolean };
  lines: readonly TipLine[];
}

const boss = (text: string): TipLine => ({ who: "boss", text });
const king = (text: string): TipLine => ({ who: "king", text });

/** Every tip (the pilot's five, Nov 24). */
export const TIPS: readonly PowerTip[] = [
  {
    boss: "birdie",
    power: "train",
    trigger: { kind: "trainSignal" },
    lines: [boss("All aboard! Clear the tracks!"), king("See the yellow sign? Move that piece. His train only hits the one under the sign.")],
  },
  {
    boss: "hollow",
    power: "dark",
    trigger: { kind: "dark" },
    lines: [boss("Don't forget what's there..."), king("It's only dark. The piece is still on that square. Remember where it was!")],
  },
  {
    boss: "sawyer",
    power: "split",
    trigger: { kind: "split" },
    lines: [boss("Measure once, cut twice!"), king("He sawed his pawn in two. Now he has an extra one.")],
  },
  {
    // (A lock at the end of his turn, once his first captures have taught them: not the taught captures' own, `first`.)
    boss: "chandy",
    power: "lockOn",
    trigger: { kind: "lockOn", first: false },
    lines: [boss("Target acquired."), king("A crosshair means he's hunting that piece. Each one he takes upgrades his rifle. Keep it safe!")],
  },
  {
    boss: "clown",
    power: "pie",
    trigger: { kind: "pie" },
    lines: [boss("Pie in your face!"), king("Nobody can step on the splattered squares for a while. And two splats on the same piece freeze it!")],
  },
];

/** Whether the tip plays in the battle that brings a power's count to `count` (1, 3, 8, then every 5: 13, 18, ...). */
export function tipDue(count: number, s: { at: readonly number[]; every: number } = SCHEDULE): boolean {
  if (s.at.includes(count)) return true;
  const last = s.at.at(-1) ?? 0;
  return count > last && s.every > 0 && (count - last) % s.every === 0;
}

/** The tip a boss's moment brings, if any (by the boss who cast it and the moment's kind and mark). */
export function tipFor(bossId: string, m: { kind: PowerEventKind; first?: true }): PowerTip | null {
  return TIPS.find((t) => t.boss === bossId && t.trigger.kind === m.kind && (t.trigger.first === undefined || t.trigger.first === !!m.first)) ?? null;
}

const countKey = (t: PowerTip) => `brc.tips.${account().profile?.user.id ?? "guest"}.${t.boss}.${t.power}`;

/** One more battle in which this power was seen (this device, this account): the count now; null when the store can't be read. */
export function countTip(t: PowerTip): number | null {
  try {
    const n = (Number(localStorage.getItem(countKey(t))) || 0) + 1;
    try {
      localStorage.setItem(countKey(t), String(n));
    } catch {
      // (Read but not written: it counts again next time.)
    }
    return n;
  } catch {
    return null;
  }
}

/** `?tip=all` (a test switch), as the page opened or now: every tip in every battle. */
const ALL_ASKED = (() => {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").get("tip") === "all";
  } catch {
    return false;
  }
})();
const allTips = () => (ALL_ASKED && testSwitchesAllowed()) || testParams().get("tip") === "all";

/** This battle's decisions (by tip): the moment that brought it, and whether it plays. */
const decided = new Map<string, { key: string; show: boolean }>();
let decidedIn = -1;

/**
 * Whether this moment plays its tip (the tip, else null). The first moment of a tip's kind in a battle counts the battle and decides;
 * the same moment asked again (another screen) gets the same answer, any later one in the battle none.
 */
export function tipNow(bossId: string, m: { kind: PowerEventKind; key: string; first?: true }): PowerTip | null {
  const tip = tipFor(bossId, m);
  if (!tip) return null;
  if (decidedIn !== kingBattle()) {
    decided.clear();
    decidedIn = kingBattle();
  }
  const id = `${tip.boss}.${tip.power}`;
  let d = decided.get(id);
  if (!d) {
    const n = countTip(tip);
    decided.set(id, (d = { key: m.key, show: n === null || tipDue(n) || allTips() }));
  }
  return d.key === m.key && d.show ? tip : null;
}

/**
 * Plays a tip's exchange: each line in its speaker's voice at the critical priority, keyed `key:tip:i` (`key` is the moment's own line
 * key, so a floor of several shows it in its boss's bubble), the next once the one before has typed out (`replyMs`). Said again (the
 * same key), nothing new.
 */
export function playTip(tip: PowerTip, key: string, now = Date.now()) {
  const voiceOf = (l: TipLine): Voice | null => (l.who === "boss" ? bossVoice : kingFallen() ? null : kingVoice);
  // (His own lines held until his part is over: from `from`, the time the lines from `i` on take to come and his last to be read.)
  const holdFrom = (i: number, from: number) => {
    const rest = tip.lines.slice(i);
    const last = rest.map((x) => x.who).lastIndexOf("king");
    if (last >= 0 && !kingFallen()) holdKing(from + rest.slice(0, last).reduce((ms, x) => ms + typeMs(x.text) + SCHEDULE.replyMs, 0) + holdMs(rest[last]!.text));
  };
  const say = (i: number, at: number) => {
    const l = tip.lines[i];
    if (!l) return;
    const k = `${key}:tip:${i}`;
    const v = voiceOf(l);
    if (!v) return say(i + 1, at);
    // (A critical line already up in that voice, said before the tip (his warning on your queen): this one starts as it ends, rather
    // than wait in the voice's queue, where a long one would outlast SPEECH.waitMs and drop it.)
    const up = v.line(at);
    if (up && up.priority >= CRITICAL && up.until > at && !up.key.startsWith(`${key}:tip:`)) {
      holdFrom(i, up.until);
      setTimeout(() => say(i, Math.max(up.until, Date.now())), up.until - Date.now());
      return;
    }
    // (Each line keeps its own time, as every line does (boss-speech.spec: up whole for its time, gone within a second after it; Eric:
    // "a few seconds… not that long"): the answer starts as it has typed out, so the two are up together for most of it.)
    if (!v.say(l.text, k, CRITICAL, at)) return say(i + 1, at);
    holdFrom(i, at);
    if (i + 1 < tip.lines.length) after(v, k, l.text, (t) => say(i + 1, t));
  };
  // (The God King mid-line (a critical one, said before the tip): the whole exchange starts later, so that his answer comes as that line
  // ends, the boss's line still up beside it, rather than the boss's line long gone by then.)
  const j = tip.lines.findIndex((x) => x.who === "king");
  const up = j > 0 && !kingFallen() ? kingVoice.line(now) : null;
  const natural = now + tip.lines.slice(0, j).reduce((ms, x) => ms + typeMs(x.text) + SCHEDULE.replyMs, 0);
  const start = up && up.priority >= CRITICAL && !up.key.includes(":tip:") && up.until > natural ? now + (up.until - natural) : now;
  if (start === now) return say(0, now);
  holdFrom(0, start);
  setTimeout(() => say(0, Math.max(start, Date.now())), start - now);
}

/** Calls `next` once the line `key` (in `voice`) has typed out and `replyMs` more have passed; if it never comes up, after its wait. */
function after(voice: Voice, key: string, text: string, next: (at: number) => void) {
  const gaveUp = Date.now() + SPEECH.waitMs + 500;
  const look = () => {
    const up = voice.line();
    if (up?.key === key) {
      const at = up.at + typeMs(text) + SCHEDULE.replyMs;
      setTimeout(() => next(Math.max(at, Date.now())), Math.max(0, at - Date.now()));
    } else if (Date.now() > gaveUp) next(Date.now());
    else setTimeout(look, 100);
  };
  look();
}
