# ReelSave hosted image: Node, ffmpeg and yt-dlp in one container.
FROM node:22-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
 && pip3 install --no-cache-dir --break-system-packages -U yt-dlp \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ENV HOSTED=1 PORT=10000 NODE_ENV=production
EXPOSE 10000
USER node
CMD ["node", "server.mjs"]
