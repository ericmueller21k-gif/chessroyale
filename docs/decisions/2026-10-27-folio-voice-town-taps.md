# Folio's voice: a chirp; a boss says something when you tap it in the town square (Oct 27, 2026)

Lane: `characters` (the director's own small change). Area pages: [bosses.md](../areas/bosses.md),
[town-square.md](../areas/town-square.md). Follows [2026-10-27-folio-wired.md](2026-10-27-folio-wired.md).

## What Eric asked for

After hearing Folio's voice (a whispered babble, as long as the line, on every line): "it's just actually slightly obnoxious
... it falls out of the norm for ... all the other sounds we have", then "we still want them to talk ... try something else
that's not quite as long or obnoxious." From three short candidates (A: a soft "mm-hm", B: a little crane chirp, C: a low,
slow murmur): "I like the [B] chirp for his one that he uses ... sounds like a kind of a bird chirp, which is what he is", and
"when you click on a boss in the town, he should make a noise. So ... let's add C as his town noise ... A is good too ... that
could also be just his town noise."

## What it is now

- **Folio's voice** (`voice` in `characters/folio-sounds.ts`, `folioVoice`): a paper crinkle, then two quick soft rising
  chirps, 0.32 s, the same for every line (it was 0.6 to 1.6 s by the line's length). Still played as each line starts, in the
  battle's voice only (`lineSounds`), at the same soft level as its other sounds.
- **A tap on a boss in the town square** opens its card and plays one sound (`townSound` in `characters/boss-select.ts`): its
  own town sounds in turn if it has any (`TOWN_SOUNDS`: Folio's murmur `folioMurmur`, then its "mm-hm" `folioHum`), else
  its select sound (`SELECT_SOUND`). Once a tap: the card's confirm ("Leave the town square?") is the same card, so it's
  silent. Phone and computer.

## The calls I made

1. **The other bosses say their select sound** in the town. Eric asked for a noise from every boss on a tap and named
   only Folio's; the select sound is each boss's own "hello", already tuned to sit under a move's loudness. Any boss can get
   town sounds of its own later with one line in `TOWN_SOUNDS`.
2. **Folio's two town sounds take turns** (murmur first), rather than a random pick: Eric liked both, and in turn you hear
   both within two taps.
3. **The sounds are made ahead as the town opens**, in the sound worker (`warmSounds`), so the first tap on a boss doesn't
   synthesize on the page's thread (Eric's rule, Oct 27: no frame drops). If audio hasn't started yet, the first tap makes
   it on demand, as every sound in the game does.

## Tests

- `packages/app/test/folio-wired.test.ts`: every line's sound is `folioVoice`; the chirp under 0.4 s; the two town sounds
  under 0.6 s (with the existing check that all its sounds stay under a move's peak and loudness).
- `packages/app/test/boss-select.test.ts`: `townSound` is the select sound for Babur on any tap, Folio's two in turn, and
  every boss with a home has one.
- `e2e/town.spec.ts`, the boss card's test: Babur's card opening plays `tigerHello` once, and its confirm opening plays
  nothing more.

## Test checks changed (none guards a rule in `docs/rules/eric.md`)

- `folio-wired.test.ts`: "each line in its own whisper, as long as the line (`folioVoiceFor`: short, medium, long)" →
  "each line with its chirp (`folioVoice`), under 0.4 s; its town sounds under 0.6 s".

## Player-visible text

None changed. (Sounds only.)
