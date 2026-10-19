# How a new boss is built (the Smudgy recipe)

Date: 2026-10-19

Smudgy went from design to live in about 9 hours of helper time, for about 3% of Eric's week.

Eric (Oct 19): "only took 3% weekly usage so we need to remember whatever you did and we will build another boss today."
Use this for every new boss. The director keeps Smudgy's briefs (still, animations, rules, review, wiring, lines, design notes) as the templates.

## 0. Design with Eric first (in chat, no code)
- Lock the passive, the ultimate, the look and the name before any helper starts. Raise the chess problems early (e.g.
  legal positions: pawns never on the back rank; nine pawns a side is refused by the engine).
- Write it all in the director's design notes for that boss as it's decided; every later brief points there.
- Ask Eric the open questions in one line each; where he doesn't answer, make the call and write it down.

## 1. Art first, on Sonnet 5.5 xhigh (UI-type work: Eric's trial)
- **Still** : one idle frame and a portrait from Eric's reference, side on facing our left, fit the
  70 px stage, parts rigged as numbers. Deliver still, light/dark, lineup with 5 bosses, vs-reference. No PR.
- Show Eric the vs-reference and lineup; tweak in the **same helper** (SendMessage resumes it with its context: cheap).
- **Animation pack** , same helper again: the 11 standard animations, the king attack (eyes on the king),
  his power moments with cue frames, his board art (all 3 board color schemes, 40 px and phone). GIFs to Eric. No PR.

## 2. Rules, on Opus at **high** (not xhigh: boss rules = high)
- One helper, one brief with **every decision already made** (numbers, guards, fallbacks, hidden-info
  handling, who sees what), the closest bosses named as models, the sim's target range (crowd score 0.08-0.55, 33-57
  crowd moves) and "make the call and write it down" for the rest. Rules + server + sim + tests + FAQ block + decision
  file, roster line with `kit: null` (not playable), PR, CI green. Never merges.

## 3. One independent review, Opus high, READ-ONLY
- A ranked list (blocker / should fix / nit) with probes. Fixes go back to **the rules helper, resumed** (it keeps its
  context), with my one-line call on each item. Merge when green (he's still hidden).

## 4. Wiring, on Sonnet 5.5 xhigh
- I write his lines myself first (used as written). The brief names every integration point (kit, moments,
  board art at the cue frames, sounds, select tile, docs) and the risky part spelled out (Smudgy: the masked board,
  with a list of every place to check). Makes him playable. PR, CI green.
- I review the risky part and the test switches myself (read the diff's key file), then merge.

## 5. Ship
- Merge commit; the live check (`version.json`, a marker from the new text); main's full run watched in the background; ops report
  checked; GIFs + stills + exact player-visible text + test links to Eric.

## What kept it cheap
- **Strictly one helper at a time**; never parallel.
- **Resume helpers** (SendMessage) for follow-ups instead of new ones that re-read everything.
- **Lower effort:** high for rules and review, Sonnet xhigh for art and wiring; never xhigh on Opus unless money/sign-in/
  stored data/fair play.
- **Briefs with decisions made**, so helpers don't stall or explore.
- **Me:** no polling loops (one background watcher per wait), short replies to notifications, small reads only (the key
  file of a diff, not whole files), my own lines/briefs written while helpers run.
- **Fast PR CI** (areas only) for PRs; the full suite only on main after merge.
- Safety check-ins (send_later) every ~60 min while Eric sleeps, in case a container restart kills a helper.
