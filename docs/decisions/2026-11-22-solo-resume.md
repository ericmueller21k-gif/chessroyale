# Solo boss battles: Resume or Forfeit after a reload (Nov 22, 2026)

Eric: "when you come back to Boss Battle with a game in progress: You have a game in progress, Resume or Forfeit?" Step 2 of
[solo-abandon](2026-11-22-solo-abandon.md); how: [accounts.md](../areas/accounts.md). Calls: Boss alone and a Solo raid only (Classic
awaits its rework; a 50 v 50's votes and chat, and the Hidden Boss's forms, aren't in the snapshot). Kept from your first move.

**Keep before show** (the third review of #885; every finding of the first two, I2, I3, D1, D2, D4 and D5, and the third's E1 and the Rush
and Lights out it saw in passing, was one bug: the battle showed something before the kept game held it). A kept battle never shows
what it hasn't kept: it keeps in the one place its updates reach the screen (`SoloMatch.show`, every `set` and `emit`), before they
do, whenever the kept game would change (the times alone don't write), and at each beat a timed moment's screen shows by the clock
alone (a Dodge's lines and teleports, the Rush's sweep, each Lights out round), 100 ms ahead of it, as at it. So your move as it's
accepted, before it's scored (I2), with the God King's call (D5) and, in a Solo raid, the bots' picks once planned (D1); a power-up as
it's used (D4); a timed moment's time into it and your inputs in it (`KeptGame.moment`, one field for every timed power: the Dodge's
vote, the Rush's placements, Lights out's rounds and taps; D2, E1) are all kept before they show. The director's shape (one place,
then the scattered keeps removed) held; the reveals need their own keep because the screen draws them from its clock with no update
at all. Measured (a Solo raid, 49 bots): about 56 updates a turn, 4 writes (5 before); its entry 46 KB, at 6x CPU throttle 0.3 ms an
update's check and 1.4 ms a write; Boss alone 6 updates, 3 writes, 6 KB. A rejoin carries a moment on from the time kept (no time
passes while away, as your turn's clock), never reopening it; one kept with Lights out begun goes on with it, never starting it again.
Until its first round is under way a rejoin keeps what it was kept with (EN1: his brain's loading step). Keeping the steps the old keeps
skipped meant two more rejoins: the dark's move due (kept as it flashes) is played, and a strike due after the crowd's move (kept on its
reveal) comes first. A stopped match's searches are never sent and its timers are cleared, so a step that found the stop at a keep
ends there (DN2), wherever the keep is.

Resume asks the server first. Any start with one kept asks first, a tower floor's at the clerk. Two tabs (the review of #885, I1): the
kept game names the tab playing it; Resume and Forfeit act on it as it is at the tap, never the card's copy; a Resume claims it, and a
tab whose game was taken over, ended or replaced stops at its next keep ("Played in another tab."), before it shows anything new. A
resign keeps first, so a tab taken over stops there and records nothing (EN2); a battle's own end keeps nothing (its result's update),
so its tab clears the kept game only while it holds it (DN4). Both are refused once its result waits to be sent ("That game has
already ended.", and that result goes), never for another tab's live note (the director's call on the delta review's D3: a page the
phone killed without `pagehide` leaves its note behind, and its own reload was locked out of the card and every solo start's Forfeit
for 10 minutes). A takeover is safe because the taking tab resumes at or after everything the other has shown (keep before show, the
third review's E1), and the other stops before showing anything new; a Forfeit is an explicit loss. A card on screen follows other
tabs (`storage` events), and shows while another tab plays the game.

Known, pre-launch (the review of #885; floors share both, left as they are): **N1**, time XP across a resume counts the time away
(the server times the game from its start: bounded by `soloMinutesPerDay`); **N2**, a reload while he thinks plays his reply again on
the rejoin, usually blind, but Chandy's first capture shows its crosshair before the keep (the one thing still shown before it's
kept: his move is a search's, kept once it's played; keeping it sooner needs the runner to take a planned move, a follow-up). A resume that can't start its first round
(N3) drops the game with "Couldn't resume that game."
