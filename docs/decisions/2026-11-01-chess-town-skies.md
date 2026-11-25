# Chess Town's button: day, dusk and night (Nov 1, 2026)

Eric: "make a version of it that's a darker version. So when it's dark at night, the default is like… the town has like dark with like the lights on the houses
and that sort of thing", by the phone's time of day. After he saw it live, the director added: today's dusk sky already reads as "dark", so three looks.
Area: [hub.md](../areas/hub.md). Builds on [2026-11-01-home-chess-town.md](2026-11-01-home-chess-town.md), whose "the sky is fixed (the pictures' dusk)" this replaces.

- **Three looks from the same drawings, by the device's local time** (the director's hours): **day** 06:00 to 17:00, **dusk** 17:00 to 19:00 (exactly the pictures as they were), **night** 19:00 to 06:00.
  Read once as the page loads (like the 50/50 A/B), never swapping while you look. `?sky=day|dusk|night` forces one (`?night=1` is night, `?night=0` dusk); anyone's address, like `?town=`.
- **Palette swaps, no new art** (`home-art/looks.ts`): day has fuller colors and unlit glass windows, night has every color darker and cooler with the windows and lamps lit warm. The same parts at the same
  places in every frame, the same idle loop (the skyline's blinking windows still blink: sun glints by day, a lamp turned down at night). The sky is the button's CSS gradient (`.fd-town[data-sky]`), the same in both themes.
- **Night's loose pixels:** a dozen fixed stars up in the sky (the top rows, where the name doesn't reach) and a soft glow round each lamp, laid only on pixels that are empty in every frame of the loop, so nothing is covered or moves.
- **The hours live in `home-art/town.ts` (`TOWN_SKY_HOURS`), not core's `settings.ts`:** they are only this picture's, and a change in core runs every e2e spec on a pull request.
- **"No flash":** the sky and the look are chosen in the first render (a constant read at load), so day's colors never show before night's; the picture is drawn the same way as before.

## Checks

None guards a rule in `docs/rules/eric.md`; no existing check was changed. New: `packages/app/test/home-art.test.ts` (the clock's edges 05:59, 06:00, 16:59, 17:00, 18:59, 19:00; `?sky=`; every pixel of the drawing in its place in each look),
`e2e/home-polish.spec.ts` "Chess Town's button under day, dusk and night…" (the edges by the clock, nothing moves or resizes, the name keeps its look, no swap while you look).
