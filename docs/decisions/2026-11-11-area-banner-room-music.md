# The area banner and room music (Nov 11, 2026)

Eric, Nov 11, on the banner's mockup (`notes/mockups/2026-11-11-area-banner.*` on `claude/director-notes`): "super clean. That's
exactly what I was imagining." On the music: "add their music to the room, it loads when you walk in, then it will also be loaded
already when the fight starts, but to be clear, only play the music if you walk in on your own through the door, not via challenging
the boss. For zebra, since you have to walk in, it's fine to let his just play when you go in."

Eric, Nov 11 (scope update, through the director): when a battle starts from a challenge inside the boss's building, the boss's
theme starts the moment the boss's full-screen splash starts, not at the battle's "START!"; from the boss menu, today's timing (after
the intro). The intro decodes first and the loop right after; a theme not ready when the splash starts holds the splash until it is,
about 2 s at most (a setting), then goes on and the music joins when ready (Folio's hold is his crumpled paper held longer, every
other boss's his splash's last frame). The battle doesn't restart it at "START!". Zebra: his room theme, already playing, carries
straight through with no restart.

What changed: walking into a home's room through its door (the town's, or Rolling Dough's door between its rooms) shows its name on a
banner (`town/AreaBanner.tsx`, timings `AREA_BANNER` in settings.ts) and plays its boss's theme (`music.ts` `roomMusic`); arriving by a
challenge shows neither. A challenge from the town starts the theme as its splash starts (`splashMusic`, Town.tsx `stormIn`) and the
battle carries it on (`bossMusic` takes it over); a battle from the boss menu starts it after its intro as before. How it works: docs/areas/town-square.md ("Going in") and docs/areas/bosses.md ("Music").

Calls made:
- **The one place the splash waits:** `stormIn`, before `storm.out()`. Every splash already holds its covering frame until `out()`
  (Folio's crumple holds the ball), so the wait (`MUSIC.splashHoldMs`, 2 s, counted from the splash covering the screen) needs no
  per-boss code. The battle loads under it meanwhile, as before.
- **The theme loads at the door zoom for a town challenge too** (only loading; nothing plays until the splash), so the splash rarely
  waits. Called off before the splash: the theme is let go.
- **Walked in, then challenging from inside** (Don's back room, the only room you can challenge from today): the room's theme carries
  through the splash and the battle, as Eric said for Zebra.
- **Rolling Dough's back room:** its banner's subtitle is "BACK ROOM" over "ROLLING DOUGH" (Don's name is on the front room's).
- **A room without a boss** shows just the name (`areaBannerOf`); every room has a boss today, so its still drops the subtitle by hand.
- **Reduced motion:** shown for the same 2.8 s without fades.
