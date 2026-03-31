import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { join } from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve frontend — path from /app (working directory)
const frontendDist = "/app/frontend/dist/public";

app.get("/healthz", (_req, res) => res.json({ 
  ok: true, 
  frontendExists: existsSync(frontendDist),
  cwd: process.cwd()
}));

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(frontendDist, "index.html"));
  });
}

export default app;
```

Commit → wait for deploy → then visit:
```
https://resumify-ai-production.up.railway.app/healthz
