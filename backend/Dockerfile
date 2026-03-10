FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src

EXPOSE 5000
CMD ["node", "src/index.js"]
