# Brief: Dash the cheetah, a new boss, in the game for admins first. Phone and computer. Opus, high

Worktree `/home/user/cr-dash`, branch `claude/boss-dash` (from origin/main 1fcdd930; checked out; run `npm ci`). Read `CLAUDE.md`
(all of it: the lanes, "Working lean", the boss lane), `docs/rules/eric.md`, `docs/areas/bosses.md` (above all **"Adding a boss"**
and how Timber, the newest, was wired: `docs/decisions/2026-11-01-timber.md`; his real-time meter is the shared block you reuse), the
boss framework (`BossRules` hooks, `warnThenUnleash`, the meter), the boss kit's tests.

This is **round 1 of 3**: the boss himself. Not in this round: his home in the town and his sneaker store (round 2, with the tortoise's
town sheet), his custom challenge intro (round 3). His challenge, if his home isn't in yet, is simply not offered.

## The name: Dash (Eric, Nov 3)
Eric dropped "Blitz" (a chess time control: confusing). **Every word a player sees says Dash.** The art's files and exports keep
`blitz` (`BOSS_BLITZ`, `boss-blitz`, …): keep them as they come, with a source line. Your own new code: boss id `dash`, unless an id
already stored for players uses `blitz` (check the Cheetah Shoes ride and the boss tokens: a stored id never changes; map it). Also
change the one live text: Cheetah Shoes' description "Blitz says the spots are just for show; the speed is not." → "Dash says …", and
`components/tokens/index.ts`'s comments. Never confuse him with the Blitz time control in Duel/1 v 1 (that stays).

## Eric's approved design (art approved Nov 1)
- A lanky, cocky cheetah: orange cap on backwards, teal and orange track jacket, a chess clock (ticks, never numerals). Sidekick:
  **Tick, a tortoise**. Never "thinks": his moves come instantly.
