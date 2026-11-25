# Boss battle music (Nov 11, 2026)

Eric, Nov 11: "Wire boss battle music into the game." Jefferson (`grex`) first; Big Boy's and Hollow's two-minute versions
come next. The pieces and their lengths come from the music handoff (branch `stills/trailer-v2`, `boss-music/`; rebuilt by
`scripts/reel/music/handoff.py` on `claude/trailer-v2`). How it works: docs/areas/bosses.md, "Music".

## The director's calls (kept)
- **Files:** `packages/app/public/music/`, MP3 only (it decodes everywhere, iOS Safari included; half the download of both),
  only grex's pieces now. The app's `themes.json` lists only the bosses whose files ship; a boss without a theme plays nothing.
  Adding one = its files and its themes.json entry (`public/music/README.md`); the lengths are read from the file, never coded.
- **Loading:** fetched and decoded when the battle is picked (its loading step and intro: the boss is known), never at app
  start; kept for the visit (sound.ts's file cache). Late: it starts when it arrives, from its intro; the battle never waits.
- **Volume, the switch, the result, the background, iOS:** as briefed (its own GainNode into the master every sound goes through,
  the same context and unlock; "Music" beside "Sound", on by default, per device; Sound off silences it; the result fades it out).

## Calls made here
- **When it starts: the intro's end** (the "START!" banner's end, as the first move's clock starts: the phase is no longer the
  boss's intro). Not as "START!" shows: that moment is drawn by one screen, while the intro's end is in the match's own state, so
  one check in App.tsx (`musicBattle`) covers solo, raids, online, the Crowd's boss final and a battle rejoined in the middle (at
  once). The theme's own 6.7 s intro then leads into the first moves.
- **When it ends: as the battle is decided** (`boss.result` set), not when the result screen shows: the 1.5 s fade plays over
  the last move's moments (the mate attack, his defeat), so nothing plays on the result screen. The result phase, leaving the
  match, or another battle end it too.
- **Volume 0.25, not 0.35** (`MUSIC.volume`), by measurement, each where it sounds (RMS per channel): the theme 0.107 (its loud
  stretches, 400 ms windows, 0.13 at the 90th percentile); Jefferson's sounds 0.059 to 0.069 (the crackle's sparkle 0.024); the move
  knock 0.098. At 0.35 the music sat only 4 dB under his sounds (2.5 dB in its loud stretches); at 0.25, 7 dB (5 dB), and 11 dB under
  a move. The songs are all within half a dB of each other, so one level fits them all.
- **Switching off, mute, a hidden page: a 0.3 s fade to nothing; the sources keep running,** so switching back on fades the loop
  back in where it is (seamless, the least code). Music off from the battle's start: nothing is fetched; switched on mid-battle,
  the theme loads and starts from its intro. A new audio context (iOS's dead one rebuilt in a tap, sound.ts) restarts the loop.
- **A Music row in the match's options too** (the gear), under Sound: Settings isn't reachable mid-battle, and "turning Music off
  mid-battle" needs a switch there. Both switches are greyed while Sound is off (Eric's rule: greyed, never hidden).
- **Not precached** (vite.config.ts): 2 MB a theme would land on every phone at install. The service worker keeps a theme once
  fetched, like a picture (`MUSIC` in sw-template.js).
