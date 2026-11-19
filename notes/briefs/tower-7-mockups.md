# Battle Tower PR 7: mockup stills for Eric (Nov 19). Opus, high. Light lane (no code merged to main)

Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, and the design `docs/decisions/2026-11-18-battle-tower-design.md` §2 "How
several bosses show", §4 (the room, for the strip only), §6 (home). The job: stills Eric approves before PRs 10 and 13 build them.
Stills only, pushed to branch `stills/battle-tower` (images never under docs/, never on main). Build each as a throwaway preview
(a scratch HTML/Preact page using the app's real CSS, tokens, fonts, sprites and portraits, rendered with Playwright), not app code.
Light and dark for the phone bar; the rest light. Phone 428x746 (Eric's) and computer 1440x900.
1. **The boss bar, 2 bosses and 3 bosses, phone:** today's bar split in equal parts, each figure smaller but whole (Nov 4 rule), its
   name, level and meter under it, the boss to move lit, the others dimmed never hidden; the bar's size the same as one boss's
   today (nothing shifts). Use real sprites (e.g. Ginger + Moo; Ginger + Moo + Chandy).
2. **Computer, 2 and 3 bosses:** the figures stacked beside the board, the boss to move stepped forward.
3. **The dock line** naming the boss: "[portrait] Ginger plays d4" (a portrait and a name, never an emoji).
4. **The run's strip** at the top of the game screen: "Battle Tower · Floor 4 of 99", the next floor's rating, beaten bosses as small portraits.
5. **The tower's own screen:** "Continue floor 5" / "Start a run", Solo or Party, your bests (phone and computer).
6. **The home row:** a third card under Other modes beside Boss Battle and Auto chess, a third wide each at 56 px, picture over name
   on the phone, "Climb 99 floors" on the computer. For the skyscraper picture use a plain placeholder box labeled "art runner"
   (art is drawn by the paid art runner, never by hand).
**Not here:** the room (PR 11: the art runner's still first). About 10 stills in all; mark any call you made on each in a short
`stills/battle-tower/README.md` on that branch. Done: push the stills branch, then an empty `.done` on branch
`claude/tower-mockups` (from main, nothing else on it); end. No PRs, no CI waits. Commits end with the `Claude-Session:` line only.
