import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Code2, Pencil, Loader2, Check, X, RefreshCw } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ResumeData, ResumeExperience, ResumeEducation, ResumePersonalInfo } from "@/types";
import { buildLatexFromData } from "@/utils/buildLatexFromData";

// ─── Types ────────────────────────────────────────────────────────────────────

type PersonalInfo = ResumePersonalInfo;
type ExperienceEntry = ResumeExperience;
type EducationEntry = ResumeEducation;
type VisualResumeData = ResumeData;

export interface ResumeEditorProps {
  latex: string;
  initialData?: ResumeData | null;
  jd?: { title?: string; company?: string; text?: string };
  onSave: (updatedLatex: string) => Promise<{ success: boolean; error?: string }>;
  onDataChange?: (data: ResumeData) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.BASE_URL || "/";

const EMPTY_DATA: VisualResumeData = {
  personalInfo: { name: "", email: "", phone: "", location: "", linkedin: "" },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  certifications: [],
};

// ─── Input styles (inline to avoid CSS specificity issues) ────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid #262626",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "13px",
  color: "#ffffff",
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "#2563eb";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "#262626";
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, action, children }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#141414", border: "1px solid #262626", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#666666" }}>
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#888888", marginBottom: "5px" }}>
      {children}
    </label>
  );
}

function EditorInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={inputStyle} {...focusHandlers} />
  );
}

