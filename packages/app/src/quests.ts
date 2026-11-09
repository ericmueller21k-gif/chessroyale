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

/**
 * Home's quests: fetched as home shows (whenever quests are yours), opened once on the day's first visit, and from the Quests
 * button. `reroll`: today's free reroll (the answer replaces the list).
 */
export function useQuests(on: boolean) {
  const [answer, setAnswer] = useState<{ a: QuestsAnswer; at: number } | null>(null);
  const [open, setOpen] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    if (!on) return;
    const asked = testQuests();
    void (asked ? setTestQuests(asked) : fetchQuests())
      .then((a) => {
        if (!live.current) return;
        setAnswer({ a, at: Date.now() });
        if (questsDueToday(a)) {
          markQuestsSeen(a);
          setOpen(true);
        }
      })
      .catch(() => undefined);
    return () => {
      live.current = false;
    };
  }, [on]);
  const reroll = useCallback((id: string) => {
    void rerollQuestNow(id)
      .then((a) => live.current && setAnswer({ a, at: Date.now() }))
      .catch(() => fetchQuests().then((a) => live.current && setAnswer({ a, at: Date.now() })))
      .catch(() => undefined);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => setOpen(true), []);
  return { answer: answer?.a ?? null, receivedAt: answer?.at ?? 0, open: open && !!answer, show, close, reroll };
}
