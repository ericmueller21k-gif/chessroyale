# The area banner and room music (Nov 11, 2026)

Eric, Nov 11, on the banner's mockup (`notes/mockups/2026-11-11-area-banner.*` on `claude/director-notes`): "super clean. That's
exactly what I was imagining." On the music: "add their music to the room, it loads when you walk in, then it will also be loaded
already when the fight starts, but to be clear, only play the music if you walk in on your own through the door, not via challenging
the boss. For zebra, since you have to walk in, it's fine to let his just play when you go in."

What changed: walking into a home's room through its door (the town's, or Rolling Dough's door between its rooms) shows its name on a
banner (`town/AreaBanner.tsx`, timings `AREA_BANNER` in settings.ts) and plays its boss's theme (`music.ts` `roomMusic`); arriving by a
challenge shows neither. How it works: docs/areas/town-square.md ("Going in") and docs/areas/bosses.md ("Music").

Calls made:
- **The battle restarts the theme from its intro** (the default kept): the room's music fades out (1.5 s) as the battle is picked and the
  same decoded theme starts again as the battle starts. The intro is written to lead into the first moves ("START!"), and one rule for
  every battle (walked in or not) is simpler than handing a playing loop across screens.
- **Rolling Dough's back room:** its banner's subtitle is "BACK ROOM" over "ROLLING DOUGH" (Don's name is on the front room's).
- **A room without a boss** shows just the name (`areaBannerOf`); every room has a boss today, so its still drops the subtitle by hand.
- **Reduced motion:** shown for the same 2.8 s without fades.
