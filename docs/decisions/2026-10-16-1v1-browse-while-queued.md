# 1 v 1: browsing while queued (Oct 16, 2026)

Eric (Oct 16, evening), on the search stage: "we just need something more on this vs screen if they are sitting there
idling waiting for an opponent like a back button or they can view inventory", and "for now just put a button or a
text or something that indicates return to lobby/main page while searching, no confirmation needed when they tap it."
He approved the design: a way home that keeps you queued, a slim bar on every screen while queued, a sound and a buzz
when found while browsing (straight to the versus stage), a confirm only before another mode, "Few players online"
still reaching you, and nothing breaking on a reload or a phone's sleep. How it works now:
[docs/areas/ranked.md](../areas/ranked.md), "Browsing while queued". The calls made building it:

- **"‹ Home" at the stage's top left,** a pill like a back button, rather than a second button by Cancel: the space
  under the stage is kept for "Few players online" and Cancel (so the pawns never move), and top left is where a way
  back is looked for. Its spoken label says the search goes on; the bar appearing at once says it on screen.
- **The bar's words:** a pulsing green dot, "Searching 1 v 1 · 0:42 ›" (the chevron says it opens something) and
  Cancel, one line, at the top of every screen, under the maintenance banner. The whole of its words is the button back
  to the stage (a big target). Cancel leaves the queue with no confirm, like the stage's Cancel, and the page you're on
  stays. The bar pushes the page down (the maintenance banner's way: `--banner-h` is now the banner's `--maint-h` plus
  the bar's `--qbar-h`), so it covers nothing, and sheets and dialogs cover it.
- **The bar sits over everything from `main.tsx`,** beside the maintenance banner, not inside each screen: App has many
  screens and returns, and one component mounted once can't be missed by one of them. App says what it shows after
  every render (`setAwaySearch`); the bar redraws itself once a second for the wait.
- **"Few players online" in the bar, its choices on the stage:** at 45 s the bar turns gold and says "Few players
  online · 0:45 ›"; its words take you to the stage, where Keep waiting and Play a bot (unranked) are, as before. Three
  buttons don't fit a slim bar at 320 px, and pulling someone out of the shop unasked would be rude. Keep waiting now
  lives on the queue (`keepWaiting`), so it holds as you come and go.
- **Found while browsing:** `bannerStart` (the fight banner's start, already loaded) and `navigator.vibrate` 90-60-160
  ms, neither while sound is off; the page you were on closes (after the game, Home is home), and the stage opens with
  the game's own waiting and versus moment, so the found moment plays whole (the e2e measures it). The buzz and sound
  are only for a find while browsing: on the stage the found moment is on screen already.
- **The only confirm, "Leave the 1 v 1 queue?"** ("Starting this ends your 1 v 1 search.", Stay / Leave queue, Stay
  focused): before anything on home that starts another mode (PLAY for 50 v 50 or Squads, the Boss raid's choices,
  Boss alone, a lobby made or joined). 1 v 1's PLAY doesn't ask: it goes back to the stage. Anything else that puts you
  in a match (an invite accepted, a party's lobby starting) ends the search without asking, so you're never in two
  places and no bar is left over a match.
- **The computer's side menu** on the stage browses (the search goes on) instead of leaving the queue, as "‹ Home" does;
  during the versus moment it still leaves the game.
- **A reload resumes the search** rather than showing nothing: the tab keeps the search (ticket, start, test switches)
  in sessionStorage after every ask, and a reload carries on with it, on the stage from /1v1 or with the bar from
  anywhere else. Showing nothing would leave the server's ticket waiting to be paired with someone who's no longer
  there (a no-show for the other player). A saved search is dropped once found, cancelled or refused, and 2 minutes
  after its last ask (the server forgets an unasked ticket long before; it then answers `expired` and the app asks
  afresh, as #255 built). The queue's test switches (`pool`, `clock`, `fewAfter`) are read once when it starts, since
  the address changes as you browse.
- **A phone asleep** behaves as #255 designed: the asks pause and resume with the page, and a ticket the server
  forgot is answered `expired` and asked again with the wait kept.

## Later, not now (Eric)

- An estimated wait, from your rating and the players online.
- Smarter widening of the pairing range when the queue is slow.
