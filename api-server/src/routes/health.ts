import { Router, type IRouter } from "express";
import { readdirSync } from "fs";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/debug", (_req, res) => {
  const result: Record<string, any> = {};
  ["/app", "/app/frontend", "/app/frontend/dist", "/app/frontend/dist/public"].forEach(p => {
    try { result[p] = readdirSync(p); } catch { result[p] = "NOT FOUND"; }
  });
  res.json(result);
});

export default router;
