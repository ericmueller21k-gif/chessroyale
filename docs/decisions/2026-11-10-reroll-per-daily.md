# Quest reroll: one per daily, not one per day (Nov 10, 2026)

Eric (his playtest): "when I just refreshed a daily quest, it refreshed both of them. It should only refresh one, so you can
optionally refresh one or both." Reproduced on a local build: only the tapped quest changed, but the shared once-a-day reroll
greyed both buttons.

The call: each unfinished daily has its own free reroll a day. The replacement keeps the slot and is marked with the day
(new column `quests.rerolled_day`, added by `ensureSchema`'s COLUMNS), so it can't be rerolled again that day; tomorrow it
can. The swap goes in only while the old quest is there, so two tabs reroll it once. `quest_days.reroll_day` is no longer
written (kept, not dropped: the least stored-data change). `QUESTS.rerollsPerDaily` (was `rerollsPerDay`) is 1 only.

Review (#603): two dailies rerolled at once could deal the same kind (and one game pay both): the replacement now goes in only while you hold no quest of its kind (test: 40 accounts, two concurrent rerolls). Accepted: on the deploy day a quest the old shared reroll swapped can be swapped again (one day, no payout); a home open from before the deploy greys both rerolls until reloaded.
