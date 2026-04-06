import { useState, useCallback, useEffect, useRef, type ComponentType, type RefObject } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Trash2, Plus, X,
  ChevronRight, Copy, Check, FileCode2,
  Briefcase, GraduationCap, LayoutTemplate,
  History, Eye, ExternalLink, Mail, MessageSquare,
  Download, Loader2, ChevronDown, Upload,
  RefreshCw, BookOpen
} from "lucide-react";
import { cn, copyToClipboard, generateOverleafUrl } from "@/lib/utils";
import type { Mode, Tone, JD, ScratchData, GenerateResponse, AtsScore } from "@/types";
import { useGenerateResume } from "@/hooks/use-generate";
import { useHistory } from "@/hooks/use-history";

import { Dropzone } from "@/components/inputs/Dropzone";
import { PdfPreview } from "@/components/ui/PdfPreview";
import { ResumeEditor } from "@/components/ui/ResumeEditor";

// -- RezAI Agent quick-action chips --
const AGENT_CHIPS_ROW1 = ["Add missing keywords", "Strengthen summary", "Fix weak verbs", "Shorten to 1 page"] as const;
const AGENT_CHIPS_ROW2 = ["What salary to ask?", "Am I a good fit?", "Interview questions", "Write follow-up email"] as const;

// Generating steps
const GENERATE_STEPS = [
  "Analysing your resume",
  "Matching keywords to JD",
  "Generating tailored resume",
  "Creating cover letter & outreach",
];

// -- Initial States --
const initialScratchData: ScratchData = {
  name: "", email: "", phone: "", location: "", linkedin: "", skills: "",
  experiences: [{ id: uuidv4(), title: "", company: "", duration: "", resp: "" }],
  education: [{ id: uuidv4(), degree: "", institution: "", month: "", year: "" }],
  certifications: ""
};

