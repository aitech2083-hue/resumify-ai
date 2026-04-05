import { useState, useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, Settings, Trash2, Plus, X,
  ChevronRight, Copy, Check, FileCode2,
  Briefcase, GraduationCap, LayoutTemplate,
  History, Eye, ExternalLink, Mail, MessageSquare,
  Download, Loader2, ChevronDown, Bot, Send
} from "lucide-react";
import { cn, copyToClipboard, generateOverleafUrl } from "@/lib/utils";
import type { Mode, Tone, JD, ScratchData, JobResult, GenerateResponse, AtsScore } from "@/types";
import { useGenerateResume } from "@/hooks/use-generate";
import { useHistory } from "@/hooks/use-history";

import { Dropzone } from "@/components/inputs/Dropzone";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { PdfPreview } from "@/components/ui/PdfPreview";
import { ResumeEditor } from "@/components/ui/ResumeEditor";

// -- Refine quick-action chips --
const REFINE_QUICK_CHIPS = [
  "Add missing keywords",
  "Improve ATS score",
  "Shorten to 1 page",
  "Strengthen summary",
  "Fix weak verbs",
  "Make bullets quantified",
] as const;

// -- Initial States --
const initialScratchData: ScratchData = {
  name: "", email: "", phone: "", location: "", linkedin: "", skills: "",
  experiences: [{ id: uuidv4(), title: "", company: "", duration: "", resp: "" }],
  education: [{ id: uuidv4(), degree: "", institution: "", year: "" }],
  certifications: ""
};

// -- Additional Experience Interface --
interface AdditionalExp {
  company: string;
  role: string;
  from: string;
  to: string;
  responsibilities: string;
}

const initialAdditionalExp: AdditionalExp = {
  company: "", role: "", from: "", to: "", responsibilities: ""
};

function formatAdditionalExp(exp: AdditionalExp): string {
  if (!exp.company && !exp.role) return "";
  const parts: string[] = [];
  if (exp.company) parts.push(`Company: ${exp.company}`);
  if (exp.role) parts.push(`Role: ${exp.role}`);
  if (exp.from || exp.to) parts.push(`Duration: ${exp.from || "?"} - ${exp.to || "Present"}`);
  if (exp.responsibilities) parts.push(`Responsibilities:\n${exp.responsibilities}`);
  return parts.join("\n");
}

