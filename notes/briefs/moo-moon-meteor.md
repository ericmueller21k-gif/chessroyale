# Moo & Moon's Full Moon: the moon comes down and bursts into light (Nov 20). Opus, high. Boss lane (animation)

**Eric, Nov 20 (his words, the spec):** "I want to see in the sky like this big moon ... some of it's on the screen ... it takes up
basically the full width of the sky, and then it starts like coming downward ... almost like a meteor ... it doesn't move ... too quick,
but ... you can clearly see it ... it should be like ... four seconds for that first part, or 5 seconds, and it should show the moon like
bigger in the sky, and then it starts glowing using like that same kind of radiate. We want to reuse that one that Fable had built for
the hidden boss ... the same way the light looks there, because it looks perfect. And then it basically starts radiating ... whatever it
would look like for ... a star or a moon to explode. But it's not exploding ... it's a massive beam of light that blasts, and it covers
the full screen. And as it's ... covering ... the full ... first cinematic part, that's when it transitions and shows ... the close up.
... that's also where we need to add this like cool effect where ... you see that light sort of like hitting the cow and the moon a bit
more, because now there's like this big light in the sky."

Read CLAUDE.md, `.claude/LESSONS.md` (watch any animation frame by frame with real taps), `docs/rules/eric.md`, Moo's cinematic
(`packages/app/src/components/MooCinematic.tsx`, `MOO_CINEMATIC` in settings.ts: the field now 2.7 s, the close-up 4.2 s after #824;
`MOO_BEATS` in `packages/chess/src/bosses/moo.ts`), its decisions (`docs/decisions/2026-11-17-moo-cinematic.md`,
`2026-11-19-moo-cinematic-longer.md`), and **the Hidden Boss's light** to reuse (`packages/app/src/components/recluse-light.ts` and its
worker, `RecluseTransform.tsx`: the rays radiating over the whole screen and the white-out; reuse its sprites/drawing, don't redraw it).
Branch `claude/moo-moon-meteor` from main.
- **The field, about 5 s** (`fieldMs`): the moon big at the top of the sky, partly off screen, about the sky's whole width, comes down
  slowly and clearly (a meteor's line, not fast); then it starts glowing with the Hidden Boss's radiate (the rays, the glow), building
  into a massive blast of light that covers the whole screen (the white-out). At full white, the cut to the close-up.
- **The close-up:** comes in out of that light, the cow and the moon lit by it: a strong light from above/the moon's side on them
  (a rim light, a wash), easing as the eyes turn white, as today's eye fade.
- Then as today: back to the field, the transformation, the fade, the hop back. His thinking waits for it all (`MOO_BEATS`), so no clock
  runs; keep the whole about 13-14 s at most and say the total.
- Art: reuse the field and the close-up stills (the moon is already in the field's sky: lift or redraw only the moon as a sprite the
  scene can move; if a new drawing is needed it goes to the art runner, never by hand: ask the director).
- Light on a phone: the light's worker as the Hidden Boss's (off the main thread); the frame budget (`@perf` if the drawing changes).
Tests: `moo-wired.test.ts`'s beats (relative checks), the changed totals listed old → new. Stills or a GIF for Eric (the moon coming
down, the light filling the screen, the close-up lit). Decision note about five lines. Done: `.pr-body.md` (under 40 lines) and
`.done`; push and end. No PRs, no CI waits.
