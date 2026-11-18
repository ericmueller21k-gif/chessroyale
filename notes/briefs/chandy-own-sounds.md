# Chandy's own sound pack, and no boss ever uses another boss's sounds. characters lane. Opus, high

Branch `claude/chandy-sounds` from main. About 1.5 h. Read CLAUDE.md, `.claude/agents/characters.md`, `.claude/LESSONS.md`,
`docs/areas/bosses.md` (Chandy; sound packs), one existing pack for the house style (e.g. `packages/app/src/characters/bigboy-sounds.ts`:
synthesized with `synth.ts`, no files, no licenses, each quieter than a piece's move, a test measures them).

**Eric, Nov 18:** "I think I noticed a big boy sound reused in chandy, can't do that".
**What's there:** `packages/app/src/characters/chandy.ts` `CHANDY_SOUNDS` is all placeholders from other bosses' packs (23 cues: hollowTick,
pigDraw, mooHum, mooZap, bigboyClack, gingerWhoosh, hopperPop, hollowFizz, grexSparkle, grexFizz, gingerBurst, mooBeam, mooFizz, mooShimmer,
gardenerChime, sawyerCrack, gingerBlast ...). `CHANDY_CUES` (just above it) says what each should sound like.

1. **Chandy's own pack:** `chandy-sounds.ts`, synthesized in the house style, one sound per cue in `CHANDY_CUES` (fewer distinct sounds
   is fine where cues share one, e.g. lock/unlock), matching his character (read his lore/lines). Register them like the other packs
   (sound names `chandy…`), map `CHANDY_SOUNDS` to them only, and the power-art effects that use his cues.
2. **The whole roster:** check every boss's sounds (kits.ts `sounds`, power-art.ts EFFECTS per boss, boss-select.ts select sounds, each
   boss's own file) for a sound from another boss's pack. Found by the director's quick scan: only chandy.ts is clearly borrowing, but
   power-art.ts and boss-select.ts are shared maps: confirm each entry belongs to its own boss; fix any that don't with that boss's own sound
   (or a new one in its pack).
3. **Fix the cause:** one unit test over the registry: every boss's mapped sounds come from its own pack (its name prefix), so a
   placeholder from another boss can't ship again; note it in `.claude/LESSONS.md` (a short rule) and the bosses page.
4. Loudness tests as the other packs have; listen-check notes in the PR (each sound's intent, length, peak). Targeted lane.

Done: `.pr-body.md` (under 40 lines; changed checks old → new) and `.done`, end. No PRs, no CI waits.
