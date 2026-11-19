# Battle Tower PR 12: the party (Nov 20). Opus, xhigh, alone. FULL lane (stored data, the server: full-e2e, an independent review, delta)

**Eric, Nov 20 (his words, the spec):** "there should be a solo mode, and then there have an invite friends, or another option, which
is like basically like open party, and it maybe sends a message in the town that just says like player is ... looking for others to
join ... if several people team up but then they like have to take a break, how can they all team up again later from the same
starting spot? ... everyone would ... want to be the host then, because they get to keep the ... seed. But ... if you give everyone a
different one, then they can just like invite other people. So I think what we need to do is everyone can keep that seed, but if you
disband and then don't play with the same party, then you can continue on your own, but it's just solo from that point forward ...
the invite friends one should just give a pop-up for your friends list."

Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, the design `docs/decisions/2026-11-18-battle-tower-design.md` (§3, §5 "The
party", §7 row 12), `docs/areas/battle-tower.md` (the flow: clerk → elevator → floor room → match → back), the server's `tower.ts` (PR 9:
`tower_runs` has `kind 'party'` and `members`, unused so far), the Boss Battle party (`squads-party.ts`, lobby `writeResult`, the party
rule: majority pick, ties to the engine's best), friends (`friends.ts`, `friends-api.ts`), and the town chat (`chat.ts`).
Branch `claude/tower-party` from main.
**The rules (the director's reading of Eric's; record each in the decision note):**
- **The clerk's card:** Solo (today's), **Invite friends** (a pop-up of your friends list; tapping one invites them as Boss Battle's
  invite circles do), **Open party** (posts one line in the town's chat, "<name> is looking for 3 more to climb the Battle Tower",
  with a Join tap; it lapses when the party fills or its leader starts or leaves). Up to 4.
- **One shared run, a copy each:** a party's run is one seed and one floor list; **every member keeps a copy** (a `tower_runs` row
  `kind 'party'` each, the same seed, floors and `members`). Every floor's result is written to every member's copy by the match
  room (never a device). A member's copy remembers who climbed it (`members`).
- **Teaming up again:** a party re-forms from the same copies: any members of the run's own party (two or more of them, nobody new)
  can continue it together from its floor (the party's floor: the lowest of the members' copies if they differ, the call to record).
  **Nobody new can join a run already climbed** (that stops carrying friends up), and a new party starts its own run from floor 1.
- **Alone after disbanding:** a member can continue their copy on their own; from then on it is solo for them (their copy plays as a
  solo run would; its party best stays a party best for the floors climbed together). They can still re-team with the original members later.
- A player holds at most one open party run (and one solo run, as today). Starting a new party run with another party asks first.
- Party floors are the server's (the room), so their wins pay as the design §3 says (win XP, milestone crates once an account); a
  solo continuation of a copy pays as solo.
- The floor room and match for a party: everyone's pawn walks in in seat order; the party rule picks each move; a member who leaves
  mid-floor follows the Boss Battle party's no-pick rules; the floor fails only as a party's does.
- PR 9's note: on sign-in merge and account delete, clear the account from others' `members` (privacy).
**Tests:** server unit tests (copies written to every member, re-teaming allowed only with original members, a new member refused,
continuing alone, the merge and delete), one e2e with two pages (invite a friend, climb floor 1 as a party, both copies at floor 2;
one continues alone). `e2e/areas.json` entries. Decision note (Eric's words + the calls). Area pages. One still per platform for Eric.
Done: `.pr-body.md` (Lane: FULL; changed checks old → new; under 60 lines) and `.done`; push and end. No PRs, no CI waits.
