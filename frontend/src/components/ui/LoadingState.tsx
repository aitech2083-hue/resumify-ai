import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Analysing JD keywords & ATS gaps...",
  "Tailoring resume with XYZ metrics...",
  "Writing cover letter & outreach email...",
  "Rewriting LinkedIn headline & About..."
];

export function LoadingState() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // Cycle through steps artificially to give user feedback
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= STEPS.length - 1) return prev;
        return prev + 1;
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-500">
      <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
        <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-r-2 border-primary/50 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shadow-glow">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </div>

      <h3 className="text-xl font-display font-semibold text-foreground mb-2">
        Crafting your career narrative
      </h3>
      <p className="text-muted-foreground max-w-sm mb-8">
        Claude is analyzing your experience against the target roles to build highly optimized materials.
      </p>

      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-xl space-y-4 text-left">
        {STEPS.map((step, i) => {
          const isCompleted = i < activeStep;
          const isActive = i === activeStep;
          const isPending = i > activeStep;

          return (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: isPending ? 0.4 : 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "flex items-center gap-3",
                isActive && "text-primary font-medium"
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : isActive ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : (
                <CircleDashed className="w-5 h-5 text-muted-foreground" />
              )}
              <span className={cn(
                "text-sm",
                isCompleted ? "text-muted-foreground" : 
                isActive ? "text-foreground" : 
                "text-muted-foreground"
              )}>
                {step}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