function EditorTextarea({ value, onChange, placeholder, rows = 2 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      style={{ ...inputStyle, resize: "vertical" }} {...focusHandlers} />
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", color: "#2563eb", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", padding: "2px 0", fontFamily: "inherit" }}>
      <Plus style={{ width: 13, height: 13 }} /> {label}
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: "none", border: "none", cursor: "pointer", color: hover ? "#ef4444" : "#666666", padding: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontFamily: "inherit", transition: "color 0.15s", flexShrink: 0 }}>
      <Trash2 style={{ width: 12, height: 12 }} /> Remove
    </button>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", background: active ? "#262626" : "transparent", color: active ? "#ffffff" : "#888888" }}>
      {icon} {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ParseStatus = "idle" | "loading" | "done" | "error";
type UpdateStatus = "idle" | "updating" | "success" | "error";

export function ResumeEditor({ latex, initialData, jd, onSave, onDataChange }: ResumeEditorProps) {
  const [mode, setMode] = useState<"visual" | "latex">("visual");
  const [data, setData] = useState<VisualResumeData>(EMPTY_DATA);
  const [rawLatex, setRawLatex] = useState(latex);
  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const parsedForLatex = useRef<string>("");

  // ── Use pre-parsed initialData when provided (skips API call) ────────────
  // initialDataApplied ref is used only by doParseLatex GUARD to short-circuit
  // the parse-latex API. The effect itself always re-applies when initialData changes
  // (e.g. user switches between job tabs in the parent).
  const initialDataApplied = useRef(false);
  useEffect(() => {
    if (!initialData) return;
    initialDataApplied.current = true;
    setData({
      personalInfo: { ...initialData.personalInfo },
      summary: initialData.summary || "",
      experience: (initialData.experience || []).map(e => ({
        id: e.id || uuidv4(),
        title: e.title || "",
        company: e.company || "",
        location: e.location || "",
        startDate: e.startDate || "",
        endDate: e.endDate || "",
        bullets: Array.isArray(e.bullets) ? e.bullets.filter(Boolean) : [],
        pageBreakBefore: e.pageBreakBefore ?? false,
      })),
      education: (initialData.education || []).map(e => ({
        id: e.id || uuidv4(),
        degree: e.degree || "",
        institution: e.institution || "",
        year: e.year || "",
      })),
      skills: Array.isArray(initialData.skills) ? initialData.skills.filter(Boolean) : [],
      certifications: Array.isArray(initialData.certifications) ? initialData.certifications.filter(Boolean) : [],
    });
    parsedForLatex.current = latex;
    setParseStatus("done");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  // ── Sync edits back to parent (fixes stale-data-on-remount bug) ──────────
  // isUserEdit distinguishes real user edits from programmatic setData calls
  // (initialData effect, undo/redo). Only user edits should propagate to the
  // parent — otherwise initialData prop changes → initialData effect → setData
  // → useEffect → onDataChange → setResult → initialData changes again → ♾️
  const isUserEdit = useRef(false);

  useEffect(() => {
    if (parseStatus !== "done") return;
    if (!isUserEdit.current) return;
    isUserEdit.current = false;
    onDataChange?.(data);
  // onDataChange intentionally omitted — it's a callback prop, adding it would
  // require the parent to memoize it and still wouldn't prevent the loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, parseStatus]);

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const [editHistory, setEditHistory] = useState<VisualResumeData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const saveToHistory = (currentData: VisualResumeData) => {
    const newHistory = editHistory.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(currentData)));
    if (newHistory.length > 20) newHistory.shift();
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  /** Wrap all user edits: saves current state to history then applies updater.
   *  Sets isUserEdit so the onDataChange effect knows to propagate to the parent. */
  const updateData = (updater: (prev: VisualResumeData) => VisualResumeData) => {
    isUserEdit.current = true;
    saveToHistory(data);
    setData(updater);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setData(JSON.parse(JSON.stringify(editHistory[newIndex])));
  };

  const handleRedo = () => {
    if (historyIndex >= editHistory.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setData(JSON.parse(JSON.stringify(editHistory[newIndex])));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex, editHistory]);

  // ── Loading message (skeleton) ────────────────────────────────────────────
  const [loadingMessage, setLoadingMessage] = useState('Loading your resume editor...');
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (parseStatus !== 'loading' && parseStatus !== 'idle') { setLoadingTimedOut(false); return; }
    setLoadingMessage('Loading your resume editor...');
    setLoadingTimedOut(false);
    const t1 = setTimeout(() => setLoadingMessage('Almost there, parsing your data...'), 5000);
    const t2 = setTimeout(() => setLoadingMessage('Taking a bit longer than usual...'), 10000);
    const t3 = setTimeout(() => setLoadingMessage('Still working on it...'), 15000);
    const t4 = setTimeout(() => setLoadingTimedOut(true), 20000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [parseStatus]);

  // Auto-parse when entering visual mode for the first time
  useEffect(() => {
    if (mode !== "visual" || parseStatus !== "idle") return;
    doParseLatex();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, parseStatus]);

  // Reset parse state when latex prop changes (e.g. after agent edit)
  // GUARD: Don't reset to "idle" if data was already populated from initialData —
  // that would re-trigger the slow parse-latex API call needlessly.
  useEffect(() => {
    setRawLatex(latex);
    if (parsedForLatex.current !== latex) {
      if (!initialDataApplied.current) {
        // Only reset if we don't already have structured data loaded
        setParseStatus("idle");
      }
      parsedForLatex.current = "";
    }
  }, [latex]);

  const doParseLatex = async () => {
    // GUARD 1: If initialData already populated this editor, skip the API entirely.
    // This is the fast-path — 0ms open time when resumeData was returned by the backend.
    if (initialDataApplied.current) {
      setParseStatus("done");
      return;
    }

    // GUARD 2: If we already have structured data in state (e.g. name is filled),
    // don't burn an API call just because parseStatus reset to idle.
    if (data.personalInfo.name && data.personalInfo.name.length > 0) {
      setParseStatus("done");
      return;
    }

    if (parsedForLatex.current === latex && parseStatus === "done") return;

    // Validate latex is present
    const currentLatex = latex?.trim();
    console.log("Sending latex to parse, length:", currentLatex?.length);
    if (!currentLatex) {
      setParseStatus("error");
      return;
    }

    setParseStatus("loading");
    try {
      const res = await fetch(`${BASE_URL}api/resume/parse-latex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: currentLatex }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        console.error("parse-latex API error:", errJson);
        throw new Error(errJson?.error || "Parse failed");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: { success?: boolean; data: any } = await res.json();
      const d = json.data ?? {};
      setData({
        personalInfo: {
          name: d.personalInfo?.name || "",
          email: d.personalInfo?.email || "",
          phone: d.personalInfo?.phone || "",
          location: d.personalInfo?.location || "",
          linkedin: d.personalInfo?.linkedin || "",
        },
        summary: d.summary || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        experience: (d.experience || []).map((e: any) => ({
          id: e.id || uuidv4(),
          title: e.title || "",
          company: e.company || "",
          location: e.location || "",
          startDate: e.startDate || "",
          endDate: e.endDate || "",
          bullets: Array.isArray(e.bullets) ? e.bullets.filter(Boolean) : [],
          pageBreakBefore: e.pageBreakBefore ?? false,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        education: (d.education || []).map((e: any) => ({
          id: e.id || uuidv4(),
          degree: e.degree || "",
          institution: e.institution || "",
          year: e.year || "",
        })),
        skills: Array.isArray(d.skills) ? d.skills.filter(Boolean) : [],
        certifications: Array.isArray(d.certifications) ? d.certifications.filter(Boolean) : [],
      });
      parsedForLatex.current = latex;
      setParseStatus("done");
    } catch {
      setParseStatus("error");
    }
  };

  // ── State helpers ──────────────────────────────────────────────────────────

  const updExp = (id: string, field: keyof ExperienceEntry, value: string) =>
    updateData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, [field]: value } : e) }));
  const updExpBullet = (id: string, bi: number, v: string) =>
    updateData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, bullets: e.bullets.map((b, i) => i === bi ? v : b) } : e) }));
  const addExpBullet = (id: string) =>
    updateData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, bullets: [...e.bullets, ""] } : e) }));
  const removeExpBullet = (id: string, bi: number) =>
    updateData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, bullets: e.bullets.filter((_, i) => i !== bi) } : e) }));
  const addExperience = () =>
    updateData(d => ({ ...d, experience: [...d.experience, { id: uuidv4(), title: "", company: "", location: "", startDate: "", endDate: "", bullets: [""], pageBreakBefore: false }] }));
  const removeExperience = (id: string) => {
    if (!confirm("Remove this experience entry?")) return;
    updateData(d => ({ ...d, experience: d.experience.filter(e => e.id !== id) }));
  };
  const updEdu = (id: string, field: keyof EducationEntry, v: string) =>
    updateData(d => ({ ...d, education: d.education.map(e => e.id === id ? { ...e, [field]: v } : e) }));
  const addEducation = () =>
    updateData(d => ({ ...d, education: [...d.education, { id: uuidv4(), degree: "", institution: "", year: "" }] }));
  const removeEducation = (id: string) =>
    updateData(d => ({ ...d, education: d.education.filter(e => e.id !== id) }));
  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || data.skills.includes(s)) { setSkillInput(""); return; }
    updateData(d => ({ ...d, skills: [...d.skills, s] }));
    setSkillInput("");
  };
  const removeSkill = (s: string) => updateData(d => ({ ...d, skills: d.skills.filter(x => x !== s) }));
  const addCert = () => {
    const c = certInput.trim();
    if (!c) return;
    updateData(d => ({ ...d, certifications: [...d.certifications, c] }));
    setCertInput("");
  };
  const removeCert = (i: number) => updateData(d => ({ ...d, certifications: d.certifications.filter((_, idx) => idx !== i) }));

  // ── Update Preview ─────────────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (updateStatus === "updating") return;
    setUpdateStatus("updating");
    setUpdateError(null);
    try {
      if (mode === "latex") {
        const result = await onSave(rawLatex);
        if (result.success) { setUpdateStatus("success"); setTimeout(() => setUpdateStatus("idle"), 2000); }
        else { setUpdateStatus("error"); setUpdateError(result.error || "Compilation failed."); }
        return;
      }

      // Visual mode: build LaTeX directly in JS — no Claude API call needed
      const builtLatex = buildLatexFromData(data);
      console.log("Built LaTeX, length:", builtLatex.length);
      const result = await onSave(builtLatex);
      if (result.success) { setUpdateStatus("success"); setTimeout(() => setUpdateStatus("idle"), 2500); }
      else { setUpdateStatus("error"); setUpdateError(result.error || "Could not compile. Please check your content for special characters."); }
    } catch (e: unknown) {
      setUpdateStatus("error");
      setUpdateError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  };

  const handleReset = () => {
    setParseStatus("idle");
    parsedForLatex.current = "";
    setData(EMPTY_DATA);
    setUpdateStatus("idle");
    setUpdateError(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a" }}>

      {/* ── Tab bar ── */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid #262626", background: "#141414", gap: "4px" }}>
        <div style={{ display: "flex", gap: "2px", background: "#0a0a0a", borderRadius: "8px", padding: "3px" }}>
          <TabButton active={mode === "visual"} onClick={() => setMode("visual")}
            icon={<Pencil style={{ width: 13, height: 13 }} />} label="Edit Resume" />
          <TabButton active={mode === "latex"} onClick={() => { setRawLatex(latex); setMode("latex"); }}
            icon={<Code2 style={{ width: 13, height: 13 }} />} label="LaTeX (Advanced)" />
        </div>
        {/* Undo / Redo buttons */}
        {mode === "visual" && parseStatus === "done" && (
          <div style={{ display: "flex", gap: "4px", marginLeft: "8px" }}>
            {[
              { label: "↩", title: "Undo (Ctrl+Z)", disabled: historyIndex <= 0, onClick: handleUndo },
              { label: "↪", title: "Redo (Ctrl+Y)", disabled: historyIndex >= editHistory.length - 1, onClick: handleRedo },
            ].map(btn => (
              <button
                key={btn.title}
                onClick={btn.onClick}
                disabled={btn.disabled}
                title={btn.title}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "#1e1e1e", border: "1px solid #333333",
                  cursor: btn.disabled ? "not-allowed" : "pointer",
                  opacity: btn.disabled ? 0.3 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#888888", fontSize: "15px", fontFamily: "inherit",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => { if (!btn.disabled) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2563eb"; (e.currentTarget as HTMLButtonElement).style.color = "#ffffff"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#333333"; (e.currentTarget as HTMLButtonElement).style.color = "#888888"; }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
        {mode === "visual" && parseStatus === "error" && (
          <button onClick={() => { parsedForLatex.current = ""; doParseLatex(); }} style={{ marginLeft: "auto", fontSize: "11px", color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px" }}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Retry
          </button>
        )}
      </div>

      {/* ── LaTeX mode ── */}
      {mode === "latex" ? (
        <textarea value={rawLatex} onChange={e => setRawLatex(e.target.value)}
          style={{ flex: 1, width: "100%", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6, padding: "20px", resize: "none", outline: "none", border: "none" }}
          spellCheck={false} placeholder="% LaTeX resume source"
          className="custom-scrollbar" />

      /* ── Loading skeleton ── */
      ) : (parseStatus === "loading" || (parseStatus === "idle" && !!latex?.trim())) ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }} className="custom-scrollbar">
          <style>{`
            @keyframes rezai-shimmer {
              0%   { opacity: 0.3 }
              50%  { opacity: 0.7 }
              100% { opacity: 0.3 }
            }
          `}</style>
          {/* Status header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", padding: "14px 16px", background: "#141414", border: "1px solid #262626", borderRadius: "10px" }}>
            <Loader2 style={{ width: 18, height: 18, color: "#2563eb", flexShrink: 0 }} className="animate-spin" />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#ffffff", fontWeight: 600 }}>{loadingMessage}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#666666" }}>Parsing resume data (5–10 sec)</p>
            </div>
          </div>
          {/* Timeout fallback */}
          {loadingTimedOut && (
            <div style={{ background: "#141414", border: "1px solid #333333", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px" }}>
              <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#ffffff" }}>Taking too long?</p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => { parsedForLatex.current = ""; doParseLatex(); }}
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", background: "#1e1e1e", border: "1px solid #333333", borderRadius: "8px", fontSize: "12px", color: "#ffffff", cursor: "pointer", fontFamily: "inherit" }}
                >
                  <RefreshCw style={{ width: 12, height: 12 }} /> Try again
                </button>
                <button
                  onClick={() => { setRawLatex(latex); setMode("latex"); }}
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", background: "#2563eb", border: "none", borderRadius: "8px", fontSize: "12px", color: "#ffffff", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Use LaTeX editor →
                </button>
              </div>
            </div>
          )}
          {/* Skeleton sections */}
          {[
            { title: "Personal Information", rows: [["full"], ["half", "half"], ["half", "half"]] },
            { title: "Experience", rows: [["full"], ["full"], ["full"], ["full"]] },
            { title: "Education", rows: [["full"], ["half", "half"]] },
            { title: "Skills", rows: [["quarter", "third", "quarter", "quarter"]] },
          ].map(section => (
            <div key={section.title} style={{ background: "#141414", border: "1px solid #262626", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
              {/* Section label */}
              <div style={{ width: "90px", height: "10px", background: "#1e1e1e", borderRadius: "4px", marginBottom: "14px", animation: "rezai-shimmer 1.5s ease-in-out infinite" }} />
              {/* Rows */}
              {section.rows.map((row, ri) => (
                <div key={ri} style={{ display: "flex", gap: "10px", marginBottom: ri < section.rows.length - 1 ? "10px" : 0 }}>
                  {row.map((size, ci) => (
                    <div key={ci} style={{
                      flex: size === "full" ? "1 1 100%" : size === "half" ? "1 1 50%" : size === "third" ? "1 1 33%" : "1 1 25%",
                      height: "40px", background: "#1e1e1e", borderRadius: "6px",
                      animation: `rezai-shimmer 1.5s ease-in-out infinite`,
                      animationDelay: `${(ri * row.length + ci) * 0.1}s`,
                    }} />
                  ))}
                </div>
              ))}
            </div>
          ))}
          <div style={{ height: "80px" }} />
        </div>

      /* ── Visual editor (parse error = show fallback empty form, or success = show populated form) ── */
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0 20px" }} className="custom-scrollbar">

          {/* No-latex banner */}
          {!latex?.trim() && (
            <div style={{ background: "#141414", border: "1px solid #2563eb", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <p style={{ margin: 0, fontSize: "13px", color: "#2563eb" }}>No resume found. Please generate a resume first.</p>
            </div>
          )}

          {/* Parse-failed fallback notice */}
          {parseStatus === "error" && latex?.trim() && (
            <div style={{ background: "#141414", border: "1px solid #666666", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span style={{ fontSize: "16px", flexShrink: 0 }}>ℹ️</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#ffffff" }}>Could not auto-parse resume. You can fill in the fields manually below.</p>
                <button onClick={() => { parsedForLatex.current = ""; doParseLatex(); }} style={{ fontSize: "12px", color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                  <RefreshCw style={{ width: 12, height: 12 }} /> Try parsing again
                </button>
              </div>
            </div>
          )}

          {/* Personal Info */}
          <SectionCard title="Personal Information">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Full Name</FieldLabel>
                <EditorInput value={data.personalInfo.name} onChange={v => updateData(d => ({ ...d, personalInfo: { ...d.personalInfo, name: v } }))} placeholder="John Doe" />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <EditorInput value={data.personalInfo.email} onChange={v => updateData(d => ({ ...d, personalInfo: { ...d.personalInfo, email: v } }))} placeholder="john@example.com" type="email" />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <EditorInput value={data.personalInfo.phone} onChange={v => updateData(d => ({ ...d, personalInfo: { ...d.personalInfo, phone: v } }))} placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <FieldLabel>Location</FieldLabel>
                <EditorInput value={data.personalInfo.location} onChange={v => updateData(d => ({ ...d, personalInfo: { ...d.personalInfo, location: v } }))} placeholder="New York, NY" />
              </div>
              <div>
                <FieldLabel>LinkedIn URL</FieldLabel>
                <EditorInput value={data.personalInfo.linkedin} onChange={v => updateData(d => ({ ...d, personalInfo: { ...d.personalInfo, linkedin: v } }))} placeholder="linkedin.com/in/johndoe" />
              </div>
            </div>
          </SectionCard>

          {/* Summary */}
          <SectionCard title="Professional Summary">
            <EditorTextarea value={data.summary} onChange={v => updateData(d => ({ ...d, summary: v }))} placeholder="Results-driven professional with…" rows={4} />
          </SectionCard>

          {/* Experience */}
          <SectionCard title="Work Experience" action={<AddBtn onClick={addExperience} label="+ Add" />}>
            {data.experience.length === 0 && (
              <p style={{ fontSize: "12px", color: "#888888", textAlign: "center", padding: "16px 0", margin: 0 }}>No experience entries. Click "+ Add" to add one.</p>
            )}
            {data.experience.map((exp, expIdx) => (
              <div key={exp.id}>
                {/* Page break indicator — above the card that has pageBreakBefore */}
                {exp.pageBreakBefore && expIdx > 0 && (
                  <div
                    onClick={() => updateData(d => ({ ...d, experience: d.experience.map(e => e.id === exp.id ? { ...e, pageBreakBefore: false } : e) }))}
                    title="Click to remove page break"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', cursor: 'pointer' }}
                  >
                    <div style={{ flex: 1, borderTop: '2px dashed #333333' }} />
                    <span style={{ fontSize: '10px', color: '#555555', whiteSpace: 'nowrap', userSelect: 'none' }}>
                      Page Break · click to remove
                    </span>
                    <div style={{ flex: 1, borderTop: '2px dashed #333333' }} />
                  </div>
                )}
              <div style={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <FieldLabel>Job Title</FieldLabel>
                    <EditorInput value={exp.title} onChange={v => updExp(exp.id, "title", v)} placeholder="Software Engineer" />
                  </div>
                  <div>
                    <FieldLabel>Company</FieldLabel>
                    <EditorInput value={exp.company} onChange={v => updExp(exp.id, "company", v)} placeholder="Google" />
                  </div>
                  <div>
                    <FieldLabel>Location</FieldLabel>
                    <EditorInput value={exp.location} onChange={v => updExp(exp.id, "location", v)} placeholder="Mountain View, CA" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <div>
                      <FieldLabel>Start</FieldLabel>
                      <EditorInput value={exp.startDate} onChange={v => updExp(exp.id, "startDate", v)} placeholder="Jan 2022" />
                    </div>
                    <div>
                      <FieldLabel>End</FieldLabel>
                      <EditorInput value={exp.endDate} onChange={v => updExp(exp.id, "endDate", v)} placeholder="Present" />
                    </div>
                  </div>
                </div>
                <FieldLabel>Bullet points</FieldLabel>
                {exp.bullets.map((b, bi) => (
                  <div key={bi} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ color: "#888888", marginTop: "13px", fontSize: "13px", flexShrink: 0 }}>•</span>
                    <EditorTextarea value={b} onChange={v => updExpBullet(exp.id, bi, v)} placeholder="Accomplished [X] by [Y], resulting in [Z]" rows={2} />
                    <button onClick={() => removeExpBullet(exp.id, bi)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", padding: "12px 0 0 0", flexShrink: 0, transition: "color 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#666666"; }}>
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <AddBtn onClick={() => addExpBullet(exp.id)} label="+ Add bullet" />
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={() => updateData(d => ({ ...d, experience: d.experience.map(e => e.id === exp.id ? { ...e, pageBreakBefore: !e.pageBreakBefore } : e) }))}
                      style={{ background: 'transparent', border: `1px solid ${exp.pageBreakBefore ? '#2563eb' : '#333333'}`, color: exp.pageBreakBefore ? '#ffffff' : '#666666', fontSize: '10px', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s' }}
                      title="Toggle page break before this entry"
                    >
                      ⊞ Page break
                    </button>
                    <RemoveBtn onClick={() => removeExperience(exp.id)} />
                  </div>
                </div>
              </div>
              </div>
            ))}
          </SectionCard>

          {/* Education */}
          <SectionCard title="Education" action={<AddBtn onClick={addEducation} label="+ Add" />}>
            {data.education.length === 0 && (
              <p style={{ fontSize: "12px", color: "#888888", textAlign: "center", padding: "16px 0", margin: 0 }}>No education entries. Click "+ Add" to add one.</p>
            )}
            {data.education.map(edu => (
              <div key={edu.id} style={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <FieldLabel>Degree</FieldLabel>
                    <EditorInput value={edu.degree} onChange={v => updEdu(edu.id, "degree", v)} placeholder="B.S. Computer Science" />
                  </div>
                  <div>
                    <FieldLabel>Year</FieldLabel>
                    <EditorInput value={edu.year} onChange={v => updEdu(edu.id, "year", v)} placeholder="2020" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Institution</FieldLabel>
                    <EditorInput value={edu.institution} onChange={v => updEdu(edu.id, "institution", v)} placeholder="MIT" />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <RemoveBtn onClick={() => removeEducation(edu.id)} />
                </div>
              </div>
            ))}
          </SectionCard>

          {/* Skills */}
          <SectionCard title="Skills">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {data.skills.map(skill => (
                <span key={skill} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#262626", border: "1px solid #444444", borderRadius: "20px", padding: "4px 10px 4px 12px", fontSize: "12px", color: "#ffffff" }}>
                  {skill}
                  <button onClick={() => removeSkill(skill)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#888888", padding: 0, lineHeight: 1, display: "flex", alignItems: "center", transition: "color 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#888888"; }}>
                    <X style={{ width: 11, height: 11 }} />
                  </button>
                </span>
              ))}
            </div>
            <input
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              placeholder="Type a skill and press Enter…"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = "#2563eb"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#262626"; }}
            />
          </SectionCard>

          {/* Certifications */}
          <SectionCard title="Certifications">
            {data.certifications.map((cert, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                <EditorInput value={cert} onChange={v => updateData(d => ({ ...d, certifications: d.certifications.map((c, ci) => ci === i ? v : c) }))} placeholder="AWS Solutions Architect" />
                <button onClick={() => removeCert(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", flexShrink: 0, padding: 0, transition: "color 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#666666"; }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
            <input
              value={certInput}
              onChange={e => setCertInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCert(); } }}
              placeholder="Add certification and press Enter…"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = "#2563eb"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#262626"; }}
            />
          </SectionCard>

          <div style={{ height: "80px" }} />
        </div>
      )}

      {/* ── Sticky footer ── */}
      <div style={{ flexShrink: 0, padding: "12px 20px", borderTop: "1px solid #262626", background: "#141414", display: "flex", flexDirection: "column", gap: "8px" }}>
        {updateStatus === "error" && updateError && (
          <p style={{ fontSize: "12px", color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "8px 12px", margin: 0 }}>
            {updateError}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={handleReset}
            style={{ fontSize: "12px", color: "#888888", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px", transition: "color 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ffffff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#888888"; }}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Reset to original
          </button>
          <button onClick={handleUpdate} disabled={updateStatus === "updating"}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
              border: "none", cursor: updateStatus === "updating" ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "opacity 0.2s",
              background: updateStatus === "success" ? "#22c55e" : updateStatus === "error" ? "#ef4444" : "#2563eb",
              color: "#ffffff",
              opacity: updateStatus === "updating" ? 0.7 : 1,
            }}>
            {updateStatus === "updating" && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
            {updateStatus === "success" && <Check style={{ width: 14, height: 14 }} />}
            {updateStatus === "updating" ? "Updating…"
              : updateStatus === "success" ? "✓ Resume updated!"
              : updateStatus === "error" ? "Retry"
              : "✨ Update Preview →"}
          </button>
        </div>
      </div>
    </div>
  );
}
