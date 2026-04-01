import { Router, type IRouter } from "express";
import { readdirSync, existsSync } from "fs";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/health", (_req, res) => {
  const info: Record<string, any> = {
    status: "ok",
    keyLoaded: !!process.env.ANTHROPIC_API_KEY,
    cwd: process.cwd(),
    paths: {} as Record<string, any>
  };
  
  ["/app", "/app/frontend", "/app/frontend/dist", "/app/frontend/dist/public"].forEach(p => {
    try { info.paths[p] = readdirSync(p); } catch { info.paths[p] = "NOT FOUND"; }
  });

  res.json(info);
});

export default router;
