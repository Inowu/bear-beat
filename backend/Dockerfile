FROM node:18.12.1-alpine AS build

WORKDIR /usr/src/app

RUN apk --no-cache add --virtual .builds-deps build-base python3 ffmpeg && npm install pm2@5.2.2 -g

COPY package*.json prisma/schema.prisma .

RUN npm config set python /usr/bin/python && npm i && npx prisma generate

COPY . .

RUN npm run build

EXPOSE 5000

ENV NODE_ENV=production

# CMD ["node", "build/index.js"]
CMD ["pm2-runtime", "ecosystem.config.js", "--only", "app"]
