# Boss alone has no clock (Oct 21, 2026)

## What Eric asked for

Eric (Oct 21), testing Boss alone: "It shouldn't be turn-based, because then the engine just moves for you and there's no
punishment... either make it so that it's just unlimited or 10 minutes... if it is 10 minutes, I think we should add a
pause feature... Or again, it can just be infinite time when you're playing by yourself. I don't think there's an issue
with that... I sometimes I'm just doing it while I'm trying to do other things at once."

## The call (director): unlimited

- **Boss alone has no move clock** (`bossAloneUntimed`, on in `RAID_SETTINGS`; `SoloMatch.untimed`): nothing counts down,
  no move is ever played for you, and you can leave a move for as long as you like. No pause button is needed, since
  there's nothing to pause.
- **Why not 10 minutes with a pause:** more to build (a pause, a total clock, what a pause does to the boss's moments) for
  the same result, and a game you play alone gains nothing from a clock: nobody waits on you.
- **No background hour clock:** Boss alone runs on the phone, not on a server, so there's no server room to time out.
- **Kept timed:** the Hidden Boss's bullet clock (his ultimate is the clock; admins only), Solo raids with bots, online
  raids, and any test link with `?clock=` (the clock and missed-move tests use it). The powers' own timed parts (Hollow's
  Lights out rounds, Chub & Chirp's carrot race) are unchanged.
- **On screen:** with no deadline the timer bar, the big 3-2-1 and the dock's clock don't show (they already hide without
  one). A God King strike just holds your move until it's over.

## Player-visible text

- FAQ, Boss alone: "...You pick every move." → "...You pick every move, and there's no clock: take as long as you like."

## Later

- The hippo gardener's seeds come on a real-time timer ("play slow, more seeds"). With no clock in Boss alone, a player who
  walks away would feed him seeds: his rules must pause the seed timer while it's your move in Boss alone (or count only
  while the app is open and in view). Noted in his design.
