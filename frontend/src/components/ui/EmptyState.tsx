import { FileText, Sparkles } from "lucide-react";

export function EmptyState() {
  return (
    <div className="relative flex flex-col items-center justify-center h-full p-8 text-center overflow-hidden">
      {/* Background illustration */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-screen flex items-center justify-center">
        <img 
          src={`${import.meta.env.BASE_URL}images/empty-state-bg.png`} 
          alt="Abstract background" 
          className="w-full h-full object-cover"
        />
      </div>
      
      <div className="relative z-10 w-24 h-24 bg-surface/50 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(240,160,32,0.1)] border border-primary/20">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      
      <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
        Ready to tailor your resume?
      </h2>
      
      <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
        Upload your existing resume or build from scratch, paste up to 3 target job descriptions, and let AI generate a perfectly tailored application package.
      </p>
      
      <div className="flex gap-4 opacity-60">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border text-sm">
          <FileText className="w-4 h-4" /> LaTeX Resume
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border text-sm">
          <span className="text-lg leading-none">📊</span> ATS Score
        </div>
      </div>
    </div>
  );
}