- **Personality (Eric, Nov 3):** a bit silly, tries way too hard to fit in with the younger crowd with slang ("Yo, this game is
  chopped, bro", broski, fam, cuz), and doesn't quite pull it off; a sneaker hustler. Friendly-cocky, never mean.
- **Passive: Clock Slap.** When he captures a piece he slaps the clock and **steals some of your time**.
- **Ultimate: Time Scramble.** After the usual warning, **your next 5 moves get 3 seconds each**, a big countdown over the board.
- **Your call, recorded in `docs/decisions/2026-11-03-dash.md` with the reason** (Eric wants few questions): what "your time" is in a
  boss battle (solo: e.g. a visible time bank for this battle, as a chess clock; raids/server-paced: the move timer), how much a slap
  steals, and what happens when a scramble move's 3 s (or the bank) runs out. Constraints: **never an instant loss on time**
  (e.g. a random legal move is played for you, with his jab); readable at a glance on a phone; nothing shifts on screen; the same
  rules in Boss alone, the Solo raid, a Boss raid and a Boss Battle party; simulated time in the sims (Timber's meter does this).
  Every number in settings, calibrated by sim.

## The art (done and approved; don't redraw)
On `origin/claude/boss-art` (`git fetch origin +refs/heads/claude/boss-art:refs/remotes/origin/claude/boss-art`), copied in the way
Timber's came in: `scripts/boss-art/out/boss-blitz/` (every animation: idle, entrance, thinking, move, capture, clockSlap,
scrambleWarn, timeScramble, hurt, check, smug, rattled, defeat, victory; the notes `summary.md`, `scripts/boss-art/out/blitz-nov1.md`
with its list of sound cues), `scripts/boss-art/out/sidekick-blitz/` (Tick), `scripts/boss-art/out/token-blitz/` (his token, if the
token system takes a new boss's token by data: wire it the way Timber's was). Don't merge that branch; don't copy the house, shop
or intro files this round.

## Build (follow "Adding a boss")
1. **Rules** in the boss framework: Clock Slap, Time Scramble, your time; his events and views. Solo and raids both.
2. **Calibrate by sim**, as the others: his strength by level, the slap, the scramble, so his win rate sits with the roster's
   (numbers in `reports/` like the others). Every number in settings.
3. **On screen**: your time (fixed place, phone and computer, the computer layout and the phone's raid layouts; nothing shifts), the
   slap (time flying from your clock to him), the scramble's countdown (big, clear, 3-2-1), his moments and lines like the other
   bosses', Tick.
4. **His sounds**: he has none yet. Make his own synthesized set the way `characters/timber-sounds.ts` was made
   (`notes`: `docs/decisions` for Timber's sounds), for the art's cues (zip, skid, snap, slam, steal, warn, tap, whoosh, whirr, ta-da,
   oof, tick, flag, …; Tick's ding, chomp, step): quick, sneaker-squeak and clock-tick flavoured, each quieter than a move. A tap on
   him in the boss select (his select sound).
5. **His lines**: merge the director's draft (below) with the art session's `scripts/boss-art/out/blitz-lines-draft.md` (on the art
   branch); pick the best two or three per trigger, short enough for the bubble, the name always Dash. Wire them as the other
   bosses' lines are. List every line in the PR body.
6. **Admins first**: in the boss select and playable only for admins (as Timber) until Eric says go; one setting flips him live.
   Say exactly how in the PR.
7. Docs: his row in `docs/areas/bosses.md`, the decision note, the FAQ if bosses are listed there.

### The director's line draft (Nov 3; Eric liked the direction)
- Entrance: "Yo yo yo! Dash in the building, fam!" · "Sup, cuz. Ready to get cooked?" · "Bet. Let's run it, broski."
- Thinking (he never thinks): "Bro, I already know my move. No cap." · "Clock's ticking, fam. Tick tock, my guy."
- Capture / Clock Slap: "Yoink! That time's mine now, cuz." · "Sheesh! Clock slap, baby!" · "That piece? Chopped. Fully chopped."
- Check: "Check, broski. It's giving… checkmate." · "Check! That's bussin. Is that the word? That's the word."
- Hurt: "Yo, that's lowkey rude." · "Okay, okay. W for you, fam. Small W."
- Smug: "This game is chopped, bro. Chopped." · "Am I the main character? Kinda, yeah."
- Rattled: "Bro, I'm not sweating. It's just humid." · "Deadass did not see that coming."
- Scramble warning: "Speed run, broski! Let's gooo!" · "Three seconds a move, cuz. Skrrt!"
- Defeat: "GG, cuz. Lowkey you're goated." · "I'm cooked. Bro, I'm so cooked."
- Victory: "Too fast, fam! Built different!" · "W! Big W! Hashtag no cap."

## Rules you must keep
- **Frame rate** (eric.md): the clocks and the countdown must not cost frames: measure a battle against Dash vs one against an
  existing boss the eric.md way (medians of four runs, in turn), phone and computer. Nothing allocated per frame.
- The boss kit's shared tests must pass for him.
- Fair play: the timers are the server's in server-paced games (never the client's word); say in the PR how a raid's scramble is
  enforced. This touches rules: CI will run with `full-e2e`.

Include and follow `notes/briefs/rules-common.md` (pasted below by the director).

## Deliver
1. Stills and a GIF into `docs/dash/`: a battle vs Dash on a phone (390 x 844) and a computer (1280 x 800) with a Clock Slap and a
   Time Scramble (`dash.gif`, under 8 MB); the boss select with his tile (admin).
2. Typecheck, the touched vitest, the boss kit and his own e2e (phone and desktop, under the e2e lock).
3. Push; PR title "Dash the cheetah: a new boss (admins first)"; the body to `docs/dash/pr-body.md` (what changed, the sim's
   numbers, every player-visible text and line, the FPS numbers, the time decisions, changed checks old → new, the lane).
Report briefly: the pushed head, the sim's win rates, the FPS numbers, your time decisions, how to turn him on for everyone.
