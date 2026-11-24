# Splash music decoded late: carried, and logged as carried (Nov 24, 2026)

- Main went red at f0e89d7 (#920): `e2e/zebra-home.spec.ts:273` logged `music:splash:zebra` without `music:carry:zebra`. #920 didn't cause it: with the theme's decode slowed by 0.7 s, 8423926 (#919) fails the same way. On a busy CI runner the decode landed after the battle had registered, so `splashMusic`'s late branch handed the music to the battle (correct: one start, no restart) without logging the carry.
- Fix (music.ts): that branch logs `music:carry:<boss>` after `music:splash`, as `bossMusic` does. Players hear no change.
- The spec now polls for the music log (5 s) instead of reading it once as the battle shows: a decode can still land under the splash after that.
- Unit test: `music.test.ts`, "a splash whose theme decodes late, the battle already picked".
