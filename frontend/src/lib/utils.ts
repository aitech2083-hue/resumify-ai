import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateOverleafUrl(latex: string): string {
  if (!latex) return "#";
  try {
    return `https://www.overleaf.com/docs?snip_uri=data:application/x-latex;base64,${encodeURIComponent(btoa(unescape(encodeURIComponent(latex))))}`;
  } catch (e) {
    console.error("Failed to generate Overleaf URL", e);
    return "#";
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
