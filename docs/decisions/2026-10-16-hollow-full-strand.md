# Hollow's whole strand of lights in every pose

Oct 16, 2026. Lane: characters.

## What Eric saw

A boss battle's header on his phone: Hollow in the boss bar holding a strand with only a few bulbs lit. His words:
"Remember… we had it updated so he has more lights. I think he does still during his ult, so we just need to take that
same sprite or whatever, that strand of light, and make sure it's showing for all of his animations."

## The cause

Every pose already painted the whole strand: ten bulbs, five down each half from his hand (Oct 9, "Hollow, polish
batch"). What took bulbs away was the countdown to his next cover of the dark: his figure wore a look from the battle's
state (`kits.ts`, Hollow's `lookOf` → `bulbs3`…`bulbs0`) that put a third of the strand out per move, 10 → 7 → 4 → 0
lit, and the dark-cast moment drew him with all ten out. A battle opens at `bulbs1` (one bulb on the strip before his
first move), so his figure showed four lit bulbs from the start; Eric's screenshot is that frame. Lights out plays on
the board without the look, so his ult showed all ten, as Eric remembered.

Measured: every frame of every animation (and his attack's) paints all ten bulbs, except the three frames where the
fresh strand spilled out of the void part-way (2, 4 and 6 bulbs).

## The call

- **His figure never wears the countdown.** All ten bulbs are lit in every pose he stands in through a battle. Hollow's
  kit has no `lookOf`; the dark-cast moment no longer passes `look="bulbs0"`; the test page's `wipLook` (only used to
  count his strand down) is gone.
- **The countdown is the strip's alone.** The three-bulb strip by the boss bar is unchanged: it is the countdown (it
  was always the one on screen in every layout, and it says the same thing).
- **The thirds still work.** Each bulb keeps its own palette keys, so the battle's colors (`lights.ts` swap) reach
  every pose, and `bulbs2`/`bulbs1`/`bulbs0` still put the right third out: his entrance lights the strand a third at a
  time, his defeat puts it out, a hit flickers it, Lights out smashes it in three sections.
- **Lights back:** the fresh strand drops out of the void whole, every bulb on it, its halves lengthening as it falls
  (55%, 70%, 85%, 100% of their length), lit a third at a time as before. The `out` option of `StrandSpec` (a strand
  only part-way out) is gone with it.

Note for the director: the brief asked to keep the thirds going dark "in every pose". The looks still work in every
pose (the keys are on every bulb), but his figure no longer wears them in battle, because that countdown on the figure
is exactly what took the bulbs away. One line brings it back (Hollow's `lookOf` in `kits.ts`) if Eric wants it.

## Tests

- `packages/app/test/hollow.test.ts`: every frame of every animation, his attack's included, paints all ten bulbs on
  its strand; every frame of the poses he stands in through a battle shows all ten, lit; the kit has no `lookOf`; the
  looks still put a third out each; the fresh strand drops lower frame by frame.
- e2e `hollow.spec.ts` and `king-attack.spec.ts` (phone and computer) pass unchanged.
- `scripts/frames-boss-character.mjs` reaches Boss alone through the Boss raid screen again (it still clicked the old
  home button).
