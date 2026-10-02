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
