# Review: claude/stranger-art (03d656f1), boss lane quick pass (Nov 27)

**1. Blocker (one line): his "Too slow." changes the Hidden Boss's voice.** `kits.ts:1342` maps his lines to `strangerVoice` in
`lineSounds`, which is keyed by the line's text alone (speech.tsx:95). "Too slow." (his capture line) is also the Hidden Boss's first
phase-2 taunt (`recluse-lines.ts:79`), said through the heard `bossVoice` (`recluse-phase2.ts:264`). Failing case: a phase-2 slash
with 3+ hearts left now plays the Stranger's "hm". Fix: reword his line, and test that none of his lines is another speaker's.

**2. Should-fix: the aura paints the whole figure a second time.** `stranger.ts:708-713` `auraPart` calls `paintFigure` again
instead of reusing the figure's canvas, once per aura strength (1, 1.5, 2). Measured in Node: figure 11 ms, figure + aura 21 ms per
pose. First builds: `idle` 141 ms, `think` 109, `smug` 114, `cast` 111, all 16 animations 963 ms (Chandy's whole set 248, Birdie's 144).
`prewarmAnims` (BossEffect.tsx:128) can't split one animation, so each is one long task, an estimated several hundred ms on a mid
phone, and idle is built synchronously the first time he's drawn. This lands when his rules wire him. Fix: build the aura from the
figure's canvas, and round the aura's strength to fewer keys.

**3. Nit: the test's palette loop checks nothing.** `stranger.test.ts:16` walks `ch.parts` before any frame is made, and they fill
lazily (0 parts at that point). `renderFrame` throwing on a missing color still covers it. Move the loop after the frames.

**4. Nit: the `ready` tips are clipped.** `stranger.ts:804` puts the tips at y ≈ 123, and the ground cut (`stranger.ts:687`, meant
for `kneel`'s planted swords) trims 1 to 2 px of them in the ready frames of draw, slash and cast.

**5. Nit: his hum plays on every move.** `move`, `powerHit` and `ultimateHit` use `nod`, which cues `hum` (`stranger.ts:989`), the
sound its doc calls his entrance's longer hum. If that's not intended, give him a nod without the cue for those moments.

**6. Nit (for the director):** the note quotes Eric as "drawn before moves", but `move` keeps the swords on his back (only capture,
check, strike and power draw them). That matches "keeps them put away most of the time"; worth confirming what Eric meant.

**7. Nit: a stale comment.** `effects/stranger.ts:3` says "Drawn, not wired", but the effect is already in `EFFECTS` (power-art.ts:674).

**Checked, fine:** no other kit, sound or the select changed; his imports are eager like other bosses', nothing is built at load;
every frame is whole in every look (x 3..124, y 2..124); the effect's stages, cues and end match the PR body; the design is original.
