# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

COPY . .
RUN npm run build

FROM node:22-alpine AS test

ARG FRONTEND_SOURCE_HASH=unknown
LABEL com.exercise.frontend-source-hash=$FRONTEND_SOURCE_HASH

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

COPY . .

CMD ["npm", "test"]

FROM nginx:alpine
COPY --from=builder /app/dist/resume-website/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
