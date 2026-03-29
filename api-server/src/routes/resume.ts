import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { anthropic } from "../lib/anthropic.js";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

interface JobDescription {
  title?: string;
  company?: string;
  text: string;
}

interface ScratchData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  skills?: string;
  experiences?: Array<{
    title?: string;
    company?: string;
    duration?: string;
    resp?: string;
  }>;
  education?: Array<{
    degree?: string;
    institution?: string;
    year?: string;
  }>;
  certifications?: string;
}

interface AtsScore {
  score: number;
  breakdown: string;
}

interface JobResult {
  jdIndex: number;
  company: string;
  jobTitle: string;
  latex: string;
  atsOriginal: AtsScore;
  atsTailored: AtsScore;
  email: string;
  coverLetter: string;
}

interface LinkedInContent {
  headline: string;
  about: string;
}

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    };

function buildScratchText(sd: ScratchData): string {
  let out = "";
  if (sd.name) out += `NAME: ${sd.name}\n`;
  if (sd.email) out += `EMAIL: ${sd.email}\n`;
  if (sd.phone) out += `PHONE: ${sd.phone}\n`;
  if (sd.location) out += `LOCATION: ${sd.location}\n`;
  if (sd.linkedin) out += `LINKEDIN: ${sd.linkedin}\n`;
  if (sd.skills) out += `\nSKILLS / EXPERTISE:\n${sd.skills}\n`;

  if (sd.experiences && sd.experiences.length) {
    out += "\nWORK EXPERIENCE:\n";
    sd.experiences.forEach((e, i) => {
      out += `\n[${i + 1}]\n`;
      if (e.title) out += `Title: ${e.title}\n`;
      if (e.company) out += `Company: ${e.company}\n`;
      if (e.duration) out += `Duration: ${e.duration}\n`;
      if (e.resp) out += `Responsibilities:\n${e.resp}\n`;
    });
  }

  if (sd.education && sd.education.length) {
    out += "\nEDUCATION:\n";
    sd.education.forEach((e) => {
      out += `${e.degree || ""} — ${e.institution || ""} ${e.year ? `(${e.year})` : ""}\n`;
    });
  }

  if (sd.certifications) out += `\nCERTIFICATIONS:\n${sd.certifications}\n`;
  return out.trim();
}

function makeContent(
  resumeText: string | null,
  resumeB64: string | null,
  extra: string,
): ContentBlock[] {
  const parts: ContentBlock[] = [];
  if (resumeB64) {
    parts.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: resumeB64 },
    });
    parts.push({ type: "text", text: extra });
  } else {
    parts.push({
      type: "text",
      text: `RESUME / PROFILE:\n${resumeText}\n\n${extra}`,
    });
  }
  return parts;
}

async function callClaude(
  system: string,
  content: ContentBlock[],
  maxTokens: number,
): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: content as any }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

function extractTag(text: string, tag: string): string {
  const m = text.match(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "i"));
  if (!m) return "";
  return m[0].replace(new RegExp(`<\\/?${tag}>`, "gi"), "").trim();
}

