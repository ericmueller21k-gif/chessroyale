import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { QUESTS, questCountdown, type QuestsAnswer } from "@chessroyale/core";
import { account, fetchQuests, mustSignInToPlayOnline, rerollQuestNow, setTestQuests } from "./account.ts";
import { testParams } from "./test-switches.ts";
import { TUTORIAL_SEEN_KEY } from "./tutorial.ts";

/**
 * Quests on home (Nov 9, phase 3; the server deals and pays them: server/quests.ts): the overlay's data, its once-a-day showing, the
 * reroll, and the test switch. The overlay itself draws what it's given (components/QuestsOverlay.tsx).
 */

/** This device's last XP day the overlay showed itself (a number: the day's start). e2e/helpers.ts starts every test with it set. */
export const QUESTS_SEEN_KEY = "hunchess.quests.seenDay";

/** Quests are yours: signed in, or anyone where sign-in isn't set up (as XP is). Null: not known yet (no account or config loaded). */
export function questsForYou(): boolean | null {
  const a = account();
  if (!a.profile || !a.config) return null;
  return !mustSignInToPlayOnline();
}

/**
 * The overlay shows itself on the XP day's first home visit (the design: "the first time you open the app each day"): signed in
 * (an account, not a guest), on this device, once a day. Everyone opens it from the Quests button any time.
 */
export function questsDueToday(a: QuestsAnswer): boolean {
  if (!account().profile?.user.signedIn) return false;
  try {
    // (Not over the first-time walkthrough: once it's closed, the next home visit shows it.)
    if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) return false;
    const seen = Number(localStorage.getItem(QUESTS_SEEN_KEY));
    return !(Number.isFinite(seen) && seen >= a.day);
  } catch {
    return false;
  }
}
export function markQuestsSeen(a: QuestsAnswer): void {
  try {
    localStorage.setItem(QUESTS_SEEN_KEY, String(a.day));
  } catch {
    // (No storage: it may show again on the next visit today.)
  }
}

/**
 * Each quest's count as this device last saw it, for your account (Nov 10, quest progress shown): back on home, a quest whose count
 * went up since was moved by a game, and the overlay opens to slide it. Stored per account, so another account's never counts.
 */
export const QUESTS_SHOWN_KEY = "hunchess.quests.shown";
/**
 * Set by e2e/helpers.ts (with QUESTS_SEEN_KEY): no opening by itself after a game, which would block a test's taps on home. A test of
 * it sets `test.use({ questsSeen: false })`.
 */
export const QUESTS_NO_POP_KEY = "hunchess.quests.noPop";

type Shown = { user: string; at: Record<string, number> };
function lastShown(user: string): Record<string, number> | null {
  try {
    const v = JSON.parse(localStorage.getItem(QUESTS_SHOWN_KEY) ?? "null") as Shown | null;
    return v && v.user === user && v.at && typeof v.at === "object" ? v.at : null;
  } catch {
    return null;
  }
}
function rememberShown(user: string, a: QuestsAnswer): void {
  try {
    localStorage.setItem(QUESTS_SHOWN_KEY, JSON.stringify({ user, at: Object.fromEntries(a.quests.map((q) => [q.id, q.progress])) } satisfies Shown));
  } catch {
    // (No storage: nothing slides, the overlay still shows the counts.)
  }
}
/** The quests a game moved since this device last saw them (the same quest, its count up): its id and the count it had. */
export function questsMoved(before: Readonly<Record<string, number>> | null, a: QuestsAnswer): Record<string, number> {
  const moved: Record<string, number> = {};
  for (const q of a.quests) {
    const was = before?.[q.id];
    if (typeof was === "number" && was < q.progress && was < q.target) moved[q.id] = was;
  }
  return moved;
}
/**
 * When each account last closed the overlay on this device (Nov 24, docs/decisions/2026-11-24-quests-gap.md): `{ [user id]: ms }`. For
 * `QUESTS.autoOpenGapHours` after it, the overlay doesn't open by itself (the day's first visit, a game that moved a quest); the Quests
 * button always opens it.
 */
export const QUESTS_CLOSED_KEY = "hunchess.quests.closedAt";
/** The overlay waits (doesn't open by itself): closed at `closedAt`, `now` is under the gap after it. A clock set back doesn't hold it. */
export function autoOpenWaits(closedAt: number | null, now: number, gapHours: number = QUESTS.autoOpenGapHours): boolean {
  if (closedAt === null || !Number.isFinite(closedAt)) return false;
  const gone = now - closedAt;
  return gone >= 0 && gone < gapHours * 3_600_000;
}
function closedTimes(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(QUESTS_CLOSED_KEY) ?? "null") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}
/** When `user` last closed the overlay on this device (null: never). */
export function questsClosedAt(user: string): number | null {
  const at = closedTimes()[user];
  return typeof at === "number" ? at : null;
}
/** The overlay closed (any way): it waits the gap before opening by itself again for this account. */
export function noteQuestsClosed(user: string, now = Date.now()): void {
  try {
    localStorage.setItem(QUESTS_CLOSED_KEY, JSON.stringify({ ...closedTimes(), [user]: now }));
  } catch {
    // (No storage: it may open by itself again as before.)
  }
}

function popsOff(): boolean {
  try {
    return !!localStorage.getItem(QUESTS_NO_POP_KEY);
  } catch {
    return false;
  }
}

/**
 * The test switch `?quests=<kind>[:<progress>],…` (test servers only, e.g. `?quests=warm-up:2,squad-up,regular:9`): your quests set
 * to these as home loads, once a page. Null: not asked.
 */
let testAsked = false;
function testQuests(): { kind: string; progress: number }[] | null {
  const v = testParams().get("quests");
  if (!v || testAsked) return null;
  testAsked = true;
  return v.split(",").map((part) => {
    const [kind, n] = part.split(":");
    return { kind: kind ?? "", progress: Math.max(0, Math.floor(Number(n) || 0)) };
  });
}

