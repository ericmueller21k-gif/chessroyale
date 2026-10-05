# Putting Battle Royale Chess online (one time, about 3 minutes, free)

You already have a Cloudflare account from Word Trap, so this is just importing a second repository.

1. In the Cloudflare dashboard, open **Workers & Pages** and select **Create application**.
2. Next to **Import a repository**, select **Get started**, and pick `chessroyale` (allow access to it on GitHub if
   asked).
3. On the settings screen:
   - **Project name:** `chessroyale`
   - **Build command:** `npm run build`
   - Leave the deploy command as `npx wrangler deploy` and everything else as it is.
4. Select **Save and Deploy**. After a minute or two you get a link like `https://chessroyale.<your-name>.workers.dev`.

Every push to `main` redeploys it. Everything runs on the free plan: the chess engine runs in each player's browser.

## The engine server (Workers Paid, from Oct 5, 2026)

The account is on **Workers Paid** ($5/month), which Containers need. `wrangler.jsonc` declares the engine server: `engine/Dockerfile` (native Stockfish 17.1 behind a small Node API), class `EngineServer`, binding `ENGINE`. Workers Builds builds the image and deploys it with the Worker on every merge to main; nothing to do by hand.

- **What it does:** re-checks the close calls before cuts (online in the lobby Durable Object, solo through `POST /api/engine/score`). Routine scoring still runs on players' devices.
- **Cost guard:** at most `ENGINE_DAILY_SEARCHES` re-checks a day (default 3000), counted in the D1 table `engine_usage`. Past it, or with no server, players' devices' numbers stand. To change the cap, set `ENGINE_DAILY_SEARCHES` as a variable on the Worker (Settings → Variables).
- **Locally:** `npx wrangler dev` builds and runs the container with Docker; `--enable-containers=false --var ENGINE_OFF:1` runs without it (the e2e suite does, to test the device fallback).
- **Budget alert:** Billing → Add Budget Alert in the Cloudflare dashboard (suggested: $20/month).
