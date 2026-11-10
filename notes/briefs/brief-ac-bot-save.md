# Auto chess: the bot saves when you save (Eric, Nov 10)

Eric: "it should look at how much gold you have at the beginning of the round and how much you spent, and basically know that if
you're saving a bunch of your gold, that it shouldn't spend a ton of its own gold necessarily, because that means it's going to end up
wasting a lot of pieces." Today the bot banks for interest on a 30% coin flip (`botBuys`, `packages/app/src/autochess/bot.ts` ~:70-74;
`AUTOCHESS.bot.saveChance`/`saveKeep` in settings.ts), blind to the player.

Build: the bot reads the player's gold **at the start of the round** and what they did in **earlier rounds** (never this round's buys:
they're hidden until the reveal). Player saving (e.g. 30+ banked, or banked last rounds): the bot leans to save, to the same interest
steps, buying only what it needs. Player spending down: the bot spends to keep up. Late rounds or low health: the bot spends whatever
the player does. All thresholds in settings. Unit tests: a saving player vs a spending player, the bot following each; the existing
"now and then" XP/reroll bounds still hold (adjust a bound only with a measured reason). Lane: targeted. Effort high. Decision note
docs/decisions/2026-11-10-ac-bot-saves.md (≤ 5 lines). Push to claude/ac-bot-save at each step; when done write .pr-body.md and push.
Don't open the PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
