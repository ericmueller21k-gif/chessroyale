# HunChess engine server: native Stockfish 17.1 (the full network, built in) behind a small Node HTTP API.
# Base image from AWS's mirror of Docker's official images (Docker Hub rate-limits shared builders).
FROM public.ecr.aws/docker/library/node:22-slim
ADD https://github.com/official-stockfish/Stockfish/releases/download/sf_17.1/stockfish-ubuntu-x86-64-avx2.tar /tmp/sf.tar
RUN tar -xf /tmp/sf.tar -C /tmp && mv /tmp/stockfish/stockfish-ubuntu-x86-64-avx2 /opt/stockfish && chmod +x /opt/stockfish && rm -rf /tmp/sf.tar /tmp/stockfish
COPY server.mjs /app/server.mjs
EXPOSE 8080
CMD ["node", "/app/server.mjs"]
