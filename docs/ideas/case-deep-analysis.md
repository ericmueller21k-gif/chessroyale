<!-- Kept in the repo Nov 11, 2026 (the fair-play near-best brief). Not built, not queued. -->

# A deeper look at one case (Eric, Nov 11)

Eric's later idea, after the live cheater demo: a button on a case's page (`/admin/fairplay/case/<id>`) that sends that one case
to a helper for a deep analysis and a determination. The helper would read everything the page has (each match's judged moves,
the deep re-check's results, think times, the crowd's picks, reports, the 1 v 1 games, how they do in the engine pool), look
deeper where it needs to (more nodes, another engine, a human-move model such as Maia at the player's level), and write back a
determination with its reasons in the case's log (cheating, honest, or not sure), for a person to read before deciding: never a
ban or a Release on its own, like the automated reviewer today (`docs/fairplay-reviewer.md`). Open questions: what it may spend
per case (engine time, model tokens), and whether it should also see the device markers and other accounts on the same device.
