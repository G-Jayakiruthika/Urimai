# Urimai has no dependencies, so there is nothing to install and nothing to audit.
# The image is the Node runtime plus about 60 KB of source.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Copy only what the server actually serves or requires.
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY shared ./shared
COPY public ./public

# Run as a non-root user: the node image ships one, so no account has to be created.
USER node

# Cloud Run supplies PORT; 8080 is its default and the documented contract.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
