FROM node:22-slim

# Instaluj Python + kompilator (wymagane dla better-sqlite3)
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Zależności
COPY package*.json ./
RUN npm ci

# Reszta projektu
COPY . .

# Zbuduj Next.js
RUN npm run build

# Port
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["npm", "run", "start"]