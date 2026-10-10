# Areas: how HunChess works now

One page per area: how it works **today**, where the code is, its settings, its tests and tools, and the rules
learned the hard way that apply to it. No history: why things are the way they are is in `DECISIONS.md` (the index)
and `docs/history/`.

| Area | Page | Lane (`.claude/agents/`) |
| --- | --- | --- |
| Bosses and their powers (the template, each boss, the battle's rules, art and moments) | [bosses.md](bosses.md) | `god-king` (rules, screens), `characters` (art, sounds), `engine` (strength) |
| The God King and the boss battle's presentation | [god-king.md](god-king.md) | `god-king` |
| The match: Crowd, 50 v 50, the raid's flow, scoring and the cut (and frozen Classic) | [crowd.md](crowd.md) | the director |
| Squads: 8 squads of 4 in a bracket (Relay, Pairs, Pick and Block); phase 1, rules and sim | [squads.md](squads.md) | the director |
| Matchmaking, lobbies and ranked | [matchmaking.md](matchmaking.md) | `hub` (joining), `ranked` (matching rules) |
| The front door: home, queue, profiles, the live line | [hub.md](hub.md) | `hub` |
| Accounts and sign-in | [accounts.md](accounts.md) | `hub` |
| Chat: quick chat, lobby chat, global chat | [chat.md](chat.md) | `social` |
| The shop, crates, the locker and the icon builder | [shop.md](shop.md) | `item-builder` |
| The engine and the judge (scoring, many judges, the engine server) | [engine.md](engine.md) | `engine` |
| Fair play | [fairplay.md](fairplay.md) | `fairplay` |
| Ops: hosting, deploy, capacity, limits | [ops.md](ops.md) | `ops` |

Rules for every area: `CLAUDE.md` and `.claude/LESSONS.md`. Every tunable is in `packages/core/src/settings.ts`.

## Keeping a page true

- A PR that changes how an area works updates its page in the same PR: what it does, files, settings, tests.
- Keep a page short and current. The reasons go in `DECISIONS.md` ("New decisions"), not here.
- A lesson that applies to one area goes on its page as well as in `.claude/LESSONS.md`.
