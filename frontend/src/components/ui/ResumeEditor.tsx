import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Code2, Pencil, Loader2, Check, X, RefreshCw } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
}

interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  year: string;
}

interface VisualResumeData {
  personalInfo: PersonalInfo;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: string[];
  certifications: string[];
}

export interface ResumeEditorProps {
  latex: string;
  jd?: { title?: string; company?: string; text?: string };
  onSave: (updatedLatex: string) => Promise<{ success: boolean; error?: string }>;
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
  background: "#070c18",
  border: "1px solid #1e304a",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "13px",
  color: "#e2ddd4",
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "#f0a020";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "#1e304a";
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, action, children }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#0c1626", border: "1px solid #1e304a", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#3a5070" }}>
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
    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#4a6080", marginBottom: "5px" }}>
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
    <button onClick={onClick} style={{ background: "none", border: "none", color: "#f0a020", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", padding: "2px 0", fontFamily: "inherit" }}>
      <Plus style={{ width: 13, height: 13 }} /> {label}
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: "none", border: "none", cursor: "pointer", color: hover ? "#ef4444" : "#3a5070", padding: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontFamily: "inherit", transition: "color 0.15s", flexShrink: 0 }}>
      <Trash2 style={{ width: 12, height: 12 }} /> Remove
    </button>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", background: active ? "#1e304a" : "transparent", color: active ? "#e2ddd4" : "#4a6080" }}>
      {icon} {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ParseStatus = "idle" | "loading" | "done" | "error";
type UpdateStatus = "idle" | "updating" | "success" | "error";

export function ResumeEditor({ latex, jd, onSave }: ResumeEditorProps) {
  const [mode, setMode] = useState<"visual" | "latex">("visual");
  const [data, setData] = useState<VisualResumeData>(EMPTY_DATA);
  const [rawLatex, setRawLatex] = useState(latex);
  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const parsedForLatex = useRef<string>("");

  // Auto-parse when entering visual mode for the first time
  useEffect(() => {
    if (mode !== "visual" || parseStatus !== "idle") return;
    doParseLatex();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, parseStatus]);

  // Reset parse state when latex prop changes (e.g. after agent edit)
  useEffect(() => {
    setRawLatex(latex);
    if (parsedForLatex.current !== latex) {
      setParseStatus("idle");
      parsedForLatex.current = "";
    }
  }, [latex]);

  const doParseLatex = async () => {
    if (parsedForLatex.current === latex && parseStatus === "done") return;
    setParseStatus("loading");
    try {
      const res = await fetch(`${BASE_URL}api/resume/parse-latex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex }),
      });
      if (!res.ok) throw new Error("Parse failed");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: { data: any } = await res.json();
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
    setData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, [field]: value } : e) }));
  const updExpBullet = (id: string, bi: number, v: string) =>
    setData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, bullets: e.bullets.map((b, i) => i === bi ? v : b) } : e) }));
  const addExpBullet = (id: string) =>
    setData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, bullets: [...e.bullets, ""] } : e) }));
  const removeExpBullet = (id: string, bi: number) =>
    setData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, bullets: e.bullets.filter((_, i) => i !== bi) } : e) }));
  const addExperience = () =>
    setData(d => ({ ...d, experience: [...d.experience, { id: uuidv4(), title: "", company: "", location: "", startDate: "", endDate: "", bullets: [""] }] }));
  const removeExperience = (id: string) => {
    if (!confirm("Remove this experience entry?")) return;
    setData(d => ({ ...d, experience: d.experience.filter(e => e.id !== id) }));
  };
  const updEdu = (id: string, field: keyof EducationEntry, v: string) =>
    setData(d => ({ ...d, education: d.education.map(e => e.id === id ? { ...e, [field]: v } : e) }));
  const addEducation = () =>
    setData(d => ({ ...d, education: [...d.education, { id: uuidv4(), degree: "", institution: "", year: "" }] }));
  const removeEducation = (id: string) =>
    setData(d => ({ ...d, education: d.education.filter(e => e.id !== id) }));
  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || data.skills.includes(s)) { setSkillInput(""); return; }
    setData(d => ({ ...d, skills: [...d.skills, s] }));
    setSkillInput("");
  };
  const removeSkill = (s: string) => setData(d => ({ ...d, skills: d.skills.filter(x => x !== s) }));
  const addCert = () => {
    const c = certInput.trim();
    if (!c) return;
    setData(d => ({ ...d, certifications: [...d.certifications, c] }));
    setCertInput("");
  };
  const removeCert = (i: number) => setData(d => ({ ...d, certifications: d.certifications.filter((_, idx) => idx !== i) }));

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
      // Visual mode: ask Claude to regenerate full LaTeX from structured data
      const regenRes = await fetch(`${BASE_URL}api/resume/regenerate-from-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData: data, jd, originalLatex: latex }),
      });
      if (!regenRes.ok) {
        const err = await regenRes.json().catch(() => null);
        throw new Error(err?.error || "Regeneration failed.");
      }
      const { latex: newLatex } = await regenRes.json();
      const result = await onSave(newLatex);
      if (result.success) { setUpdateStatus("success"); setTimeout(() => setUpdateStatus("idle"), 2500); }
      else { setUpdateStatus("error"); setUpdateError(result.error || "Could not compile the generated resume."); }
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
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#070c18" }}>

      {/* ── Tab bar ── */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid #1e304a", background: "#0c1626", gap: "4px" }}>
        <div style={{ display: "flex", gap: "2px", background: "#070c18", borderRadius: "8px", padding: "3px" }}>
          <TabButton active={mode === "visual"} onClick={() => setMode("visual")}
            icon={<Pencil style={{ width: 13, height: 13 }} />} label="Edit Resume" />
          <TabButton active={mode === "latex"} onClick={() => { setRawLatex(latex); setMode("latex"); }}
            icon={<Code2 style={{ width: 13, height: 13 }} />} label="LaTeX (Advanced)" />
        </div>
        {mode === "visual" && parseStatus === "error" && (
          <button onClick={doParseLatex} style={{ marginLeft: "auto", fontSize: "11px", color: "#f0a020", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px" }}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Retry
          </button>
        )}
      </div>

      {/* ── LaTeX mode ── */}
      {mode === "latex" ? (
        <textarea value={rawLatex} onChange={e => setRawLatex(e.target.value)}
          style={{ flex: 1, width: "100%", background: "#0d1117", color: "#c9d1d9", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6, padding: "20px", resize: "none", outline: "none", border: "none" }}
          spellCheck={false} placeholder="% LaTeX resume source"
          className="custom-scrollbar" />

      /* ── Loading ── */
      ) : parseStatus === "loading" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: "#4a6080" }}>
          <Loader2 style={{ width: 28, height: 28 }} className="animate-spin" />
          <p style={{ fontSize: "13px", margin: 0 }}>Loading editor…</p>
        </div>

      /* ── Parse error ── */
      ) : parseStatus === "error" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#4a6080" }}>
          <p style={{ fontSize: "13px", margin: 0 }}>Could not parse resume.</p>
          <button onClick={doParseLatex} style={{ fontSize: "12px", color: "#f0a020", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
        </div>

      /* ── Visual editor ── */
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0 20px" }} className="custom-scrollbar">

          {/* Personal Info */}
          <SectionCard title="Personal Information">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Full Name</FieldLabel>
                <EditorInput value={data.personalInfo.name} onChange={v => setData(d => ({ ...d, personalInfo: { ...d.personalInfo, name: v } }))} placeholder="John Doe" />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <EditorInput value={data.personalInfo.email} onChange={v => setData(d => ({ ...d, personalInfo: { ...d.personalInfo, email: v } }))} placeholder="john@example.com" type="email" />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <EditorInput value={data.personalInfo.phone} onChange={v => setData(d => ({ ...d, personalInfo: { ...d.personalInfo, phone: v } }))} placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <FieldLabel>Location</FieldLabel>
                <EditorInput value={data.personalInfo.location} onChange={v => setData(d => ({ ...d, personalInfo: { ...d.personalInfo, location: v } }))} placeholder="New York, NY" />
              </div>
              <div>
                <FieldLabel>LinkedIn URL</FieldLabel>
                <EditorInput value={data.personalInfo.linkedin} onChange={v => setData(d => ({ ...d, personalInfo: { ...d.personalInfo, linkedin: v } }))} placeholder="linkedin.com/in/johndoe" />
              </div>
            </div>
          </SectionCard>

          {/* Summary */}
          <SectionCard title="Professional Summary">
            <EditorTextarea value={data.summary} onChange={v => setData(d => ({ ...d, summary: v }))} placeholder="Results-driven professional with…" rows={4} />
          </SectionCard>

          {/* Experience */}
          <SectionCard title="Work Experience" action={<AddBtn onClick={addExperience} label="+ Add" />}>
            {data.experience.length === 0 && (
              <p style={{ fontSize: "12px", color: "#4a6080", textAlign: "center", padding: "16px 0", margin: 0 }}>No experience entries. Click "+ Add" to add one.</p>
            )}
            {data.experience.map(exp => (
              <div key={exp.id} style={{ background: "#070c18", border: "1px solid #1e304a", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
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
                    <span style={{ color: "#4a6080", marginTop: "13px", fontSize: "13px", flexShrink: 0 }}>•</span>
                    <EditorTextarea value={b} onChange={v => updExpBullet(exp.id, bi, v)} placeholder="Accomplished [X] by [Y], resulting in [Z]" rows={2} />
                    <button onClick={() => removeExpBullet(exp.id, bi)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#3a5070", padding: "12px 0 0 0", flexShrink: 0, transition: "color 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#3a5070"; }}>
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <AddBtn onClick={() => addExpBullet(exp.id)} label="+ Add bullet" />
                  <RemoveBtn onClick={() => removeExperience(exp.id)} />
                </div>
              </div>
            ))}
          </SectionCard>

          {/* Education */}
          <SectionCard title="Education" action={<AddBtn onClick={addEducation} label="+ Add" />}>
            {data.education.length === 0 && (
              <p style={{ fontSize: "12px", color: "#4a6080", textAlign: "center", padding: "16px 0", margin: 0 }}>No education entries. Click "+ Add" to add one.</p>
            )}
            {data.education.map(edu => (
              <div key={edu.id} style={{ background: "#070c18", border: "1px solid #1e304a", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
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
                <span key={skill} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#1e304a", border: "1px solid #2e4060", borderRadius: "20px", padding: "4px 10px 4px 12px", fontSize: "12px", color: "#e2ddd4" }}>
                  {skill}
                  <button onClick={() => removeSkill(skill)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#4a6080", padding: 0, lineHeight: 1, display: "flex", alignItems: "center", transition: "color 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4a6080"; }}>
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
              onFocus={e => { e.currentTarget.style.borderColor = "#f0a020"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#1e304a"; }}
            />
          </SectionCard>

          {/* Certifications */}
          <SectionCard title="Certifications">
            {data.certifications.map((cert, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                <EditorInput value={cert} onChange={v => setData(d => ({ ...d, certifications: d.certifications.map((c, ci) => ci === i ? v : c) }))} placeholder="AWS Solutions Architect" />
                <button onClick={() => removeCert(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#3a5070", flexShrink: 0, padding: 0, transition: "color 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#3a5070"; }}>
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
              onFocus={e => { e.currentTarget.style.borderColor = "#f0a020"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#1e304a"; }}
            />
          </SectionCard>

          <div style={{ height: "80px" }} />
        </div>
      )}

      {/* ── Sticky footer ── */}
      <div style={{ flexShrink: 0, padding: "12px 20px", borderTop: "1px solid #1e304a", background: "#0c1626", display: "flex", flexDirection: "column", gap: "8px" }}>
        {updateStatus === "error" && updateError && (
          <p style={{ fontSize: "12px", color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "8px 12px", margin: 0 }}>
            {updateError}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={handleReset}
            style={{ fontSize: "12px", color: "#4a6080", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px", transition: "color 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#e2ddd4"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4a6080"; }}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Reset to original
          </button>
          <button onClick={handleUpdate} disabled={updateStatus === "updating"}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
              border: "none", cursor: updateStatus === "updating" ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "opacity 0.2s",
              background: updateStatus === "success" ? "#22c55e" : updateStatus === "error" ? "#ef4444" : "#f0a020",
              color: "#070c18",
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
