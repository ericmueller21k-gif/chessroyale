# Crates page tidy: used Welcome Crates gone, a clearer order, admin last; the opening bigger on a computer (Nov 25). Opus medium

Eric (Nov 25, screenshot of the Crates tab on a computer): "these welcome crates go away once they've been used ... they just shouldn't
even appear ... anymore ... refactor this page a bit ... put the admin stuff all the way at the bottom so I know what it's going to look
like for every user ... on the desktop, the present is too small ... relative to the size of the screen ... the present needs to be bigger.
The whole thing should be a bit bigger on desktop to match the size of the screen. The phone looks great. ... the boss tokens are good, but
... it's like hard to see what's going on this page ... I do know we need to get rid of the welcome crates because ... they look like
there's something you could do with them, but they've already been used, so they're useless."

STARTS AFTER the bonus crate (`claude/bonus-crate`) merges: it touches the same screen. Start from origin/main then. Read CLAUDE.md,
`.claude/LESSONS.md`, `docs/rules/eric.md` ("nothing hidden, nothing shifts": Eric's own exceptions here are cited below),
`docs/areas/shop.md`, `screens/Crates.tsx`, `welcome-rows.ts`, `crate-open/crate-open.css` and `CrateOpenStage.tsx`.

1. **Used Welcome Crates are gone:** a Welcome Crate row shows only while it can still be opened or is mid-progress (not yet fully opened /
   its reveal not yet seen). Once fully opened and its reveal seen, its row is not shown at all (Eric's own exception to "nothing hidden").
   Its rides stay in the locker as today.
2. **A clearer order (director's design; Eric: "I'm not quite sure how we need to fix it"):** top to bottom:
   1. the keys/crates line (as now);
   2. **Ready to open:** everything you can open now, one list: Welcome Crates still to open, your regular crates, your boss crates, and the
      Boss crate choice when you have one to pick. Plain empty line when there's none ("Nothing to open right now.").
   3. **Boss tokens** (as now: the strip and its line);
   4. **All crates:** the catalog (Beta, Winter, the Mythic crate, every boss crate) with the "Show unowned" box (as #920 made it), each row
      opening its page (odds, contents) as today; the "Boss crate choice" row when there's nothing to choose stays here, greyed;
   5. **Admin: test grants**, admins only, at the very bottom.
   Keep the rows' look; this is order and grouping, with clear section titles. Phone and computer, light and dark.
3. **The opening bigger on a computer:** on a computer the crate opening's stage (the strip, the box, the beam, the card) scales up to fill
   the middle column sensibly (the box and strip clearly larger, about matching the column's width; the card readable, not huge). The phone
   stays exactly as it is (Eric: "The phone looks great"). Keep transforms/opacity only; frame rate unchanged (measure once on the computer).
4. Prove: typecheck; unit tests for the welcome rows' visibility; the touched e2e specs (shop, welcome-crate, crate-banner) plus one focused
   check each: a fully opened Welcome Crate shows no row; the admin box is the page's last section; on the computer the box's size is at
   least a set share of the column. Stills on orphan `stills/crates-page-tidy` (never under docs/): the Crates tab phone and computer (as a
   user and as an admin), the opening on a computer at the box and at the card. Decision note (about five lines), shop.md. PR body in
   `.pr-body.md` (changed checks old → new). `.done`, push, stop. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By, no model names).

## Also in this job: #923's delta re-review follow-ups (Nov 25)
- **The bonus card's OK takes no tap until its fade-in ends** (`cardAt + cardMs`): a double tap on Done/Open another (first tap brings the
  card up, the second lands on its OK at 160-300 ms while it's nearly transparent) or a tap about 860 ms in now closes it unseen and clears
  the unseen record (`Crates.tsx:905-912`, `crate-open/CrateOpenStage.tsx:309-312`). Nothing is lost (the crate is granted). Test it.
- **The odds line for admins:** `Crates.tsx:615` uses `bonusOddsLine()` (players' pool); the server rolls `bonusPool(admin)`; pass
  `bonusPool(profile?.admin)` so an admin's line is exact too.
- **Older Safari (< 15.5) has no `inert`:** guard the item card's buttons with a disabled/pointer-events fallback while the bonus card is
  up and during the calm.
- Tests: a reload before OK brings the bonus card back; the client's `?bonus=0`.
