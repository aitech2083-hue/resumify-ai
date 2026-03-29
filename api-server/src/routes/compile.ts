import { Router, type IRouter, type Request, type Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

// ── PDF compilation via pdflatex ──────────────────────────────────────────────
router.post("/pdf", async (req: Request, res: Response) => {
  const { latex } = req.body as { latex?: string };

  if (!latex || typeof latex !== "string" || !latex.trim()) {
    res.status(400).json({ error: "latex field is required." });
    return;
  }

  const workDir = join(tmpdir(), `resume-${randomUUID()}`);
  const texFile = join(workDir, "resume.tex");
  const pdfFile = join(workDir, "resume.pdf");

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(texFile, latex, "utf-8");

    const pdflatexArgs = [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-output-directory",
      workDir,
      texFile,
    ];

    await execFileAsync("pdflatex", pdflatexArgs, { cwd: workDir, timeout: 30000 });

    await execFileAsync("pdflatex", pdflatexArgs, { cwd: workDir, timeout: 30000 }).catch(() => {});

    const pdfBuffer = await readFile(pdfFile);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: unknown) {
    req.log.error({ err }, "LaTeX compilation failed");
    const msg = err instanceof Error ? err.message : "Compilation failed";
    res.status(500).json({ error: `PDF compilation failed: ${msg}` });
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

// ── DOCX conversion via pandoc ────────────────────────────────────────────────
router.post("/docx", async (req: Request, res: Response) => {
  const { latex } = req.body as { latex?: string };

  if (!latex || typeof latex !== "string" || !latex.trim()) {
    res.status(400).json({ error: "latex field is required." });
    return;
  }

  const workDir = join(tmpdir(), `resume-docx-${randomUUID()}`);
  const texFile = join(workDir, "resume.tex");
  const docxFile = join(workDir, "resume.docx");

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(texFile, latex, "utf-8");

    const referenceDoc = join(__dirname, "..", "templates", "reference.docx");
    const pandocArgs = [
      texFile,
      "-f", "latex",
      "-t", "docx",
      "--standalone",
      "-o", docxFile,
    ];

    try {
      await readFile(referenceDoc);
      pandocArgs.push("--reference-doc", referenceDoc);
    } catch {}

    await execFileAsync("pandoc", pandocArgs, { cwd: workDir, timeout: 30000 });

    const docxBuffer = await readFile(docxFile);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="resume.docx"');
    res.setHeader("Content-Length", docxBuffer.length);
    res.send(docxBuffer);
  } catch (err: unknown) {
    req.log.error({ err }, "DOCX conversion failed");
    const msg = err instanceof Error ? err.message : "Conversion failed";
    res.status(500).json({ error: `Word document conversion failed: ${msg}` });
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;
