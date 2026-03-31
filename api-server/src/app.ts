import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { join } from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes first
app.use("/api", router);

// Serve frontend static files — no existsSync, always register
app.use(express.static("/app/frontend/dist/public"));

// All other routes serve the React app
app.get("*", (_req, res) => {
  res.sendFile("/app/frontend/dist/public/index.html");
});

export default app;
