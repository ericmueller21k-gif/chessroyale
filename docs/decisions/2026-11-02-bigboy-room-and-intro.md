# Big Boy's room and battle intro (Nov 2, 2026)

Eric's design: a colorful ball-pit floor with stuffed animals in it, the shop and battle circle built over the pit and
joined by a walkway, a toy plane circling on a string as the showpiece, a toy-block theme. For the intro, six blocks stack
3-2-1 into the table, the board plops on top, two blocks drop as chairs, and rainbow swirly lollipops cover the screen.

Calls made:
- **Walking:** only the walkway, the shop platform and the circle are walkable. The ball pit is scenery, marked solid.
  That's the least code, and the walkway gives the room its shape.
- **The block table:** its top block sits at the height where the town's renderer lays the board's slab, so the
  existing board drawing works unchanged. The board balances on the single top block, as a joke.
- **The lollipop swirl:** built exactly like Alfil's sandstorm (a looping tile and a leading edge that code slides
  across), so one piece of code plays every boss's transition.
