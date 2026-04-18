FROM node:20-alpine AS builder

WORKDIR /workspace

COPY package.json package-lock.json nx.json tsconfig.base.json jest.config.ts jest.preset.js eslint.config.mjs ./
COPY apps ./apps
COPY libs ./libs
COPY policies ./policies

ARG APP_NAME

RUN npm ci --legacy-peer-deps
RUN npx nx build ${APP_NAME} --outputStyle=static

FROM node:20-alpine AS runtime

WORKDIR /app

ARG APP_NAME
ENV NODE_ENV=production

COPY --from=builder /workspace/dist/apps/${APP_NAME}/package.json ./package.json
COPY --from=builder /workspace/dist/apps/${APP_NAME}/package-lock.json ./package-lock.json
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /workspace/dist/apps/${APP_NAME}/main.js ./main.js
COPY --from=builder /workspace/policies ./policies

CMD ["node", "main.js"]