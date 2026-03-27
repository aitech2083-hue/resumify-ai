import { Router, type IRouter } from "express";
import healthRouter from "./health";
import resumeRouter from "./resume";
import compileRouter from "./compile";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/resume", resumeRouter);
router.use("/compile", compileRouter);

export default router;
