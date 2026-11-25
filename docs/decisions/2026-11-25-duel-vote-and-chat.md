# 1 v 1: a 10 s vote that ends once both pick, tap a zone everywhere, typed chat that arrives (Nov 25, 2026)

Eric, Nov 25 (ranked 1 v 1 against a resident, computer, Edge): "the augment choice was like 1 second long i couldnt even read
anything, needs to be like 10s, or when both pick then it instantly ends, also, i said hello, it never appeared, twice". And: "when
tapping on the augment square ... I tap on it and it should bring my pawn there, but it didn't. I had to manually drag it."

- **The vote:** `RANKED_1V1.voteSeconds` 10 (was 5). Once both have picked it closes `voteBothPickedMs` (1 s) after the second pick,
  never later than its own end; a changed pick in that beat counts and doesn't put the close back (the rules' `pick`). The room sends
  the whole game when the close comes forward, so both screens' countdowns follow it. Residents and the app's bot pick 1.5-5 s in
  (`RESIDENTS.duel.pickMs`, was 0.8-3.5), so a person sees the other pawn move.
- **Why ~1 s:** not reproduced. Played locally on a computer the vote stayed on screen 9.9 s of its 5 → 10 s, from 0.1 s after it
  opened, and the server closes it only at its time. Ruled out: the versus moment (the server's clock, the app waits for it), a
  resident's pick (it never closed the vote), the clock offset (the quickest sample, tested), Maia (the bot game's only). Most likely:
  the tab was in the background while searching (found while browsing plays a sound; Edge throttles hidden tabs), so most of the
  2.5 s + 5 s was gone on coming back. 12.5 s now, and it ends as soon as both pick.
- **Tap a zone:** one shared piece, `components/VoteZoneHits.tsx`, in every pawn vote (`screens/Vote.tsx`: the 50 v 50, Squads,
  raids; `DuelVote.tsx`: the 1 v 1 and the town's games). Eric's standing rule (docs/rules/eric.md).
- **Typed chat:** the cause was the 1 v 1's chat bridge (`duel.ts`), which copied each message's fields by name and so dropped the
  typed text and the typed-chat opt-in added on Nov 7: a typed "hello" went as an empty quick line, the server refused it ("unknown"),
  and the app shows no word for that refusal. It forwards the messages as they are now (only `to` off). A second, found on the way:
  turning chat on mid-match told the server before `chat_on` was saved, so typing stayed refused for the rest of the match; the match's
  chat now waits for the save (`chatOnSaved`, which is set before the switch shows). Call made: when the other player won't see a typed
  line (their chat off, or typed lines off there), your own line still shows and a note says so ("Bo doesn't see typed messages, only
  the quick lines."); a mute is never told.
