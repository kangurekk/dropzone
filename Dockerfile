FROM node:22-slim

WORKDIR /app

# Instaluj zależności
COPY package*.json ./
RUN npm ci

# Kopiuj resztę
COPY . .

# Zbuduj Next.js
RUN npm run build

# Port
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["npm", "run", "start"]