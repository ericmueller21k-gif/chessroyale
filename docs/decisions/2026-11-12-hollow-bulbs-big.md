# Hollow's bulbs: your ten bigger, his strip six counting every move (Nov 12, 2026)

Eric, Nov 12: "The 10 hollow bulbs need to be way bigger"; on the v2 mockups: "put them on the desktop, shove it to the right again,
and just keep it that same size... mobile seems fine too... make it six bulbs. And then put them underneath the bar, and then make it
our moves count as well. So then each one of those goes out every turn... easier to see those bulbs going out."

- **Your ten:** a computer's 190 px (was 110; exactly 2x the 95 x 15 drawing, so every pixel is 2 x 2 and crisp), a phone's 114
  (was 95, 1.2x); right-aligned where they were; never wider than the bar's free room. Same drawing, wire and fizz.
- **His strip: six, one out per move, yours and his** (`stripLit`). No rule change: `darkEvery` stays 3, so three of his moves and
  three of yours fall between two covers. **The start (my call):** 2 lit before his first cover (your first move and his, which
  brings it), so the count is always "moves until his next cover"; then 6 at each cover. Raids and online: the crowd's move counts.
- **Its width is the rage meter's, its drawing pixel for pixel** (my call): a computer's bar has only 11 px under its 88 px meter,
  a phone's meter is 44 px, so two drawings, 44 x 11 and 88 x 11 (`bulbStrand`, `bulbStrandWide`); the row keeps its 11.25 px, so
  the bar and the board don't move. A bulb on your move goes out without the pop (your move already knocks); his keeps it.
