# Quests: 12 hours between pop-ups; boss crates "Show unowned" (Nov 24, 2026)

Eric: "once you hit got it, it shouldn't appear again ... a 12-hour timer so it only reappears for every person every 12 hours unless they manually go to the quest button". And: "next to boss crates it should say ... show unowned, and by default it's unchecked."

- **Quests:** any close (Got it, ×, Escape, a tap outside; Chess Town's layer too) starts `QUESTS.autoOpenGapHours` (12) per account on this device (`hunchess.quests.closedAt`); neither auto-open (the day's first visit, a moved quest) fires inside it. The day stays due and the moved counts unseen, so the next opening, the Quests button's included, slides them. A clock set back before the close doesn't hold it.
- **Boss crates:** "Show unowned" beside the title, unchecked by default: only the boss crates you hold; checked, all (remembered on this device, `hunchess.crates.showUnowned`). None held: "You have no boss crates yet. Check Show unowned to see them all." Hiding rows by default is Eric's own exception to "nothing hidden" (brief `notes/briefs/quests-gap-boss-crates.md`, Nov 24).
