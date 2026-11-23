# Birdie's fall: hop out happily; the cutscene's happy free fall wired (Nov 23). Opus high, boss lane

Eric (Nov 23): "We need to change the birdie falling animation, I guess it's too morbid that he gets 'hit' by it. Instead have his tumble
from his train be a hop out of it and then him free falling but looking like he's having fun instead of dead. The getting hit effect can be
the same tho."

Start: `git fetch origin main && git checkout -B claude/birdie-fall-fun origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/bosses.md` (Birdie's fall), `components/BirdieFall.tsx`, `characters/birdie.ts` (`fall` ~954),
`characters/birdie-figure.ts`. Effort high: animation.

1. **His figure's `fall` (in the boss panel, before the cutscene):** today "a jolt, then he tumbles backward out of the cab", wide-eyed,
   feathers flying. Make it a **happy hop out**: a little crouch, a hop up and out of the cab with wings opening, his `joy` eye (his
   `victory` pose's parameters: `lid: "joy"`, `wing`/`far` up), then he drops out of the frame downward, grinning; no feathers flying, no
   shake. Same length (the moment's beats `BIRDIE_BEATS.fall` must not change unless you change them in one place and solo/online follow).
   Build it from his drawing's existing parameters (`F(...)`), as his other animations are: no new art. If a pose truly can't be made
   from them, say so in the PR body and the director orders a paid run.
2. **The cutscene's happy free fall:** copy in the new drawing from `claude/boss-art` `scripts/boss-art/out/arena-birdie-fall-fun/
   arena-birdie-fall-fun.ts` (the director gives you the commit when its stills are approved; until then, do step 1 and wait for the
   director's message) into `characters/birdie-cutscene-fall.ts` as the current one was (its header naming the source and commit, the
   `build` wrapper kept), re-bake the sheet (`scripts/bake-birdie-cutscene.ts`), and update `app/test/birdie.test.ts`'s sheet hash. The hit
   (the train's nose on him, the white-out, Armored Birdie's reveal) is unchanged.
3. Prove: typecheck; `birdie`, `birdie-sounds`, `boss-kits`, boss kit unit tests; `e2e/birdie.spec.ts` "the fall" phone and computer.
   Stills on a new orphan branch `stills/birdie-fall-fun`: his figure's new `fall` as 8 frames (phone) and 4 frames of the cutscene in the
   game. Decision note of about five lines. Area page. PR body in `.pr-body.md`. `.done`, push, stop. Don't open PRs or wait on CI.
   Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model
   names). Never write the Hidden Boss's name. American English.
