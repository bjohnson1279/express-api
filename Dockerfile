FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first for layer caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN NODE_OPTIONS=--max-old-space-size=1024 npm run build

EXPOSE 8000

CMD ["npm", "start"]
