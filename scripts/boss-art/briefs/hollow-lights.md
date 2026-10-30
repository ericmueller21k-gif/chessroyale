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
