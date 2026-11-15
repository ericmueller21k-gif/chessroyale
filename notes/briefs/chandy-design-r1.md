# New boss Chandy, round 1: his look, his rifle and its five upgrades, and the design questions (Eric, Nov 15)

Effort high (character art and design judgment, Opus). You are the `characters` delegate (`.claude/agents/characters.md`).
Boss lane, **mockup only: no rules code, no wiring this round.** New branch `claude/boss-chandy` from main; stills to branch
`stills/boss-chandy`. Include `notes/briefs/rules-common.md` (on `claude/director-notes`).

## Read first
- `docs/areas/bosses.md`: "The ground rules of every power", "The rage meter", the boss table under "The bosses" (Ginger's freeze,
  Big Boy's blocks, Moo & Moon's moonbeam stun, Hollow's dark, the strike), "Banners and lines", "Adding a boss".
- `.claude/LESSONS.md`; CLAUDE.md "Simple beats flashy" and "Nothing hidden, nothing shifts".
- How a standing animal boss is drawn: `packages/app/src/characters/sprite-kit.ts`, `tiger.ts` / `tiger-figure.ts` (Babur),
  `smudgy.ts` (Smudgy, **already a green lizard**: Chandy must read as a different animal at a glance), `zebra-figure.ts`.
- The God King's Final-Fantasy-style blue window: `.gk-command` in `packages/app/src/styles.css`, `BossDock.tsx` (the crates
  reuse the same look). Eric wants the upgrade shown in a window like this.

