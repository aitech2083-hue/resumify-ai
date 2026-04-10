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
    month?: string;
    year?: string;
  }>;
  certifications?: string;
}

interface LinkedInImportProfile {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  headline?: string | null;
  summary?: string | null;
  experience?: Array<{ title: string; company: string; duration: string; highlights: string[] }>;
  education?: Array<{ degree: string; institution: string; year?: string | null }>;
  skills?: string[];
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
  matched_keywords: string[];
  missing_keywords: string[];
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
      const period = e.month && e.year
        ? `(${e.month} ${e.year})`
        : e.year ? `(${e.year})` : e.month ? `(${e.month})` : "";
      out += `${e.degree || ""} — ${e.institution || ""} ${period}\n`.trim() + "\n";
    });
  }

  if (sd.certifications) out += `\nCERTIFICATIONS:\n${sd.certifications}\n`;
  return out.trim();
}

function buildLinkedInProfileText(p: LinkedInImportProfile): string {
  let out = "CANDIDATE PROFILE (from LinkedIn):\n";
  if (p.name) out += `Name: ${p.name}\n`;
  if (p.headline) out += `Headline: ${p.headline}\n`;
  if (p.location) out += `Location: ${p.location}\n`;
  if (p.email) out += `Email: ${p.email}\n`;
  if (p.phone) out += `Phone: ${p.phone}\n`;
  if (p.summary) out += `\nSummary:\n${p.summary}\n`;

  if (p.experience && p.experience.length) {
    out += "\nEXPERIENCE:\n";
    p.experience.forEach(e => {
      out += `${e.title} at ${e.company} (${e.duration})\n`;
    });
  }

  if (p.education && p.education.length) {
    out += "\nEDUCATION:\n";
    p.education.forEach(e => {
      const yr = e.year ? ` (${e.year})` : "";
      out += `${e.degree} — ${e.institution}${yr}\n`;
    });
  }

  if (p.skills && p.skills.length) {
    out += `\nSKILLS: ${p.skills.join(", ")}\n`;
  }
  return out.trim();
}

