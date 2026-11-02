# Brief: Timber's own sounds

Worktree `/home/user/cr-tsound`, branch `claude/timber-sounds` (from main). Opus high. Push as you go.

## Why
Eric, Nov 2: "We got to get new sounds for the beaver… He's using Big Boy's sounds… it should either be like a gnawing wood
sound… Wood knocking, cutting, saw, thumping." Timber (the beaver builder) has no sounds of his own: his select sound is
`bigboyClack` (`packages/app/src/characters/boss-select.ts`, `timber:`), and every cue in his kit's `sounds` (`characters/kits.ts`,
the Timber block: drop, stomp, pat, whoosh, tap, whack, point, oof, thump, clatter, cheer, slap, pull, show, clack, chomp, burp)
borrows another boss's. Also check his town tap sounds, his power/ult sounds (the gnaw, the build, the workshop) and anything else
that names another boss's sound for him.

## What to build
- `packages/app/src/characters/timber-sounds.ts`: synthesized like the other bosses' (`bigboy-sounds.ts`, `sawyer-sounds.ts`), and
  registered the same way (`sound.ts`, `boss-sounds.ts`). A set of his own, wood-themed: gnawing wood (teeth rasping and chips), a
  wood knock, a mallet/hammer tap on wood, a hand saw cutting, a heavy plank thump, a plank clatter, a tail slap on wood, plus
  whatever his cues need (a short beaver chitter for cheer/oof is fine). Not Sawyer's power saw: Sawyer owns the motor saw.
- **His select sound: the gnaw.**
- Replace every borrowed sound in his kit with his own. Keep the cue names and timings.
- Loudness in line with the other bosses (compare peak/RMS with two of theirs).

## For Eric first
Render each new sound to `docs/timber-sounds/<name>.wav` (16-bit mono, short), plus `select.wav` (the gnaw), and a
`docs/timber-sounds/README.md` listing each file and which cues use it. Eric listens before it merges.

## Done means
- The tests that pin boss sounds still pass (find them: grep the sound names in `packages/app/test` and `e2e`); add a unit test
  that Timber's kit and select sound name no other boss's sound.
- Typecheck clean. Run only the tests you change.
- PR-body file `docs/timber-sounds/pr-body.md`. Push. Don't open a PR.
