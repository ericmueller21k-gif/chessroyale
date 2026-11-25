# HunChess residents host: Node and git, nothing of the game's own. At each start, start.sh clones the public repository's main,
# installs it and runs the residents program (scripts/residents/run.ts) until it exits, then starts over on the newest main.
# Code changes reach it with no new image; the image changes only if Node or this file does. Pushed by hand (DEPLOY.md, "Residents").
# Base image from AWS's mirror of Docker's official images (Docker Hub rate-limits shared builders), as engine/Dockerfile.
FROM public.ecr.aws/docker/library/node:22-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY start.sh /usr/local/bin/residents-start
RUN chmod 755 /usr/local/bin/residents-start
USER node
WORKDIR /home/node
CMD ["/usr/local/bin/residents-start"]
