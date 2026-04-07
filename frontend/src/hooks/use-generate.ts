import { useMutation } from "@tanstack/react-query";
import type { GenerateResponse, Mode, Tone, JD, ScratchData } from "@/types";

interface GenerateParams {
  mode: Mode;
  tone: Tone;
  jds: JD[];
  extra?: string;
  scratchData?: ScratchData;
  resumeFile?: File | null;
  linkedinFile?: File | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  linkedinProfile?: Record<string, any> | null;
}

export function useGenerateResume() {
  return useMutation({
    mutationFn: async (params: GenerateParams) => {
      const formData = new FormData();
      formData.append("mode", params.mode);
      formData.append("tone", params.tone);
      
      // Clean JDs for API
      const cleanJds = params.jds
        .filter(jd => jd.text.trim().length > 20)
        .map(({ title, company, text }) => ({ title, company, text }));
        
      if (cleanJds.length === 0) {
        throw new Error("Please provide at least one valid job description.");
      }
      
      formData.append("jds", JSON.stringify(cleanJds));

      if (params.extra?.trim()) {
        formData.append("extra", params.extra.trim());
      }

      if (params.mode === "scratch" && params.scratchData) {
        // Validate basic scratch data
        if (!params.scratchData.name) {
          throw new Error("Name is required in Build from Scratch mode.");
        }
        formData.append("scratchData", JSON.stringify(params.scratchData));
      } else if (params.mode === "upload" && params.resumeFile) {
        formData.append("resume", params.resumeFile);
      } else if (params.mode === "linkedin" && params.linkedinFile) {
        formData.append("resume", params.linkedinFile);
      } else if (params.mode === "linkedin" && params.linkedinProfile) {
        formData.append("linkedinProfile", JSON.stringify(params.linkedinProfile));
      } else if (params.mode !== "scratch") {
        throw new Error("Please provide a resume file.");
      }

      const baseUrl = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${baseUrl}api/resume/generate`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Generation failed (${res.status})`);
      }

      const data = await res.json();
      return data as GenerateResponse;
    },
  });
}
