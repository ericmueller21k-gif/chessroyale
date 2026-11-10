# Desktop: Daily Quests in the left menu, not on the card (Eric, Nov 10)

Eric (his screenshot: notes/assets/eric-desktop-home-nov10.png on claude/director-notes): "the quest thing that we've put here, I don't
know where that came from ... put the quests on the left and get rid of it in the other spot ... it should be called, we don't need it
to say quests, it should be called like daily quests or rewards or something a little more polished."

The computer's home has a "Quests" pill on your card's top right (docs/decisions/2026-11-09-quests-mock.md: the card's entry on a
computer, since its top bar is hidden at 1024 px and up). The phone's entry (top bar) stays as it is.

## Do
1. Remove the card's Quests pill on a computer (and its icon-only fallback for a short card). The card keeps its size and layout.
2. Add **Daily Quests** to the computer's left menu, after "Play with friends" and before "Shop & crates", with the same clipboard icon
   in the menu's style (outline, like the others) and the same unread/finished dot the phone's top-bar button shows, if it has one.
   Tapping it opens the same quests overlay. Keyboard and screen-reader label as the other items.
3. Update the checks that look for the card's pill (list each old → new) and docs/areas/hub.md. If a guard in docs/rules/eric.md is
   touched, stop and say which.
One still of the computer's home after (stills/desktop-quests). Lane: light (a UI move). Effort medium. Decision note
docs/decisions/2026-11-10-desktop-quests.md (≤ 5 lines). Push to claude/desktop-quests at each step; as your LAST push write .pr-body.md
and .done together. Don't open the PR. Read CLAUDE.md, .claude/LESSONS.md and notes/briefs/rules-common.md first.
