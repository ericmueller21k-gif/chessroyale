# The town's chat box on a computer: a third as tall (Oct 30)

- Eric (Oct 30, a screenshot at about 1885 px): "the chat is massive on desktop … it's so easy to click on it when running around, it should be 33% of what it is now, about 4-5 lines of text."
- Computer in the frame only (`.town-screen.in-frame`): the box is 500 × 120 (it was 500 × 340): the 30 px typing strip kept, about 4 single lines (17 px + 2) above it. 120 is 35% of 340, the nearest that shows 4 whole lines.
- Phones, tablets and a mouse window under 1024 px (no frame) keep their sizes. This replaces "closer to a dozen" (Eric, Oct 28) for the computer.
- Checks: town-chat.spec's computer box height 300+ -> 110 to 130, its lines before scrolling 12+ -> 4 to 5. Light lane; no drawing change, so no frame-rate pass.

## Also: the frame-rate pill and the crowd for anyone (Oct 30)

- Eric: "i dont need to be an admin to see this, no one is signing in anyway its all behind cloudflare." `/town?fps` (the pill) and `?crowd=N` (the testers' crowd) no longer ask for an admin or the test switches: anyone who opens the address gets them, on their own device only. Without them nothing changes.
- town.spec's pill check: "an admin sees it, a player doesn't" -> anyone with `?fps` sees it, `?crowd=50` brings 50; without `?fps` no pill.

## Also: one moderator test address per spec file (Oct 30, director)

- CI on this PR ran town-chat.spec and town-chat-history.spec side by side (the changed areas on two shards). Both signed in `chat-admin-desktop@e2e.test`, and putting an address on an account takes it off any other (e2e/helpers.ts `withEmail`), so the first test's moderator became a guest halfway: its Report answered "Sign in to chat with other players." (one failed, one passed on its retry). On main's five shards they hadn't met.
- `asServerAdmin` now uses `${who}-admin-${file}-${project}@e2e.test` and playwright.config.ts lists one per spec file that makes an admin (problems, chat-mod, town-chat, town-chat-history). A new such file needs its line there.

