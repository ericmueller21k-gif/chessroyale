# Birdie's move: whistles, not puffing (Nov 23, 2026)

Eric: "I was thinking more whistles than the other stuff. Or we want a couple different whistles. And like the double whistle, you know how the trains go like toot toot?"
- Five whistles built in code (`birdie-sounds.ts`, the recipe's `whistle_wave`, one whistle function): toot, toot-toot, long, toot-long, peep-peep (the peeps on a higher set of pipes, E G B). One gain for the five; no puffing under them.
- The director's mapping (`birdieWhistle`): the double toot for most moves; one toot for a one-square move; the long blast for 5 squares or more; toot-long for a capture or a check; the peep-peep for about one move in five (a hash of the move and his move's number, so every device hears the same).
- The short run is gone (only his move used it). The medium, long and toot runs stay: his entrance, his ride, the town's ride loop (`BIRDIE_RIDE_LOOP`) and his challenge's wipe.
- *(mine)* With one gain, the peeps (short, higher) measure quietest by plain loudness, so the whistles' "heard" floor is a move's loudness minus 11 dB (the chirps and runs keep minus 9), and "a chirp over it reads" is measured up where the chirp sings (a steep high-pass, the chirp 12 dB over) instead of across the whole band, since the whistle is a steady tone in a band below the chirps, not low puffs.
