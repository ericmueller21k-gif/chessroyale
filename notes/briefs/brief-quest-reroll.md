# Quest reroll: one per daily, not one per day (Eric, Nov 10, his playtest)

Eric: "Found a bug on when I just refreshed a daily quest, it refreshed both of them. It should only refresh one, so you
can optionally refresh one or both."

Today (`packages/server/src/quests.ts` `rerollQuest`, `QUESTS.rerollsPerDay: 1` in settings.ts, `quest_days.reroll_day`):
one free reroll a day shared by both dailies; using it greys both buttons (`QuestsOverlay.tsx` `rerollLeft`). The server
swaps only the named quest (`packages/server/test/quests.test.ts` "the reroll").

## Do
1. **First, reproduce what Eric saw** on a real build (`npx wrangler dev`, signed in, real quests, not `?quests=`): tap
   one daily's reroll. Do both quests' names change, or only both buttons grey? If both quests change, find why (the
   overlay's refresh, `ensureQuests` re-dealing, slots, the app's quest store) and fix it; say which in the PR.
2. **Each unfinished daily gets its own free reroll a day.** Rerolling one swaps that one only and greys only its button;
   the other keeps its own. A rerolled quest's replacement can't be rerolled again that day (its slot's reroll is used).
   Keep the nonce claim (two taps or two tabs: once per slot). Prefer the least stored-data change: e.g. track the day per
   quest slot (a column on `quests`, or the slots rerolled today in `quest_days`). If it needs a D1 migration, follow the
   repo's migration pattern and say so (full lane: the director adds `full-e2e` and a review).
3. API/view: per-quest `canReroll` (or `rerolled`) instead of the shared `rerollLeft`. `QuestsOverlay`: each button greys on
   its own (nothing hidden, Eric's rule). Settings: rename/redefine `rerollsPerDay` as per daily.
4. Tests: server unit tests (each daily once, the other still free, two tabs once, tomorrow fresh, the weekly never);
   update `e2e/home-layout.spec.ts` ~:598-602 (now: reroll the first, only the first greys, the second still works, then
   both grey). That spec line's change is Eric's own ask. FAQ: update any line that says "one reroll a day".

Effort xhigh (stored data, rewards). Decision note docs/decisions/2026-11-10-reroll-per-daily.md (≤ 120 words); update
docs/areas/hub.md (quests). Push to claude/quest-reroll at each real step; when done write .pr-body.md and push. Don't
open the PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
