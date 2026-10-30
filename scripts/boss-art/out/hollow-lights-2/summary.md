# Boss art (item): hollow-lights-2

- Model claude-opus-5-5, effort high, adaptive thinking. 9 turns, 5 renders.
- Spend: **$0.70** of the $2.65 cap (20 input, 41,926 cache-write, 180,469 cache-read, 22,717 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/hollow-lights-2/hollow-lights-2.tsx.
- Previews: scripts/boss-art/out/hollow-lights-2/preview/frames.png, scripts/boss-art/out/hollow-lights-2/preview/look.png. Each look it took: scripts/boss-art/out/hollow-lights-2/looks/.

## Its notes

I drew Hollow's String of Lights (id "hollow-lights", epic, weapon) as a single strand this time. It hangs from a twist of dark-green wire held up at the pawn's right side, at about (81, 33), with a small loop of slack above the grip. From there it falls in one gentle curve to about (92, 82). Five big C9 bulbs with grey sockets stick out from it in turn: left, right, left, right, and the last one hangs at the end. The left-pointing bulbs angle steeply downward so they stay clear of the collar and body. Each bulb reads on its own at 60 px. The bulbs are the painted part, all in the item's color with a white glint. The wire and sockets have fixed colors. There are no warnings, and the whole thing fits inside x 64–101 and y 23–97.

**Motion:** a chase down the string, 10 frames of 210 ms (about 2.1 s per loop).
- **Even frames:** one bulb is fully lit. It gets a near-white core, a soft halo in a light tint of its own color, and six small sparkle rays outlined in dark so they show on a white or a black pawn.
- **Odd frames:** a hand-over. The lit bulb fades to 60% while the next one warms to 40%.
- **Order:** top bulb to bottom, then the loop starts again from the top.
- **Unlit bulbs:** dimmed with a 32% dark overlay, so the lit one clearly stands out.

I checked it in red, yellow and midnight up close, and every color scheme at small size. In all of them the lit bulb reads as a white-hot sparkle, even at 60 px.

**Choices you might want to change:**
1. **Grip position:** it sits higher and further right (about x 81, y 33) than the brief's hand at (75, 50). That was the only way to keep five bulbs clear of the body within the square. Moving it down would put the bulbs back over the pawn.
2. **Sparkle rays:** I added them on top of the halo, because a halo alone doesn't show against a white pawn. Drop them if you want something calmer.
3. **Dimming:** the unlit bulbs are darkened by 32%. More would make the yellow bulbs look muddy, so I'd keep it there or lower.
4. **Export name:** the const is exported as `hollowLights2`, even though the item id is "hollow-lights" as asked. Rename it when you move it into Items.tsx.
