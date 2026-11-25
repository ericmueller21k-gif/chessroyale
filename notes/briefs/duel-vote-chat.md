# Ranked 1 v 1: the time-control vote is too short; typed chat "never appeared" (Nov 25). Opus high, ranked + social lanes, targeted

Eric (Nov 25, playing a resident in ranked 1 v 1 at hunchess.com/1v1/NEHJZ, computer, Edge): "the augment choice was like 1 second long i
couldnt even read anything, needs to be like 10s, or when both pick then it instantly ends, also, i said hello, it never appeared, twice".
His screenshot after the game started: Rapid 10+5, the chat panel showing "Type a message." and his input; no message in it.

Start: `git fetch origin main && git checkout -B claude/duel-vote-chat origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`,
`docs/areas/ranked.md` (versus `versusMs` 2.5 s, the vote `voteSeconds` 5, overlay), `docs/areas/chat.md` (typed chat, the `chat_on` opt-in,
the duel's chat), `duel-room.ts`, `duel-do.ts`, `screens/Duel.tsx`, `components/DuelVote.tsx`.
1. **The vote:** find why Eric saw ~1 s (the versus moment eating it? a resident's instant pick closing it? the clock offset? Maia's load?). Then:
   `voteSeconds` 10 (settings), and the vote **closes early once both have picked** (after a short beat, ~1 s, so you see both picks land;
   a changed pick still counts until then). The countdown visible on screen the whole time. Residents (scripts/residents/play.ts) pick after a
   human-like 1.5-5 s, not instantly, so a person sees the other pawn move. Tests: unit (core/server rules), the e2e `ranked-1v1.spec.ts`.
2. **Typed chat:** reproduce Eric's "hello" twice not showing in a ranked 1 v 1 against a resident (and against a person: e2e). Find why
   (the chat_on opt-in silently dropping? the opponent's chat off hiding it from the sender too? the filter? a resident session?). Fix the
   cause: your own message always shows in your chat (or the box says plainly why you can't type yet, with the way to turn it on: "nothing
   hidden"). If the opponent can't see typed chat, say so in the panel. One focused e2e check.
Docs: ranked.md, chat.md, a short decision note. `.pr-body.md` (lane: targeted; changed checks), `.done`, push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort high. About an hour.
