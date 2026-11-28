# Battle Tower: bots in a party (for testing), friends in a solo climb up to floor 10, solo and squad bests on the profile (Eric, Nov 28
~01:20 UTC). Opus, xhigh. FULL lane (runs and bests are stored data; the party room's rules)

Read `notes/briefs/rules-common.md` first, then `docs/areas/battle-tower.md` (all of "The party", runs and kinds, `tower_best` by kind,
"Alone") and `docs/areas/hub.md` (profiles). Branch `claude/tower-party-bots` from `origin/main`.
**Eric:** "if I go to the Battle Tower and talk to the clerk, can I already queue up with bots ... I want to play test with some bots."
(Today a tower party is accounts only, no bots, two or more to start.) And: "we decided it saves whoever the host is ... that's fine ...
as long as you can invite other people ... If you start a solo boss mode ... up until level 10, because those are easy, you can invite
players to your party to play, but after level 10, it's locked in if you're in solo mode, because ... on your actual profile we want
to add your best climb in solo and your best climb in squad."
1. **Bots in a tower party (admins first, for playtests):** the party's waiting card gets **Add a bot** (up to 3) for admins; a bot takes
   a seat with a bot name and look (the town's bot looks) and picks moves the way the Boss Battle party's/crowd's bots do (reuse it; its
   strength per the floor), counts toward "two or more to START", and never holds a copy of the run. A party of one admin plus bots can
   climb. Players don't see Add a bot yet (a one-line setting to open it to everyone later; say it in the decision note).
2. **Friends in a solo climb up to floor 10:** while your solo run's next floor is 10 or under, the clerk's card lets you invite friends
   / open your party from it: the climb becomes a party climb from there (the host's run carries on as the party's; its floors from
   then count for the squad best, not the solo best). From floor 11 a solo run stays solo (Invite and Open party say "Solo past floor 10"
   greyed for that run; starting a new party climb is still there).
3. **The profile:** "Battle Tower: best solo floor N · best squad floor M" (from the stored bests by kind; "-" if none), on your profile
   and anyone's.
Server checks every rule (a client can't add bots without admin, can't invite into a solo run past 10). Tests: unit (bots seated and
voting, the floor-10 rule, the bests by kind), e2e (an admin + 2 bots climb a floor; a solo run at floor 3 invites a friend; at 11 it
can't; the profile line). `.pr-body.md` (at most 40 lines), decision note, area pages, `.done`.
