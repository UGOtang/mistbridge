FROM oven/bun:1-slim

WORKDIR /app
COPY server.js /app/server.js

ENV NODE_ENV=production
EXPOSE 4000
CMD ["bun", "/app/server.js"]
