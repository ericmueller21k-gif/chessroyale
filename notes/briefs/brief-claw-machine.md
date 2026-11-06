# Brief: Boingo's claw machine: spend a boss token for a chance at that boss's crate (Opus xhigh: tokens, crates, fair play)

Worktree `/home/user/cr-claw`, branch `claude/claw-machine`, from main. Set it up with `npm ci`. Ports 8983, inspector 9483.
Include notes/briefs/rules-common.md (American English). Push early and often; the container can restart.

A second helper is building Boingo's Funhouse room on `claude/boingo-home`. It places the claw machine, zooms in when you walk up,
and on a tap of the coin slot calls `openClawMachine()` from `packages/app/src/claw/index.ts` (it creates that as a stub).
- **You own `packages/app/src/claw/`:** create the real `index.ts` with the same export, `openClawMachine(): void`, plus the rest of
  the module.
- **Don't edit the room's files.** When their branch merges, you merge main and resolve the stub (yours wins).

## Eric, Nov 6
"A claw machine … it'll take real tokens … you put in boss tokens, and there's a chance you get a crate from a boss that's openable
right away … a good use of your tokens if you have extras … tap on the insert slot, it asks you to insert one boss coin, and you pick
from your inventory which one … the claw comes out on its own and moves around, and there's a tap button to stop it … when you put in
the coin we calculate it … a 25% chance to start … make sure I have enough coins, I think I have unlimited."

## Build
1. **The server (the fair-play core):** an endpoint to play the claw with one token of a chosen boss.
   - It checks the signed-in account has at least one of that boss's tokens.
   - **Atomically** it spends exactly one, rolls the outcome on the server (`CLAW.winChance` 0.25 in settings, never in code, with a
     secure random), and on a win grants **that boss's Boss Crate** to the inventory.
   - It returns { won, crate? }. The win or loss is decided at insert time. The player's stop tap is cosmetic only.
   - **Idempotent:** a client request id, so a retry never double-spends or double-grants. Make concurrent plays safe.
   - Log every play: account, boss, outcome and time.
   - A crate won here opens like a bought one.
   - Respect the existing kill switches and pause patterns if crates have them.
   - Guests can't play.
   - Expected cost: 4 tokens a crate at 25%, against a bought crate's 3 tokens, or 1 token and a key. Say so in the decision note for
     Eric. Note "a good use of extras".
2. **Eric's testing:** check how admins' tokens work ("I think I have unlimited"). If admins don't have plenty, add a safe admin-only
   way for Eric to have tokens for testing, using the existing admin patterns (runtime variables or admin tools), never a public
   cheat. Say exactly what you did.
3. **The UI** (`packages/app/src/claw/`), phone first:
   - **Insert:** the machine's own screen opens over the zoomed view: "Insert one boss coin", then a picker of your boss tokens (each
     boss's token art and your count; none means a friendly "You have no boss tokens yet").
   - **Pick one:** the coin drops in, with a sound.
   - **The claw** comes out and roams over the prizes on its own. A big **STOP** button. A tap drops the claw: it grabs, lifts and
     carries.
   - **Win:** it drops the boss's crate into the chute, then "You won Folio's Boss Crate!" and an Open now button, which uses the
     existing crate opening.
   - **Loss:** it slips at the top, then "So close! Try again?".
   - The animation matches the server's result, which comes first. Never show a win the server didn't grant.
   - Closing at any point is safe: the token is spent and any crate is already in the inventory.
4. **Sounds:** a coin, a claw whir, a grab and a prize thud, synthesized like the others, passing the finite-sound tests.

## Done
- **Unit tests (server):**
  - spends exactly one;
  - refuses with none;
  - rate about 25% over many seeded rolls;
  - a win grants that boss's crate;
  - idempotent on retry;
  - concurrent plays never overspend;
  - guests refused;
  - the admin testing path admin-only.
- **Unit tests (app):** the flow states, with a win and a loss from the server driving the animation.
- **e2e** (phone and computer): with test tokens, play to a forced win and a forced loss using a test-only seed hook that's
  impossible in production (like the others' test switches), open the won crate, and check the token count dropped by one each.
- **Stills and GIFs** in `docs/claw-machine/`: the insert screen and picker, the claw roaming, a win and a loss (GIF), on a phone.
- **The PR body** in `docs/claw-machine/pr-body.md` (lane: full e2e).
- **A decision note** in `docs/decisions/2026-11-06-claw-machine.md`, quoting Eric. List every player-visible text and every changed
  check old → new.
- Don't open the PR. Stop with a short report.
