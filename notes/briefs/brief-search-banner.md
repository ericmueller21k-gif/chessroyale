# Search while you browse: one banner for every queue (Eric, Nov 10)

Eric (paraphrased, his words in quotes): tap a mode and you go into its lobby or search; you can go back and keep searching. While
searching, a banner at the top says what you're searching for and for how long, with a cancel. "It should be like a solid banner,
nothing see-through behind it. It should overlap on the profile a little bit. It should overlap completely where it shows like how
many players are online ... not blocking the icons at the top because you can still click on those." While queued, "gray out the
ability to tap on any other modes on the main page ... you can go to your shop, you can go to your inventory, but you can't tap on
other game modes". Tapping one (e.g. Chess Town) opens "a pop-up ... you are currently in queue. Would you like to cancel your
queue?" In a lobby (50 v 50, Squads): an exit "but stay in the queue", e.g. a checkbox "Keep me in the queue" next to Exit. "We
just want every container to have the same pattern and theme as the rest, so nothing looks out of place."

**The mockup is the spec.** On claude/director-notes:
- the stills `notes/assets/search-banner-phone.png`, `search-banner-desktop.png` and `search-popup-phone.png`;
- their code, `notes/assets/search-banner-mock.spec.ts`;
- Eric's own screenshot of the area, `notes/assets/eric-banner-area-nov10.jpg`.

What the mockup shows:
- **The card:** a solid `--fd-panel` card with a 2 px `--fd-line` border and an 18 px radius.
- **Its contents:** a green spinning ring; "<Mode> · <m:ss>" with the time in green; "Searching · <queue type>" under it; a Cancel button.
- **Phone:** over the online-count row, its bottom 22 px over the profile card's top, with the top icons clear.
- **Computer:** across the top of the two middle columns.

## Build
1. **One app-wide "search" state** for every queue:
   - 1 v 1, which already has one: `DuelQueueBar` / `setAwaySearch` (docs/areas/ranked.md, "Browsing while queued");
   - the 50 v 50 crowd's queue and lobby;
   - Squads' queue and lobby (solo queue and party).

   Generalize the 1 v 1 one; don't build a second. The connection that holds your place lives with the app, not the screen.
2. **The banner** replaces today's slim `dq-` bar.
   - On home: as the mockup shows, as an overlay.
   - On other screens (shop, locker, profile, friends, settings): the same card at the top, under the screen's header, never covering a header button.
   - Nothing shifts (Eric's rule). Off home, pick a place that doesn't move the page, and say how.
3. **While searching:**
   - PLAY, the mode buttons, Chess Town, Boss Battle, Auto chess and any other "play" entry are greyed in place, not hidden.
   - Tapping one opens the pop-up from the mockup: "You're in a queue", with "Keep searching" and "Cancel search" (red).
   - Shop, locker, profile, friends, quests and settings work normally.
4. **In a lobby:** an "Exit" with a checkbox "Keep me in the queue", checked by default and remembered.
   - Checked: you go home and the banner shows.
   - Unchecked: you leave the queue, as today.
   - When the match is found while you browse: the existing found alert (sound and buzz), and you're taken in, as 1 v 1 does today.
5. Tapping the banner (not Cancel) takes you back to the lobby or search screen.

**Lane:** targeted, but this touches online sync and the lobbies' seats and connections, so effort xhigh.

**Tests:**
- e2e for each queue: going home while searching, the banner and its timer, a greyed mode's pop-up, Cancel, Keep searching, and a match found while away.
- The lobbies' "Keep me in the queue".
- The 1 v 1 tests updated for the new banner; list each changed check.

**Docs:** decision note `docs/decisions/2026-11-10-search-banner.md` (≤ 120 words), and the `docs/areas` pages for hub, matchmaking, ranked, squads and crowd.

**Stills** (on stills/search-banner): home on a phone and a computer while searching, the pop-up, and a lobby's Exit.

Push to claude/search-banner at each real step; when done write `.pr-body.md` and push. Don't open the PR. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md` and `notes/briefs/rules-common.md` first.

**Not in this job:** auto chess against people. It has no server today, so it gets its own design next.
