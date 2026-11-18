import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { questCountdown, type QuestsAnswer } from "@chessroyale/core";
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
 * home visit.
 */
export function useQuests(on: boolean, busy = false) {
  const [answer, setAnswer] = useState<{ a: QuestsAnswer; at: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Record<string, number> | null>(null);
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
        const moved = questsMoved(lastShown(user), a);
        const pop = Object.keys(moved).length > 0 && !popsOff();
        const due = questsDueToday(a);
        const free = !busyNow.current && !otherNoticeUp();
        if ((due || pop) && free) {
          if (due) markQuestsSeen(a);
          setFrom(pop ? moved : null);
          setOpen(true);
        }
        // (Held back (queueing, another notice): the old counts stay, so the next home visit slides them.)
        if (!pop || free) rememberShown(user, a);
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
    };
    void rerollQuestNow(id)
      .then(got)
      .catch(() => fetchQuests().then(got))
      .catch(() => undefined);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setFrom(null);
  }, []);
  const show = useCallback(() => setOpen(true), []);
  return { answer: answer?.a ?? null, receivedAt: answer?.at ?? 0, open: open && !!answer, from, show, close, reroll };
}
