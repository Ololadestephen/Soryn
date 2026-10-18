ARG NODE_IMAGE=node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force
COPY next.config.ts next-env.d.ts tsconfig.json ./
COPY src ./src
COPY public ./public
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_PRIVY_CLIENT_ID
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID NEXT_PUBLIC_PRIVY_CLIENT_ID=$NEXT_PUBLIC_PRIVY_CLIENT_ID
RUN npm run build

FROM ${NODE_IMAGE}
ARG SORYN_SOURCE_SHA
LABEL io.soryn.source-sha256=$SORYN_SOURCE_SHA
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node scripts/release/backup.mjs ./scripts/release/backup.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
