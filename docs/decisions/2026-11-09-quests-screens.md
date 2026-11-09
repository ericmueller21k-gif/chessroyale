# Quests: the overlay, the entry and the 320 px top bar (Nov 9, 2026; XP phase 3)

- **The overlay** is the approved mockup's (`QuestsOverlay`), unchanged but for the paused line; home feeds it GET /api/quests
  (`quests.ts`). The mock (`quests-mock.ts`) is gone; `?quests=<kind>[:<progress>],…` (test servers only) now sets real quests.
- **By itself once a day:** on the XP day's first home visit, signed in (an account, not a guest: the brief's "(signed in)"), on this
  device (`hunchess.quests.seenDay` in local storage: no server write for a "seen"), and never over the first-time walkthrough (it
  shows on the next visit once that's closed). e2e/helpers.ts starts every context with it seen (`questsSeen` option), as the
  walkthrough's key, so a signed-in test isn't blocked.
- **The entry for everyone** (nothing hidden): enabled wherever quests are yours (signed in, or anyone where sign-in isn't set up, as
  XP), greyed with "Sign in for quests" for a guest where it is, and greyed while the account loads.
- **320 px:** the mockup's 36 px squeeze is gone. Below 344 px, with Quests in the bar, the logo becomes the app's icon (28 px, its
  words kept for screen readers) and every button keeps 40 px; home-layout.spec.ts's tap-target check is unchanged.
- **The toast:** a quest's line, "Quest done: Boss Hunter +300 XP" (· its crate and key), its crates and keys in the counts; titled
  "Quest done!" when no level or daily reward came with it.
