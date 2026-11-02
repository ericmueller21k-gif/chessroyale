# Timber's own sounds: all wood, the gnaw his select sound

Eric, Nov 2: "We got to get new sounds for the beaver… He's using Big Boy's sounds… it should either be like a gnawing wood
sound… Wood knocking, cutting, saw, thumping."

**For Eric first:** listen to `docs/timber-sounds/*.wav` before this merges (the README there maps each file to his cues).

## What changed
- `packages/app/src/characters/timber-sounds.ts` (new): seventeen synthesized sounds, all wood: the gnaw (teeth rasping a log,
  chips flying), a chomp, a teeth clack, a knuckle knock, a paw's pat on his hard hat, a hammer tap, a hammer whack, a hand
  saw (by hand: Sawyer keeps the motor saw), a plank thump, a plank clatter, a tail slap, a swoosh, a plank sliding out of its
  strap, and his little beaver voice (a chitter, an "oof", a proud "hup!", a burp of sawdust). Registered like every boss's:
  `sound.ts` (`timber*` names, made ahead in the sound worker via `MAKE`) and `characters/boss-sounds.ts`.
- `characters/kits.ts`: every cue in Timber's kit plays one of his own (it borrowed Puddles', Alfil's, Smudgy's, Sawyer's, Big
  Boy's, Wrangler's, Chub & Chirp's, the tiger's and Moo's). Cue names and timings unchanged.
- `characters/boss-select.ts`: his select sound is the gnaw (`timberGnaw`, was `bigboyClack`); his town taps go in turn: the
  gnaw, the hand saw, a knock (`TOWN_SOUNDS.timber`; before, his select sound every time).
- Loudness fitted to Big Boy's and Sawyer's: about -25 dB mean (theirs -24.7 to -26), peaks 0.17 to 0.29 (theirs 0.17 to 0.28).
  Each takes about 2 to 30 ms to make (in the sound worker, ahead of the battle).
- `scripts/timber-sounds-wav.ts` renders the WAVs; `docs/timber-sounds/` holds them and the README;
  `docs/decisions/2026-11-02-timber-sounds.md`; `docs/areas/bosses.md` updated.

## Player-visible changes
- Timber sounds like a beaver builder: wood, teeth and tools, nothing borrowed. (He is admins-first: only admins see him yet.)
- His select-screen sound is the gnaw; tapping him in the town square plays the gnaw, a hand saw, then a knock, in turn.
- No new text on screen.

## Checks
- Added: `packages/app/test/timber-sounds.test.ts` (his kit's, select and town sounds are all his own and no other boss's; a
  sound for every cue in his animations and every sound of his used; each under a move's peak and mean and within 6 dB of it,
  the same every time; no bright dings).
- Changed or removed: none. No check in `docs/rules/eric.md` touched.
- Run locally: the new test, `boss-select`, `boss-kits`, `sawyer`, `bigboy`, `king-attack` (154 passed); `npm run typecheck`
  clean. No e2e changed; CI's selection includes `e2e/timber.spec.ts`, `boss-smoke`, `boss-select`, `sound`.

## Lane
Boss lane (boss content: his sounds and their wiring), light on logic: no rules, protocol or drawing changed. The director
decides whether it needs the boss lane's review pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
