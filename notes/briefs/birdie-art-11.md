# Birdie's token (Nov 23). Art session, paid runner only

Every boss has a token coin in one approved series (Eric, Nov 2: "the examples of the ginger and blitz coins were perfect"). Birdie's is a
plain gold coin for now. Draw his with the same template. Follow `notes/RULES.md` on art (the paid API draws; never by hand; never print
the key; art matching existing art gets reference pictures). Ask Eric ONCE here: "Birdie's token coin, one run, about $1" and wait for his
own yes. Start: `git fetch origin claude/boss-art && git checkout claude/boss-art && git pull`; `git pull --rebase` before you push.

1. Copy the newest token brief (`scripts/boss-art/briefs/token-smudgy.md`) to `token-birdie.md`; change only the face: **Birdie's head**
   (the mourning dove: soft grey-brown, a navy conductor cap with a little gold badge, a red tie at the neck if it fits; his warm face),
   head and shoulders, filling the navy middle like the others. Reference pictures (the 3rd argument): the approved Ginger and Blitz
   token pictures the brief names, plus young Birdie's idle (render his frames from `scripts/boss-art/out/boss-birdie/boss-birdie.ts`
   with `scripts/boss-art/boss-refs.ts` if it can load him, else the runner's render) into `scripts/boss-art/refs/token-birdie/`.
2. Run it as the token briefs say (cap $1.50). Wait for it in the foreground (`timeout 590 bash -c 'until <done>; do sleep 30; done'`).
3. Stills on a new orphan branch `stills/birdie-11`: the token at 4x on dark and light, and next to two approved tokens. `NOTE.md`: the
   spend and the drawing's path. `.done`, push, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
