FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV N8N_USER_FOLDER=/home/node/.n8n
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg tini ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g n8n@1.123.5

RUN mkdir -p /home/node/.n8n/nodes \
  && cd /home/node/.n8n/nodes \
  && npm init -y \
  && npm install n8n-nodes-feishu-lite@0.4.3 n8n-nodes-feishu-common@0.1.1 \
  # The Feishu node pulls its own copy of n8n-workflow/n8n-core, which is a
  # different module instance than n8n core's. That mismatch makes node
  # registration fail ("Unrecognized node type"). Point them at n8n's copies.
  && cd /home/node/.n8n/nodes/node_modules \
  && rm -rf n8n-workflow \
  && ln -sfn /usr/local/lib/node_modules/n8n/node_modules/n8n-workflow n8n-workflow \
  && if [ -d /usr/local/lib/node_modules/n8n/node_modules/n8n-core ]; then rm -rf n8n-core && ln -sfn /usr/local/lib/node_modules/n8n/node_modules/n8n-core n8n-core; fi

COPY root-renderer/package.json ./root-renderer/package.json
RUN cd /app/root-renderer \
  && npm install --omit=dev \
  && npx playwright install --with-deps chromium

COPY terms-renderer/package.json terms-renderer/package-lock.json ./terms-renderer/
RUN cd /app/terms-renderer \
  && npm ci --omit=dev \
  && npx playwright install --with-deps chromium

COPY root-renderer ./root-renderer
COPY terms-renderer ./terms-renderer
COPY imports ./imports
COPY start-railway.sh /usr/local/bin/start-railway.sh
COPY import-workflows.sh /usr/local/bin/import-workflows.sh

RUN chmod +x /usr/local/bin/start-railway.sh \
  && chmod +x /usr/local/bin/import-workflows.sh \
  && mkdir -p /home/node/.n8n /data /shared/out \
  && chown -R node:node /app /home/node/.n8n /data /shared /ms-playwright

USER node

EXPOSE 5678

ENTRYPOINT ["tini", "--"]
CMD ["/usr/local/bin/start-railway.sh"]