function parseScore(block: string): number {
  const m = block.match(/score\s*:\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function parseBreakdown(block: string): string {
  return block.replace(/score\s*:\s*\d+/i, "").trim();
}

async function generateResumeAndATS(
  jd: JobDescription,
  resumeText: string | null,
  resumeB64: string | null,
  isLinkedIn: boolean,
  isScratch: boolean,
): Promise<{
  latex: string;
  atsOriginal: AtsScore;
  atsTailored: AtsScore;
}> {
  const preambleExample = [
    String.raw`\documentclass[11pt]{article}`,
    String.raw`\usepackage[T1]{fontenc}`,
    String.raw`\usepackage[utf8]{inputenc}`,
    String.raw`\usepackage{helvet}`,
    String.raw`\renewcommand{\familydefault}{\sfdefault}`,
    String.raw`\usepackage[margin=0.65in]{geometry}`,
    String.raw`\usepackage{enumitem}`,
    String.raw`\usepackage{hyperref}`,
    String.raw`\usepackage{titlesec}`,
    String.raw`\usepackage{tfrupee}`,
  ].map(l => "  " + l).join("\n");

  const modeInstructions = isScratch
    ? "The candidate has NO existing resume. Build a complete, professional resume from the structured information provided. Infer plausible but honest-sounding achievement bullets based on their role titles, responsibilities, and skills. Use the JD to shape the framing."
    : isLinkedIn
      ? "The input is a LinkedIn PDF export. Extract experience, skills, education carefully from its non-standard formatting."
      : "Tailor the existing resume to the job description.";

  const system = [
    "You are an elite resume writer, ATS expert, and LaTeX developer.",
    "",
    modeInstructions,
    "",
    "━━━ TAILORING RULES ━━━",
    "• Replace similar skills with exact JD keywords (e.g. Tableau→Power BI if JD requires it)",
    "• If a JD skill is entirely absent, weave it in 4-6 times across summary, experience, skills",
    "• Only add skills that are contextually logical given the candidate's background",
    '• XYZ formula: "Accomplished [X], measured by [Y], by doing [Z]"',
    "• At least 5 quantified bullets",
    "• Match ≥80% of JD keywords for ATS",
    "• No pronouns (I/me/my), no buzzwords, every bullet starts with a strong action verb",
    "• Body content: 400-500 words, fits 1 page",
    "",
    "━━━ PRESERVE ORIGINAL FORMAT ━━━",
    String.raw`• CRITICAL: Preserve all original currency symbols EXACTLY as they appear in the source resume. If the resume uses ₹ (Indian Rupee), use \rupee in LaTeX (from tfrupee package) — do NOT convert to $ or any other currency. If it uses €, use \texteuro. If it uses £, use \textsterling. Keep ALL original currency symbols.`,
    "• Preserve original number formats EXACTLY (e.g. lakhs/crores — do NOT convert to millions/billions)",
    "• Preserve original date formats and location names",
    "• Do NOT localize or Americanize content unless the JD specifically requires it",
    "• Preserve the overall resume structure and section ordering from the original resume",
    "",
    "━━━ LATEX REQUIREMENTS ━━━",
    String.raw`• Fully compilable with pdflatex: \documentclass through \end{document}`,
    "• Preamble MUST be exactly (in this order):",
    preambleExample,
    "• The font is Arial (via helvet package). Do NOT use carlito, lmodern, or Computer Modern.",
    String.raw`• For Indian Rupee symbol: use \rupee (provided by tfrupee package). Example: \rupee 50,00,000`,
    "• Sections: Professional Summary · Work Experience · Skills · Education · Certifications (if any)",
    "• Professional, clean design — consistent spacing, fits 1 page",
    "• Return ONLY raw LaTeX — no markdown fences, no explanation",
    "",
    "━━━ OUTPUT FORMAT (use EXACT tags) ━━━",
    "<ATS_BEFORE>",
    "score:[integer 0-100]",
    "breakdown:[2-3 sentences on missing keywords and gaps in original]",
    "</ATS_BEFORE>",
    "<LATEX>",
    "[complete LaTeX code]",
    "</LATEX>",
    "<ATS_AFTER>",
    "score:[integer 0-100]",
    "breakdown:[2-3 sentences on how tailored version improved]",
    "</ATS_AFTER>",
  ].join("\n");

  const jdBlock = `TARGET ROLE: ${jd.title || "Position"} at ${jd.company || "Company"}\n\nJOB DESCRIPTION:\n${jd.text}`;
  const content = makeContent(resumeText, resumeB64, jdBlock);
  const raw = await callClaude(system, content, 8192);

  const latex = (extractTag(raw, "LATEX") || "").replace(/```latex|```/g, "").trim();
  const before = extractTag(raw, "ATS_BEFORE") || "";
  const after = extractTag(raw, "ATS_AFTER") || "";

  return {
    latex,
    atsOriginal: { score: parseScore(before), breakdown: parseBreakdown(before) },
    atsTailored: { score: parseScore(after), breakdown: parseBreakdown(after) },
  };
}

async function generateEmailAndCover(
  jd: JobDescription,
  resumeText: string | null,
  resumeB64: string | null,
  tone: string,
  isLinkedIn: boolean,
): Promise<{ email: string; coverLetter: string }> {
  const system = `You are an expert career coach and professional writer.
Generate a cold-outreach EMAIL and a formal COVER LETTER for the candidate.
${isLinkedIn ? "Input is a LinkedIn PDF export." : ""}

━━━ EMAIL (tone: ${tone}) ━━━
• Under 200 words — body only, no subject line
• Strong opening hook — NOT "I am writing to express my interest"
• Reference 2-3 specific JD requirements matched to candidate achievements
• At least one quantified metric
• Clear CTA at the end
• No clichés, no sentence-starting pronouns

━━━ COVER LETTER ━━━
• 300-350 words, 4 paragraphs
• Para 1: Powerful opening — lead with top strength or career achievement relevant to role
• Para 2-3: Two specific achievements with metrics addressing JD priorities
• Para 4: Enthusiasm, cultural fit, call to action
• Salutation: "Dear Hiring Manager," (use name if found in JD)
• Sign off: "Yours sincerely," + [Candidate Name]
• Formal but energetic — not robotic

━━━ OUTPUT FORMAT ━━━
<EMAIL>
[email body only — no subject]
</EMAIL>
<COVER>
[full cover letter]
</COVER>`;

  const jdBlock = `ROLE: ${jd.title || "Position"} at ${jd.company || "Company"}\n\nJOB DESCRIPTION:\n${jd.text}`;
  const content = makeContent(resumeText, resumeB64, jdBlock);
  const raw = await callClaude(system, content, 8192);

  return {
    email: (extractTag(raw, "EMAIL") || "").trim(),
    coverLetter: (extractTag(raw, "COVER") || "").trim(),
  };
}

async function generateLinkedIn(
  jd: JobDescription | null,
  resumeText: string | null,
  resumeB64: string | null,
  isLinkedIn: boolean,
): Promise<LinkedInContent> {
  const system = `You are a LinkedIn profile optimisation expert.
Rewrite the candidate's LinkedIn Headline and About section.
${isLinkedIn ? "Input is a LinkedIn PDF — use existing profile as the base." : ""}

━━━ HEADLINE ━━━
• Max 220 characters
• Format: [Target Title] | [2-3 Top Skills] | [Value Proposition with metric if possible]
• Must be rich in LinkedIn search keywords

━━━ ABOUT SECTION ━━━
• 300-400 words, 4-5 short paragraphs
• First sentence: powerful hook — NOT "I am a..." — lead with impact
• Weave in 6-8 target keywords naturally
• 2 quantified career highlights
• End: what you're open to / what you bring to your next role
• First person is fine here (About section norms)

━━━ OUTPUT FORMAT ━━━
<HEADLINE>
[headline text only]
</HEADLINE>
<ABOUT>
[full About section]
</ABOUT>`;

  const jdBlock = jd
    ? `TARGET ROLE: ${jd.title || ""} at ${jd.company || ""}\n\nJD CONTEXT:\n${(jd.text || "").slice(0, 800)}`
    : "";
  const content = makeContent(
    resumeText,
    resumeB64,
    jdBlock || "Analyse the profile and write the best LinkedIn headline and About section.",
  );
  const raw = await callClaude(system, content, 8192);

  return {
    headline: (extractTag(raw, "HEADLINE") || "").trim(),
    about: (extractTag(raw, "ABOUT") || "").trim(),
  };
}

async function processJD(
  jd: JobDescription,
  idx: number,
  resumeText: string | null,
  resumeB64: string | null,
  tone: string,
  isLinkedIn: boolean,
  isScratch: boolean,
): Promise<JobResult> {
  const [rr, cr] = await Promise.all([
    generateResumeAndATS(jd, resumeText, resumeB64, isLinkedIn, isScratch),
    generateEmailAndCover(jd, resumeText, resumeB64, tone, isLinkedIn),
  ]);
  return {
    jdIndex: idx,
    company: jd.company || `Job ${idx + 1}`,
    jobTitle: jd.title || "Position",
    ...rr,
    ...cr,
  };
}

router.post(
  "/generate",
  upload.single("resume"),
  async (req: Request, res: Response) => {
    const mode = (req.body.mode as string) || "upload";
    const tone = (req.body.tone as string) || "formal";
    const extra = ((req.body.extra as string) || "").trim();

    let jds: JobDescription[] = [];
    try {
      jds = JSON.parse((req.body.jds as string) || "[]");
    } catch {
      // ignore parse errors
    }
    jds = jds.filter((j) => (j.text || "").trim().length > 20);
    if (!jds.length) {
      res.status(400).json({ error: "Add at least one job description." });
      return;
    }

    const isLinkedIn = mode === "linkedin";
    const isScratch = mode === "scratch";

    let resumeText: string | null = null;
    let resumeB64: string | null = null;

    if (isScratch) {
      let sd: ScratchData = {};
      try {
        sd = JSON.parse((req.body.scratchData as string) || "{}");
      } catch {
        // ignore parse errors
      }
      resumeText = buildScratchText(sd);
      if (!resumeText.trim()) {
        res
          .status(400)
          .json({ error: "Fill in at least your name and one experience block." });
        return;
      }
      if (extra) resumeText += `\n\nADDITIONAL NOTES:\n${extra}`;
    } else if (req.file) {
      if (req.file.mimetype === "application/pdf") {
        resumeB64 = req.file.buffer.toString("base64");
      } else {
        resumeText = req.file.buffer.toString("utf-8");
      }
      if (extra) resumeText = (resumeText || "") + `\n\nCURRENT / ADDITIONAL EXPERIENCE:\n${extra}`;
    } else {
      res.status(400).json({ error: "Upload a resume or use Build from Scratch." });
      return;
    }

    try {
      const [jdResults, linkedin] = await Promise.all([
        Promise.all(
          jds.map((jd, i) =>
            processJD(jd, i, resumeText, resumeB64, tone, isLinkedIn, isScratch),
          ),
        ),
        generateLinkedIn(jds[0] || null, resumeText, resumeB64, isLinkedIn),
      ]);
      res.json({ results: jdResults, linkedin });
    } catch (err) {
      req.log.error({ err }, "Generation failed");
      res.status(500).json({
        error: err instanceof Error ? err.message : "Generation failed.",
      });
    }
  },
);

// ── Refine Resume via chat instruction ────────────────────────────────────────
router.post(
  "/refine",
  async (req: Request, res: Response) => {
    const { latex, instruction, jd } = req.body as {
      latex?: string;
      instruction?: string;
      jd?: { title?: string; company?: string; text?: string };
    };

    if (!latex || !instruction) {
      res.status(400).json({ error: "latex and instruction are required." });
      return;
    }

    const system = [
      "You are an expert resume writer and LaTeX developer.",
      "The user has an existing LaTeX resume and wants to refine it based on their instruction.",
      "Apply the instruction precisely and return ONLY the complete updated LaTeX code.",
      "Rules:",
      String.raw`• Keep the exact same preamble (\\usepackage{helvet}, \\renewcommand, etc.)`,
      "• Do NOT add markdown fences (no ```latex), no explanation, no comments outside LaTeX",
      "• Preserve all content not mentioned in the instruction",
      "• If the instruction asks to improve ATS score, weave in more relevant keywords from the JD naturally",
      "• Return only raw LaTeX from \\documentclass to \\end{document}",
    ].join("\n");

    const jdContext = jd?.text
      ? `\n\nJOB DESCRIPTION CONTEXT:\nRole: ${jd.title || ""} at ${jd.company || ""}\n${jd.text}`
      : "";

    const userMessage = `CURRENT LATEX RESUME:\n${latex}${jdContext}\n\nUSER INSTRUCTION: ${instruction}\n\nReturn only the complete updated LaTeX.`;

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 8192,
        system,
        messages: [{ role: "user", content: userMessage }],
      });

      const raw = message.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { type: string; text: string }) => b.text)
        .join("");

      // Strip any markdown fences if Claude adds them
      const refined = raw
        .replace(/^```latex\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      res.json({ latex: refined });
    } catch (err) {
      req.log.error({ err }, "Refine failed");
      res.status(500).json({
        error: err instanceof Error ? err.message : "Refinement failed.",
      });
    }
  }
);

export default router;
