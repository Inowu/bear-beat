FROM node:18.12.1-alpine AS build

WORKDIR /usr/src/app

COPY . .

RUN apk --no-cache add --virtual .builds-deps build-base python3

RUN npm config set python /usr/bin/python && npm i && npm run build

FROM node:18.12.1-alpine AS runner

WORKDIR /usr/src/app

COPY . .

RUN npm i --production

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "build/index.js"]
