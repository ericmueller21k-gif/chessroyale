# Daily quests stop popping up for 12 hours; boss crates "Show unowned" (Nov 24). Opus medium, targeted lane

Eric (Nov 24): "for the daily quests ... once you hit got it, it shouldn't appear again. Let's put it on a 12-hour timer so it only
reappears for every person every 12 hours unless they manually go to the quest button, because it's actually getting annoying that it keeps
popping up." And: "consolidate the way all the boss crates show. Right now there's just like a long laundry list ... it can stay as a long
list, but next to boss crates it should say ... show unowned, and by default it's unchecked. So if you check it, then it will show the ones
you don't own."

Start: `git fetch origin main && git checkout -B claude/quests-gap-boss-crates origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/accounts.md` (quests), `docs/areas/shop.md` (Crates tab), `packages/app/src/quests.ts`,
`components/QuestsOverlay.tsx`, `screens/Crates.tsx` (~line 240, "Boss crates").

1. **Quests: 12 hours between pop-ups.** Today the overlay opens by itself on the XP day's first home visit (`QUESTS_SEEN_KEY`) and again
   after any game that moved a quest (the `pop`, quests.ts ~141). New rule: once the overlay is closed (Got it, ×, Escape, a tap outside),
   it doesn't open by itself again (neither kind) for 12 hours, per account on this device (key it by the account, like the other
   per-account keys). The Quests button opens it any time, and that's never blocked. A moved quest's slide animation simply waits for the
   next opening. One setting, `QUESTS.autoOpenGapHours: 12` (Eric's words in its comment). Keep the existing guards (not over the
   walkthrough or another notice; `QUESTS_NO_POP_KEY` for e2e).
2. **Boss crates: "Show unowned".** Beside the "Boss crates" title, a checkbox "Show unowned", unchecked by default: then only the boss
   crates you hold (count ≥ 1) show; checked, every boss crate shows as today. Remember the choice on this device (try/catch). With none
   owned and the box unchecked, one plain line in the list's place: "You have no boss crates yet. Check Show unowned to see them all."
   This hides rows by default on Eric's own ask (his exception to "nothing hidden": cite this brief in the decision note). Big tap target
   on a phone; light and dark mode.
3. Prove: typecheck; unit tests of the gap (closed at t, no auto-open before t+12h, auto-open after; the button always opens) and of the
   filter; one focused check added to an existing e2e spec for each (quests: closed then a game that moves a quest → no overlay; crates:
   the box unchecked → only owned rows, checked → all). One still per platform touched (phone and computer: the Crates tab with the box).
   Decision note of about five lines; area pages (accounts.md, shop.md). PR body in `.pr-body.md` (what changed, player-visible, changed
   checks old → new). `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names). American English.
