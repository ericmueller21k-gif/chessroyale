# Room music off; Birdie's token wired (Nov 23, 2026)

- **Eric (Nov 23):** "walking into a building no longer triggers the boss's music. I want that to stop." His call on how rooms work.
- **What changed:** `ROOM_BOSS_MUSIC: false` (core settings.ts). Walking into any building (each boss's home, the tower's lobby and floor room, the Hidden Boss's house) leaves the town's music playing: no boss theme, no fade, and nothing loaded at the door unless it's a challenge. A challenge's splash and the battle still play the boss's theme, unchanged.
- **Call made:** the room-music code stays (music.ts `roomMusic`, shops.ts `roomTheme`); one gate, shops.ts `roomMusicFor`, so `true` brings Nov 11's behavior back in one line.
- **Also:** Birdie's token (`claude/boss-art` at 0746234e, approved by the director) copied into `components/tokens/token-birdie.ts` and mapped.
