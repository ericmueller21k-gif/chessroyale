# Town minimap test: its arrow step clear of the bots (Nov 25, 2026)

- Main 025406c went red: `[phone] town-controls.spec.ts:347` (the minimap) passed only on retry; a held ArrowUp didn't move you off [14,23] in 5 s.
- Cause: the step's square, [15,23], is inside the area the town's bots pick spots from (world.ts `freeSpot`: columns 14 to 29, rows 21 to 34). A bot standing there claims it (`taken`), and the walker rightly refuses a step onto someone's square, for as long as the bot stays (sampled locally: one of three 4.5-minute runs had a bot on [15,23] for over a minute). The app is right; the test chose squares where bots stand.
- Fix (test only): the minimap test walks [2,28] → [8,28] → [1,23] and looks round and steps from [1,23] to [2,23], all west of the park, where no bot stands. The same checks, at new squares. The spec's other arrow steps are already outside the bots' area.
