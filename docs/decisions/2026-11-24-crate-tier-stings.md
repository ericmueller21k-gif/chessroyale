# Crate opening: each rarity its own sting, quieter than the ticks; Fischer Random renamed Transcendent (Nov 24)

Eric (Nov 24): "can we make other sounds for the different rarities ... keep like common and uncommon the same, but like rare and
whatever goes up should each have their own"; "maybe it's just time to change the Fisher random name ... what's our highest rank? Is it
Transcendent ... switch the name to that"; "do away with the little king with the question mark and we actually make a cooler looking
crate in its place". On the clips: Common, Rare, Epic, Mythic and Transcendent fine; Legendary "sounds ... depressing"; all of them "a
little bit quieter than the ticking sound ... they hurt my ears a little bit".

- **Stings** (`crate-open/sounds.ts` `STINGS`, `sting`): Common and Uncommon share today's (Common's pitch). Rare a step brighter with a
  trembling shimmer an octave up; Epic a bass octave and a rising arpeggio; Legendary the big chord, a choir above it and a chime run to
  a high ding (the first try's tolling bell, whose partials hold a minor third, and its choir an octave down read as somber); Mythic a
  fanfare's change (flat six, flat seven, home), the choir and a bell on home, sparkles falling. No build-up before any burst.
- **Transcendent's sound**: a harp's sweep up a Lydian scale onto a held, trembling Lydian chord, a soft gong, a crystal ting. It plays
  on the strip's audio clock as the banner comes up (`T.bannerAt`, the moment `onStop` shows it) and replaces the banner's usual
  `bannerStart` (the director's call).
- **Levels** (`ENDING_DB`): measured with ffmpeg's ebur128 (momentary max) on the offline render: ticks -15.8 LUFS; before, the stings
  were 2 to 6 dB over. Now Common -21 climbing to Mythic -19, Transcendent -19.5, the box's land -23.5, its knocks -33; every ending's
  peak 5 to 9 dB under the ticks'. A unit test checks it the same way (K-weighted, 400 ms) with 2.5 dB of margin, so a louder sting
  fails before it reaches Eric's headset.
- Held notes fade over their last 0.15 to 0.4 s instead of being cut off (no click under the room's tail).
- **The rename** is player text only (the strip's tile, the banner "TRANSCENDENT!", the odds panel, the test switch's label, the FAQ);
  code names (`FISCHER`, `.fischer-stage`, `fischer=1`) stay, and the chess variant "Fischer Random" in the votes is untouched.
- **The tile**: an SVG in SupplyBoxArt's flat style (no art spend, the director's call): the supply crate gone prismatic (an
  iridescent violet-cyan-pink-gold sheen), a glowing star on its band, light breaking over its lid, sparkles; the tile's ground deep
  violet instead of gold. The crown with the question mark (`FischerArt`) is gone.
