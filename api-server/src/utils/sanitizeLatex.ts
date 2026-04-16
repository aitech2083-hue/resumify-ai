/**
 * sanitizeLatex — unified LaTeX sanitization utility
 *
 * Converts markdown syntax and problematic Unicode characters to proper
 * LaTeX equivalents before writing to a .tex file.
 *
 * Strategy:
 *   1. Replace backtick code spans and Unicode chars globally.
 *   2. Per-line: convert **bold** / *italic* / # headings on lines that
 *      are NOT already LaTeX commands (i.e. don't start with \ or %).
 *      This prevents double-escaping real LaTeX markup.
 */
export function sanitizeLatex(latex: string): string {
  // Step 1 — global replacements (safe on all lines)
  let result = latex
    .replace(/`(.+?)`/g, "\\texttt{$1}")
    .replace(/\u2013/g, "--")
    .replace(/\u2014/g, "---")
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, "``")
    .replace(/\u201D/g, "''")
    .replace(/\u2022/g, "\\textbullet{}")
    .replace(/\u2026/g, "\\ldots{}")
    .replace(/\u00AE/g, "\\textregistered{}")
    .replace(/\u00A9/g, "\\textcopyright{}")
    .replace(/\u2122/g, "\\texttrademark{}");

  // Step 2 — per-line markdown conversion (skip LaTeX command lines)
  result = result
    .split("\n")
    .map(line => {
      const trimmed = line.trimStart();
      // Skip blank lines and lines that are already LaTeX (start with \ or %)
      if (trimmed === "" || trimmed.startsWith("\\") || trimmed.startsWith("%")) {
        return line;
      }
      return line
        .replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}")
        .replace(/\*(.+?)\*/g,     "\\textit{$1}")
        .replace(/^#{1,6}\s+/,     "");  // strip leading # headings
    })
    .join("\n");

  return result;
}
