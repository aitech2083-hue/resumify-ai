import type { ResumeData } from "@/types";

// ─── LaTeX escape ─────────────────────────────────────────────────────────────

export function escTex(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\^{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}");
}

// ─── Pure JS LaTeX builder — no API needed ────────────────────────────────────

export function buildLatexFromData(d: ResumeData): string {
  const pi = d.personalInfo;

  const contactParts = [pi.location, pi.email, pi.phone, pi.linkedin]
    .filter(Boolean)
    .map(escTex)
    .join(" $\\bullet$ ");

  // Build each experience entry as { content, hasPageBreak } so the joiner
  // can decide whether to add \vspace{6pt} between entries.
  // Rule: skip \vspace{6pt} after an entry when the NEXT entry has pageBreakBefore —
  // otherwise the \vspace{6pt} lands on the first page just before \newpage (wrong).
  const experienceParts = d.experience.map((exp, idx) => {
    const bullets = exp.bullets.filter(Boolean);
    const pageBreak = exp.pageBreakBefore && idx > 0 ? "\\newpage\n" : "";
    const bulletBlock = bullets.length > 0
      ? `\\begin{itemize}[nosep,leftmargin=*,topsep=2pt,partopsep=0pt]\n${bullets.map(b => `  \\item ${escTex(b)}`).join("\n")}\n\\end{itemize}`
      : "";
    return {
      content: `${pageBreak}\\noindent\\textbf{${escTex(exp.title)}} \\hfill ${escTex(exp.startDate)}${exp.endDate ? ` -- ${escTex(exp.endDate)}` : ""}\\\\
\\textit{${escTex(exp.company)}${exp.location ? `, ${escTex(exp.location)}` : ""}}
${bulletBlock}`,
      hasPageBreak: !!(exp.pageBreakBefore && idx > 0),
    };
  });

  const experienceJoined = experienceParts
    .map((part, idx) => {
      const isLast = idx === experienceParts.length - 1;
      const nextHasPageBreak = experienceParts[idx + 1]?.hasPageBreak === true;
      // No trailing \vspace when: this is the last entry, or next entry starts a new page
      if (isLast || nextHasPageBreak) return part.content;
      return part.content + "\n\\vspace{6pt}";
    })
    .join("\n");

  const experienceSection = d.experience.length === 0 ? "" : `
\\section*{Work Experience}
\\vspace{-4pt}
${experienceJoined}`;

  const educationSection = d.education.length === 0 ? "" : `
\\section*{Education}
\\vspace{-4pt}
${d.education.map(edu => `\\noindent\\textbf{${escTex(edu.degree)}} \\hfill ${escTex(edu.year)}\\\\
${escTex(edu.institution)}`).join("\n\\vspace{4pt}\n")}`;

  const skillsSection = d.skills.filter(Boolean).length === 0 ? "" : `
\\section*{Skills}
${escTex(d.skills.filter(Boolean).join(", "))}`;

  const certsSection = d.certifications.filter(Boolean).length === 0 ? "" : `
\\section*{Certifications}
\\begin{itemize}[nosep,leftmargin=*]
${d.certifications.filter(Boolean).map(c => `  \\item ${escTex(c)}`).join("\n")}
\\end{itemize}`;

  const summarySection = d.summary.trim() ? `
\\section*{Professional Summary}
${escTex(d.summary)}` : "";

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[top=0.65in,bottom=0.65in,left=0.65in,right=0.65in]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\usepackage[T1]{fontenc}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}

\\begin{document}

\\begin{center}
{\\Large \\textbf{${escTex(pi.name)}}}\\\\[4pt]
{\\small ${contactParts}}
\\end{center}

\\vspace{2pt}
\\hrule
\\vspace{4pt}
${summarySection}
${experienceSection}
${educationSection}
${skillsSection}
${certsSection}

\\end{document}`.replace(/\n{3,}/g, "\n\n");
}
