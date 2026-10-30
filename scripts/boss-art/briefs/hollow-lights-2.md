# Hollow's String of Lights (a weapon, Boss Series Crate #1)

Draw **Hollow's String of Lights**, a crate weapon your pawn carries. Hollow is the game's darkness boss, a lanky shaggy
creature (the references), who holds a string of big old-fashioned Christmas lights in his hand, its two halves hanging
down with five bulbs each.

- A string of big, chunky Christmas bulbs on a dark wire, held up at the pawn's right side (the hand at about x 75, y 50)
  and hanging in two loops, or draped round from the hand: whatever reads best at 60 px. Five to seven bulbs, each with
  its socket.
- The bulbs are the painted part (the item's color: all the same color, each with a little glint); the wire and the
  sockets are fixed (dark green or black wire, grey sockets).
- **Its motion:** the bulbs **glow and twinkle**: one at a time brightens with a soft glow around it while the others
  dim a little, chasing along the string (about 2 seconds a loop, 8 to 10 frames). Draw the glow as a soft halo in a light
  tint of the bulb's color (p.flameFill or lighten(p.hex, …)), so it works in every color.
- "Yeah, this thing is sweet": cozy and a little spooky, warm light in the dark.
- Tier: epic. Name it "Hollow's String of Lights", id "hollow-lights".

## Second try: what read badly the first time
The first drawing (scripts/boss-art/out/hollow-lights/hollow-lights.tsx: you may read it) hung seven bulbs in two loops
from x 55 to 90, so half of them sat over the pawn's body and the whole thing read as a cluttered tangle at 60 px; the
glow was a faint pink ring that barely showed. This time:
- Keep every bulb clear of the pawn's body (the body reaches x 75 at its base, about x 66 at y 50): hang the string
  from the pawn's side, out to the right and down, or let it trail in one clean swag. Five bulbs, bigger and spaced so
  each one reads alone at 60 px.
- The lit bulb must clearly glow: a bright core (near white at its center) and a halo that reads on the dark ground, and
  the dim ones visibly dimmer, so the chase reads at 60 px.
- Keep the name and id ("hollow-lights").
