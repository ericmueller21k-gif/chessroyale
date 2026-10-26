# Deploys: the engine server's image pinned, so a deploy needs no Docker (Oct 26, 2026)

## What happened
From about 18:40 UTC on Oct 26, every deploy of main failed in Workers Builds before uploading anything:
"The Docker CLI is needed to build the configured image before deploying but could not be launched." The last good
deploy (d0950f5, 17:18 UTC) had built the engine server's image from `engine/Dockerfile` with Docker in the same build
environment. Nothing on our side changed between them (same trigger, build and deploy commands, Node, npm and wrangler
4.147.0); Cloudflare's status page showed no incident. Two merges (8bb6c64, f42fb96) didn't go live.

## The decision (director)
`wrangler.jsonc` points the container at the image that last good deploy built and pushed, by digest
(`registry.cloudflare.com/…/chessroyale-engineserver@sha256:7ebd716c…`), instead of at `./engine/Dockerfile`. Wrangler
only needs Docker to build an image, so the deploy goes through without it, and the engine server keeps exactly the image
it runs now (wrangler finds no change to apply to it).

Checked: `npx wrangler deploy --dry-run` fails with the same Docker error in a container whose Docker daemon isn't
running, and passes with the pinned image.

## What it costs
The engine server no longer rebuilds by itself when `engine/` changes. It rarely does; DEPLOY.md says how to build and
push a new image by hand, or how to go back to building on each deploy once Workers Builds can run Docker again.
`npx wrangler dev` with containers on now pulls the pinned image instead of building it; the e2e suite runs with
containers off, as before.
