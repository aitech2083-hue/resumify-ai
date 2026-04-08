import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Code2, FormInput, Loader2, Check } from "lucide-react";
import type { ResumeData, ExperienceEntry, SkillGroup, EducationEntry } from "@/lib/latex-resume";
import { parseLatex, buildLatex } from "@/lib/latex-resume";

interface ResumeEditorProps {
  latex: string;
  onSave: (updatedLatex: string) => Promise<{ success: boolean; error?: string }>;
  saving?: boolean;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-3 first:mt-0">
      <h3 className="text-sm font-bold uppercase tracking-wider text-primary">{title}</h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1">{children}</label>;
}

function Input({ value, onChange, placeholder, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[#0d1117] border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all ${className}`}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-[#0d1117] border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
    />
  );
}

type ApplyStatus = "idle" | "applying" | "success" | "error";

export function ResumeEditor({ latex, onSave, saving: _saving }: ResumeEditorProps) {
  const [data, setData] = useState<ResumeData>(() => parseLatex(latex));
  const [rawMode, setRawMode] = useState(false);
  const [rawLatex, setRawLatex] = useState(latex);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>("idle");
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    setData(parseLatex(latex));
    setRawLatex(latex);
  }, [latex]);

  const update = useCallback((fn: (d: ResumeData) => ResumeData) => {
    setData(prev => fn({ ...prev }));
  }, []);

  const handleSave = async () => {
    if (applyStatus === "applying") return;
    setApplyStatus("applying");
    setApplyError(null);
    const latexToSave = rawMode ? rawLatex : buildLatex(data, latex);
    const result = await onSave(latexToSave);
    if (result.success) {
      setApplyStatus("success");
      setTimeout(() => setApplyStatus("idle"), 2000);
    } else {
      setApplyStatus("error");
      setApplyError(result.error ?? "Could not compile. Check LaTeX syntax.");
    }
  };

  const updateExp = (idx: number, field: keyof ExperienceEntry, value: any) => {
    update(d => {
      const exp = [...d.experience];
      exp[idx] = { ...exp[idx], [field]: value };
      return { ...d, experience: exp };
    });
  };

  const updateBullet = (expIdx: number, bulletIdx: number, value: string) => {
    update(d => {
      const exp = [...d.experience];
      const bullets = [...exp[expIdx].bullets];
      bullets[bulletIdx] = value;
      exp[expIdx] = { ...exp[expIdx], bullets };
      return { ...d, experience: exp };
    });
  };

  const addBullet = (expIdx: number) => {
    update(d => {
      const exp = [...d.experience];
      exp[expIdx] = { ...exp[expIdx], bullets: [...exp[expIdx].bullets, ""] };
      return { ...d, experience: exp };
    });
  };

  const removeBullet = (expIdx: number, bulletIdx: number) => {
    update(d => {
      const exp = [...d.experience];
      const bullets = exp[expIdx].bullets.filter((_, i) => i !== bulletIdx);
      exp[expIdx] = { ...exp[expIdx], bullets };
      return { ...d, experience: exp };
    });
  };

  const addExperience = () => {
    update(d => ({
      ...d,
      experience: [...d.experience, { title: "", company: "", location: "", dates: "", bullets: [""] }],
    }));
  };

  const removeExperience = (idx: number) => {
    update(d => ({
      ...d,
      experience: d.experience.filter((_, i) => i !== idx),
    }));
  };

  const updateSkill = (idx: number, field: keyof SkillGroup, value: string) => {
    update(d => {
      const skills = [...d.skills];
      skills[idx] = { ...skills[idx], [field]: value };
      return { ...d, skills };
    });
  };

  const addSkill = () => {
    update(d => ({ ...d, skills: [...d.skills, { category: "", items: "" }] }));
  };

  const removeSkill = (idx: number) => {
    update(d => ({ ...d, skills: d.skills.filter((_, i) => i !== idx) }));
  };

  const updateEdu = (idx: number, field: keyof EducationEntry, value: string) => {
    update(d => {
      const education = [...d.education];
      education[idx] = { ...education[idx], [field]: value };
      return { ...d, education };
    });
  };

  const addEducation = () => {
    update(d => ({
      ...d,
      education: [...d.education, { degree: "", school: "", location: "", dates: "", details: "" }],
    }));
  };

  const removeEducation = (idx: number) => {
    update(d => ({ ...d, education: d.education.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-border/50">
        <div className="flex items-center gap-1 bg-surface/50 rounded-lg p-0.5">
          <button
            onClick={() => setRawMode(false)}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              !rawMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FormInput className="w-3.5 h-3.5" /> Visual
          </button>
          <button
            onClick={() => {
              if (!rawMode) {
                setRawLatex(buildLatex(data, latex));
              }
              setRawMode(true);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              rawMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> LaTeX
          </button>
        </div>
      </div>

      {rawMode ? (
        <textarea
          value={rawLatex}
          onChange={e => setRawLatex(e.target.value)}
          className="flex-1 w-full bg-[#0d1117] text-[#c9d1d9] font-mono text-sm leading-relaxed p-5 resize-none outline-none border-0 custom-scrollbar"
          spellCheck={false}
          placeholder="% LaTeX resume source"
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-1 custom-scrollbar">

          <SectionHeader title="Personal Info" />
          <div className="space-y-2">
            <div>
              <FieldLabel>Full Name</FieldLabel>
              <Input value={data.name} onChange={v => update(d => ({ ...d, name: v }))} placeholder="John Doe" />
            </div>
            <div>
              <FieldLabel>Contact (email, phone, location, LinkedIn — separated by |)</FieldLabel>
              <Input value={data.contactLine} onChange={v => update(d => ({ ...d, contactLine: v }))} placeholder="john@email.com | (555) 123-4567 | City, State" />
            </div>
          </div>

          <SectionHeader title="Professional Summary" />
          <TextArea
            value={data.summary}
            onChange={v => update(d => ({ ...d, summary: v }))}
            placeholder="Experienced software engineer with 8+ years..."
            rows={4}
          />

          <SectionHeader title="Work Experience" />
          {data.experience.map((exp, i) => (
            <div key={i} className="bg-surface/30 border border-border rounded-xl p-4 mb-3 space-y-2 group relative">
              <button
                onClick={() => removeExperience(i)}
                className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Job Title</FieldLabel>
                  <Input value={exp.title} onChange={v => updateExp(i, "title", v)} placeholder="Software Engineer" />
                </div>
                <div>
                  <FieldLabel>Dates</FieldLabel>
                  <Input value={exp.dates} onChange={v => updateExp(i, "dates", v)} placeholder="Jan 2020 – Present" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Company</FieldLabel>
                  <Input value={exp.company} onChange={v => updateExp(i, "company", v)} placeholder="Google" />
                </div>
                <div>
                  <FieldLabel>Location</FieldLabel>
                  <Input value={exp.location} onChange={v => updateExp(i, "location", v)} placeholder="Mountain View, CA" />
                </div>
              </div>
              <div>
                <FieldLabel>Achievements / Bullets</FieldLabel>
                <div className="space-y-1.5">
                  {exp.bullets.map((bullet, bi) => (
                    <div key={bi} className="flex gap-2 items-start">
                      <span className="mt-2.5 text-muted-foreground/40 text-xs">{"\u2022"}</span>
                      <textarea
                        value={bullet}
                        onChange={e => updateBullet(i, bi, e.target.value)}
                        rows={2}
                        className="flex-1 bg-[#0d1117] border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                        placeholder="Accomplished [X] by [Y], resulting in [Z]"
                      />
                      <button
                        onClick={() => removeBullet(i, bi)}
                        className="mt-2 p-1 text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addBullet(i)}
                    className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 mt-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add bullet
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addExperience}
            className="w-full py-2.5 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-primary hover:border-primary/50 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Experience
          </button>

          <SectionHeader title="Skills" />
          {data.skills.map((sg, i) => (
            <div key={i} className="flex gap-2 items-start mb-2 group">
              <div className="w-1/3">
                <Input value={sg.category} onChange={v => updateSkill(i, "category", v)} placeholder="Category" />
              </div>
              <div className="flex-1">
                <Input value={sg.items} onChange={v => updateSkill(i, "items", v)} placeholder="Python, JavaScript, React, ..." />
              </div>
              <button
                onClick={() => removeSkill(i)}
                className="mt-2 p-1 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={addSkill}
            className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add skill category
          </button>

          <SectionHeader title="Education" />
          {data.education.map((edu, i) => (
            <div key={i} className="bg-surface/30 border border-border rounded-xl p-4 mb-3 space-y-2 group relative">
              <button
                onClick={() => removeEducation(i)}
                className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Degree</FieldLabel>
                  <Input value={edu.degree} onChange={v => updateEdu(i, "degree", v)} placeholder="BS Computer Science" />
                </div>
                <div>
                  <FieldLabel>Dates</FieldLabel>
                  <Input value={edu.dates} onChange={v => updateEdu(i, "dates", v)} placeholder="2016 – 2020" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>School</FieldLabel>
                  <Input value={edu.school} onChange={v => updateEdu(i, "school", v)} placeholder="MIT" />
                </div>
                <div>
                  <FieldLabel>Location</FieldLabel>
                  <Input value={edu.location} onChange={v => updateEdu(i, "location", v)} placeholder="Cambridge, MA" />
                </div>
              </div>
              <div>
                <FieldLabel>Additional Details (GPA, honors, etc.)</FieldLabel>
                <Input value={edu.details} onChange={v => updateEdu(i, "details", v)} placeholder="GPA: 3.8, Magna Cum Laude" />
              </div>
            </div>
          ))}
          <button
            onClick={addEducation}
            className="w-full py-2.5 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-primary hover:border-primary/50 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Education
          </button>

          {data.certifications.length > 0 && (
            <>
              <SectionHeader title="Certifications" />
              {data.certifications.map((cert, i) => (
                <div key={i} className="flex gap-2 items-center mb-2 group">
                  <Input
                    value={cert}
                    onChange={v =>
                      update(d => {
                        const certs = [...d.certifications];
                        certs[i] = v;
                        return { ...d, certifications: certs };
                      })
                    }
                    placeholder="AWS Solutions Architect"
                  />
                  <button
                    onClick={() =>
                      update(d => ({
                        ...d,
                        certifications: d.certifications.filter((_, idx) => idx !== i),
                      }))
                    }
                    className="p-1 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}

          {data.customSections.length > 0 && (
            <>
              <SectionHeader title="Other Sections" />
              <p className="text-xs text-muted-foreground mb-2">
                These sections are preserved from your resume. Switch to LaTeX mode to edit them.
              </p>
              {data.customSections.map((cs, i) => (
                <div key={i} className="bg-surface/20 border border-border/50 rounded-lg px-4 py-3 mb-2">
                  <span className="text-sm font-medium text-foreground/80">{cs.title}</span>
                </div>
              ))}
            </>
          )}

          <div className="h-4" />
        </div>
      )}

      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-surface/50 space-y-2">
        {applyStatus === "error" && applyError && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">
            {applyError}
          </p>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={applyStatus === "applying"}
            className={[
              "px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-md",
              applyStatus === "success"
                ? "bg-success text-white"
                : applyStatus === "error"
                  ? "bg-destructive/90 text-white hover:bg-destructive"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              applyStatus === "applying" ? "opacity-70 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {applyStatus === "applying" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {applyStatus === "success" && <Check className="w-3.5 h-3.5" />}
            {applyStatus === "applying" && "Applying…"}
            {applyStatus === "success" && "✓ Applied!"}
            {applyStatus === "error" && "Retry"}
            {applyStatus === "idle" && "Apply Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
