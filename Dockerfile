FROM node:20-slim

# Install system tools
RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    pandoc \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy everything
COPY . .

# Delete the old lock file so pnpm regenerates it fresh
RUN rm -f pnpm-lock.yaml

# Install all dependencies
RUN pnpm install --no-frozen-lockfile

# Build backend
RUN pnpm --filter @workspace/api-server run build

# Build frontend
RUN pnpm --filter @workspace/resume-ai run build

EXPOSE 8080

CMD ["node", "--enable-source-maps", "api-server/dist/index.mjs"]