// FIX 1 & 3: additional experience is now passed separately and prominently labeled
function makeContent(
  resumeText: string | null,
  resumeB64: string | null,
  jdBlock: string,
  additionalExperience?: string,
): ContentBlock[] {
  const parts: ContentBlock[] = [];

  // Build the extra text block — additional experience comes FIRST and prominently
  const additionalBlock = additionalExperience
    ? `\n\n⚠️ MOST RECENT EXPERIENCE (HIGHEST PRIORITY — ADD THIS FIRST IN WORK EXPERIENCE SECTION):\n${additionalExperience}\n`
    : "";

  if (resumeB64) {
    parts.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: resumeB64 },
    });
    parts.push({ type: "text", text: `${additionalBlock}\n${jdBlock}` });
  } else {
    parts.push({
      type: "text",
      text: `RESUME / PROFILE:\n${resumeText}${additionalBlock}\n\n${jdBlock}`,
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
  additionalExperience?: string,
): Promise<{
  latex: string;
  atsOriginal: AtsScore;
  atsTailored: AtsScore;
  matched_keywords: string[];
  missing_keywords: string[];
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

  // FIX 2 & 3: Improved system prompt with deep analysis instructions
  // and explicit handling of additional experience
  const system = [
    "You are an elite resume writer, ATS expert, and LaTeX developer.",
    "Take your time to carefully read and deeply understand both the resume and the job description before writing anything.",
    "",
    modeInstructions,
    "",
    "━━━ STEP 1: HANDLE ADDITIONAL/RECENT EXPERIENCE FIRST ━━━",
    "• If the candidate has provided ADDITIONAL or RECENT experience (marked with ⚠️ MOST RECENT EXPERIENCE), this is their LATEST role",
    "• You MUST add this experience as the FIRST entry in the Work Experience section — before all other roles",
    "• Do NOT ignore, skip, or bury this experience anywhere — it is their most current job and must be visible",
    "• Incorporate the skills and responsibilities from this role into the Professional Summary and Skills sections too",
    "",
    "━━━ STEP 2: DEEPLY ANALYZE THE JOB DESCRIPTION ━━━",
    "• Read the full JD carefully — understand what the company is actually looking for",
    "• Extract ALL important keywords: hard skills, soft skills, tools, frameworks, methodologies",
    "• Identify the top 10 most critical keywords the employer needs",
    "• Plan to include each important keyword at least 4-6 times naturally across the resume",
    "• Understand the seniority level, industry, and company culture from the JD before writing",
    "",
    "━━━ STEP 3: SKILL MATCHING RULES ━━━",
    "• If candidate has a similar skill to what JD requires — replace with the JD keyword (e.g. Tableau → Power BI)",
    "• If a JD skill is entirely missing from the resume — weave it in 4-6 times across summary, experience, skills",
    "• Be ethical — only add skills that are contextually logical given the candidate's actual background",
    "• Never add skills that make no sense with their experience — do not make up experience they do not have",
    "",
    "━━━ TAILORING RULES ━━━",
    "• Match ≥80% of JD keywords to maximize ATS score",
    '• XYZ formula for all bullets: "Accomplished [X], measured by [Y], by doing [Z]"',
    "• At least 5 quantified bullets with real metrics — avoid vague statements",
    "• Every bullet starts with a strong action verb",
    "• No pronouns (I/me/my), no buzzwords, no clichés",
    "• Focus on achievements and impact, not just duties",
    "• Body content: 400-500 words, fits 1 page",
    "",
    "━━━ PRESERVE ORIGINAL FORMAT ━━━",
    String.raw`• CRITICAL: Preserve all original currency symbols EXACTLY. If resume uses ₹ use \rupee in LaTeX (from tfrupee package) — do NOT convert to $. If it uses €, use \texteuro. If £, use \textsterling.`,
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
    "<KEYWORDS_MATCHED>",
    "[comma separated list of important keywords from the JD that are already present in the resume]",
    "</KEYWORDS_MATCHED>",
    "<KEYWORDS_MISSING>",
    "[comma separated list of important keywords from the JD that are completely missing from the resume]",
    "</KEYWORDS_MISSING>",
  ].join("\n");

  const jdBlock = `TARGET ROLE: ${jd.title || "Position"} at ${jd.company || "Company"}\n\nJOB DESCRIPTION:\n${jd.text}`;
  const content = makeContent(resumeText, resumeB64, jdBlock, additionalExperience);
  const raw = await callClaude(system, content, 8192);

  const latex = (extractTag(raw, "LATEX") || "").replace(/```latex|```/g, "").trim();
  const before = extractTag(raw, "ATS_BEFORE") || "";
  const after = extractTag(raw, "ATS_AFTER") || "";

  const parseKeywords = (tag: string): string[] =>
    (extractTag(raw, tag) || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

  return {
    latex,
    atsOriginal: { score: parseScore(before), breakdown: parseBreakdown(before) },
    atsTailored: { score: parseScore(after), breakdown: parseBreakdown(after) },
    matched_keywords: parseKeywords("KEYWORDS_MATCHED"),
    missing_keywords: parseKeywords("KEYWORDS_MISSING"),
  };
}

async function generateEmailAndCover(
  jd: JobDescription,
  resumeText: string | null,
  resumeB64: string | null,
  tone: string,
  isLinkedIn: boolean,
  additionalExperience?: string,
): Promise<{ email: string; coverLetter: string }> {
  const system = `You are an expert career coach and professional writer.
Generate a cold-outreach EMAIL and a formal COVER LETTER for the candidate.
${isLinkedIn ? "Input is a LinkedIn PDF export." : ""}
${additionalExperience ? "The candidate has recent experience — prioritize this in your writing." : ""}

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
  const content = makeContent(resumeText, resumeB64, jdBlock, additionalExperience);
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
  additionalExperience?: string,
): Promise<LinkedInContent> {
  const system = `You are a LinkedIn profile optimisation expert.
Rewrite the candidate's LinkedIn Headline and About section.
${isLinkedIn ? "Input is a LinkedIn PDF — use existing profile as the base." : ""}
${additionalExperience ? "The candidate has recent additional experience — incorporate this prominently." : ""}

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
    additionalExperience,
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
  additionalExperience?: string,
): Promise<JobResult> {
  const [rr, cr] = await Promise.all([
    generateResumeAndATS(jd, resumeText, resumeB64, isLinkedIn, isScratch, additionalExperience),
    generateEmailAndCover(jd, resumeText, resumeB64, tone, isLinkedIn, additionalExperience),
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

    // FIX 1 & 3: additional experience is now tracked separately
    // so it can be passed explicitly to each function and placed correctly
    let additionalExperience: string | undefined = undefined;

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
      if (extra) additionalExperience = extra;
    } else if (isLinkedIn && req.body.linkedinProfile) {
      // LinkedIn URL import — profile JSON sent instead of a file
      try {
        const lp: LinkedInImportProfile = JSON.parse(req.body.linkedinProfile as string);
        resumeText = buildLinkedInProfileText(lp);
      } catch {
        res.status(400).json({ error: "Invalid LinkedIn profile data." });
        return;
      }
      if (extra) additionalExperience = extra;
    } else if (req.file) {
      if (req.file.mimetype === "application/pdf") {
        resumeB64 = req.file.buffer.toString("base64");
      } else {
        resumeText = req.file.buffer.toString("utf-8");
      }
      if (extra) additionalExperience = extra;
    } else {
      res.status(400).json({ error: "Upload a resume or use Build from Scratch." });
      return;
    }

    try {
      const [jdResults, linkedin] = await Promise.all([
        Promise.all(
          jds.map((jd, i) =>
            processJD(jd, i, resumeText, resumeB64, tone, isLinkedIn, isScratch, additionalExperience),
          ),
        ),
        generateLinkedIn(jds[0] || null, resumeText, resumeB64, isLinkedIn, additionalExperience),
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

// ── LinkedIn URL Import ───────────────────────────────────────────────────────
router.post("/linkedin-import", async (req: Request, res: Response) => {
  let { linkedinUrl } = req.body as { linkedinUrl?: string };

  if (!linkedinUrl) {
    res.status(400).json({ error: "Invalid LinkedIn profile URL" });
    return;
  }

  // Normalize URL — add https:// if missing
  if (!linkedinUrl.startsWith("http")) {
    linkedinUrl = "https://" + linkedinUrl;
  }
  if (!linkedinUrl.includes("linkedin.com/in/")) {
    res.status(400).json({ error: "Invalid LinkedIn profile URL" });
    return;
  }

  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  console.log("APIFY_TOKEN present:", !!APIFY_TOKEN, "length:", APIFY_TOKEN?.length ?? 0);
  if (!APIFY_TOKEN) {
    res.status(500).json({ error: "Apify token not configured" });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null = null;
  let lastError = "";

  // --- Actor 1: supreme_coder (sync, urls as objects) ---
  try {
    console.log(`[LinkedIn import] Trying actor: supreme_coder~linkedin-profile-scraper`);
    const res1 = await fetch(
      `https://api.apify.com/v2/acts/supreme_coder~linkedin-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [{ url: linkedinUrl }] }),
      },
    );
    if (res1.ok) {
      const result = await res1.json();
      if (Array.isArray(result) && result.length > 0) {
        console.log("[LinkedIn import] supreme_coder succeeded");
        data = result;
      } else {
        console.warn("[LinkedIn import] supreme_coder returned empty result");
        lastError = "supreme_coder returned empty dataset";
      }
    } else {
      const errorText = await res1.text();
      console.error(`[LinkedIn import] supreme_coder failed — status: ${res1.status}, body: ${errorText}`);
      lastError = `supreme_coder returned ${res1.status}`;
    }
  } catch (e) {
    console.error("[LinkedIn import] supreme_coder threw:", e);
    lastError = `supreme_coder threw: ${e instanceof Error ? e.message : String(e)}`;
  }

  // --- Actor 2: harvestapi (async: start run, then poll dataset) ---
  if (!data) {
    try {
      console.log(`[LinkedIn import] Trying actor: harvestapi~linkedin-profile-scraper (async)`);
      const startRes = await fetch(
        `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/runs?token=${APIFY_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileUrls: [linkedinUrl] }),
        },
      );
      if (!startRes.ok) {
        const errorText = await startRes.text();
        console.error(`[LinkedIn import] harvestapi start failed — status: ${startRes.status}, body: ${errorText}`);
        lastError = `harvestapi start returned ${startRes.status}`;
      } else {
        const runData = await startRes.json();
        const runId: string = runData?.data?.id;
        console.log(`[LinkedIn import] harvestapi run started, id: ${runId}`);

        // Poll up to 8 times with 5s intervals (40s total)
        for (let attempt = 0; attempt < 8; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const pollRes = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`,
          );
          if (pollRes.ok) {
            const items = await pollRes.json();
            if (Array.isArray(items) && items.length > 0) {
              console.log(`[LinkedIn import] harvestapi succeeded on attempt ${attempt + 1}`);
              data = items;
              break;
            }
          }
          console.log(`[LinkedIn import] harvestapi poll attempt ${attempt + 1} — no data yet`);
        }
        if (!data) {
          lastError = "harvestapi returned empty after polling";
          console.warn("[LinkedIn import] harvestapi returned empty after all polls");
        }
      }
    } catch (e) {
      console.error("[LinkedIn import] harvestapi threw:", e);
      lastError = `harvestapi threw: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // --- Actor 3: curious_coder (sync, profileUrls) ---
  if (!data) {
    try {
      console.log(`[LinkedIn import] Trying actor: curious_coder~linkedin-profile-scraper`);
      const res3 = await fetch(
        `https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileUrls: [linkedinUrl] }),
        },
      );
      if (res3.ok) {
        const result = await res3.json();
        if (Array.isArray(result) && result.length > 0) {
          console.log("[LinkedIn import] curious_coder succeeded");
          data = result;
        } else {
          console.warn("[LinkedIn import] curious_coder returned empty result");
          lastError = "curious_coder returned empty dataset";
        }
      } else {
        const errorText = await res3.text();
        console.error(`[LinkedIn import] curious_coder failed — status: ${res3.status}, body: ${errorText}`);
        lastError = `curious_coder returned ${res3.status}`;
      }
    } catch (e) {
      console.error("[LinkedIn import] curious_coder threw:", e);
      lastError = `curious_coder threw: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  if (!data || data.length === 0) {
    console.error(`[LinkedIn import] All actors failed. Last error: ${lastError}`);
    res.status(404).json({ error: "Profile not found or private. Make sure your profile is public." });
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: any = data[0];

    const profile: LinkedInImportProfile = {
      name: [item.firstName, item.lastName].filter(Boolean).join(" ") || item.fullName || null,
      email: item.email || null,
      phone: item.phone || item.phoneNumber || null,
      location: item.location || item.geoLocationName || item.addressWithCountry || null,
      headline: item.headline || item.title || null,
      summary: item.summary || item.about || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      experience: (item.positions || item.experience || item.workExperience || []).slice(0, 10).map((p: any) => ({
        title: p.title || p.jobTitle || "",
        company: p.companyName || p.company || p.organizationName || "",
        duration: (() => {
          const start = p.startDate?.year || p.dateRange?.start?.year || "";
          const end = p.endDate?.year || p.dateRange?.end?.year || "Present";
          return start ? `${start} – ${end}` : "Present";
        })(),
        highlights: [],
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      education: (item.educations || item.education || []).slice(0, 5).map((e: any) => ({
        degree: e.degreeName || e.degree || e.fieldOfStudy || "",
        institution: e.schoolName || e.school || e.institutionName || "",
        year: e.endDate?.year?.toString() || e.dateRange?.end?.year?.toString() || null,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      skills: (item.skills || []).slice(0, 20).map((s: any) => s.name || s.skillName || s).filter((s: any) => typeof s === "string" && s.length > 0),
    };

    res.json({ success: true, profile });
  } catch (err) {
    console.error("LinkedIn import parse error:", err);
    res.status(500).json({
      error: "Import failed. Please try again or use PDF upload.",
    });
  }
});

// ── Parse LaTeX → structured VisualResumeData via Claude ─────────────────────
router.post("/parse-latex", async (req: Request, res: Response) => {
  console.log("parse-latex called");
  const { latex } = req.body as { latex?: string };
  console.log("Latex length:", latex?.length ?? 0);
  console.log("Latex preview:", latex?.substring(0, 200));

  if (!latex) { res.status(400).json({ error: "latex is required" }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("parse-latex: ANTHROPIC_API_KEY is not set");
    res.status(500).json({ error: "API key not configured", details: "ANTHROPIC_API_KEY missing" });
    return;
  }

  try {
    console.log("parse-latex: calling Anthropic API...");
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: `You are a LaTeX resume parser. Parse the LaTeX resume into structured JSON.
Return ONLY valid JSON — no markdown, no code fences, no explanation.
Use exactly this structure (empty string if a field is not found):
{
  "personalInfo": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "" },
  "summary": "",
  "experience": [{ "id": "1", "title": "", "company": "", "location": "", "startDate": "", "endDate": "", "bullets": [""] }],
  "education": [{ "id": "1", "degree": "", "institution": "", "year": "" }],
  "skills": [],
  "certifications": []
}`,
        messages: [{ role: "user", content: latex }],
      }),
    });

    console.log("parse-latex: API status:", apiRes.status);

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error("parse-latex: API error body:", errBody);
      res.status(500).json({ error: "Claude API error", details: errBody });
      return;
    }

    const apiJson = await apiRes.json() as { content?: Array<{ type: string; text?: string }>; error?: { message: string } };
    console.log("parse-latex: API response type:", apiJson?.content?.[0]?.type);

    const raw = apiJson.content?.[0]?.type === "text" ? (apiJson.content[0].text ?? "{}").trim() : "{}";
    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    console.log("parse-latex: cleaned JSON preview:", cleaned.substring(0, 100));

    let data: unknown;
    try {
      data = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("parse-latex: JSON.parse failed:", parseErr, "raw:", cleaned.substring(0, 300));
      res.status(500).json({ error: "Failed to parse Claude response as JSON", details: String(parseErr) });
      return;
    }

    console.log("parse-latex: success");
    res.json({ success: true, data });
  } catch (err) {
    console.error("parse-latex error:", err);
    res.status(500).json({ error: "Failed to parse resume. Please try again.", details: err instanceof Error ? err.message : String(err) });
  }
});

// ── Regenerate LaTeX from VisualResumeData via Claude ────────────────────────
router.post("/regenerate-from-data", async (req: Request, res: Response) => {
  console.log("regenerate-from-data called");
  const { resumeData, jd, originalLatex } = req.body as {
    resumeData?: Record<string, unknown>;
    jd?: { title?: string; company?: string; text?: string };
    originalLatex?: string;
  };
  console.log("resumeData keys:", resumeData ? Object.keys(resumeData) : "missing");

  if (!resumeData) { res.status(400).json({ error: "resumeData is required" }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("regenerate-from-data: ANTHROPIC_API_KEY is not set");
    res.status(500).json({ error: "API key not configured", details: "ANTHROPIC_API_KEY missing" });
    return;
  }

  // Extract preamble from original LaTeX so we preserve the template
  const preambleEnd = originalLatex ? originalLatex.indexOf("\\begin{document}") : -1;
  const preamble = preambleEnd > 0 ? originalLatex!.slice(0, preambleEnd + 16) : "";

  const systemPrompt = `You are a professional LaTeX resume generator. Generate a clean, ATS-optimised LaTeX resume from the structured JSON provided.
${preamble ? "You MUST use the exact same LaTeX preamble (\\documentclass, \\usepackage lines, etc.) as provided — do not change it." : "Use: \\documentclass[11pt]{article}, helvet font, geometry 0.65in margins, enumitem, hyperref."}
Rules:
- Return ONLY the complete LaTeX source code — no markdown, no code fences, no explanation
- Start with \\documentclass, end with \\end{document}
- Escape special characters: & → \\&, % → \\%, # → \\#, _ → \\_, $ → \\$
- Use \\begin{itemize}[nosep, leftmargin=*] for bullet points
- Keep formatting professional and consistent
${jd ? `- This resume targets: ${jd.title || "the role"} at ${jd.company || "the company"}` : ""}`;

  const userContent = [
    preamble ? `LaTeX preamble to reuse:\n${preamble}\n\n` : "",
    `Resume data (JSON):\n${JSON.stringify(resumeData, null, 2)}`,
    jd?.text ? `\n\nTarget job description (first 1000 chars):\n${jd.text.slice(0, 1000)}` : "",
  ].join("");

  try {
    console.log("regenerate-from-data: calling Anthropic API...");
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    console.log("regenerate-from-data: API status:", apiRes.status);

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error("regenerate-from-data: API error body:", errBody);
      res.status(500).json({ error: "Claude API error", details: errBody });
      return;
    }

    const apiJson = await apiRes.json() as { content?: Array<{ type: string; text?: string }> };
    const raw = apiJson.content?.[0]?.type === "text" ? (apiJson.content[0].text ?? "").trim() : "";
    console.log("regenerate-from-data: raw length:", raw.length, "preview:", raw.substring(0, 80));

    const latex = raw
      .replace(/^```latex\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "")
      .trim();

    console.log("regenerate-from-data: latex length:", latex.length);

    if (!latex.includes("\\documentclass")) {
      console.error("regenerate-from-data: output missing \\documentclass");
      res.status(500).json({ error: "Generated output is not valid LaTeX. Please try again." });
      return;
    }

    console.log("regenerate-from-data: success");
    res.json({ latex });
  } catch (err) {
    console.error("regenerate-from-data error:", err);
    res.status(500).json({ error: "Failed to regenerate resume. Please try again.", details: err instanceof Error ? err.message : String(err) });
  }
});

// ── RezAI Agent — unified career coach endpoint ──────────────────────────────
router.post(
  "/agent",
  async (req: Request, res: Response) => {
    const {
      latex,
      message,
      history = [],
      jd,
      atsOriginal,
      atsTailored,
      matchedKeywords = [],
      missingKeywords = [],
      currentTab = "resume",
    } = req.body as {
      latex?: string;
      message?: string;
      history?: { role: "user" | "assistant"; content: string }[];
      jd?: { title?: string; company?: string; text?: string };
      atsOriginal?: { score: number; breakdown: string };
      atsTailored?: { score: number; breakdown: string };
      matchedKeywords?: string[];
      missingKeywords?: string[];
      currentTab?: string;
    };

    if (!message) {
      res.status(400).json({ error: "message is required." });
      return;
    }

    const system = [
      "You are RezAI Agent — a world-class career coach, resume expert, and interview specialist.",
      "",
      "━━━ CANDIDATE CONTEXT ━━━",
      `TARGET JOB: ${jd?.title || "Unknown role"} at ${jd?.company || "Unknown company"}`,
      `JOB DESCRIPTION: ${(jd?.text || "").slice(0, 1000)}`,
      `ATS SCORE: ${atsOriginal?.score ?? "?"} → ${atsTailored?.score ?? "?"}`,
      `MATCHED KEYWORDS: ${matchedKeywords.join(", ") || "none"}`,
      `MISSING KEYWORDS: ${missingKeywords.join(", ") || "none"}`,
      `USER IS CURRENTLY ON: ${currentTab} tab`,
      latex ? `\nRESUME (LaTeX):\n${latex}` : "",
      "",
      "━━━ YOU DO TWO THINGS ━━━",
      "",
      "THING 1 — EDIT RESUME:",
      "When user wants to edit/improve/fix/add/shorten anything in the resume:",
      "→ Make the changes to the LaTeX",
      "→ Return the complete updated LaTeX in <LATEX> tags",
      "→ Explain exactly what changed in the MESSAGE using → bullets",
      String.raw`• Always keep the exact same preamble (\usepackage{helvet}, etc.)`,
      "• Do NOT add markdown fences inside LATEX tags",
      "",
      "THING 2 — ANSWER CAREER QUESTIONS:",
      "When user asks about job fit, salary, interview prep, career advice, emails, LinkedIn, RezAI features:",
      "→ Answer conversationally using their ACTUAL data (real company name, real scores, real keywords)",
      "→ Do NOT return LaTeX — leave <LATEX> empty",
      "",
      "━━━ FEATURE ACTIONS (add when relevant) ━━━",
      "Use one of these inside <ACTION> when it makes sense to direct the user:",
      "tab:resume  tab:ats  tab:cover  tab:email  tab:linkedin",
      "download:pdf  download:docx",
      "",
      "━━━ STRICT RULES ━━━",
      "• Only help with: resume, career, jobs, interviews, salary, LinkedIn, job search, cover letters",
      "• If asked anything outside these topics, respond: 'I am RezAI Agent — I specialise in career topics only!'",
      "• Always use the candidate's ACTUAL data — never give generic advice",
      "• Always be warm, specific, and encouraging",
      "• Always end your message with a follow-up question or a concrete next-step suggestion",
      "• Remember the full conversation history provided",
      "",
      "━━━ RESPONSE FORMAT — ALWAYS USE THESE EXACT TAGS ━━━",
      "<TYPE>edit</TYPE>  OR  <TYPE>answer</TYPE>",
      "<LATEX>[complete updated LaTeX if type=edit, otherwise leave empty]</LATEX>",
      "<MESSAGE>[your full response to the user]</MESSAGE>",
      "<ACTION>[one action string from the list above, or leave empty]</ACTION>",
    ].join("\n");

    // Build multi-turn conversation: history + current user message
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...history,
      { role: "user", content: message },
    ];

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system,
        messages,
      });

      const raw = response.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { type: string; text: string }) => b.text)
        .join("");

      const type = (extractTag(raw, "TYPE") || "answer").trim() as "edit" | "answer";
      const latexRaw = extractTag(raw, "LATEX").trim();
      const latex_out = type === "edit" && latexRaw
        ? latexRaw.replace(/^```latex\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
        : null;
      const agentMessage = extractTag(raw, "MESSAGE").trim()
        || "I've processed your request. Is there anything else I can help you with?";
      const action = extractTag(raw, "ACTION").trim() || null;

      res.json({ type, latex: latex_out, message: agentMessage, action });
    } catch (err) {
      req.log.error({ err }, "Agent failed");
      res.status(500).json({
        error: err instanceof Error ? err.message : "Agent request failed.",
      });
    }
  },
);

export default router;
