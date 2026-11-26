# Boss alone and a raid on a computer: the shared frame (Nov 26, 2026)

- The director's brief (the shared game frame's third job): Boss alone and a raid on the 50 v 50's frame, reused (`board-size.css`: the same
  `--cf-*` sizes, gap and step, with two new knobs, `--cf-left` for the left column's width and `--cf-side-most` for the column's most).
  Eric kept the two-line boss bar (Nov 26: "I like the boss bar bigger"), so the board stays the size it allows: 602 at 1536 × 730, 832 at
  1920 × 960, and the same as before at every size tested. A phone, a tablet and a computer under 1100 px are unchanged.
- Every column on the board's lines, 28 px either side of the board (were 38 and 16 in Boss alone at 1536 × 730). The Moves panel runs from
  the board's top down to 12 px over the God King's frame, then the figures to the board's foot. The gear in its place, level with the bar.
- Calls:
  - **Boss alone's left column is the boss's** (`.tower-space`, where he stands): its edge is the gap's. It has no box to see. It takes half
    the room the block leaves (the other half stays right of the column), so the board is where a centered block puts it and the boss's
    room is at least the old layout's: centered, Babur's pump had no room at 1920 × 1080 and his board fell to the taller bar's 832.
  - **The figures keep their places from the board** and their sizes at 1536 × 730 and 1920 × 960. Elsewhere the room they grow into moved
    a little with the equal gaps (the board sits 12 to 14 px further right): your pawn and the God King 1.2 → 1.15 at 1280 × 800 and
    1.6 → 1.55 at 1920 × 1080; the boss 3.25 → 3.4 at 1440 × 900. A raid's are unchanged.
  - **The panel stops over the God King's frame, not his head.** His tallest pose (a beat's last frame) fills his frame, 200 px × his size
    over the board's foot, and the eric.md guard (boss-side.spec.ts) keeps every figure off the list's text. So the panel is taller than
    before (Boss alone 228 → 300 px at 1536 × 730, 343 → 480 at 1920 × 960; a raid 228 → 390, 343 → 620), not the board's whole height:
    the room under it is the figures'. Drawing him over the list would need that guard changed (Eric's OK).
  - **The figures stand on the squares' foot, the clock's bar under them** (as the boss always has): the guard measures them there.
  - **Not the Hidden Boss's fight, nor a Battle Tower floor** (`bossFramed`): his phase change and phase 2 keep phase 1's boxes (their own
    layout, hidden-boss-room.spec.ts); a floor has its own bar and column.
  - **Labels per #953's rule:** labels at 1536 × 730, 1920 × 960 and 1920 × 1080; icons at 1280 × 800, 1366 × 768 and 1440 × 900.