export default function Home() {
  // -- App State --
  const [mode, setMode] = useState<Mode>("upload");
  const [tone, setTone] = useState<Tone>("formal");
  
  // -- Input State --
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [linkedinFile, setLinkedinFile] = useState<File | null>(null);

  // Structured additional experience (replaces plain textareas)
  const [extraUploadExp, setExtraUploadExp] = useState<AdditionalExp>(initialAdditionalExp);
  const [extraLinkedinExp, setExtraLinkedinExp] = useState<AdditionalExp>(initialAdditionalExp);

  const [scratchData, setScratchData] = useState<ScratchData>(initialScratchData);
  const [extraScratchNotes, setExtraScratchNotes] = useState("");
  
  const [jds, setJds] = useState<JD[]>([{ id: uuidv4(), title: "", company: "", text: "" }]);
  
  // -- Output State --
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [activeJdTab, setActiveJdTab] = useState<number>(0);
  const [activeFeatureTab, setActiveFeatureTab] = useState<string>("resume");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // -- Resume Preview / Edit State --
  const [resumeViewMode, setResumeViewMode] = useState<"preview" | "edit">("preview");
  const [editableLatex, setEditableLatex] = useState<Record<number, string>>({});
  const [previewBlobs, setPreviewBlobs] = useState<Record<number, Blob>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<number, boolean>>({});

  // -- Refine Chat State --
  interface RefineMsg { role: "user" | "assistant"; content: string; }
  const [refineMessages, setRefineMessages] = useState<Record<number, RefineMsg[]>>({});
  const [refineInput, setRefineInput] = useState("");
  const [refineLoading, setRefineLoading] = useState<Record<number, boolean>>({});
  const [refineGreeted, setRefineGreeted] = useState<Record<number, boolean>>({});
  const refineBottomRef = useRef<HTMLDivElement>(null);

  // -- Hooks --
  const generateMut = useGenerateResume();
  const { history, saveHistory, deleteHistory } = useHistory();

  // -- Handlers --
  const handleGenerate = async () => {
    setErrorMsg(null);
    setResult(null);
    
    try {
      let extraNotes = "";
      if (mode === "upload") extraNotes = formatAdditionalExp(extraUploadExp);
      if (mode === "linkedin") extraNotes = formatAdditionalExp(extraLinkedinExp);
      if (mode === "scratch") extraNotes = extraScratchNotes;

      const data = await generateMut.mutateAsync({
        mode, tone, jds, 
        extra: extraNotes,
        scratchData: mode === "scratch" ? scratchData : undefined,
        resumeFile, linkedinFile
      });

      setResult(data);
      setActiveJdTab(0);
      setActiveFeatureTab("resume");
      
      // Save to history
      saveHistory({
        id: uuidv4(),
        date: new Date().toISOString(),
        jds: [...jds],
        response: data
      });
      
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate materials. Please try again.");
    }
  };

  const loadHistoryItem = (item: any) => {
    setResult(item.response);
    setJds(item.jds);
    setActiveJdTab(0);
    setActiveFeatureTab("resume");
    setResumeViewMode("preview");
  };

  // Auto-scroll refine chat to bottom
  useEffect(() => {
    refineBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [refineMessages, refineLoading]);

  // Inject greeting when Refine tab is first opened for each JD
  useEffect(() => {
    if (activeFeatureTab !== "refine" || !result || refineGreeted[activeJdTab]) return;
    const r = result.results[activeJdTab];
    if (!r) return;
    const greeting =
      `Hi! I've reviewed your resume for ${r.company}. ` +
      `Your ATS score improved from ${r.atsOriginal.score} to ${r.atsTailored.score}.\n\n` +
      `Here's what I can help you with next:`;
    setRefineMessages(prev => ({ ...prev, [activeJdTab]: [{ role: "assistant" as const, content: greeting }] }));
    setRefineGreeted(prev => ({ ...prev, [activeJdTab]: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFeatureTab, activeJdTab]);

  // Core send logic — used by handleRefine, quick chips, and Fix with AI
  const sendRefineMessage = async (instruction: string, tab = activeJdTab) => {
    const latex = editableLatex[tab] || result?.results[tab]?.latex || "";
    if (!instruction || !latex || refineLoading[tab]) return;

    const userMsg: RefineMsg = { role: "user", content: instruction };
    setRefineMessages(prev => ({ ...prev, [tab]: [...(prev[tab] || []), userMsg] }));
    setRefineLoading(prev => ({ ...prev, [tab]: true }));

    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const jd = jds[tab];
      const res = await fetch(`${baseUrl}api/resume/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex, instruction, jd }),
      });
      if (!res.ok) throw new Error("Refinement failed");
      const data = await res.json();
      const newLatex: string = data.latex;

      setEditableLatex(prev => ({ ...prev, [tab]: newLatex }));
      setPreviewLoading(prev => ({ ...prev, [tab]: true }));
      compileLatexToBlob(newLatex).then(blob => {
        if (blob) setPreviewBlobs(prev => ({ ...prev, [tab]: blob }));
        setPreviewLoading(prev => ({ ...prev, [tab]: false }));
      });

      const assistantMsg: RefineMsg = {
        role: "assistant",
        content: data.message || "Done! Your resume has been updated. Switch to the Resume tab to see the changes.",
      };
      setRefineMessages(prev => ({ ...prev, [tab]: [...(prev[tab] || []), assistantMsg] }));
    } catch {
      const errMsg: RefineMsg = { role: "assistant", content: "Something went wrong. Please try again." };
      setRefineMessages(prev => ({ ...prev, [tab]: [...(prev[tab] || []), errMsg] }));
    } finally {
      setRefineLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  const handleRefine = async () => {
    const instruction = refineInput.trim();
    if (!instruction) return;
    setRefineInput("");
    await sendRefineMessage(instruction);
  };

  // Fix with AI — switches to Refine tab and auto-sends missing keywords message
  const handleFixWithAI = (missingKeywords: string[]) => {
    const instruction = `Add these missing keywords naturally into my resume: ${missingKeywords.join(", ")}`;
    setActiveFeatureTab("refine");
    // Short delay lets the greeting inject before the user message appears
    setTimeout(() => sendRefineMessage(instruction), 80);
  };

  // -- Compile latex → Blob for preview --
  const compileLatexToBlob = useCallback(async (latex: string): Promise<Blob | null> => {
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${baseUrl}api/compile/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex }),
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  }, []);

  // Auto-compile all JDs when result arrives
  useEffect(() => {
    if (!result) return;
    setPreviewBlobs({});
    setPreviewLoading({});

    const latexMap: Record<number, string> = {};
    result.results.forEach((r, i) => { latexMap[i] = r.latex || ""; });
    setEditableLatex(latexMap);
    setResumeViewMode("preview");

    result.results.forEach((r, i) => {
      if (!r.latex) return;
      setPreviewLoading(prev => ({ ...prev, [i]: true }));
      compileLatexToBlob(r.latex).then(blob => {
        if (blob) setPreviewBlobs(prev => ({ ...prev, [i]: blob }));
        setPreviewLoading(prev => ({ ...prev, [i]: false }));
      });
    });
  }, [result, compileLatexToBlob]);

  const downloadPdf = async (latex: string, filename = "resume.pdf") => {
    if (!latex || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${baseUrl}api/compile/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Compilation failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || "PDF download failed. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadDocx = async (latex: string, filename = "resume.docx") => {
    if (!latex || downloadingDocx) return;
    setDownloadingDocx(true);
    setShowDownloadMenu(false);
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${baseUrl}api/compile/docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Conversion failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || "Word download failed. Please try again.");
    } finally {
      setDownloadingDocx(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* HEADER */}
      <header className="flex-shrink-0 h-16 px-6 flex items-center justify-between glass-panel z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-glow">
            <Zap className="w-5 h-5 text-primary-foreground fill-current" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-none text-foreground tracking-wide">Resumify AI</h1>
            <p className="text-xs font-medium text-primary tracking-widest uppercase mt-1 opacity-80">v2 Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-full bg-surface border border-border flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            System Ready
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* === LEFT PANEL (INPUTS) === */}
        <div className="w-full md:w-[480px] flex-shrink-0 flex flex-col border-r border-border bg-surface/30 z-10">
          <div className="p-5 border-b border-border bg-surface/50 backdrop-blur-sm">
            <h2 className="font-display text-xl font-semibold mb-1">Configuration</h2>
            <p className="text-sm text-muted-foreground">Provide your base profile and target roles.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
            
            {/* 1. Resume Mode */}
            <section className="space-y-3">
              <label className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Base Profile Mode</label>
              <div className="flex bg-surface p-1 rounded-lg border border-border">
                {(["upload", "linkedin", "scratch"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "flex-1 text-xs font-medium py-2 rounded-md transition-all duration-200 capitalize tracking-wide",
                      mode === m 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </section>

            {/* Mode Content */}
            <AnimatePresence mode="wait">
              <motion.section 
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {mode === "upload" && (
                  <div className="space-y-4">
                    <Dropzone 
                      accept={{ "application/pdf": [".pdf"], "text/plain": [".txt"] }}
                      selectedFile={resumeFile}
                      onFileSelect={setResumeFile}
                      label="Drop existing resume"
                      sublabel="PDF or TXT format"
                      icon={<FileCode2 className="w-6 h-6 text-muted-foreground" />}
                    />

                    {/* Structured Additional Experience */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
                        Additional / Recent Experience
                      </label>
                      <p className="text-xs text-muted-foreground">Have a new job not on your resume? Add it here — it will appear first.</p>
                      <div className="p-3 bg-surface border border-border rounded-xl space-y-2">
                        <input
                          type="text"
                          placeholder="Company name"
                          value={extraUploadExp.company}
                          onChange={e => setExtraUploadExp(s => ({ ...s, company: e.target.value }))}
                          className="scratch-input"
                        />
                        <input
                          type="text"
                          placeholder="Your role / position"
                          value={extraUploadExp.role}
                          onChange={e => setExtraUploadExp(s => ({ ...s, role: e.target.value }))}
                          className="scratch-input"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="From (e.g. Jan 2024)"
                            value={extraUploadExp.from}
                            onChange={e => setExtraUploadExp(s => ({ ...s, from: e.target.value }))}
                            className="scratch-input flex-1"
                          />
                          <input
                            type="text"
                            placeholder="To (e.g. Present)"
                            value={extraUploadExp.to}
                            onChange={e => setExtraUploadExp(s => ({ ...s, to: e.target.value }))}
                            className="scratch-input flex-1"
                          />
                        </div>
                        <textarea
                          placeholder={"Responsibilities & achievements (bullet points recommended)\n• Led a team of 5 engineers...\n• Increased revenue by 30%..."}
                          value={extraUploadExp.responsibilities}
                          onChange={e => setExtraUploadExp(s => ({ ...s, responsibilities: e.target.value }))}
                          className="scratch-textarea min-h-[90px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {mode === "linkedin" && (
                  <div className="space-y-4">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-primary/90 flex items-start gap-3">
                      <div className="mt-0.5"><ExternalLink className="w-4 h-4" /></div>
                      <div>
                        <strong>How to get this:</strong> Go to your LinkedIn Profile &rarr; Click "More" &rarr; "Save to PDF".
                      </div>
                    </div>
                    <Dropzone 
                      accept={{ "application/pdf": [".pdf"] }}
                      selectedFile={linkedinFile}
                      onFileSelect={setLinkedinFile}
                      label="Drop LinkedIn PDF"
                      sublabel="Exported profile PDF"
                    />

                    {/* Structured Additional Experience */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
                        Additional / Recent Experience
                      </label>
                      <p className="text-xs text-muted-foreground">Have a new job not on your LinkedIn? Add it here — it will appear first.</p>
                      <div className="p-3 bg-surface border border-border rounded-xl space-y-2">
                        <input
                          type="text"
                          placeholder="Company name"
                          value={extraLinkedinExp.company}
                          onChange={e => setExtraLinkedinExp(s => ({ ...s, company: e.target.value }))}
                          className="scratch-input"
                        />
                        <input
                          type="text"
                          placeholder="Your role / position"
                          value={extraLinkedinExp.role}
                          onChange={e => setExtraLinkedinExp(s => ({ ...s, role: e.target.value }))}
                          className="scratch-input"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="From (e.g. Jan 2024)"
                            value={extraLinkedinExp.from}
                            onChange={e => setExtraLinkedinExp(s => ({ ...s, from: e.target.value }))}
                            className="scratch-input flex-1"
                          />
                          <input
                            type="text"
                            placeholder="To (e.g. Present)"
                            value={extraLinkedinExp.to}
                            onChange={e => setExtraLinkedinExp(s => ({ ...s, to: e.target.value }))}
                            className="scratch-input flex-1"
                          />
                        </div>
                        <textarea
                          placeholder={"Responsibilities & achievements (bullet points recommended)\n• Led a team of 5 engineers...\n• Increased revenue by 30%..."}
                          value={extraLinkedinExp.responsibilities}
                          onChange={e => setExtraLinkedinExp(s => ({ ...s, responsibilities: e.target.value }))}
                          className="scratch-textarea min-h-[90px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {mode === "scratch" && (
                  <div className="space-y-6">
                    {/* Personal Info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary font-medium text-sm">
                        <LayoutTemplate className="w-4 h-4" /> Personal Details
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Full Name *" value={scratchData.name} onChange={e => setScratchData(s => ({...s, name: e.target.value}))} className="col-span-2 scratch-input" />
                        <input type="text" placeholder="City, Country" value={scratchData.location} onChange={e => setScratchData(s => ({...s, location: e.target.value}))} className="scratch-input" />
                        <input type="email" placeholder="Email" value={scratchData.email} onChange={e => setScratchData(s => ({...s, email: e.target.value}))} className="scratch-input" />
                        <input type="tel" placeholder="Phone" value={scratchData.phone} onChange={e => setScratchData(s => ({...s, phone: e.target.value}))} className="scratch-input" />
                        <input type="text" placeholder="LinkedIn URL" value={scratchData.linkedin} onChange={e => setScratchData(s => ({...s, linkedin: e.target.value}))} className="scratch-input" />
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Skills Brain-dump</label>
                      <textarea value={scratchData.skills} onChange={e => setScratchData(s => ({...s, skills: e.target.value}))} placeholder="Python, SQL, Management, Agile..." className="scratch-textarea" />
                    </div>

                    {/* Experience */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-medium text-sm">
                          <Briefcase className="w-4 h-4" /> Work Experience
                        </div>
                        <button onClick={() => setScratchData(s => ({...s, experiences: [...s.experiences, {id: uuidv4(), title:"", company:"", duration:"", resp:""}]}))} className="text-xs text-primary hover:text-primary-hover flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                      <div className="space-y-3">
                        {scratchData.experiences.map((exp, idx) => (
                          <div key={exp.id} className="p-3 bg-surface border border-border rounded-xl relative group">
                            {idx > 0 && (
                              <button onClick={() => setScratchData(s => ({...s, experiences: s.experiences.filter(e => e.id !== exp.id)}))} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            <div className="grid grid-cols-2 gap-2 mb-2 pr-6">
                              <input type="text" placeholder="Title" value={exp.title} onChange={e => { const n = [...scratchData.experiences]; n[idx].title = e.target.value; setScratchData(s => ({...s, experiences: n}))}} className="scratch-input py-1.5 text-xs" />
                              <input type="text" placeholder="Company" value={exp.company} onChange={e => { const n = [...scratchData.experiences]; n[idx].company = e.target.value; setScratchData(s => ({...s, experiences: n}))}} className="scratch-input py-1.5 text-xs" />
                              <input type="text" placeholder="Duration (e.g. 2020-2023)" value={exp.duration} onChange={e => { const n = [...scratchData.experiences]; n[idx].duration = e.target.value; setScratchData(s => ({...s, experiences: n}))}} className="col-span-2 scratch-input py-1.5 text-xs" />
                            </div>
                            <textarea placeholder="Responsibilities (bullet points or paragraph)" value={exp.resp} onChange={e => { const n = [...scratchData.experiences]; n[idx].resp = e.target.value; setScratchData(s => ({...s, experiences: n}))}} className="scratch-textarea text-xs min-h-[60px]" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Education */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-medium text-sm">
                          <GraduationCap className="w-4 h-4" /> Education
                        </div>
                        <button onClick={() => setScratchData(s => ({...s, education: [...s.education, {id: uuidv4(), degree:"", institution:"", year:""}]}))} className="text-xs text-primary hover:text-primary-hover flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {scratchData.education.map((edu, idx) => (
                          <div key={edu.id} className="p-2 bg-surface border border-border rounded-lg flex items-center gap-2">
                            <input type="text" placeholder="Degree" value={edu.degree} onChange={e => { const n = [...scratchData.education]; n[idx].degree = e.target.value; setScratchData(s => ({...s, education: n}))}} className="scratch-input py-1 text-xs flex-1" />
                            <input type="text" placeholder="Uni" value={edu.institution} onChange={e => { const n = [...scratchData.education]; n[idx].institution = e.target.value; setScratchData(s => ({...s, education: n}))}} className="scratch-input py-1 text-xs flex-1" />
                            <input type="text" placeholder="Year" value={edu.year} onChange={e => { const n = [...scratchData.education]; n[idx].year = e.target.value; setScratchData(s => ({...s, education: n}))}} className="scratch-input py-1 text-xs w-20" />
                            {idx > 0 && <button onClick={() => setScratchData(s => ({...s, education: s.education.filter(e => e.id !== edu.id)}))} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Certifications & Extra Notes</label>
                      <textarea value={extraScratchNotes} onChange={e => setExtraScratchNotes(e.target.value)} placeholder="AWS Certified, Published author..." className="scratch-textarea" />
                    </div>
                  </div>
                )}
              </motion.section>
            </AnimatePresence>

            <div className="w-full h-px bg-border my-6"></div>

            {/* 2. Job Descriptions */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Target Jobs (up to 3)</label>
                {jds.length < 3 && (
                  <button 
                    onClick={() => setJds([...jds, { id: uuidv4(), title: "", company: "", text: "" }])}
                    className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Role
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                <AnimatePresence>
                  {jds.map((jd, index) => (
                    <motion.div 
                      key={jd.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-background border border-border rounded-xl p-4 relative group"
                    >
                      <div className="absolute -left-3 top-4 w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shadow-glow">
                        {index + 1}
                      </div>
                      
                      {jds.length > 1 && (
                        <button 
                          onClick={() => setJds(jds.filter(j => j.id !== jd.id))}
                          className="absolute top-4 right-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <div className="ml-2 space-y-3">
                        <div className="flex gap-3">
                          <input 
                            type="text" 
                            placeholder="Job Title" 
                            value={jd.title}
                            onChange={(e) => {
                              const newJds = [...jds];
                              newJds[index].title = e.target.value;
                              setJds(newJds);
                            }}
                            className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                          />
                          <input 
                            type="text" 
                            placeholder="Company" 
                            value={jd.company}
                            onChange={(e) => {
                              const newJds = [...jds];
                              newJds[index].company = e.target.value;
                              setJds(newJds);
                            }}
                            className="w-1/3 bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                          />
                        </div>
                        <textarea 
                          placeholder="Paste the full job description here..." 
                          value={jd.text}
                          onChange={(e) => {
                            const newJds = [...jds];
                            newJds[index].text = e.target.value;
                            setJds(newJds);
                          }}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-3 text-sm min-h-[120px] focus:border-primary outline-none resize-y"
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>

            <div className="w-full h-px bg-border my-6"></div>

            {/* 3. Tone Selector */}
            <section className="space-y-3">
              <label className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Outreach Tone</label>
              <div className="flex gap-2">
                {(["formal", "warm", "concise"] as Tone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-medium transition-all capitalize",
                      tone === t 
                        ? "bg-primary/10 border-primary text-primary shadow-glow" 
                        : "bg-surface border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>

          </div>

          {/* Action Footer */}
          <div className="p-5 border-t border-border bg-surface/50 backdrop-blur-sm space-y-3">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm leading-tight">
                {errorMsg}
              </div>
            )}
            <button 
              onClick={handleGenerate}
              disabled={generateMut.isPending}
              className={cn(
                "w-full py-4 rounded-xl font-display font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 relative overflow-hidden",
                generateMut.isPending 
                  ? "bg-surface border border-primary/50 text-primary cursor-wait" 
                  : "bg-gradient-to-r from-primary to-[#c77a10] text-primary-foreground hover:shadow-[0_0_25px_rgba(240,160,32,0.4)] hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              {generateMut.isPending ? (
                <>
                  <div className="absolute inset-0 bg-primary/10 animate-pulse"></div>
                  Generating Materials...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Package
                </>
              )}
            </button>
          </div>
        </div>

        {/* === RIGHT PANEL (OUTPUTS) === */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
          
          {generateMut.isPending ? (
             <LoadingState />
          ) : !result && activeFeatureTab !== 'history' ? (
             <EmptyState />
          ) : activeFeatureTab === 'history' ? (
            <div className="p-8 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-semibold text-foreground flex items-center gap-2">
                  <History className="w-6 h-6 text-primary" /> Generation History
                </h2>
                {history.length > 0 && (
                  <button onClick={() => { if(confirm("Clear all history?")) useHistory().clearHistory(); window.location.reload(); }} className="text-sm text-muted-foreground hover:text-destructive">
                    Clear All
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">No history yet.</p>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="bg-surface border border-border p-5 rounded-xl hover:border-primary/50 transition-colors group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-sm text-muted-foreground">
                          {new Date(item.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => loadHistoryItem(item)} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1">
                            <Eye className="w-4 h-4" /> View
                          </button>
                          <button onClick={() => deleteHistory(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {item.jds.map((jd, i) => (
                          <div key={i} className="flex items-center gap-2 text-foreground font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                            {jd.title || 'Untitled Role'} <span className="text-muted-foreground font-normal">at</span> {jd.company || 'Unknown Company'}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : result ? (
            <>
              {/* JD Tabs Header */}
              <div className="flex-shrink-0 bg-surface/50 border-b border-border pt-3 px-6 flex gap-2 overflow-x-auto hide-scrollbar">
                {result.results.map((jobRes, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveJdTab(idx)}
                    className={cn(
                      "px-5 py-3 text-sm font-medium rounded-t-xl border-x border-t transition-all truncate max-w-[200px]",
                      activeJdTab === idx 
                        ? "bg-background border-border text-primary shadow-[0_-4px_10px_rgba(0,0,0,0.2)] z-10" 
                        : "bg-surface/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-surface"
                    )}
                  >
                    {jobRes.company || `Job ${idx + 1}`}
                  </button>
                ))}
              </div>

              {/* Feature Tabs */}
              <div className="flex-shrink-0 border-b border-border px-6 py-3 flex gap-2 overflow-x-auto hide-scrollbar items-center justify-between">
                <div className="flex gap-2">
                  {[
                    { id: 'resume', label: 'Resume', icon: Eye },
                    { id: 'ats', label: 'ATS Analysis', icon: Sparkles },
                    { id: 'cover', label: 'Cover Letter', icon: FileText },
                    { id: 'email', label: 'Outreach', icon: Mail },
                    { id: 'linkedin', label: 'LinkedIn', icon: MessageSquare },
                    { id: 'refine', label: 'Refine AI', icon: Bot }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFeatureTab(tab.id)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                        activeFeatureTab === tab.id
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-surface hover:text-foreground"
                      )}
                    >
                      <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                  ))}
                </div>
                
                <button 
                  onClick={() => setActiveFeatureTab('history')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                    activeFeatureTab === 'history' ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <History className="w-4 h-4" /> History
                </button>
              </div>

              {/* Output Content Area */}
              <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeJdTab}-${activeFeatureTab}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 overflow-y-auto p-6 custom-scrollbar"
                  >
                    
                    {/* --- RESUME --- */}
                    {activeFeatureTab === 'resume' && (
                      <div className="h-full flex flex-col gap-0" style={{ minHeight: 0 }}>
                        <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0 flex-wrap">
                          <div className="flex items-center bg-surface border border-border rounded-xl p-1 gap-1">
                            <button
                              onClick={() => setResumeViewMode("preview")}
                              className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all",
                                resumeViewMode === "preview"
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <Eye className="w-4 h-4" /> Preview
                            </button>
                            <button
                              onClick={() => setResumeViewMode("edit")}
                              className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all",
                                resumeViewMode === "edit"
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <FileCode2 className="w-4 h-4" /> Edit
                            </button>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <div ref={downloadMenuRef} className="relative flex">
                              <button
                                onClick={() => {
                                  const latex = editableLatex[activeJdTab] || result.results[activeJdTab].latex;
                                  const jobTitle = result.results[activeJdTab].jobTitle || "resume";
                                  const company = result.results[activeJdTab].company || "";
                                  const slug = `${jobTitle}${company ? `-${company}` : ""}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                                  downloadPdf(latex, `${slug}.pdf`);
                                  setShowDownloadMenu(false);
                                }}
                                disabled={downloadingPdf || downloadingDocx}
                                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-l-lg text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md border-r border-primary-foreground/20"
                              >
                                {downloadingPdf
                                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Compiling…</>
                                  : <><Download className="w-4 h-4" /> Download PDF</>
                                }
                              </button>
                              <button
                                onClick={() => setShowDownloadMenu(v => !v)}
                                disabled={downloadingPdf || downloadingDocx}
                                className="px-2 py-2 bg-primary text-primary-foreground hover:bg-primary/80 rounded-r-lg text-sm font-semibold flex items-center transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                                aria-label="More download options"
                              >
                                {downloadingDocx
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <ChevronDown className="w-4 h-4" />
                                }
                              </button>
                              {showDownloadMenu && (
                                <div className="absolute right-0 top-full mt-1.5 z-50 bg-surface border border-border rounded-xl shadow-xl overflow-hidden min-w-[180px]">
                                  <button
                                    onClick={() => {
                                      const latex = editableLatex[activeJdTab] || result.results[activeJdTab].latex;
                                      const jobTitle = result.results[activeJdTab].jobTitle || "resume";
                                      const company = result.results[activeJdTab].company || "";
                                      const slug = `${jobTitle}${company ? `-${company}` : ""}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                                      downloadPdf(latex, `${slug}.pdf`);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 hover:bg-primary/10 text-foreground transition-colors"
                                  >
                                    <span className="text-base">📄</span> Download as PDF
                                  </button>
                                  <div className="h-px bg-border mx-3" />
                                  <button
                                    onClick={() => {
                                      const latex = editableLatex[activeJdTab] || result.results[activeJdTab].latex;
                                      const jobTitle = result.results[activeJdTab].jobTitle || "resume";
                                      const company = result.results[activeJdTab].company || "";
                                      const slug = `${jobTitle}${company ? `-${company}` : ""}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                                      downloadDocx(latex, `${slug}.docx`);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 hover:bg-primary/10 text-foreground transition-colors"
                                  >
                                    <span className="text-base">📝</span> Download as Word
                                  </button>
                                </div>
                              )}
                            </div>
                            <CopyButton text={editableLatex[activeJdTab] || result.results[activeJdTab].latex} label="Copy LaTeX" />
                          </div>
                        </div>

                        <div className="flex-1 overflow-hidden rounded-xl border border-border" style={{ minHeight: 0 }}>
                          {resumeViewMode === "preview" ? (
                            previewLoading[activeJdTab] ? (
                              <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#525659]">
                                <Loader2 className="w-8 h-8 animate-spin text-white/60" />
                                <p className="text-sm text-white/50">Compiling preview…</p>
                              </div>
                            ) : previewBlobs[activeJdTab] ? (
                              <PdfPreview blob={previewBlobs[activeJdTab]} />
                            ) : (
                              <div className="h-full flex flex-col items-center justify-center gap-3 bg-surface/30">
                                <FileCode2 className="w-10 h-10 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">Preview unavailable — switch to Edit to view LaTeX</p>
                              </div>
                            )
                          ) : (
                            <ResumeEditor
                              latex={editableLatex[activeJdTab] ?? result.results[activeJdTab].latex ?? ""}
                              saving={previewLoading[activeJdTab]}
                              onSave={async (updatedLatex: string) => {
                                setEditableLatex(prev => ({ ...prev, [activeJdTab]: updatedLatex }));
                                setPreviewLoading(prev => ({ ...prev, [activeJdTab]: true }));
                                const blob = await compileLatexToBlob(updatedLatex);
                                if (blob) setPreviewBlobs(prev => ({ ...prev, [activeJdTab]: blob }));
                                setPreviewLoading(prev => ({ ...prev, [activeJdTab]: false }));
                                setResumeViewMode("preview");
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* --- ATS SCORE --- */}
                    {activeFeatureTab === 'ats' && (
                      <div className="max-w-4xl mx-auto space-y-6">

                        {/* Keyword Analysis */}
                        {(result.results[activeJdTab].matched_keywords?.length > 0 || result.results[activeJdTab].missing_keywords?.length > 0) && (
                          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-5">
                            <h3 className="text-lg font-display font-semibold text-foreground">Keyword Analysis</h3>

                            {result.results[activeJdTab].matched_keywords?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-success mb-3">
                                  Found in your resume
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {result.results[activeJdTab].matched_keywords.map((kw) => (
                                    <span
                                      key={kw}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20"
                                    >
                                      <Check className="w-3 h-3" />
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {result.results[activeJdTab].missing_keywords?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-destructive mb-3">
                                  Missing from your resume
                                </p>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {result.results[activeJdTab].missing_keywords.map((kw) => (
                                    <span
                                      key={kw}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20"
                                    >
                                      <X className="w-3 h-3" />
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                  <p className="text-xs text-muted-foreground">
                                    These keywords appear in the job description but not in your resume.
                                  </p>
                                  <button
                                    onClick={() => handleFixWithAI(result.results[activeJdTab].missing_keywords)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex-shrink-0"
                                  >
                                    Fix with AI
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <AtsCard title="Original Resume" data={result.results[activeJdTab].atsOriginal} type="neutral" />
                          <AtsCard title="Tailored Version" data={result.results[activeJdTab].atsTailored} type="success" />
                        </div>
                        <div className="bg-surface border border-border rounded-xl p-6 flex items-center justify-between shadow-lg">
                          <div>
                            <h3 className="text-lg font-display font-semibold text-foreground">Optimization Result</h3>
                            <p className="text-muted-foreground text-sm mt-1">Your resume was rewritten to hit target keywords and use the XYZ impact formula.</p>
                          </div>
                          <div className="text-right">
                            <div className="text-4xl font-mono font-bold text-primary">
                              +{Math.max(0, result.results[activeJdTab].atsTailored.score - result.results[activeJdTab].atsOriginal.score)}
                            </div>
                            <div className="text-xs font-bold uppercase tracking-wider text-primary/70">Point Increase</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* --- COVER LETTER --- */}
                    {activeFeatureTab === 'cover' && (
                      <div className="max-w-3xl mx-auto h-full flex flex-col">
                        <div className="flex justify-end mb-4 flex-shrink-0">
                          <CopyButton text={result.results[activeJdTab].coverLetter} />
                        </div>
                        <div className="flex-1 bg-surface border border-border rounded-xl p-8 overflow-auto shadow-sm">
                          <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed text-[15px]">
                            {result.results[activeJdTab].coverLetter}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* --- EMAIL --- */}
                    {activeFeatureTab === 'email' && (
                      <div className="max-w-3xl mx-auto h-full flex flex-col">
                        <div className="flex justify-end mb-4 flex-shrink-0">
                          <CopyButton text={result.results[activeJdTab].email} />
                        </div>
                        <div className="bg-surface border border-border rounded-xl p-8 shadow-sm">
                          <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed text-[15px]">
                            {result.results[activeJdTab].email}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* --- LINKEDIN --- */}
                    {activeFeatureTab === 'linkedin' && (
                      <div className="max-w-3xl mx-auto space-y-6">
                        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-[#0a66c2]/10 border-b border-border px-6 py-3 flex justify-between items-center">
                            <h3 className="font-semibold text-[#0a66c2] flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" /> Optimized Headline
                            </h3>
                            <CopyButton text={result.linkedin.headline} minimal />
                          </div>
                          <div className="p-6">
                            <p className="text-lg font-medium text-foreground leading-snug">{result.linkedin.headline}</p>
                          </div>
                        </div>
                        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-[#0a66c2]/10 border-b border-border px-6 py-3 flex justify-between items-center">
                            <h3 className="font-semibold text-[#0a66c2] flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" /> About Section
                            </h3>
                            <CopyButton text={result.linkedin.about} minimal />
                          </div>
                          <div className="p-6">
                            <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed text-[15px]">{result.linkedin.about}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* --- REFINE AI --- */}
                    {activeFeatureTab === 'refine' && (
                      <div className="max-w-3xl mx-auto h-full flex flex-col" style={{ minHeight: 400 }}>
                        <div className="flex-1 overflow-y-auto space-y-4 pb-4 custom-scrollbar">
                          {(refineMessages[activeJdTab] || []).map((msg, i) => {
                            const msgs = refineMessages[activeJdTab] || [];
                            const noUserMsgsYet = !msgs.some(m => m.role === "user");
                            return (
                              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                                {msg.role === "assistant" && (
                                  <div className="w-8 h-8 rounded-full bg-primary/15 flex-shrink-0 flex items-center justify-center mt-1">
                                    <Bot className="w-4 h-4 text-primary" />
                                  </div>
                                )}
                                <div className={cn(
                                  "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                                  msg.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                    : "bg-surface border border-border text-foreground rounded-tl-sm"
                                )}>
                                  {msg.content}
                                  {/* Quick-action chips: only below the greeting (first msg) when no user msg sent yet */}
                                  {msg.role === "assistant" && i === 0 && noUserMsgsYet && (
                                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/50">
                                      {REFINE_QUICK_CHIPS.map(chip => (
                                        <button
                                          key={chip}
                                          onClick={() => sendRefineMessage(chip)}
                                          disabled={!!refineLoading[activeJdTab]}
                                          className="px-3 py-1.5 bg-background border border-border rounded-full text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          {chip}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {refineLoading[activeJdTab] && (
                            <div className="flex gap-3 justify-start">
                              <div className="w-8 h-8 rounded-full bg-primary/15 flex-shrink-0 flex items-center justify-center mt-1">
                                <Bot className="w-4 h-4 text-primary" />
                              </div>
                              <div className="bg-surface border border-border px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">Refining your resume...</span>
                              </div>
                            </div>
                          )}
                          <div ref={refineBottomRef} />
                        </div>
                        <div className="flex-shrink-0 flex gap-2 pt-4 border-t border-border">
                          <input
                            type="text"
                            value={refineInput}
                            onChange={e => setRefineInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                            placeholder="Ask me to improve your resume... e.g. Add more Python keywords, shorten the summary, fix grammar"
                            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                            disabled={refineLoading[activeJdTab]}
                          />
                          <button
                            onClick={handleRefine}
                            disabled={!refineInput.trim() || refineLoading[activeJdTab]}
                            className="px-4 py-3 bg-primary rounded-xl text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium text-sm"
                          >
                            {refineLoading[activeJdTab] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          ) : null}
          
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .scratch-input {
          @apply w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all;
        }
        .scratch-textarea {
          @apply w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-y min-h-[80px];
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}

// --- Subcomponents ---

function CopyButton({ text, label = "Copy", minimal = false }: { text: string, label?: string, minimal?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  if (minimal) {
    return (
      <button onClick={handleCopy} className="p-1.5 text-muted-foreground hover:text-primary transition-colors">
        {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
      </button>
    );
  }
  return (
    <button onClick={handleCopy} className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors text-foreground">
      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function AtsCard({ title, data, type }: { title: string, data: AtsScore, type: 'neutral' | 'success' }) {
  const score = data?.score || 0;
  let colorClass = "text-warning";
  let barClass = "bg-warning";
  if (score >= 80) { colorClass = "text-success"; barClass = "bg-success"; }
  else if (score <= 50) { colorClass = "text-destructive"; barClass = "bg-destructive"; }
  if (type === 'neutral') { colorClass = "text-foreground"; barClass = "bg-muted-foreground"; }
  return (
    <div className="bg-surface border border-border rounded-xl p-6 flex flex-col">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">{title}</h4>
      <div className="flex items-end gap-2 mb-4">
        <span className={cn("text-6xl font-mono font-bold leading-none", colorClass)}>{score}</span>
        <span className="text-xl text-muted-foreground font-mono mb-1">/100</span>
      </div>
      <div className="w-full h-2 bg-background rounded-full overflow-hidden mb-6">
        <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, ease: "easeOut" }} className={cn("h-full rounded-full", barClass)} />
      </div>
      <div className="flex-1 bg-background rounded-lg p-4 text-sm text-muted-foreground leading-relaxed">
        {data?.breakdown || "No breakdown provided."}
      </div>
    </div>
  );
}

function FileText({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
}
function Sparkles({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>;
}
