FROM node:20-slim

RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    pandoc \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

WORKDIR /app

COPY . .

RUN rm -f pnpm-lock.yaml

RUN pnpm install --no-frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

RUN pnpm --filter @workspace/resume-ai run build

EXPOSE 8080

# v3
CMD ["node", "--enable-source-maps", "api-server/dist/index.mjs"]
