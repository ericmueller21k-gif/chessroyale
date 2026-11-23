# Birdie, a new boss: the build, part 1 (rules, wiring, his art in the game). Opus, xhigh, alone. Boss lane

Read first: CLAUDE.md, `.claude/LESSONS.md` ("keep before show" included), `docs/areas/bosses.md` (the boss template, a new boss's
checklist), and **`notes/designs-birdie.md` on `claude/director-notes`** (Eric's whole design, his words). The god-king lane's
agent doc `.claude/agents/god-king.md` and `characters.md` apply. Follow how the newest bosses were added (Chub & Chirp `hopper`,
Smudgy, Chandy): roster entry, settings, rules module, solo and online (lobby) parity, the shared protocol's optional boss fields,
the boss kit (`packages/chess/test/boss-kit.test.ts`, `e2e/boss-smoke.spec.ts`), the FAQ, `e2e/areas.json`, fair play (power turns,
the judge), Battle Tower as the other bosses do.

**His art is drawn** (on `claude/boss-art`, `scripts/boss-art/out/`):
- `boss-birdie/boss-birdie.ts`: young Birdie, all 14 animations including `signal`, `depart` and `fall`.
- `birdie-train/`: the train from above (`ride`), the crossing warning (`crossing`) and `smash`.
- `boss-birdie-armored-a/boss-birdie-armored-a.ts`: Armored Birdie, idle only. Eric picked A.

Move them into `packages/app/src/characters/` (and effects) as the earlier bosses' art was moved, and register them. His id:
`birdie`; his name: **Birdie**.

**His rules (Eric, Nov 23; details in the design):**
- **The train.** The first warning comes at the end of his reply to the crowd's first move. Then a cooldown of 3 crowd turns (6
  plies). When due, he picks a rank or file where exactly one crowd piece stands (any piece, the king included; several lines: the
  seed picks, the same on every device; none: it waits). He signals it (his `signal` animation and the crossing on every square of
  the line). If the crowd's next move doesn't move that piece, at the start of his turn he rides the train along the line (`depart`,
  the train crossing the board) and the piece is removed with the smash. His own pieces on the line step aside for the moment and
  are back after. The king smashed: the crowd loses the battle. Any move of the marked piece saves it; only it is hit. Settings for
  all the numbers.
- **The ultimate: the fall.** When he has lost a set amount of material (a setting, start at 9 points: P1 N3 B3 R5 Q9, counted from
  his material at the battle's start), once a battle: his `fall`, then the cutscene, then he's **Armored Birdie** for the rest of the
  battle. Armored Birdie no longer uses the train. **His armored power is not designed yet** (Eric: "the same idea, but stronger,
  later"): leave a clean place for it, and say so in the FAQ ("…a new power, coming soon" is not shown; just describe what exists).
- **The cutscene's art is being drawn now** (`stills/birdie-3`, then `out/arena-birdie-fall/` and `out/arena-birdie-armored/` on
  `claude/boss-art`). Build the cutscene's timing and wiring the way Moo's Full Moon is built (its moment, its full-board layer, the
  game paused for it, kept-battle "keep before show", online), with a plain placeholder picture until the art lands. If it lands
  while you work, wire it in; otherwise leave a short note on exactly what to drop in.
Make the calls the design leaves open and list each in a short decision note. Ask the director (a `.question` on your branch, then
keep working on other parts) only for something only Eric can decide.

Lane: **boss** (targeted, plus the boss kit, plus one quick review the director runs). Prove it with typecheck, the unit tests of the
packages you touch, the boss kit, `e2e/boss-smoke.spec.ts` for birdie, and a new focused `e2e/birdie.spec.ts`: the warning, a smash,
a saved piece, the fall into Armored Birdie. Watch the train and the smash frame by frame (`npm run frames:boss`). One sim run
(`npm run simulate` or the boss sim) to check his win rate sits with the other bosses'. Stills for Eric at the end (phone and
computer): the warning on the board, the train mid-ride, Armored Birdie in the boss bar.
Start with exactly: `git fetch origin main && git checkout -B claude/birdie origin/main && git log --oneline -1`. Push at every real
step. Write `.pr-body.md` (what changed, what players see, changed checks old → new) and `.done`, push and stop. Don't open PRs or
wait on CI. Commits end with the `Claude-Session:` line only.
