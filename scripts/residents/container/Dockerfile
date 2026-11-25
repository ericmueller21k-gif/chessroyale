# HunChess residents host: Node and git, nothing of the game's own. At each start, start.sh clones the public repository's main,
# installs it and runs the residents program (scripts/residents/run.ts) until it exits, then starts over on the newest main.
# Code changes reach it with no new image; the image changes only if Node or start.sh does. Pushed by hand (DEPLOY.md, "Residents").
# Node's full Debian image already has git and the CA certificates, so the build fetches nothing but the base: it builds the same
# anywhere Docker runs. From AWS's mirror of Docker's official images (Docker Hub rate-limits shared builders), as engine/Dockerfile,
# pinned by its digest (node:22-bookworm on Nov 25, 2026; the same digest on Docker Hub and mirror.gcr.io), so a rebuild is the
# same image. A builder that can't reach AWS's mirror passes another of the three with the same digest:
# `--build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm@sha256:…` (DEPLOY.md).
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm@sha256:7c400d78797d8cbe3f6bb21d2227b86af4cd24b0014cc9f62ff989cc16de988e
FROM ${NODE_IMAGE}
COPY start.sh /usr/local/bin/residents-start.sh
USER node
WORKDIR /home/node
ENV HOME=/home/node
# (Run by bash, not by its file mode: a checkout that lost the executable bit builds the same.)
CMD ["bash", "/usr/local/bin/residents-start.sh"]
