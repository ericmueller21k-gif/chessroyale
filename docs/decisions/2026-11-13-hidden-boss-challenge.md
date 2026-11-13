# The Hidden Boss's room challenge (Nov 13, 2026)

Eric's rules, built: challenge from his room only; four at most in it ("The door is locked."); leaving asks "Cancel your game
request?"; a 5-minute cap ("Sorry, not enough players."); the summoning; his fight together; admins' 3 test bots and online 🏆.
Calls:
- The room lives in the live hub's memory; a restart forgets it. A disconnect: 20 s silent.
- His fight: a party battle of four; a 2-2 tie goes by strength ("a deliberate blunder never wins a tie").
- Others in the room: plain pawns. Bots join 2 s apart, so each count shows.
- Online, his adult form only: winning it ends the fight.

## Review round (Nov 13)

The independent review (no blockers; `review/hidden-challenge`), and the director's call on each:
- **M1, bans:** `enter` and `challenge` run the same `banCheck` as PLAY (the account and the device cookie), cached beside `whoIs`, at
  most once a minute; a banned account gets 403 with `banned` and the ban notice. A look, a cancel and leaving go on.
- **m1, a start racing a cancel or a leave:** a seat in a starting request is kept. A cancel and a new visit keep an unread fight
  outcome, and the hub's answers wait while a fight is being made, so a Cancel or "Leave and cancel" just as the fourth joined hands you
  into the fight like the others. Only a closed tab leaves its seat empty (the others start at `joinWaitSec`, as before). My call: out of
  the town by then (the side menu), the app goes straight into the fight, without the summoning.
- **m2, the rest:** `hiddenFight` checks `boss:recluse` and `raid` and ends the request with the rest's line, so the admin's bots can't
  start a fight that would meet another boss under his name.
- **m3, a forced win stored as a team win:** accepted, as solo's Win this form does: the 🏆 is admin-only and the fight is a test game
  (no XP, quests or daily reward), but its result row still counts as a team win against him.
- **m4:** `hiddenDrop` runs after the solo battle's answer (`waitUntil`). PLAY, a party's START, Squads and 1v1 don't drop a room request:
  a known gap, only reachable with two tabs (an admin-tested case); no change.
- **n1:** the comments now say what drives the idle drop (the town's own away rule); no new code.
- **n2:** the count shows from the start, "Challengers 0 of 4", in the same place (greyed for anyone not in the count). The admin's
  "Fill with 3 bots" stays admin-only and shows once the server says `admin`: an admin tool, like the 🏆.
