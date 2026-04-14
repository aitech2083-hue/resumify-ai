import { Router, type IRouter, type Request, type Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, rm, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

// Sanitize LaTeX before compilation: convert markdown and problematic Unicode
function sanitizeForLatex(latex: string): string {
  return latex
    .replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}")
    .replace(/\*(.+?)\*/g,     "\\textit{$1}")
    .replace(/`(.+?)`/g,       "\\texttt{$1}")
    .replace(/[^\x00-\x7F]/g, (char) => {
      const map: Record<string, string> = {
        "\u2013": "--",
        "\u2014": "---",
        "\u2018": "'",
        "\u2019": "'",
        "\u201C": "``",
        "\u201D": "''",
        "\u2022": "\\textbullet{}",
        "\u2026": "\\ldots{}",
        "\u00AE": "\\textregistered{}",
        "\u00A9": "\\textcopyright{}",
        "\u2122": "\\texttrademark{}",
      };
      return map[char] ?? "";
    });
}

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
    await writeFile(texFile, sanitizeForLatex(latex), "utf-8");

    const pdflatexArgs = [
      "-interaction=nonstopmode",
      "-output-directory",
      workDir,
      texFile,
    ];

    // First pass — required
    try {
      await execFileAsync("pdflatex", pdflatexArgs, { cwd: workDir, timeout: 30000 });
    } catch (firstErr: unknown) {
      // pdflatex exits non-zero on warnings — check if PDF was produced anyway
      req.log.warn({ err: firstErr }, "pdflatex first pass exited non-zero");
    }

    // Second pass — optional, resolves internal references
    await execFileAsync("pdflatex", pdflatexArgs, { cwd: workDir, timeout: 30000 }).catch(() => {});

    if (!existsSync(pdfFile)) {
      res.status(500).json({
        error: "PDF generation failed. Please click Update Preview to refresh your resume and try downloading again.",
      });
      return;
    }

    const pdfBuffer = await readFile(pdfFile);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: unknown) {
    req.log.error({ err }, "LaTeX compilation failed");
    res.status(500).json({
      error: "PDF generation failed. Please click Update Preview to refresh your resume and try downloading again.",
    });
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
