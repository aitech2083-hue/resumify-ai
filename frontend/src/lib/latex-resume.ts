export interface ExperienceEntry {
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: string[];
}

export interface SkillGroup {
  category: string;
  items: string;
}

export interface EducationEntry {
  degree: string;
  school: string;
  location: string;
  dates: string;
  details: string;
}

export interface CustomSection {
  title: string;
  rawLatex: string;
}

export interface ResumeData {
  name: string;
  contactLine: string;
  summary: string;
  experience: ExperienceEntry[];
  skills: SkillGroup[];
  education: EducationEntry[];
  certifications: string[];
  customSections: CustomSection[];
}

const KNOWN_SECTION_PATTERNS = [
  /summary|profile|objective/i,
  /experience|employment|work/i,
  /skill|competenc|technical/i,
  /education/i,
  /certif|license|award/i,
];

function isKnownSection(name: string): boolean {
  const sn = name.replace(/[^a-z ]/gi, "").trim().toLowerCase();
  return KNOWN_SECTION_PATTERNS.some(p => p.test(sn));
}

function clean(s: string): string {
  return s
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    .replace(/\\Large\s*/g, "")
    .replace(/\\large\s*/g, "")
    .replace(/\\LARGE\s*/g, "")
    .replace(/\\Huge\s*/g, "")
    .replace(/\\huge\s*/g, "")
    .replace(/\\normalsize\s*/g, "")
    .replace(/\\small\s*/g, "")
    .replace(/\\footnotesize\s*/g, "")
    .replace(/\\\\/g, "")
    .replace(/\\hfill\s*/g, "")
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\url\{([^}]*)\}/g, "$1")
    .replace(/\\[,~]/g, " ")
    .replace(/~/g, " ")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/\\[&%#_]/g, m => m[1])
    .replace(/\{([^}]*)\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function stripItemize(text: string): string {
  return text.replace(/\\begin\{itemize\}[\s\S]*?\\end\{itemize\}/g, "");
}

export function parseLatex(latex: string): ResumeData {
  const data: ResumeData = {
    name: "",
    contactLine: "",
    summary: "",
    experience: [],
    skills: [],
    education: [],
    certifications: [],
    customSections: [],
  };

  const beginDoc = latex.indexOf("\\begin{document}");
  if (beginDoc < 0) return data;

  const sectionPattern = /\\section\*?\{([^}]+)\}/gi;
  const sections: { name: string; originalName: string; start: number; content: string }[] = [];
  let match;

  while ((match = sectionPattern.exec(latex)) !== null) {
    sections.push({ name: match[1].toLowerCase(), originalName: match[1], start: match.index, content: "" });
  }

  const endDoc = latex.indexOf("\\end{document}");
  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].start;
    const end = i + 1 < sections.length ? sections[i + 1].start : (endDoc > 0 ? endDoc : latex.length);
    sections[i].content = latex.slice(start, end);
  }

  const headerEnd = sections.length > 0 ? sections[0].start : (endDoc > 0 ? endDoc : latex.length);
  const headerBlock = latex.slice(beginDoc + 16, headerEnd);

  const headerLines = headerBlock
    .split(/\\\\\s*|\n/)
    .map(l => clean(l))
    .filter(l => l.length > 0);

  if (headerLines.length >= 1) data.name = headerLines[0];
  if (headerLines.length >= 2) data.contactLine = headerLines.slice(1).join(" | ");

  for (const sec of sections) {
    const sn = sec.name.replace(/[^a-z ]/g, "").trim();

    if (/summary|profile|objective/.test(sn)) {
      const content = sec.content.replace(/\\section\*?\{[^}]+\}/i, "");
      data.summary = clean(content);
      continue;
    }

    if (/experience|employment|work/.test(sn)) {
      const content = sec.content.replace(/\\section\*?\{[^}]+\}/i, "");
      const textOutsideItems = stripItemize(content);
      const entryPattern = /\\textbf\{([^}]+)\}/g;
      let em;
      const positions: number[] = [];
      const titles: string[] = [];
      while ((em = entryPattern.exec(textOutsideItems)) !== null) {
        const originalIdx = content.indexOf(textOutsideItems.substring(Math.max(0, em.index - 20), em.index + em[0].length));
        const realIdx = originalIdx >= 0 ? originalIdx + (em.index - Math.max(0, em.index - 20)) : em.index;
        positions.push(em.index);
        titles.push(em[1]);
      }

      const entryBlocks: string[] = [];
      for (let j = 0; j < positions.length; j++) {
        const searchTitle = `\\textbf{${titles[j]}}`;
        let realStart = content.indexOf(searchTitle);
        if (realStart < 0) realStart = 0;
        let realEnd: number;
        if (j + 1 < titles.length) {
          const nextTitle = `\\textbf{${titles[j + 1]}}`;
          const insideItems = content.indexOf(nextTitle);
          realEnd = insideItems > realStart ? insideItems : content.length;
        } else {
          realEnd = content.length;
        }
        entryBlocks.push(content.slice(realStart, realEnd));
      }

      for (let j = 0; j < entryBlocks.length; j++) {
        const block = entryBlocks[j];
        const entry: ExperienceEntry = {
          title: titles[j] || "",
          company: "",
          location: "",
          dates: "",
          bullets: [],
        };

        const italicMatch = block.match(/\\textit\{([^}]+)\}/);
        if (italicMatch) entry.company = italicMatch[1];

        const hfillMatches = [...block.matchAll(/\\hfill\s*(.+?)(?:\\\\|\n|$)/g)];
        for (const hm of hfillMatches) {
          const val = clean(hm[1]);
          if (/\d{4}|present|current/i.test(val) && !entry.dates) entry.dates = val;
          else if (!entry.location && !/\\textbf/.test(hm[1])) entry.location = val;
        }

        const itemMatches = [...block.matchAll(/\\item\s+(.+?)(?=\\item|\\end\{itemize\}|$)/gs)];
        for (const im of itemMatches) {
          const bullet = clean(im[1]);
          if (bullet) entry.bullets.push(bullet);
        }

        if (entry.title) data.experience.push(entry);
      }
      continue;
    }

    if (/skill|competenc|technical/.test(sn)) {
      const content = sec.content.replace(/\\section\*?\{[^}]+\}/i, "");
      const skillLines = [...content.matchAll(/\\textbf\{([^}]+)\}[:\s]*([\s\S]*?)(?=\\textbf\{|$)/g)];
      if (skillLines.length > 0) {
        for (const sl of skillLines) {
          const items = clean(sl[2]);
          if (items) data.skills.push({ category: sl[1].trim(), items });
        }
      } else {
        const plainSkills = clean(content);
        if (plainSkills) data.skills.push({ category: "Skills", items: plainSkills });
      }
      continue;
    }

    if (/education/.test(sn)) {
      const content = sec.content.replace(/\\section\*?\{[^}]+\}/i, "");
      const boldMatches = [...content.matchAll(/\\textbf\{([^}]+)\}/g)];
      const eduPositions = boldMatches.map(m => ({ index: m.index!, text: m[1] }));

      for (let j = 0; j < eduPositions.length; j++) {
        const start = eduPositions[j].index;
        const end = j + 1 < eduPositions.length ? eduPositions[j + 1].index : content.length;
        const block = content.slice(start, end);

        const edu: EducationEntry = {
          degree: eduPositions[j].text,
          school: "",
          location: "",
          dates: "",
          details: "",
        };

        const italicMatch = block.match(/\\textit\{([^}]+)\}/);
        if (italicMatch) edu.school = italicMatch[1];

        const hfillMatches = [...block.matchAll(/\\hfill\s*(.+?)(?:\\\\|\n|$)/g)];
        for (const hm of hfillMatches) {
          const val = clean(hm[1]);
          if (/\d{4}|present|current/i.test(val)) edu.dates = val;
          else if (!edu.location) edu.location = val;
        }

        if (edu.degree) data.education.push(edu);
      }
      continue;
    }

    if (/certif|license|award/.test(sn)) {
      const content = sec.content.replace(/\\section\*?\{[^}]+\}/i, "");
      const items = [...content.matchAll(/\\item\s+(.+?)(?=\\item|\\end\{itemize\}|$)/gs)];
      for (const im of items) {
        const cert = clean(im[1]);
        if (cert) data.certifications.push(cert);
      }
      if (data.certifications.length === 0) {
        const plainCerts = clean(content).split(/[,;]\s*/);
        data.certifications = plainCerts.filter(c => c.length > 2);
      }
      continue;
    }

    if (!isKnownSection(sec.originalName)) {
      const rawContent = sec.content;
      data.customSections.push({
        title: sec.originalName,
        rawLatex: rawContent,
      });
    }
  }

  return data;
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\$/g, "\\$")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");
}

