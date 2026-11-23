/**
 * Birdie's lines (Nov 23; docs/decisions/2026-11-23-birdie-rules.md): **placeholders for Eric**, short, in a young conductor's cheerful
 * voice (Eric's own mourning dove on his toy diesel, who loves his train and his timetable).
 *
 * - `entrance`: his hello as the battle begins; `power`: his train's warning, said as he signals; `powerHit`: his train's ride.
 * - `ultimate`: his fall, as he's knocked off his train (the cutscene says the rest).
 * - The rest are every boss's beats.
 */
import type { Beat } from "./boss-beats.ts";

export const BIRDIE_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["All aboard! Next stop: checkmate!", "Tickets, please!"],
  move: ["Right on schedule.", "Choo choo!", "Next stop!"],
  capture: ["Coo!", "That one's off the line!", "Ticket punched!"],
  hurt: ["Hey! That was my car!", "Coo… ow."],
  strike: ["Ticket punched!"],
  thinking: ["Checking the timetable…", "Hmm, which track…"],
  check: ["Check! Mind the gap!", "Check! Clear the tracks!"],
  smug: ["Never late. Never.", "Coo coo!"],
  rattled: ["Oh no, oh no, delays!", "This isn't on the timetable!"],
  power: ["Train coming! Clear the line!", "Mind the crossing!", "Stand clear of the tracks!"],
  powerHit: ["Full steam ahead!", "Toot toot!"],
  ultimate: ["Whoa-oh-oh!"],
  victory: ["End of the line!", "Coo! Right on time!"],
  defeat: ["The last train's gone…", "Coo… out of steam."],
};
