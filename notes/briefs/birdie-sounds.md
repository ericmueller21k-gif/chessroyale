# Birdie's voice and his train's move sound (Nov 23). characters lane, Opus high

Eric's asks, word for word, are in `notes/designs-birdie.md` on `claude/director-notes`: "His voice: chirps" and "His move's train
sound". Read both, plus CLAUDE.md, `.claude/LESSONS.md` and `docs/areas/bosses.md` (his row; the sound packs).
Branch: `git fetch origin main && git checkout -B claude/birdie-sounds origin/main`. Boss lane (targeted, plus the boss kit). Effort
high: sound timing on game events, no rules.

1. **The sounds.** From `stills/trailer-v2`: `birdie-chirps/` at a5617d58 (7 chirps) and `birdie-train/` at 6817770f (4 train runs),
   each with a README giving the exact synthesis recipe. Every other boss's sounds are synthesized in code
   (`packages/app/src/characters/*-sounds.ts`, the `MAKERS` table in `boss-sounds.ts`, made ahead in the sound worker). Do the same in
   `birdie-sounds.ts` from the READMEs (seeded, so every device makes the same sound), and compare yours with the mp3s by ear-proxy
   (length, envelope, spectrum peaks; a short numeric comparison in the PR). Only if a sound can't be matched, ship that one as a small
   mp3 the way the music does; say which and why. His current synthesized placeholder sounds that these replace go.
2. **Where they play** (your call per moment, written in the PR as a table): wherever a boss makes a sound, his chirps are his voice:
   his entrance, his moves (tsip, cheer), his captures (trill), thinking (ask), hurt / losing a piece (scold), idle chatter, smug
   (teeoo), the fall and win/lose if the pack has those. **The challenge: `hello`** when a player challenges him (the boss challenge,
   wherever another boss's challenge sound plays; his town home comes later, so wire it where the challenge is today).
   **Every ordinary move of his gets a train run**: picked by his move animation's length (short / medium / long), `toot` on his
   captures and checks. Keep the voice and the train from fighting: a chirp on a move plays over the train's start, at a level that
   reads (the under-a-move rule in LESSONS). Same on Armored Birdie unless it sounds wrong; say what you chose.
3. Prove: typecheck, the app unit tests you touch (the boss sound tests: `boss-sounds-own.test.ts` and kin), Birdie's e2e and the
   boss kit. Watch one battle frame by frame with sound timings logged (`npm run frames:boss`), phone. A short recording of a battle's
   first moves as an mp4 or the sound timings table for the director to send Eric (stills branch `stills/birdie-sounds`, never docs/).
4. Area page `docs/areas/bosses.md` (his sounds), a short decision note. `e2e/areas.json` covers any new file. PR body to `.pr-body.md`
   (short: what changed, the where-table, changed checks old → new). `.done`, push, stop. Don't open the PR.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
