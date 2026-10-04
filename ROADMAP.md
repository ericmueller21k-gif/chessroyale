# Roadmap: the next phase (Oct 4, 2026)

Eric wants to build out the real site: server, matchmaking, ranking and profiles, plus icons and a coin system. Paid
hosting and a good domain are fine (see `DECISIONS.md`, "Paid hosting and a domain"). Everything stays on Cloudflare,
on Eric's account.

## Build order

1. **Domain.** Point the game at the new address (Cloudflare custom domain; the workers.dev address keeps working).
2. **Accounts and profiles.** Play as a guest at once (an account tied to the device), then link a sign-in to keep it
   across devices. Profile: name, icon, games played, wins (the 2v2 final, and the team's game result in Crowd),
   average placement, rating and its history, best moves, recent matches. Storage: Cloudflare D1 (SQL).
3. **Matchmaking.** "Play now" per mode: a queue that fills a lobby with people, then tops it up with bots after a short
   wait, so a match always starts. Private lobbies with a code stay as they are.
4. **Ranked.** A rating per mode, moved by finishing position (beating everyone you outplace, like a big multiplayer
   Elo) and shown as tiers. Rated matches have mostly real players. Seasons with a soft reset, later. Unranked quick
   play stays for practice.
5. **Coins, icons and emotes.** Coins for doing well (placement, surviving cuts, a good move streak, daily first match),
   spent on cosmetic things only: profile icons, emotes to send during a match, board and piece themes, name colours.
   Nothing that changes play: no power-ups, no hints, no extra time. Earned only, not bought, unless Eric decides
   otherwise later.

## Needs Eric

- **Domain:** choose the name and buy it through Cloudflare Registrar (sold at cost, about $10-15 a year for a .com).
- **Sign-in:** which ways to sign in (see below), and create the Google login credentials if we use Google.
- **Database:** create a D1 database in the Cloudflare dashboard if the deploy can't create it itself (one click).
- **Workers Paid ($5 a month):** only when real traffic outgrows the free limits.
- **Privacy policy and terms:** needed once accounts store emails; Claude drafts, Eric approves.
- **Real-phone testing** of matchmaking with friends.
- **Art:** simple icons and emotes can be drawn in code; polished custom art would mean an artist or a paid pack.