/** The countdowns as the overlay says them ("12h", "4d"), against the server's clock as it answered. */
export function questCountdowns(a: QuestsAnswer, receivedAt: number, now = Date.now()): { daily: string; weekly: string } {
  const gone = Math.max(0, now - receivedAt);
  return { daily: questCountdown(a.dailyResetAt - a.now - gone), weekly: questCountdown(a.weeklyResetAt - a.now - gone) };
}

/** Another of home's notices is up (the chat notice, the Welcome Crate's): the overlay doesn't open by itself over it. */
export function otherNoticeUp(): boolean {
  const p = account().profile;
  const welcome = p?.locker?.welcome;
  return !!p?.chatMod?.notice || (welcome?.notice === true && welcome.status !== "locked");
}

/**
 * Home's quests: fetched as home shows (whenever quests are yours), opened once on the day's first visit, after a game that moved one
 * (`from`: each moved quest's old count, the overlay slides it to its new one; Nov 10), and from the Quests button. `reroll`: today's free reroll (the answer replaces the list). `busy` (queueing, or another notice up; review of #575,
 * m3): as the answer comes in, the overlay doesn't open by itself and the day isn't marked seen, so it stays due until the next
 * home visit. Closed less than `QUESTS.autoOpenGapHours` ago (Nov 24), it doesn't open by itself either: the day stays due and the moved
 * counts unseen, so the next opening (the button's too) slides them. `manual`: the card is already showing (Chess Town's layer).
 */
export function useQuests(on: boolean, busy = false, manual = false) {
  const [answer, setAnswer] = useState<{ a: QuestsAnswer; at: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Record<string, number> | null>(null);
  // (Moved quests held back by the gap: the button's opening slides them.)
  const waiting = useRef<Record<string, number> | null>(null);
  const live = useRef(true);
  const busyNow = useRef(busy);
  busyNow.current = busy;
  useEffect(() => {
    live.current = true;
    if (!on) return;
    const asked = testQuests();
    void (asked ? setTestQuests(asked) : fetchQuests())
      .then((a) => {
        if (!live.current) return;
        setAnswer({ a, at: Date.now() });
        const user = account().profile?.user.id ?? "";
        noteQuestCounts(user, a);
        const moved = questsMoved(lastShown(user), a);
        const pop = Object.keys(moved).length > 0 && !popsOff();
        const due = questsDueToday(a);
        const free = !busyNow.current && !otherNoticeUp();
        const waits = !manual && autoOpenWaits(questsClosedAt(user), Date.now());
        if ((due || pop) && free && !waits) {
          if (due) markQuestsSeen(a);
          setFrom(pop ? moved : null);
          setOpen(true);
        }
        // (Held back (queueing, another notice, the gap): the old counts stay, so the next opening slides them.)
        if (!pop || (free && !waits)) rememberShown(user, a);
        else if (waits) waiting.current = moved;
      })
      .catch(() => undefined);
    return () => {
      live.current = false;
    };
  }, [on]);
  const reroll = useCallback((id: string) => {
    const got = (a: QuestsAnswer) => {
      if (!live.current) return;
      setAnswer({ a, at: Date.now() });
      rememberShown(account().profile?.user.id ?? "", a);
      noteQuestCounts(account().profile?.user.id ?? "", a);
    };
    void rerollQuestNow(id)
      .then(got)
      .catch(() => fetchQuests().then(got))
      .catch(() => undefined);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setFrom(null);
    noteQuestsClosed(account().profile?.user.id ?? "");
  }, []);
  const show = useCallback(() => {
    const moved = waiting.current;
    if (moved && answer) {
      waiting.current = null;
      setFrom(moved);
      rememberShown(account().profile?.user.id ?? "", answer.a);
    }
    setOpen(true);
  }, [answer]);
  return { answer: answer?.a ?? null, receivedAt: answer?.at ?? 0, open: open && !!answer, from, show, close, reroll };
}

/**
 * The end screen's quests (Nov 20, docs/decisions/2026-11-20-end-screen.md): the quests a match moved, each with the count it had.
 * Each quest's count as this page last read it (home's, the last end screen's), per account: the next end screen compares against it,
 * so each match shows its own moves, not every move since home. (Not home's QUESTS_SHOWN_KEY: home still slides what it hasn't shown.)
 */
let counts: { user: string; at: Record<string, number> } | null = null;
function noteQuestCounts(user: string, a: QuestsAnswer): void {
  counts = { user, at: Object.fromEntries(a.quests.map((q) => [q.id, q.progress])) };
}
/** One quest a match moved: the quest after it, and the count it had. */
export interface QuestMoved {
  quest: QuestsAnswer["quests"][number];
  from: number;
}
/** The answer for each grant, asked once: a second end screen for the same game (Squads' card, then its results) shows the same. */
const movedBy = new WeakMap<object, Promise<QuestMoved[]>>();
/**
 * The quests this game moved (its XP `grant` has come: the server counted them in the same batch). Against this page's last read, or
 * (none this page) home's last shown; none if neither knows the quest.
 */
export function questsMovedBy(grant: object): Promise<QuestMoved[]> {
  let p = movedBy.get(grant);
  if (p) return p;
  const user = account().profile?.user.id ?? "";
  const before = counts?.user === user ? counts.at : lastShown(user);
  p = fetchQuests()
    .then((a) => {
      noteQuestCounts(user, a);
      const was = questsMoved(before, a);
      return a.quests.filter((q) => q.id in was).map((q) => ({ quest: q, from: was[q.id]! }));
    })
    .catch(() => []);
  movedBy.set(grant, p);
  return p;
}