interface AdditionalExp {
  company: string; role: string; from: string; to: string; responsibilities: string;
}
const initialAdditionalExp: AdditionalExp = { company: "", role: "", from: "", to: "", responsibilities: "" };

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
  const [extraUploadExp, setExtraUploadExp] = useState<AdditionalExp>(initialAdditionalExp);
  const [extraLinkedinExp, setExtraLinkedinExp] = useState<AdditionalExp>(initialAdditionalExp);
  const [scratchData, setScratchData] = useState<ScratchData>(initialScratchData);
  const [extraScratchNotes, setExtraScratchNotes] = useState("");
  const [jds, setJds] = useState<JD[]>([{ id: uuidv4(), title: "", company: "", text: "" }]);
  const [multiJdOpen, setMultiJdOpen] = useState(false);
  const [activeInputJdIndex, setActiveInputJdIndex] = useState(0);
  const [showUploadExtra, setShowUploadExtra] = useState(false);
  const [showLinkedinExtra, setShowLinkedinExtra] = useState(false);

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

  // -- UI State --
  const [showChangingJd, setShowChangingJd] = useState(false);
  const [showSidebarExtra, setShowSidebarExtra] = useState(false);
  const [jobTrackerStage, setJobTrackerStage] = useState<string | null>(null);
  const [generateStep, setGenerateStep] = useState(-1);
  const [showHistoryOverlay, setShowHistoryOverlay] = useState(false);

  // -- RezAI Agent Chat State --
  interface AgentMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    type?: "edit" | "answer";
    action?: string | null;
    timestamp: Date;
  }
  const [agentMessages, setAgentMessages] = useState<Record<number, AgentMessage[]>>({});
  const [agentInput, setAgentInput] = useState("");
  const [agentLoading, setAgentLoading] = useState<Record<number, boolean>>({});
  const [agentGreeted, setAgentGreeted] = useState<Record<number, boolean>>({});
  const [agentOpen, setAgentOpen] = useState(false);
  const agentBottomRef = useRef<HTMLDivElement>(null);
  const agentBubbleBottomRef = useRef<HTMLDivElement>(null);

  // -- Hooks --
  const generateMut = useGenerateResume();
  const { history, saveHistory, deleteHistory, clearHistory } = useHistory();

  // -- Generate Step Progress --
  useEffect(() => {
    if (!generateMut.isPending) { setGenerateStep(-1); return; }
    setGenerateStep(0);
    const timers = [
      setTimeout(() => setGenerateStep(1), 9000),
      setTimeout(() => setGenerateStep(2), 18000),
      setTimeout(() => setGenerateStep(3), 27000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [generateMut.isPending]);

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
      setShowHistoryOverlay(false);

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

  const handleStartOver = () => {
    setResult(null);
    setActiveFeatureTab("resume");
    setAgentMessages({});
    setAgentGreeted({});
    setShowChangingJd(false);
    setShowSidebarExtra(false);
    setJobTrackerStage(null);
  };

  const loadHistoryItem = (item: any) => {
    setResult(item.response);
    setJds(item.jds);
    setActiveJdTab(0);
    setActiveFeatureTab("resume");
    setResumeViewMode("preview");
    setShowHistoryOverlay(false);
  };

  // Auto-scroll agent chat
  useEffect(() => { agentBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [agentMessages, agentLoading]);
  useEffect(() => { agentBubbleBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [agentMessages, agentLoading, agentOpen]);

  // Greeting
  useEffect(() => {
    const agentVisible = activeFeatureTab === "agent" || agentOpen;
    if (!agentVisible || !result || agentGreeted[activeJdTab]) return;
    const r = result.results[activeJdTab];
    if (!r) return;
    const greeting =
      `Hi! I'm RezAI Agent — your personal career coach.\n\n` +
      `I've loaded your resume for ${r.jobTitle} at ${r.company}.\n` +
      `ATS score: ${r.atsOriginal.score}/100 → ${r.atsTailored.score}/100 ✨\n\n` +
      `I can edit your resume, check your job fit, help with interview prep, salary negotiation, and more. What would you like to do?`;
    setAgentMessages(prev => ({
      ...prev,
      [activeJdTab]: [{ id: uuidv4(), role: "assistant" as const, content: greeting, type: "answer", timestamp: new Date() }]
    }));
    setAgentGreeted(prev => ({ ...prev, [activeJdTab]: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFeatureTab, agentOpen, activeJdTab]);

  // Compile latex → Blob
  const compileLatexToBlob = useCallback(async (latex: string): Promise<Blob | null> => {
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${baseUrl}api/compile/pdf`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex }),
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch { return null; }
  }, []);

  // -- Agent send function --
  const sendAgentMessage = async (message: string, tab = activeJdTab) => {
    if (!message.trim() || agentLoading[tab]) return;
    const latex = editableLatex[tab] || result?.results[tab]?.latex || "";
    const r = result?.results[tab];
    const jd = jds[tab];
    const hist = (agentMessages[tab] || []).map(m => ({ role: m.role, content: m.content }));
    const userMsg: AgentMessage = { id: uuidv4(), role: "user", content: message, timestamp: new Date() };
    setAgentMessages(prev => ({ ...prev, [tab]: [...(prev[tab] || []), userMsg] }));
    setAgentLoading(prev => ({ ...prev, [tab]: true }));
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${baseUrl}api/resume/agent`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latex, message, history: hist, jd,
          atsOriginal: r?.atsOriginal, atsTailored: r?.atsTailored,
          matchedKeywords: r?.matched_keywords || [],
          missingKeywords: r?.missing_keywords || [],
          currentTab: activeFeatureTab,
        }),
      });
      if (!res.ok) throw new Error("Agent request failed");
      const data = await res.json();
      if (data.type === "edit" && data.latex) {
        setEditableLatex(prev => ({ ...prev, [tab]: data.latex }));
        setPreviewLoading(prev => ({ ...prev, [tab]: true }));
        compileLatexToBlob(data.latex).then(blob => {
          if (blob) setPreviewBlobs(prev => ({ ...prev, [tab]: blob }));
          setPreviewLoading(prev => ({ ...prev, [tab]: false }));
        });
      }
      if (data.action) {
        if (data.action.startsWith("tab:")) setActiveFeatureTab(data.action.replace("tab:", ""));
        else if (data.action === "download:pdf") { const l = data.latex || editableLatex[tab] || r?.latex || ""; if (l) downloadPdf(l); }
        else if (data.action === "download:docx") { const l = data.latex || editableLatex[tab] || r?.latex || ""; if (l) downloadDocx(l); }
      }
      const agentMsg: AgentMessage = {
        id: uuidv4(), role: "assistant",
        content: data.message || "Done! What else can I help you with?",
        type: data.type, action: data.action || null, timestamp: new Date(),
      };
      setAgentMessages(prev => ({ ...prev, [tab]: [...(prev[tab] || []), agentMsg] }));
    } catch {
      setAgentMessages(prev => ({ ...prev, [tab]: [...(prev[tab] || []), { id: uuidv4(), role: "assistant", content: "Something went wrong. Please try again.", timestamp: new Date() }] }));
    } finally {
      setAgentLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  const handleAgentSend = async () => {
    const msg = agentInput.trim();
    if (!msg) return;
    setAgentInput("");
    await sendAgentMessage(msg);
  };

  const handleFixWithAgent = (missingKeywords: string[]) => {
    const instruction = `Please add these missing keywords naturally into my resume: ${missingKeywords.join(", ")}`;
    setAgentOpen(true);
    setActiveFeatureTab("agent");
    setTimeout(() => sendAgentMessage(instruction), 80);
  };

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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex }),
      });
      if (!res.ok) { const err = await res.json().catch(() => null); throw new Error(err?.error || `Compilation failed (${res.status})`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(e.message || "PDF download failed."); }
    finally { setDownloadingPdf(false); }
  };

  const downloadDocx = async (latex: string, filename = "resume.docx") => {
    if (!latex || downloadingDocx) return;
    setDownloadingDocx(true); setShowDownloadMenu(false);
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${baseUrl}api/compile/docx`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex }),
      });
      if (!res.ok) { const err = await res.json().catch(() => null); throw new Error(err?.error || `Conversion failed (${res.status})`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(e.message || "Word download failed."); }
    finally { setDownloadingDocx(false); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) setShowDownloadMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // -- Shared agent chat renderer --
  const renderAgentChat = (opts: { messages: AgentMessage[]; loading: boolean; bottomRef: RefObject<HTMLDivElement>; compact?: boolean; }) => {
    const { messages, loading, bottomRef, compact } = opts;
    const noUserMsgsYet = !messages.some(m => m.role === "user");
    return (
      <div className="flex-1 overflow-y-auto space-y-3 py-3 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center mt-0.5 border border-primary/30">
                <Zap className="w-3.5 h-3.5 text-primary fill-current" />
              </div>
            )}
            <div className={cn(
              "rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
              compact ? "max-w-[85%] px-3 py-2.5" : "max-w-[78%] px-4 py-3",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-[#0c1626] border border-[#1e304a] text-foreground/90 rounded-tl-sm"
            )}>
              {msg.type === "edit" && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 border border-success/25 text-success text-xs font-semibold mb-2">
                  <Check className="w-3 h-3" /> Resume updated
                </div>
              )}
              {msg.content}
              {msg.action && msg.action.startsWith("tab:") && (
                <button
                  onClick={() => setActiveFeatureTab(msg.action!.replace("tab:", ""))}
                  className="flex items-center gap-1 mt-2 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <ChevronRight className="w-3 h-3" /> View {msg.action.replace("tab:", "")} tab
                </button>
              )}
              {msg.role === "assistant" && i === 0 && noUserMsgsYet && (
                <div className="mt-3 pt-3 border-t border-[#1e304a]/60 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {AGENT_CHIPS_ROW1.map(chip => (
                      <button key={chip} onClick={() => sendAgentMessage(chip)} disabled={loading}
                        className="px-2.5 py-1 bg-background border border-border rounded-full text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-40">
                        {chip}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AGENT_CHIPS_ROW2.map(chip => (
                      <button key={chip} onClick={() => sendAgentMessage(chip)} disabled={loading}
                        className="px-2.5 py-1 bg-background border border-border rounded-full text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-40">
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center border border-primary/30">
              <Zap className="w-3.5 h-3.5 text-primary fill-current" />
            </div>
            <div className="bg-[#0c1626] border border-[#1e304a] px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
              {[0, 0.2, 0.4].map((delay, k) => (
                <span key={k} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${delay}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    );
  };

  // ─── The current extra exp for the active mode ───
  const currentExtra = mode === "linkedin" ? extraLinkedinExp : extraUploadExp;
  const setCurrentExtra = mode === "linkedin"
    ? (fn: (s: AdditionalExp) => AdditionalExp) => setExtraLinkedinExp(fn)
    : (fn: (s: AdditionalExp) => AdditionalExp) => setExtraUploadExp(fn);

  // ─── FEATURE TABS definition ───
  const featureTabs: { id: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: "resume", label: "Resume", icon: FileText as ComponentType<{ className?: string }> },
    { id: "ats", label: "ATS Analysis", icon: Sparkles as ComponentType<{ className?: string }> },
    { id: "cover", label: "Cover Letter", icon: BookOpen as ComponentType<{ className?: string }> },
    { id: "email", label: "Outreach", icon: Mail as ComponentType<{ className?: string }> },
    { id: "linkedin", label: "LinkedIn", icon: MessageSquare as ComponentType<{ className?: string }> },
    { id: "agent", label: "RezAI Agent", icon: Zap as ComponentType<{ className?: string }> },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#070c18] text-[#e2ddd4] overflow-hidden">

      {/* ── SLIM NAV (48px) ── */}
      <nav className="flex-shrink-0 h-12 px-5 flex items-center justify-between border-b border-[#1e304a] bg-[#0c1626]/90 backdrop-blur-sm z-30">
        {/* Logo */}
        <a href="/app" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-[#c77a10] flex items-center justify-center shadow-[0_0_12px_rgba(240,160,32,0.3)]">
            <Zap className="w-4 h-4 text-[#070c18] fill-current" />
          </div>
          <span className="font-bold text-sm tracking-wide text-foreground">RezAI</span>
        </a>

        {/* Right links */}
        <div className="flex items-center gap-5">
          <button className="text-xs text-[#4a6080] hover:text-foreground transition-colors flex items-center gap-1.5">
            <span>📋</span> Job Tracker
          </button>
          <button
            onClick={() => result ? setActiveFeatureTab("history") : setShowHistoryOverlay(v => !v)}
            className={cn("text-xs transition-colors flex items-center gap-1.5",
              (activeFeatureTab === "history" || showHistoryOverlay) ? "text-primary" : "text-[#4a6080] hover:text-foreground"
            )}
          >
            <History className="w-3.5 h-3.5" /> History
          </button>
          {result && (
            <div className="flex items-center gap-1.5 text-xs text-success font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              Package ready
            </div>
          )}
        </div>
      </nav>

      {/* ── MAIN ── */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">

          {/* ═══ BEFORE / GENERATING: CENTERED CARD ═══ */}
          {!result && (
            <motion.div
              key="pre-result"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute inset-0 overflow-y-auto custom-scrollbar"
            >
              {/* History overlay */}
              {showHistoryOverlay && (
                <div className="fixed inset-0 z-50 bg-[#070c18]/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowHistoryOverlay(false)}>
                  <div className="w-full max-w-lg bg-[#0c1626] border border-[#1e304a] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e304a]">
                      <h3 className="font-semibold text-foreground flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Generation History</h3>
                      <button onClick={() => setShowHistoryOverlay(false)} className="p-1.5 text-[#4a6080] hover:text-foreground rounded-lg hover:bg-white/5">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {history.length === 0 ? (
                        <p className="text-[#4a6080] text-sm text-center py-8">No history yet.</p>
                      ) : history.map(item => (
                        <div key={item.id} className="bg-[#070c18] border border-[#1e304a] rounded-xl p-4 hover:border-primary/40 transition-colors group">
                          <div className="flex justify-between items-start mb-2">
                            <div className="text-xs text-[#4a6080]">{new Date(item.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
                            <div className="flex gap-2">
                              <button onClick={() => loadHistoryItem(item)} className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary hover:text-[#070c18] transition-colors flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Load
                              </button>
                              <button onClick={() => deleteHistory(item.id)} className="p-1 text-[#4a6080] hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {item.jds.map((jd, i) => (
                            <div key={i} className="text-sm text-foreground/80 flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-primary/50" />
                              {jd.title || "Untitled"} <span className="text-[#4a6080]">at</span> {jd.company || "Unknown"}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    {history.length > 0 && (
                      <div className="px-6 py-3 border-t border-[#1e304a]">
                        <button onClick={() => { if (confirm("Clear all history?")) { clearHistory(); } }} className="text-xs text-[#4a6080] hover:text-destructive transition-colors">Clear all history</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="min-h-full flex items-center justify-center py-10 px-4">
                <div className="w-full max-w-[560px]">

                  {/* ─── GENERATING CARD ─── */}
                  {generateMut.isPending ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#0c1626] border border-[#1e304a] rounded-2xl overflow-hidden shadow-2xl"
                    >
                      {/* Amber progress bar */}
                      <div className="h-1 bg-[#1e304a] relative overflow-hidden">
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-[#c77a10]"
                          animate={{ width: `${((generateStep + 1) / 4) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <div className="p-8">
                        {/* Pulsing logo */}
                        <div className="flex justify-center mb-6">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-[#c77a10] flex items-center justify-center shadow-[0_0_40px_rgba(240,160,32,0.4)]">
                              <Zap className="w-8 h-8 text-[#070c18] fill-current" />
                            </div>
                            <span className="absolute inset-0 rounded-2xl bg-primary/30 animate-ping" style={{ animationDuration: "1.8s" }} />
                          </div>
                        </div>
                        <h2 className="text-center font-bold text-lg text-foreground mb-1">RezAI is crafting your package...</h2>
                        <p className="text-center text-sm text-[#4a6080] mb-8">This usually takes 30–45 seconds</p>
                        {/* Steps */}
                        <div className="space-y-3 max-w-xs mx-auto">
                          {GENERATE_STEPS.map((step, i) => (
                            <motion.div
                              key={step}
                              initial={{ opacity: 0.3 }}
                              animate={{ opacity: i <= generateStep ? 1 : 0.3 }}
                              className="flex items-center gap-3"
                            >
                              <div className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500",
                                i < generateStep ? "bg-success border border-success/30" :
                                i === generateStep ? "bg-primary border border-primary/30 shadow-[0_0_8px_rgba(240,160,32,0.5)]" :
                                "bg-[#0c1626] border border-[#1e304a]"
                              )}>
                                {i < generateStep ? (
                                  <Check className="w-3 h-3 text-[#070c18]" />
                                ) : i === generateStep ? (
                                  <Loader2 className="w-3 h-3 text-[#070c18] animate-spin" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#1e304a]" />
                                )}
                              </div>
                              <span className={cn("text-sm transition-colors", i <= generateStep ? "text-foreground" : "text-[#4a6080]")}>{step}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (

                    /* ─── INPUT CARD ─── */
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#0c1626] border border-[#1e304a] rounded-2xl shadow-2xl overflow-hidden"
                    >
                      {/* Card header */}
                      <div className="px-6 pt-6 pb-4 border-b border-[#1e304a]/60">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="w-4 h-4 text-primary fill-current" />
                          <span className="text-xs font-bold tracking-widest uppercase text-[#4a6080]">RezAI — AI Resume Builder</span>
                        </div>
                        <h1 className="text-xl font-bold text-foreground">Build your resume package</h1>
                      </div>

                      <div className="p-6 space-y-6">

                        {/* Mode selector */}
                        <div>
                          <label className="text-[10px] font-bold tracking-widest uppercase text-[#4a6080] mb-2 block">Resume Source</label>
                          <div className="flex bg-[#070c18] p-1 rounded-xl border border-[#1e304a] gap-1">
                            {([
                              { id: "upload", label: "Upload", emoji: "📄" },
                              { id: "linkedin", label: "LinkedIn", emoji: "💼" },
                              { id: "scratch", label: "Scratch", emoji: "✏️" },
                            ] as { id: Mode; label: string; emoji: string }[]).map(m => (
                              <button
                                key={m.id}
                                onClick={() => setMode(m.id)}
                                className={cn(
                                  "flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                                  mode === m.id
                                    ? "bg-primary text-[#070c18] shadow-sm"
                                    : "text-[#4a6080] hover:text-foreground hover:bg-[#0c1626]"
                                )}
                              >
                                <span>{m.emoji}</span> {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Mode content */}
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={mode}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18 }}
                          >
                            {/* UPLOAD */}
                            {mode === "upload" && (
                              <div className="space-y-4">
                                <Dropzone
                                  accept={{ "application/pdf": [".pdf"], "text/plain": [".txt"] }}
                                  selectedFile={resumeFile}
                                  onFileSelect={setResumeFile}
                                  label="Drop your resume here or click to upload"
                                  sublabel="PDF or TXT supported"
                                  icon={<Upload className="w-5 h-5 text-[#4a6080]" />}
                                />
                                {/* Collapsible extra exp */}
                                <button
                                  onClick={() => setShowUploadExtra(v => !v)}
                                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                                >
                                  <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", showUploadExtra && "rotate-90")} />
                                  Have a recent job to add?
                                </button>
                                <AnimatePresence>
                                  {showUploadExtra && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-3 bg-[#070c18] border border-[#1e304a] rounded-xl space-y-2">
                                        <input type="text" placeholder="Company name" value={extraUploadExp.company} onChange={e => setExtraUploadExp(s => ({ ...s, company: e.target.value }))} className="card-input" />
                                        <input type="text" placeholder="Your role / position" value={extraUploadExp.role} onChange={e => setExtraUploadExp(s => ({ ...s, role: e.target.value }))} className="card-input" />
                                        <div className="flex gap-2">
                                          <input type="text" placeholder="From (e.g. Jan 2024)" value={extraUploadExp.from} onChange={e => setExtraUploadExp(s => ({ ...s, from: e.target.value }))} className="card-input flex-1" />
                                          <input type="text" placeholder="To (e.g. Present)" value={extraUploadExp.to} onChange={e => setExtraUploadExp(s => ({ ...s, to: e.target.value }))} className="card-input flex-1" />
                                        </div>
                                        <textarea placeholder={"Key responsibilities & achievements\n• Led a team of 5...\n• Increased revenue by 30%..."} value={extraUploadExp.responsibilities} onChange={e => setExtraUploadExp(s => ({ ...s, responsibilities: e.target.value }))} className="card-textarea min-h-[80px]" />
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}

                            {/* LINKEDIN */}
                            {mode === "linkedin" && (
                              <div className="space-y-4">
                                <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-sm text-primary/80">
                                  <div className="font-semibold mb-2 flex items-center gap-2"><ExternalLink className="w-3.5 h-3.5" /> Export your LinkedIn as PDF</div>
                                  {[
                                    "Go to your LinkedIn profile page",
                                    'Click "More" → "Save to PDF"',
                                    "Upload the downloaded PDF below",
                                  ].map((step, i) => (
                                    <div key={i} className="flex items-start gap-2 mt-1.5">
                                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                      <span className="text-xs text-[#4a6080]">{step}</span>
                                    </div>
                                  ))}
                                </div>
                                <Dropzone
                                  accept={{ "application/pdf": [".pdf"] }}
                                  selectedFile={linkedinFile}
                                  onFileSelect={setLinkedinFile}
                                  label="Drop LinkedIn PDF here or click to upload"
                                  sublabel="Exported profile PDF"
                                />
                                <button
                                  onClick={() => setShowLinkedinExtra(v => !v)}
                                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                                >
                                  <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", showLinkedinExtra && "rotate-90")} />
                                  Have a recent job to add?
                                </button>
                                <AnimatePresence>
                                  {showLinkedinExtra && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                      <div className="p-3 bg-[#070c18] border border-[#1e304a] rounded-xl space-y-2">
                                        <input type="text" placeholder="Company name" value={extraLinkedinExp.company} onChange={e => setExtraLinkedinExp(s => ({ ...s, company: e.target.value }))} className="card-input" />
                                        <input type="text" placeholder="Your role / position" value={extraLinkedinExp.role} onChange={e => setExtraLinkedinExp(s => ({ ...s, role: e.target.value }))} className="card-input" />
                                        <div className="flex gap-2">
                                          <input type="text" placeholder="From" value={extraLinkedinExp.from} onChange={e => setExtraLinkedinExp(s => ({ ...s, from: e.target.value }))} className="card-input flex-1" />
                                          <input type="text" placeholder="To" value={extraLinkedinExp.to} onChange={e => setExtraLinkedinExp(s => ({ ...s, to: e.target.value }))} className="card-input flex-1" />
                                        </div>
                                        <textarea placeholder="Key responsibilities..." value={extraLinkedinExp.responsibilities} onChange={e => setExtraLinkedinExp(s => ({ ...s, responsibilities: e.target.value }))} className="card-textarea min-h-[80px]" />
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}

                            {/* SCRATCH */}
                            {mode === "scratch" && (
                              <div className="space-y-5">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1"><LayoutTemplate className="w-3.5 h-3.5" /> Personal Details</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Full Name *" value={scratchData.name} onChange={e => setScratchData(s => ({ ...s, name: e.target.value }))} className="col-span-2 card-input" />
                                    <input type="text" placeholder="City, Country" value={scratchData.location} onChange={e => setScratchData(s => ({ ...s, location: e.target.value }))} className="card-input" />
                                    <input type="email" placeholder="Email" value={scratchData.email} onChange={e => setScratchData(s => ({ ...s, email: e.target.value }))} className="card-input" />
                                    <input type="tel" placeholder="Phone" value={scratchData.phone} onChange={e => setScratchData(s => ({ ...s, phone: e.target.value }))} className="card-input" />
                                    <input type="text" placeholder="LinkedIn URL" value={scratchData.linkedin} onChange={e => setScratchData(s => ({ ...s, linkedin: e.target.value }))} className="card-input" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080] mb-1.5 block">Skills</label>
                                  <textarea value={scratchData.skills} onChange={e => setScratchData(s => ({ ...s, skills: e.target.value }))} placeholder="Python, SQL, Management, Agile..." className="card-textarea" />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Briefcase className="w-3.5 h-3.5" /> Work Experience</div>
                                    <button onClick={() => setScratchData(s => ({ ...s, experiences: [...s.experiences, { id: uuidv4(), title: "", company: "", duration: "", resp: "" }] }))} className="text-xs text-primary flex items-center gap-0.5 hover:text-primary/80">
                                      <Plus className="w-3 h-3" /> Add
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {scratchData.experiences.map((exp, idx) => (
                                      <div key={exp.id} className="p-3 bg-[#070c18] border border-[#1e304a] rounded-xl relative group">
                                        {idx > 0 && (
                                          <button onClick={() => setScratchData(s => ({ ...s, experiences: s.experiences.filter(e => e.id !== exp.id) }))} className="absolute top-2 right-2 p-1 text-[#4a6080] hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 mb-2 pr-5">
                                          <input type="text" placeholder="Title" value={exp.title} onChange={e => { const n = [...scratchData.experiences]; n[idx].title = e.target.value; setScratchData(s => ({ ...s, experiences: n })); }} className="card-input py-1.5 text-xs" />
                                          <input type="text" placeholder="Company" value={exp.company} onChange={e => { const n = [...scratchData.experiences]; n[idx].company = e.target.value; setScratchData(s => ({ ...s, experiences: n })); }} className="card-input py-1.5 text-xs" />
                                          <input type="text" placeholder="Duration (e.g. 2020–2023)" value={exp.duration} onChange={e => { const n = [...scratchData.experiences]; n[idx].duration = e.target.value; setScratchData(s => ({ ...s, experiences: n })); }} className="col-span-2 card-input py-1.5 text-xs" />
                                        </div>
                                        <textarea placeholder="Responsibilities (bullet points or paragraph)" value={exp.resp} onChange={e => { const n = [...scratchData.experiences]; n[idx].resp = e.target.value; setScratchData(s => ({ ...s, experiences: n })); }} className="card-textarea text-xs min-h-[60px]" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-primary"><GraduationCap className="w-3.5 h-3.5" /> Education</div>
                                    <button onClick={() => setScratchData(s => ({ ...s, education: [...s.education, { id: uuidv4(), degree: "", institution: "", month: "", year: "" }] }))} className="text-xs text-primary flex items-center gap-0.5 hover:text-primary/80">
                                      <Plus className="w-3 h-3" /> Add
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {scratchData.education.map((edu, idx) => (
                                      <div key={edu.id} className="flex items-center gap-2 flex-wrap">
                                        <input type="text" placeholder="Degree" value={edu.degree} onChange={e => { const n = [...scratchData.education]; n[idx].degree = e.target.value; setScratchData(s => ({ ...s, education: n })); }} className="card-input py-1.5 text-xs flex-1 min-w-[100px]" />
                                        <input type="text" placeholder="Institution" value={edu.institution} onChange={e => { const n = [...scratchData.education]; n[idx].institution = e.target.value; setScratchData(s => ({ ...s, education: n })); }} className="card-input py-1.5 text-xs flex-1 min-w-[100px]" />
                                        <input type="text" placeholder="Month (optional)" value={edu.month} onChange={e => { const n = [...scratchData.education]; n[idx].month = e.target.value; setScratchData(s => ({ ...s, education: n })); }} className="card-input py-1.5 text-xs w-28" />
                                        <input type="text" placeholder="Year" value={edu.year} onChange={e => { const n = [...scratchData.education]; n[idx].year = e.target.value; setScratchData(s => ({ ...s, education: n })); }} className="card-input py-1.5 text-xs w-16" />
                                        {idx > 0 && <button onClick={() => setScratchData(s => ({ ...s, education: s.education.filter(e => e.id !== edu.id) }))} className="p-1 text-[#4a6080] hover:text-destructive flex-shrink-0"><X className="w-3 h-3" /></button>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080] mb-1.5 block">Certifications & Notes</label>
                                  <textarea value={extraScratchNotes} onChange={e => setExtraScratchNotes(e.target.value)} placeholder="AWS Certified, Published author..." className="card-textarea" />
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>

                        {/* ── JD SECTION ── */}
                        <div className="pt-2 border-t border-[#1e304a]/60">
                          <label className="text-[10px] font-bold tracking-widest uppercase text-[#4a6080] mb-3 block">Job Description</label>

                          {/* Single JD mode */}
                          {!multiJdOpen ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <input
                                  type="text" placeholder="Job Title (optional)"
                                  value={jds[0]?.title || ""} onChange={e => { const n = [...jds]; n[0].title = e.target.value; setJds(n); }}
                                  className="card-input flex-1"
                                />
                                <input
                                  type="text" placeholder="Company name (optional)"
                                  value={jds[0]?.company || ""} onChange={e => { const n = [...jds]; n[0].company = e.target.value; setJds(n); }}
                                  className="card-input w-1/3"
                                />
                              </div>
                              <textarea
                                placeholder="Paste the full job description here..."
                                value={jds[0]?.text || ""} onChange={e => { const n = [...jds]; n[0].text = e.target.value; setJds(n); }}
                                className="card-textarea min-h-[120px]"
                              />
                              <button onClick={() => { setMultiJdOpen(true); if (jds.length < 2) setJds([...jds, { id: uuidv4(), title: "", company: "", text: "" }]); }}
                                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                                <ChevronRight className="w-3.5 h-3.5" /> Apply to multiple jobs at once
                              </button>
                            </div>
                          ) : (
                            /* Multi JD mode */
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="flex bg-[#070c18] p-1 rounded-lg border border-[#1e304a] gap-1 flex-1">
                                  {jds.map((jd, i) => (
                                    <button key={jd.id} onClick={() => setActiveInputJdIndex(i)}
                                      className={cn("flex-1 py-1.5 rounded-md text-xs font-semibold transition-all",
                                        activeInputJdIndex === i ? "bg-primary text-[#070c18]" : "text-[#4a6080] hover:text-foreground")}>
                                      {jd.company || `JD ${i + 1}`}
                                    </button>
                                  ))}
                                </div>
                                {jds.length < 3 && (
                                  <button onClick={() => { setJds([...jds, { id: uuidv4(), title: "", company: "", text: "" }]); setActiveInputJdIndex(jds.length); }}
                                    className="px-2.5 py-1.5 text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary/10 flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Add
                                  </button>
                                )}
                                <button onClick={() => { setMultiJdOpen(false); setActiveInputJdIndex(0); }} className="text-xs text-[#4a6080] hover:text-foreground">Single</button>
                              </div>
                              <div className="flex gap-2">
                                <input type="text" placeholder="Job Title (optional)" value={jds[activeInputJdIndex]?.title || ""} onChange={e => { const n = [...jds]; n[activeInputJdIndex].title = e.target.value; setJds(n); }} className="card-input flex-1" />
                                <input type="text" placeholder="Company name (optional)" value={jds[activeInputJdIndex]?.company || ""} onChange={e => { const n = [...jds]; n[activeInputJdIndex].company = e.target.value; setJds(n); }} className="card-input w-1/3" />
                              </div>
                              <textarea placeholder="Paste job description here..." value={jds[activeInputJdIndex]?.text || ""} onChange={e => { const n = [...jds]; n[activeInputJdIndex].text = e.target.value; setJds(n); }} className="card-textarea min-h-[120px]" />
                              {jds.length > 1 && (
                                <button onClick={() => { const n = jds.filter((_, i) => i !== activeInputJdIndex); setJds(n); setActiveInputJdIndex(Math.max(0, activeInputJdIndex - 1)); }} className="text-xs text-[#4a6080] hover:text-destructive flex items-center gap-1">
                                  <Trash2 className="w-3 h-3" /> Remove this JD
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Tone selector */}
                        <div className="pt-1 border-t border-[#1e304a]/60">
                          <label className="text-[10px] font-bold tracking-widest uppercase text-[#4a6080] mb-2 block">Outreach Tone</label>
                          <div className="flex gap-2">
                            {(["formal", "warm", "concise"] as Tone[]).map(t => (
                              <button key={t} onClick={() => setTone(t)} className={cn("flex-1 py-2 rounded-lg border text-xs font-semibold transition-all capitalize",
                                tone === t ? "bg-primary/10 border-primary text-primary" : "bg-[#070c18] border-[#1e304a] text-[#4a6080] hover:border-primary/40 hover:text-foreground")}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>{/* end card body */}

                      {/* Card footer */}
                      <div className="px-6 pb-6 space-y-3">
                        {errorMsg && (
                          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">
                            {errorMsg}
                          </div>
                        )}
                        <button
                          onClick={handleGenerate}
                          disabled={generateMut.isPending}
                          className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-300 bg-gradient-to-r from-primary to-[#c77a10] text-[#070c18] hover:shadow-[0_0_30px_rgba(240,160,32,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
                        >
                          <Zap className="w-5 h-5 fill-current" /> ⚡ Generate Package
                        </button>
                        <p className="text-center text-xs text-[#4a6080]">Usually takes 30–45 seconds · Free forever</p>
                      </div>
                    </motion.div>
                  )}{/* end input/generating card */}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ AFTER GENERATE: TWO-PANEL LAYOUT ═══ */}
          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 flex"
            >

              {/* ── LEFT PANEL (280px) ── */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-[280px] flex-shrink-0 flex flex-col border-r border-[#1e304a] bg-[#0c1626] overflow-y-auto custom-scrollbar"
              >
                {/* Package ready */}
                <div className="px-4 py-4 border-b border-[#1e304a]">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Zap className="w-3.5 h-3.5 text-primary fill-current" />
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#4a6080]">RezAI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
                    </span>
                    <span className="text-sm font-semibold text-foreground">Your package is ready</span>
                  </div>
                </div>

                {/* Resume source */}
                <div className="px-4 py-3 border-b border-[#1e304a]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080]">Source</span>
                    <button onClick={handleStartOver} className="text-[10px] text-primary hover:text-primary/80 transition-colors font-medium">Edit</button>
                  </div>
                  <div className="text-xs text-foreground/70 truncate">
                    {mode === "upload" && resumeFile ? resumeFile.name
                      : mode === "linkedin" && linkedinFile ? linkedinFile.name
                      : mode === "scratch" ? `${scratchData.name || "Scratch"} — built manually`
                      : "Resume uploaded"}
                  </div>
                  <div className="text-[10px] text-[#4a6080] mt-0.5 capitalize">{mode} mode · {tone} tone</div>
                </div>

                {/* JD Tabs */}
                {result.results.length > 1 && (
                  <div className="px-4 py-3 border-b border-[#1e304a]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080] block mb-2">Jobs</span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.results.map((r, i) => (
                        <button key={i} onClick={() => setActiveJdTab(i)}
                          className={cn("px-2.5 py-1 rounded-full text-xs font-semibold transition-all",
                            activeJdTab === i ? "bg-primary text-[#070c18]" : "bg-[#070c18] border border-[#1e304a] text-[#4a6080] hover:text-foreground hover:border-primary/40")}>
                          {r.company || `JD ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Single JD: show company + title */}
                {result.results.length === 1 && (
                  <div className="px-4 py-3 border-b border-[#1e304a]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080] block mb-0.5">Target Role</span>
                    <div className="text-sm font-medium text-foreground">{result.results[0].jobTitle || jds[0]?.title || "—"}</div>
                    <div className="text-xs text-[#4a6080]">{result.results[0].company || jds[0]?.company || "—"}</div>
                  </div>
                )}

                {/* ATS Score badge */}
                <div className="px-4 py-3 border-b border-[#1e304a]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080] block mb-2">ATS Score</span>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-[#4a6080]">{result.results[activeJdTab]?.atsOriginal?.score ?? "—"}</div>
                      <div className="text-[10px] text-[#4a6080]">Before</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-primary" />
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-primary">{result.results[activeJdTab]?.atsTailored?.score ?? "—"}</div>
                      <div className="text-[10px] text-primary/70">After ✨</div>
                    </div>
                    <div className="ml-auto">
                      <span className="px-2 py-0.5 rounded-full bg-success/15 border border-success/25 text-success text-xs font-bold">
                        +{Math.max(0, (result.results[activeJdTab]?.atsTailored?.score ?? 0) - (result.results[activeJdTab]?.atsOriginal?.score ?? 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Current JD preview */}
                <div className="px-4 py-3 border-b border-[#1e304a]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080]">Job Description</span>
                    <button onClick={() => setShowChangingJd(v => !v)} className="text-[10px] text-primary hover:text-primary/80 font-medium transition-colors">
                      {showChangingJd ? "Done" : "Change"}
                    </button>
                  </div>
                  {showChangingJd ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input type="text" placeholder="Job Title (optional)" value={jds[activeJdTab]?.title || ""} onChange={e => { const n = [...jds]; n[activeJdTab] = { ...n[activeJdTab], title: e.target.value }; setJds(n); }} className="card-input flex-1 text-xs py-1.5" />
                        <input type="text" placeholder="Company (optional)" value={jds[activeJdTab]?.company || ""} onChange={e => { const n = [...jds]; n[activeJdTab] = { ...n[activeJdTab], company: e.target.value }; setJds(n); }} className="card-input w-20 text-xs py-1.5" />
                      </div>
                      <textarea value={jds[activeJdTab]?.text || ""} onChange={e => { const n = [...jds]; n[activeJdTab] = { ...n[activeJdTab], text: e.target.value }; setJds(n); }} className="card-textarea min-h-[80px] text-xs" />
                    </div>
                  ) : (
                    <p className="text-xs text-[#4a6080] line-clamp-3 leading-relaxed">
                      {jds[activeJdTab]?.text || "No job description."}
                    </p>
                  )}
                </div>

                {/* Additional experience (collapsible) */}
                <div className="px-4 py-3 border-b border-[#1e304a]">
                  <button onClick={() => setShowSidebarExtra(v => !v)} className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080]">Additional Experience</span>
                    <ChevronDown className={cn("w-3 h-3 text-[#4a6080] transition-transform", showSidebarExtra && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {showSidebarExtra && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                        <div className="space-y-2">
                          <input type="text" placeholder="Company" value={currentExtra.company} onChange={e => setCurrentExtra(s => ({ ...s, company: e.target.value }))} className="card-input text-xs py-1.5" />
                          <input type="text" placeholder="Role" value={currentExtra.role} onChange={e => setCurrentExtra(s => ({ ...s, role: e.target.value }))} className="card-input text-xs py-1.5" />
                          <div className="flex gap-2">
                            <input type="text" placeholder="From" value={currentExtra.from} onChange={e => setCurrentExtra(s => ({ ...s, from: e.target.value }))} className="card-input text-xs py-1.5 flex-1" />
                            <input type="text" placeholder="To" value={currentExtra.to} onChange={e => setCurrentExtra(s => ({ ...s, to: e.target.value }))} className="card-input text-xs py-1.5 flex-1" />
                          </div>
                          <textarea placeholder="Key responsibilities..." value={currentExtra.responsibilities} onChange={e => setCurrentExtra(s => ({ ...s, responsibilities: e.target.value }))} className="card-textarea text-xs min-h-[60px]" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Regenerate + Start over */}
                <div className="px-4 py-4 border-t border-[#1e304a] space-y-2">
                  <button
                    onClick={handleGenerate}
                    disabled={generateMut.isPending}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-[#c77a10] text-[#070c18] font-bold text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(240,160,32,0.35)] transition-all disabled:opacity-60"
                  >
                    {generateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Regenerate ⚡
                  </button>
                  <button onClick={handleStartOver} className="w-full text-center text-xs text-[#4a6080] hover:text-foreground transition-colors py-1">
                    Start over
                  </button>
                </div>

                {/* Job Tracker */}
                <div className="px-4 pb-4">
                  {jobTrackerStage ? (
                    <div className="flex gap-1">
                      {["Saved", "Applied", "Interviewing"].map(stage => (
                        <button key={stage} onClick={() => setJobTrackerStage(stage)}
                          className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                            jobTrackerStage === stage ? "bg-primary/15 border-primary text-primary" : "border-[#1e304a] text-[#4a6080] hover:border-primary/30 hover:text-foreground")}>
                          {stage}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => setJobTrackerStage("Saved")} className="w-full py-2.5 rounded-xl border border-[#1e304a] text-xs font-semibold text-[#4a6080] hover:text-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2">
                      📋 Save to Job Tracker
                    </button>
                  )}
                </div>
              </motion.div>

              {/* ── RIGHT PANEL ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
                className="flex-1 flex flex-col min-w-0 bg-[#070c18] relative"
              >

                {/* Feature tab bar with amber underline indicator */}
                <div className="flex-shrink-0 border-b border-[#1e304a] px-4 flex items-end overflow-x-auto hide-scrollbar" style={{ height: "48px" }}>
                  {featureTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFeatureTab(tab.id)}
                      className={cn(
                        "relative px-3 h-full flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                        activeFeatureTab === tab.id ? "text-primary" : "text-[#4a6080] hover:text-foreground"
                      )}
                    >
                      <tab.icon className={cn("w-3.5 h-3.5", tab.id === "agent" && "fill-current")} />
                      {tab.label}
                      {activeFeatureTab === tab.id && (
                        <motion.div
                          layoutId="tab-underline"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button
                    onClick={() => setActiveFeatureTab("history")}
                    className={cn("relative px-3 h-full flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors mb-px",
                      activeFeatureTab === "history" ? "text-primary" : "text-[#4a6080] hover:text-foreground"
                    )}
                  >
                    <History className="w-3.5 h-3.5" /> History
                    {activeFeatureTab === "history" && (
                      <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                    )}
                  </button>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${activeJdTab}-${activeFeatureTab}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className={cn(
                        "absolute inset-0",
                        activeFeatureTab === "agent" ? "p-0" : "overflow-y-auto p-6 custom-scrollbar"
                      )}
                    >

                      {/* ── RESUME ── */}
                      {activeFeatureTab === "resume" && (
                        <div className="h-full flex flex-col gap-0" style={{ minHeight: 0 }}>
                          <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0 flex-wrap">
                            {/* Sub-tabs */}
                            <div className="flex items-center bg-[#0c1626] border border-[#1e304a] rounded-xl p-1 gap-1">
                              <button onClick={() => setResumeViewMode("preview")} className={cn("px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all", resumeViewMode === "preview" ? "bg-[#070c18] text-foreground shadow-sm" : "text-[#4a6080] hover:text-foreground")}>
                                <Eye className="w-3.5 h-3.5" /> Preview
                              </button>
                              <button onClick={() => setResumeViewMode("edit")} className={cn("px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all", resumeViewMode === "edit" ? "bg-[#070c18] text-foreground shadow-sm" : "text-[#4a6080] hover:text-foreground")}>
                                <FileCode2 className="w-3.5 h-3.5" /> Edit LaTeX
                              </button>
                            </div>
                            {/* Download + ATS badge */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold">
                                ATS {result.results[activeJdTab]?.atsTailored?.score ?? "—"}/100 ↑ from {result.results[activeJdTab]?.atsOriginal?.score ?? "—"}
                              </div>
                              <div className="relative" ref={downloadMenuRef}>
                                <div className="flex">
                                  <button onClick={() => downloadPdf(editableLatex[activeJdTab] || result.results[activeJdTab].latex, `resume-${result.results[activeJdTab].company}.pdf`)} disabled={downloadingPdf || !editableLatex[activeJdTab]} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-[#070c18] rounded-l-lg text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                                    {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                                  </button>
                                  <button onClick={() => setShowDownloadMenu(v => !v)} className="px-2 py-1.5 bg-primary/90 text-[#070c18] rounded-r-lg border-l border-[#070c18]/20 hover:bg-primary transition-colors">
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {showDownloadMenu && (
                                  <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-[#0c1626] border border-[#1e304a] rounded-xl shadow-xl overflow-hidden">
                                    <button onClick={() => downloadDocx(editableLatex[activeJdTab] || result.results[activeJdTab].latex, `resume-${result.results[activeJdTab].company}.docx`)} disabled={downloadingDocx} className="w-full flex items-center gap-2 px-4 py-3 text-xs text-foreground hover:bg-[#1e304a]/50 transition-colors">
                                      {downloadingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Word (.docx)
                                    </button>
                                  </div>
                                )}
                              </div>
                              <a href={generateOverleafUrl(editableLatex[activeJdTab] || result.results[activeJdTab].latex)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0c1626] border border-[#1e304a] rounded-lg text-xs font-semibold hover:border-primary/40 transition-colors text-foreground">
                                <ExternalLink className="w-3.5 h-3.5" /> Overleaf
                              </a>
                              <CopyButton text={editableLatex[activeJdTab] || result.results[activeJdTab].latex} label="Copy LaTeX" />
                            </div>
                          </div>
                          <div className="flex-1 overflow-hidden rounded-xl border border-[#1e304a]" style={{ minHeight: 0 }}>
                            {resumeViewMode === "preview" ? (
                              previewLoading[activeJdTab] ? (
                                <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#525659]">
                                  <Loader2 className="w-8 h-8 animate-spin text-white/60" />
                                  <p className="text-sm text-white/50">Compiling preview…</p>
                                </div>
                              ) : previewBlobs[activeJdTab] ? (
                                <PdfPreview blob={previewBlobs[activeJdTab]} />
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center gap-3 bg-[#0c1626]/30">
                                  <FileCode2 className="w-10 h-10 text-[#4a6080]/40" />
                                  <p className="text-sm text-[#4a6080]">Preview unavailable — switch to Edit LaTeX</p>
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

                      {/* ── ATS ANALYSIS ── */}
                      {activeFeatureTab === "ats" && (
                        <div className="max-w-4xl mx-auto space-y-6">
                          {(result.results[activeJdTab].matched_keywords?.length > 0 || result.results[activeJdTab].missing_keywords?.length > 0) && (
                            <div className="bg-[#0c1626] border border-[#1e304a] rounded-xl p-6 shadow-sm space-y-5">
                              <h3 className="text-lg font-bold text-foreground">Keyword Analysis</h3>
                              {result.results[activeJdTab].matched_keywords?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-success mb-3">Found in your resume</p>
                                  <div className="flex flex-wrap gap-2">
                                    {result.results[activeJdTab].matched_keywords.map(kw => (
                                      <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                                        <Check className="w-3 h-3" />{kw}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {result.results[activeJdTab].missing_keywords?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-3">Missing from your resume</p>
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {result.results[activeJdTab].missing_keywords.map(kw => (
                                      <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                                        <X className="w-3 h-3" />{kw}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <p className="text-xs text-[#4a6080]">These keywords appear in the JD but not in your resume.</p>
                                    <button onClick={() => handleFixWithAgent(result.results[activeJdTab].missing_keywords)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-bold hover:bg-primary/20 transition-colors flex-shrink-0">
                                      <Zap className="w-3 h-3 fill-current" /> Fix with RezAI Agent
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
                          <div className="bg-[#0c1626] border border-[#1e304a] rounded-xl p-6 flex items-center justify-between shadow-lg">
                            <div>
                              <h3 className="text-lg font-bold text-foreground">Optimization Result</h3>
                              <p className="text-[#4a6080] text-sm mt-1">Your resume was rewritten to hit target keywords and use the XYZ impact formula.</p>
                            </div>
                            <div className="text-right">
                              <div className="text-4xl font-mono font-bold text-primary">+{Math.max(0, result.results[activeJdTab].atsTailored.score - result.results[activeJdTab].atsOriginal.score)}</div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Point Increase</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── COVER LETTER ── */}
                      {activeFeatureTab === "cover" && (
                        <div className="max-w-3xl mx-auto h-full flex flex-col">
                          <div className="flex justify-end mb-4 flex-shrink-0"><CopyButton text={result.results[activeJdTab].coverLetter} /></div>
                          <div className="flex-1 bg-[#0c1626] border border-[#1e304a] rounded-xl p-8 overflow-auto shadow-sm">
                            <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed text-[15px]">{result.results[activeJdTab].coverLetter}</p>
                          </div>
                        </div>
                      )}

                      {/* ── OUTREACH EMAIL ── */}
                      {activeFeatureTab === "email" && (
                        <div className="max-w-3xl mx-auto h-full flex flex-col">
                          <div className="flex justify-end mb-4 flex-shrink-0"><CopyButton text={result.results[activeJdTab].email} /></div>
                          <div className="bg-[#0c1626] border border-[#1e304a] rounded-xl p-8 shadow-sm">
                            <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed text-[15px]">{result.results[activeJdTab].email}</p>
                          </div>
                        </div>
                      )}

                      {/* ── LINKEDIN ── */}
                      {activeFeatureTab === "linkedin" && (
                        <div className="max-w-3xl mx-auto space-y-6">
                          <div className="bg-[#0c1626] border border-[#1e304a] rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-[#0a66c2]/10 border-b border-[#1e304a] px-6 py-3 flex justify-between items-center">
                              <h3 className="font-semibold text-[#0a66c2] flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Optimized Headline</h3>
                              <CopyButton text={result.linkedin.headline} minimal />
                            </div>
                            <div className="p-6"><p className="text-lg font-medium text-foreground leading-snug">{result.linkedin.headline}</p></div>
                          </div>
                          <div className="bg-[#0c1626] border border-[#1e304a] rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-[#0a66c2]/10 border-b border-[#1e304a] px-6 py-3 flex justify-between items-center">
                              <h3 className="font-semibold text-[#0a66c2] flex items-center gap-2"><MessageSquare className="w-4 h-4" /> About Section</h3>
                              <CopyButton text={result.linkedin.about} minimal />
                            </div>
                            <div className="p-6"><p className="whitespace-pre-wrap text-foreground/90 leading-relaxed text-[15px]">{result.linkedin.about}</p></div>
                          </div>
                        </div>
                      )}

                      {/* ── REZAI AGENT ── */}
                      {activeFeatureTab === "agent" && (
                        <div className="h-full flex">
                          {/* Chat (55%) */}
                          <div className="flex flex-col border-r border-[#1e304a]" style={{ width: "55%" }}>
                            <div className="flex-shrink-0 px-5 py-3 border-b border-[#1e304a] flex items-center gap-3 bg-[#070c18]">
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                                <Zap className="w-4 h-4 text-primary fill-current" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">RezAI Agent</p>
                                <p className="text-xs text-[#4a6080]">Resume for {result.results[activeJdTab].company}</p>
                              </div>
                            </div>
                            <div className="flex-1 overflow-hidden px-5">
                              {renderAgentChat({ messages: agentMessages[activeJdTab] || [], loading: !!agentLoading[activeJdTab], bottomRef: agentBottomRef })}
                            </div>
                            <div className="flex-shrink-0 px-5 py-4 border-t border-[#1e304a] bg-[#070c18]">
                              <div className="flex gap-2">
                                <input type="text" value={agentInput} onChange={e => setAgentInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAgentSend(); } }}
                                  placeholder="Edit resume or ask career questions..."
                                  className="flex-1 bg-[#0c1626] border border-[#1e304a] rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-[#4a6080] focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                  disabled={!!agentLoading[activeJdTab]} />
                                <button onClick={handleAgentSend} disabled={!agentInput.trim() || !!agentLoading[activeJdTab]}
                                  className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-[#070c18] disabled:opacity-40 hover:bg-primary/90 transition-colors flex-shrink-0">
                                  {agentLoading[activeJdTab] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Live Preview (45%) */}
                          <div className="flex flex-col bg-[#070c18]" style={{ width: "45%" }}>
                            <div className="flex-shrink-0 px-5 py-3 border-b border-[#1e304a] flex items-center justify-between">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080]">Live Preview</p>
                              {previewLoading[activeJdTab] && <div className="flex items-center gap-1.5 text-xs text-primary"><Loader2 className="w-3 h-3 animate-spin" /> Updating...</div>}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              {previewBlobs[activeJdTab] ? <PdfPreview blob={previewBlobs[activeJdTab]} /> : (
                                <div className="h-full flex flex-col items-center justify-center gap-3 bg-[#0c1626]/40">
                                  <FileCode2 className="w-10 h-10 text-[#4a6080]/30" />
                                  <p className="text-sm text-[#4a6080]/60">Preview loading...</p>
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 px-4 py-3 border-t border-[#1e304a] flex gap-2">
                              <button onClick={() => downloadPdf(editableLatex[activeJdTab] || result.results[activeJdTab].latex)} disabled={downloadingPdf || !editableLatex[activeJdTab]} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary/10 border border-primary/25 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-40">
                                {downloadingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
                              </button>
                              <button onClick={() => downloadDocx(editableLatex[activeJdTab] || result.results[activeJdTab].latex)} disabled={downloadingDocx || !editableLatex[activeJdTab]} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0c1626] border border-[#1e304a] text-[#4a6080] rounded-lg text-xs font-bold hover:text-foreground transition-colors disabled:opacity-40">
                                {downloadingDocx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Word
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── HISTORY ── */}
                      {activeFeatureTab === "history" && (
                        <div className="max-w-2xl mx-auto">
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Generation History</h2>
                            {history.length > 0 && (
                              <button onClick={() => { if (confirm("Clear all history?")) clearHistory(); }} className="text-sm text-[#4a6080] hover:text-destructive transition-colors">Clear All</button>
                            )}
                          </div>
                          <div className="space-y-4">
                            {history.length === 0 ? (
                              <p className="text-[#4a6080] text-center py-12">No history yet.</p>
                            ) : history.map(item => (
                              <div key={item.id} className="bg-[#0c1626] border border-[#1e304a] p-5 rounded-xl hover:border-primary/40 transition-colors group">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="text-xs text-[#4a6080]">{new Date(item.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => loadHistoryItem(item)} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary hover:text-[#070c18] transition-colors flex items-center gap-1">
                                      <Eye className="w-3.5 h-3.5" /> Load
                                    </button>
                                    <button onClick={() => deleteHistory(item.id)} className="p-1.5 text-[#4a6080] hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  {item.jds.map((jd, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                                      {jd.title || "Untitled Role"} <span className="text-[#4a6080] font-normal">at</span> {jd.company || "Unknown Company"}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* ── FLOATING AGENT BUBBLE (absolute in right panel) ── */}
                {activeFeatureTab !== "agent" && (
                  <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-3">
                    <AnimatePresence>
                      {agentOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 16, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 16, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="w-[380px] h-[520px] rounded-2xl bg-[#0c1626] border border-[#1e304a] shadow-2xl flex flex-col overflow-hidden"
                          style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(240,160,32,0.08)" }}
                        >
                          <div className="flex-shrink-0 px-4 py-3 bg-[#070c18] border-b border-[#1e304a] flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                                <Zap className="w-3.5 h-3.5 text-primary fill-current" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground leading-none">RezAI Agent</p>
                                <p className="text-[10px] text-[#4a6080] mt-0.5">Resume for {result.results[activeJdTab]?.company || "—"} loaded</p>
                              </div>
                            </div>
                            <button onClick={() => setAgentOpen(false)} className="p-1.5 text-[#4a6080] hover:text-foreground transition-colors rounded-lg hover:bg-white/5">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex-1 overflow-hidden px-4">
                            {renderAgentChat({ messages: agentMessages[activeJdTab] || [], loading: !!agentLoading[activeJdTab], bottomRef: agentBubbleBottomRef, compact: true })}
                          </div>
                          <div className="flex-shrink-0 px-3 pb-3 pt-2 border-t border-[#1e304a] bg-[#070c18] space-y-2">
                            <div className="flex gap-2">
                              <input type="text" value={agentInput} onChange={e => setAgentInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAgentSend(); } }}
                                placeholder="Edit resume or ask career questions..."
                                className="flex-1 bg-[#0c1626] border border-[#1e304a] rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-[#4a6080] focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                disabled={!!agentLoading[activeJdTab]} />
                              <button onClick={handleAgentSend} disabled={!agentInput.trim() || !!agentLoading[activeJdTab]}
                                className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-[#070c18] disabled:opacity-40 hover:bg-primary/90 transition-colors flex-shrink-0">
                                {agentLoading[activeJdTab] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
                              </button>
                            </div>
                            <button onClick={() => { setActiveFeatureTab("agent"); setAgentOpen(false); }} className="w-full text-center text-xs text-[#4a6080] hover:text-primary transition-colors py-0.5">
                              ↗ Open full view
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="relative">
                      {!agentOpen && <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping pointer-events-none" style={{ animationDuration: "2s" }} />}
                      <button onClick={() => setAgentOpen(v => !v)} title="Chat with RezAI Agent"
                        className="relative w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-primary/40 hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-200">
                        {agentOpen ? <X className="w-6 h-6 text-[#070c18]" /> : <Zap className="w-6 h-6 text-[#070c18] fill-current" />}
                      </button>
                    </div>
                  </div>
                )}

              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .card-input {
          width: 100%;
          background: #070c18;
          border: 1px solid #1b2d45;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          color: #e2ddd4;
          outline: none;
          transition: border-color 0.15s;
        }
        .card-input::placeholder { color: #4a6080; }
        .card-input:focus { border-color: #f0a020; }
        .card-textarea {
          width: 100%;
          background: #070c18;
          border: 1px solid #1b2d45;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          color: #e2ddd4;
          outline: none;
          transition: border-color 0.15s;
          resize: vertical;
          min-height: 80px;
        }
        .card-textarea::placeholder { color: #4a6080; }
        .card-textarea:focus { border-color: #f0a020; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e304a; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a6080; }
      ` }} />
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy", minimal = false }: { text: string; label?: string; minimal?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  if (minimal) {
    return (
      <button onClick={handleCopy} className="p-1.5 text-[#4a6080] hover:text-primary transition-colors">
        {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
      </button>
    );
  }
  return (
    <button onClick={handleCopy} className="px-3 py-1.5 bg-[#0c1626] hover:bg-[#1e304a]/50 border border-[#1e304a] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors text-foreground">
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function AtsCard({ title, data, type }: { title: string; data: AtsScore; type: "neutral" | "success" }) {
  const score = data?.score || 0;
  let colorClass = "text-warning";
  let barClass = "bg-warning";
  if (score >= 80) { colorClass = "text-success"; barClass = "bg-success"; }
  else if (score <= 50) { colorClass = "text-destructive"; barClass = "bg-destructive"; }
  if (type === "neutral") { colorClass = "text-foreground"; barClass = "bg-[#4a6080]"; }
  return (
    <div className="bg-[#0c1626] border border-[#1e304a] rounded-xl p-6 flex flex-col">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#4a6080] mb-4">{title}</h4>
      <div className="flex items-end gap-2 mb-4">
        <span className={cn("text-6xl font-mono font-bold leading-none", colorClass)}>{score}</span>
        <span className="text-xl text-[#4a6080] font-mono mb-1">/100</span>
      </div>
      <div className="w-full h-2 bg-[#070c18] rounded-full overflow-hidden mb-6">
        <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, ease: "easeOut" }} className={cn("h-full rounded-full", barClass)} />
      </div>
      <div className="flex-1 bg-[#070c18] rounded-lg p-4 text-sm text-[#4a6080] leading-relaxed">
        {data?.breakdown || "No breakdown provided."}
      </div>
    </div>
  );
}

function FileText({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>;
}
function Sparkles({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>;
}
