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

COPY package.json pnpm-workspace.yaml ./
COPY api-server/package.json ./api-server/
COPY frontend/package.json ./frontend/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/db/package.json ./lib/db/

RUN rm -f pnpm-lock.yaml
RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm --filter @workspace/api-server run build
RUN pnpm --filter @workspace/resume-ai run build

EXPOSE 8080

CMD ["node", "--enable-source-maps", "api-server/dist/index.mjs"]
```

**Steps:**
1. Go to GitHub → click `Dockerfile`
2. Click pencil icon to edit
3. Select all → delete everything
4. Paste the above
5. Click **Commit changes**

Once Railway finishes building, visit:
```
https://resumify-ai-production.up.railway.app/api/debug