## Eric's words (Nov 15, condensed; his full message is quoted at the end)
- **Chandy**, an alligator (Eric: alligator or crocodile, doesn't matter; go alligator: broad rounded snout). A **special ops**
  alligator: **war paint**, a **sniper's eye strap** over one eye (not a pirate patch: a strap with a small scope/monocle-like lens),
  ordinary **green**, **not muscly**: a normal alligator standing upright on two feet like our other standing animals.
- On his back, **slung diagonally on a sling, a giant sniper rifle**, about his full length. **No bullets: it fires energy.**
- **His passive, always on:** he always has one of your pieces **locked on** (a cool **crosshair** on it, and he **points** at it).
  A lock lasts a random 4 to 6 of his moves, then moves to another piece. He picks a piece he could plausibly **capture in the next
  few turns** (never the king; not just the queen), and his engine is steered to go after it.
- **Each capture upgrades his rifle** (up to **5 attachments**). The game pauses briefly: the rifle in a window at the front center,
  the new part attaches (longer barrel, and so on), "UPGRADE".
- **A second bar, his move meter**, only starts filling after his first capture. Each upgrade unlocks one of five moves, in a random
  order:
  1. **Scatter shot:** a shot at one spot, 4 particles burst onto empty squares around it; you can't move onto those squares on
     your next turn.
  2. **Row and column beam:** he blasts one row and one column (never your king's row or column); for your next turn the pieces in
     them can't move and **you can't see what's under the beam**.
  3. **Shields:** two of his pieces (never his king) get a bubble shield; you can't capture them on your next turn.
  4. **Rapid fire:** three of your pieces hit in quick succession, dizzy stars over their heads; they can't move for one turn.
  5. **Queen lock:** he spends his whole turn: you must move your queen; then he fires a piercing round down at her from his side
     (or from the left or right, jumping to that side of the board): the first piece in the way shatters and the shot stops; with
     nothing in the way, your queen dies.
- **His ultimate:** after all 5 upgrades. Eric is still brainstorming it: leave room, don't design it.

## What to make (mockup)
1. **Chandy himself:** idle (2 to 4 frames, breathing, tail sway), facing the board, at the size the other standing bosses use;
   a close-up front still; the boss bar's bust; the boss-select tile. Original design (CLAUDE.md: never copy famous characters):
   no famous cartoon commando reptiles or turtles, no real gun models or brands; say in the README how he stays his own and how he
   reads differently from Smudgy.
2. **The rifle, 6 stages:** base, then each of 5 attachments added one by one (a longer barrel, a big scope, a stock/bipod, an
   energy cell, a muzzle/emitter: your call), each a clear silhouette change, glowing energy color consistent with his palette. One
   sheet showing all six. It must still read when slung on his back at phone size.
3. **The lock-on:** a crosshair mark on a piece (static still plus a 2 to 3 frame pulse) and Chandy pointing at it.
4. **The upgrade moment:** one still of the Final-Fantasy-style window front-center over the board with the rifle and "UPGRADE",
   and a short GIF (about 2 s) of a part snapping on. Keep it short: it will happen up to 5 times a battle.
5. **One still per move (5):** scatter shot's burst and blocked squares, the row+column beam (what covering looks like), the bubble
   shields, rapid fire with dizzy stars, the queen lock shot. Reuse existing marks where a rule already exists (Big Boy's blocked
   squares, Moo & Moon's stun mark, Ginger's ice) and say which.
6. **Firing pose:** him unslinging and aiming (2 or 3 frames are enough).
About 15 images and 2 GIFs, phone first (one computer still of him on the board is enough).

## The design questions (as important as the art)
Write `DESIGN.md` on the stills branch: for each passive/move, the rules as you read them, then **every question or problem**,
each in plain words Eric can answer in a line, with your recommended answer first. Check each against the ground rules and the
existing powers (what's reused, what's new code). The director's starting list (add to it, drop what's wrong):
- **What upgrades the rifle:** any capture he makes, or only capturing the locked piece? (Eric said both.)
- **Which move fires when the meter fills:** the newest unlocked, or a random one among those unlocked?
- **The lock-on target and the engine:** how "capturable within a few turns" is judged; how hard his engine is steered toward it
  without making him much stronger or much weaker; what happens when the target is traded off, moves to safety, or nothing fits.
- **Beam:** do covered pieces still block lines, defend and give check (they must, in chess terms)? Is the cover only on your
  pieces, or on his too? Online, does everyone see the same cover? What if the beam leaves you no legal move?
- **Shields:** a shielded piece giving check that only a capture could answer would be mate: does the shield lift (as other powers
  lift when they'd leave no move) or does he never shield such a piece?
- **Rapid fire** is close to Moo & Moon's moonbeam stun: reuse its rule with a dizzy look?
- **Scatter shot** is close to Big Boy's blocks: reuse?
- **Queen lock:** what if you have no queen, she can't move, or you're in check; which direction he picks (his side, left or
  right); does his own piece in the way count as a blocker; is it always a lost piece (a blocker or the queen), and is skipping his
  turn enough to pay for that?
- **The pause on every capture:** how long, and does it hold the clock (it pauses for everyone online)?
- **Name:** "Chandy" as given. Code id suggestion (`chandy`).
- Anything that conflicts with "Nothing hidden, nothing shifts" or Eric's rules in `docs/rules/eric.md`.

## Deliver and wait
Push stills, `README.md` (what's drawn, originality notes, frame-cost estimate on a phone) and `DESIGN.md` to `stills/boss-chandy`;
the source art (as code in the sprite kit's format, unwired) to `claude/boss-chandy`. Then write `.mockup` (content "chandy round 1")
to `claude/boss-chandy` and wait in one foreground Bash call
(`timeout 590 bash -c 'until git fetch -q origin claude/boss-chandy && git show origin/claude/boss-chandy:.go 2>/dev/null | grep -q chandy; do sleep 30; done'`,
repeated, up to 3 hours) for the director's `.go`, which carries Eric's answers and notes: "redo" means another mockup round;
"build art" means finish the art set in the game's format (rules come in a separate job). No PRs, no CI waits, no model names in
commits (end commits with the Claude-Session line only). Push work in progress at each real step.

## Eric's full message (Nov 15)
"All right, I've got an idea for a new boss. I want to call him Chandy. And what he would be, I don't really know the difference
between an alligator and a crocodile. I guess we'll make him an alligator, but it doesn't matter. So I want him to, he's like a
special ops alligator. So he's got like a, war paint style look. Like a, one of those like things where it's like a strap. It's not
like an eye patch, but it sort of covers one another. It's like a sniper eye patch, if that makes sense. And then his big thing is
slung around his back on like a diagonal as a giant, like really badass looking sniper. That's like almost think like overly large
kind of, not like soup, not like his body size, but it's like, you know, it's like the full length of him. And he's got a slung,
like a slung for it, or a sling, whatever they're called. And, no bullets though. It'll just be like energy, sort of like an energy
sort of thing. And so like basically what I'm thinking about right now, we'll probably need to tweak this a bit, but I want to get
started on some drawings for him. Also, he's still like green, you know, not, and he kind of looks like he's not like a built, like
it's not like he has like muscles. He just looks like a normal crocodile or alligator that's like standing on his two, you know,
two feet or whatever. Like we've been drawing for some of the characters, how they stand upright. But anyway, his I'm trying to
think about what his ult and his normal moves. It'll be like another one that's like a passive build up where it's constantly
building for his passive. And then when it builds up, what he does is he locks onto one of your units and one of your pieces, and
he like, it does like a cool crosshair effect on it, and he like points at it. And then when that piece is locked on, it will Or
actually, you know what? I take that back. He always has one of your pieces locked on, and what he's trying to do So basically what
he'll do is he'll lock on your one of your pieces for let's just say like 5 turns or like 6 moves total. And we'll just make it
random. Say it's between four and six. What he tries to do is he locks onto a piece and then it's not like random, like it wouldn't
be, you know, the king or the queen. What it's looking for is a piece that's like capturable. So it might need a little bit of
logic, like something that's within reach of capturing in the next few turns. And so basically the idea is like, so he would lock
on at the end of his turn or the start of yours. It doesn't matter. I guess the end of his. And then it'll basically trigger you to
know that you're trying to defend that piece or like get rid, like, cause he's going to, we want to then send, if it's possible, to
the engine or whatever, that like you want to go after that piece, like prioritize that piece, because if he captures it, what he
does, yeah, this will actually be cool. So if he captures your piece, what he does is he upgrades his weapon, and then we'll
actually make like a weapon upgrade. So then like what it would do is it would, you know, like how we use that container for like
the God King, that like Final Fantasy style container. So it would go in the middle of the board, like it would put his gun, and
then it would show like an animation, and like it would put it in the front center. It would like pause the game for a second, and
then it shows his gun, like kind of doing like a, just like a transformation, you know, not a transformation. Like we should make
it upgrade actually. So like say after the first one, what it does is it puts on like a longer, barrel, and you know, something
else, whatever, and then it just needs to look cool, and then it'll, you know, show like, it'll say like, you know, upgrade,
something like that. [...] So every time he captures a piece, it upgrades his gun. So it'll just be like a quick kind of thing
where it goes to the center, like the animation, and it attaches. So we'll just like it'll have up to, we'll just say 5
attachments, and But he's also gonna, so what he'll do is, for instead of just making it get more difficult, like each one will
unlock a stronger move, but he only has one. He'll have another. His passive bar is like his move. So basically he's always locked
on to one of your units throughout the whole game, or one of your pieces, I mean. So that never changes. What changes is then
there's another bar that builds, and it only starts building after he's captured a piece, though. And then for his first one, you
know what, actually, we can just make it random. So we'll make them all like roughly. That way he's not overpowered. So one of his
things will be he shoots like a particle at one spot on the board [...] it blasts off that spot and does like 4 particles on tiles
around it. And it's like a scatter shot. And then the ones that it hits around it, it doesn't hit any pieces. So just pick ones
that don't have pieces. [...] those spots just become, you can't move there just for your own next turn. Another one is he just
shoots a beam. [...] He picks a row and a column, and just for your next turn, you can't, like, those pieces become inactive. So,
and you can't see what's underneath them. [...] The only rule is they don't touch the king, row, or column. Another one is he
shoots [...] two of his pieces [...] and gives them shields. And then for the next turn, you can't capture them. Same rule as
always, no king. [...] the shield is like a bubble, kind of like a barrier looking kind of, proton shield, whatever. [...] Another
one is he shoots 3 of your pieces in like rapid succession. He just blasts them each a few times, and then they [...] get like a
dizzy kind of animation above their head, [...] you just can't move them for one turn. [...] they're random. [...] Okay, for his
last one, he locks on to your queen and it's actually his whole turn, so he skips his turn and you have to move your queen. It
forces you to move your queen the next turn. [...] you have to get your queen to safety basically. And [...] he shoots down from
the board at it or to the side. [...] since he's always looking down, [...] he's always pointing down. If you have any piece in
front of it, he blasts that piece. [...] He shoots a piercing round and it shatters the first piece that it hits and then it goes
away. But if you don't have anything to block it, then your queen dies. But like, it'll also cover the logic if there's a piece to
the left or right. So if there's a piece to the left or right, then he'll jump on either side of the board and shoot it from that
direction [...]. And then for his ult works is after he's done all 5 of his moves and his gun is fully upgraded. I'm going to
brainstorm the old more. [...] for now, if you want to send a worker to design the weapon, the upgrades, the what he looks like,
and any questions or issues with any of these things that are built, let me know."