function escSafe(s: string): string {
  return s
    .replace(/(?<!\\)&/g, "\\&")
    .replace(/(?<!\\)%/g, "\\%")
    .replace(/(?<!\\)#/g, "\\#")
    .replace(/(?<!\\)_/g, "\\_");
}

export function buildLatex(d: ResumeData, originalLatex: string): string {
  const preambleEnd = originalLatex.indexOf("\\begin{document}");
  const preamble = preambleEnd > 0
    ? originalLatex.slice(0, preambleEnd + 16)
    : [
      "\\documentclass[11pt]{article}",
      "\\usepackage[T1]{fontenc}",
      "\\usepackage[utf8]{inputenc}",
      "\\usepackage{helvet}",
      "\\renewcommand{\\familydefault}{\\sfdefault}",
      "\\usepackage[margin=0.65in]{geometry}",
      "\\usepackage{enumitem}",
      "\\usepackage{hyperref}",
      "\\usepackage{titlesec}",
      "\\usepackage{tfrupee}",
      "",
      "\\pagestyle{empty}",
      "\\begin{document}",
    ].join("\n");

  let body = `\n\n\\begin{center}\n\\textbf{\\Large ${escSafe(d.name)}} \\\\\n${escSafe(d.contactLine)}\n\\end{center}\n`;

  if (d.summary) {
    body += `\n\\section*{Professional Summary}\n${escSafe(d.summary)}\n`;
  }

  if (d.experience.length > 0) {
    body += `\n\\section*{Work Experience}\n`;
    for (const exp of d.experience) {
      body += `\\textbf{${escSafe(exp.title)}}`;
      if (exp.dates) body += ` \\hfill ${escSafe(exp.dates)}`;
      body += ` \\\\\n`;
      if (exp.company) {
        body += `\\textit{${escSafe(exp.company)}}`;
        if (exp.location) body += ` \\hfill ${escSafe(exp.location)}`;
        body += ` \\\\\n`;
      }
      if (exp.bullets.length > 0) {
        body += `\\begin{itemize}[nosep, leftmargin=*]\n`;
        for (const b of exp.bullets) {
          body += `  \\item ${escSafe(b)}\n`;
        }
        body += `\\end{itemize}\n`;
      }
      body += `\\vspace{4pt}\n`;
    }
  }

  if (d.skills.length > 0) {
    body += `\n\\section*{Skills}\n`;
    for (const sg of d.skills) {
      body += `\\textbf{${escSafe(sg.category)}:} ${escSafe(sg.items)} \\\\\n`;
    }
  }

  if (d.education.length > 0) {
    body += `\n\\section*{Education}\n`;
    for (const edu of d.education) {
      body += `\\textbf{${escSafe(edu.degree)}}`;
      if (edu.dates) body += ` \\hfill ${escSafe(edu.dates)}`;
      body += ` \\\\\n`;
      if (edu.school) {
        body += `\\textit{${escSafe(edu.school)}}`;
        if (edu.location) body += ` \\hfill ${escSafe(edu.location)}`;
        body += ` \\\\\n`;
      }
      if (edu.details) body += `${escSafe(edu.details)} \\\\\n`;
    }
  }

  if (d.certifications.length > 0) {
    body += `\n\\section*{Certifications}\n`;
    body += `\\begin{itemize}[nosep, leftmargin=*]\n`;
    for (const c of d.certifications) {
      body += `  \\item ${escSafe(c)}\n`;
    }
    body += `\\end{itemize}\n`;
  }

  for (const cs of d.customSections) {
    body += `\n${cs.rawLatex}\n`;
  }

  body += `\n\\end{document}\n`;

  return preamble + body;
}
