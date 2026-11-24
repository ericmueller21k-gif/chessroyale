# Vote labels: mockup (Nov 25)

Eric (Nov 25): during the pre-game votes, show what each zone is for about 3 seconds, maybe as 3D text like the Battle Tower's
floor arrow hovering above each zone, a soft flash, not ugly or out of place, and gone once you've voted. "Give me a couple of
different ideas."

Three looks, all built in the real vote screen behind a test switch (`?votetags=a|b|c`), on branch `claude/vote-labels-mockup`.
They share one behavior:

- They show for **3 s from the moment the vote opens**: a soft fade in (about 0.4 s), a gentle pulse, then a fade out. It's a
  pulse, not a hard blink.
- **They go away the moment your vote is in.** They fade over about 0.3 s, by a drag, a tap on a zone or a tap on a card.
- **Each label sits over its own zone**, so it's right from either side. White's and Black's boards are both checked (the
  `-black` still). Options keep their left-to-right order on every screen, as they do today.
- The board stays exactly as it is: nothing moves and nothing new takes space. The labels float over the empty rank above the
  zones (A, B) or inside the zones (C).
- **The same on every pawn vote.** 50 v 50 and Squads share one vote screen. 1 v 1's time-control vote is wired too, though its
  zones already show "Bullet 3+2" and the others all the time, so the labels add little there.
- **Long names fit the zone.** The three zones touch, so each label is at most two squares wide. A name of up to 10 letters stays
  on one line and shrinks a little if it must ("Bullet 3+2", "Rapid 10+5"). A longer one takes two lines ("Random opening").

Each still is at the labels' peak, on the first vote ("How are moves picked?"). `*-vote2` and `*-vote3` show the longer names
(the start vote, the clock vote). Each GIF is the real thing in real time on a phone in dark mode, with the crowd's pawns
gliding in, from the vote opening to just past the 3 s.

## A: floor letters (`a-*`)

Chunky gold 3D words lying in perspective on the board, just above each zone, with a small gold arrow at each word's foot
pointing into the zone. It's the Battle Tower floor arrow's own look: its gold top `#f4b740`, its pale rim `#ffd877`, its
deep-gold sides `#8a5c08` and its dark edge. It breathes like the arrow does, dimming a little and nudging toward its zone, the
way the floor arrow nudges toward its door.

- Phone: `a-phone-light.png`, `a-phone-dark.png`. Computer: `a-computer-light.png`, `a-computer-dark.png`. GIF: `a-fade.gif`.
- Its gold is the zones' own border color, so it reads as part of the board rather than pasted on top of it.
- Short names read at a glance on a 390 px phone. The time controls are the smallest words ("Bullet 3+2") and still read, but
  their digits are the busiest thing in it.

## B: floating tag (`b-*`)

A small dark tag above each zone (the game's own banner style, `.vote-banner`, in small), with a thin gold rim and a pointer
down to its zone. It rises in, bobs gently and lifts away.

- Phone: `b-phone-light.png`, `b-phone-dark.png`. Computer: `b-computer-light.png`, `b-computer-dark.png`. GIF: `b-fade.gif`.
- The most readable of the three at any size, and the plainest. It looks like the rest of the game's labels.

## C: zone sweep (`c-*`)

The zones light up in turn, left to right (a soft gold glow, about 0.45 s apart), and each zone's name appears across its middle
as it lights. The names stay until the 3 s are up, then all fade together.

- Phone: `c-phone-light.png`, `c-phone-dark.png`. Computer: `c-computer-light.png`, `c-computer-dark.png`. GIF: `c-fade.gif`.
- It draws the eye to each zone in order, so the label sits where you drop your pawn. But the crowd's pawns pour into those same
  zones in the first seconds. By about 2 s the names sit among a dozen pawns (see the GIF), and the left zone's name is shown for
  longer than the right one's.

## My pick: A, with B as the fallback

**A** is what Eric described: the tower arrow's 3D gold, on the floor, above each zone. At phone size it came out readable, not
garish. It uses the zones' own gold, sits in the empty rank above them where nothing else is, and the breathing nudge toward the
zone does the pointing. If Eric finds the 3D words too loud, or the time controls too busy, **B** is the safe choice: the same
behavior, plainer, and the easiest to read. **C** is the weakest. Its names land where everyone's pawns land, so they're
crowded within a second or two.

## What it would cost to build (any of the three)

Light to targeted lane, about an hour for one helper. Most of it is already written here:

- **Code:** `components/VoteZoneTags.tsx` (about 70 lines) and its CSS (about 60 lines for the chosen look; the other two
  looks' rules are deleted). It adds one element to `screens/Vote.tsx` and one to `components/DuelVote.tsx`. The 3 s goes to
  `settings.ts` as `voteTagMs`. Removing the test switch (`?votetags`, `?votetaghold`) makes it always on.
- **One call to make:** the first-time hint, "Drag your pawn into a zone to vote", shows once per device in the same empty rank
  above the zones (these stills hide it). Simplest fix: move the hint up one square (a single CSS number) so both fit. Or don't
  show the labels while the hint is up, since the hint shows only on a player's very first vote.
- **Reduced motion:** hold the labels still, fading in and out with no pulse (a few CSS lines).
- **Lag:** none to speak of. The labels are three small elements for 3 s, animating only opacity and position, which the phone's
  GPU does on its own. The board and the frame loop are untouched, so no frame-rate measurement is needed.
- **Test:** one focused check in `e2e/votes.spec.ts` (labels show as the vote opens, are gone after your vote and are gone after
  3 s), plus a unit check of the fit rule. Its PR's e2e run is the Crowd and Ranked 1 v 1 areas' specs (`e2e/ci-select.mjs`: 20 specs, votes, opening-vote and vote-hint among them).
- **The capture script** (`scripts/frames-vote-tags.mjs`) stays for any later tweak to the look.
