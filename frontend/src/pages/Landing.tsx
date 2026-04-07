import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import {
  Upload, Wand2, Download, Zap, Target, FileText,
  Mail, Linkedin, BarChart3, Bot, ArrowRight, Check,
  Star, ChevronRight, Sparkles, Shield, Clock, Sun, Moon
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

// ── Animation helpers ──────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

function AnimateIn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FadeItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--rz-bg)]/90 backdrop-blur-xl border-b border-[var(--rz-border)]/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-[var(--rz-accent)] flex items-center justify-center shadow-lg">
            <Sparkles className="w-4 h-4 text-[var(--rz-accent-text)]" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[var(--rz-text)] font-display">
            Rez<span className="text-[var(--rz-accent)]">AI</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {["Features", "How it works", "Testimonials"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              className="text-sm text-[var(--rz-text)]/60 hover:text-[var(--rz-text)] transition-colors duration-200"
            >
              {item}
            </a>
          ))}
        </div>

        {/* Right: theme toggle + CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--rz-border)] bg-[var(--rz-surface)] text-[var(--rz-muted)] hover:text-[var(--rz-text)] hover:border-[var(--rz-muted)] transition-colors"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--rz-accent)] text-[var(--rz-accent-text)] font-semibold text-sm hover:bg-[var(--rz-accent)]/90 transition-all duration-200 hover:-translate-y-0.5"
          >
            Try Free
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[var(--rz-accent)]/5 blur-[120px]" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-[var(--rz-accent)]/8 blur-[80px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px]" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--rz-accent) 1px, transparent 1px), linear-gradient(90deg, var(--rz-accent) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24 pb-16">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--rz-accent)]/30 bg-[var(--rz-accent)]/10 text-[var(--rz-accent)] text-sm font-medium mb-8"
        >
          <Zap className="w-3.5 h-3.5" />
          AI-powered resume tailoring in seconds
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="text-5xl md:text-7xl font-bold tracking-tight text-[var(--rz-text)] font-display leading-[1.05] mb-6"
        >
          Get more interviews.
          <br />
          <span className="text-gradient-gold">
            Stop rewriting
          </span>
          <br />
          your resume.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-lg md:text-xl text-[var(--rz-text)]/55 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Upload your resume + paste a job description = tailored resume, cover letter,
          outreach email and LinkedIn rewrite in 2 minutes.{" "}
          <span className="text-[var(--rz-text)]/75 font-medium">Free. No login needed.</span>
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/app"
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--rz-accent)] text-[var(--rz-accent-text)] font-bold text-base hover:bg-[var(--rz-accent)]/90 transition-all duration-200 hover:-translate-y-1"
          >
            Build my resume free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-[var(--rz-border)] text-[var(--rz-text)]/70 font-medium text-base hover:border-[var(--rz-muted)] hover:text-[var(--rz-text)] transition-all duration-200"
          >
            See how it works
          </a>
        </motion.div>

        {/* Stat bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-10 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--rz-text)]/40"
        >
          <span className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-[var(--rz-accent)] text-[var(--rz-accent)]" />
            Used by 1,200+ job seekers
          </span>
          <span className="hidden sm:block text-[var(--rz-text)]/15">·</span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[var(--rz-accent)]" />
            Free forever
          </span>
          <span className="hidden sm:block text-[var(--rz-text)]/15">·</span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[var(--rz-accent)]" />
            No login needed
          </span>
        </motion.div>
      </div>
    </section>
  );
}

// ── How it works ───────────────────────────────────────────────────────────
const steps = [
  {
    number: "01",
    icon: <Upload className="w-6 h-6" />,
    title: "Upload your resume",
    description:
      "Drop your existing resume as a PDF, paste your LinkedIn export, or build one from scratch using our guided form. No account needed.",
  },
  {
    number: "02",
    icon: <Target className="w-6 h-6" />,
    title: "Paste the job description",
    description:
      "Copy-paste the job description for any role you're targeting. Add up to 3 roles at once and get a separate tailored package for each.",
  },
  {
    number: "03",
    icon: <Download className="w-6 h-6" />,
    title: "Get your full package in 2 minutes",
    description:
      "Instantly receive a tailored resume, cover letter, outreach email, and LinkedIn rewrite — ATS-optimised and ready to send. Download as PDF or Word.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <AnimateIn className="text-center mb-16">
          <FadeItem>
            <p className="text-[var(--rz-accent)] font-semibold text-sm uppercase tracking-widest mb-3">
              How it works
            </p>
          </FadeItem>
          <FadeItem>
            <h2 className="text-4xl md:text-5xl font-bold text-[var(--rz-text)] font-display tracking-tight">
              From resume to offer in{" "}
              <span className="text-gradient-gold">three steps</span>
            </h2>
          </FadeItem>
        </AnimateIn>

        <AnimateIn className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-12 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-transparent via-[var(--rz-accent)]/30 to-transparent" />

          {steps.map((step) => (
            <FadeItem key={step.number}>
              <div className="relative p-8 rounded-2xl border border-[var(--rz-card-border)] bg-[var(--rz-card-bg)] hover:border-[var(--rz-card-hover-border)] hover:bg-[var(--rz-surface)] transition-all duration-300 group">
                {/* Step number */}
                <div className="absolute -top-4 left-8 text-[var(--rz-accent)]/20 font-bold text-6xl font-display leading-none select-none group-hover:text-[var(--rz-accent)]/30 transition-colors">
                  {step.number}
                </div>
                <div className="w-12 h-12 rounded-xl bg-[var(--rz-accent)]/10 border border-[var(--rz-accent)]/20 flex items-center justify-center text-[var(--rz-accent)] mb-5 mt-4 group-hover:bg-[var(--rz-accent)]/20 transition-colors">
                  {step.icon}
                </div>
                <h3 className="text-lg font-semibold text-[var(--rz-text)] mb-2 font-display">
                  {step.title}
                </h3>
                <p className="text-[var(--rz-text)]/50 text-sm leading-relaxed">{step.description}</p>
              </div>
            </FadeItem>
          ))}
        </AnimateIn>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────
const features = [
  {
    icon: <FileText className="w-5 h-5" />,
    title: "ATS-optimised resumes",
    description:
      "Every resume is scored before and after tailoring. RezAI targets 80%+ keyword match to beat applicant tracking systems every time.",
  },
  {
    icon: <Wand2 className="w-5 h-5" />,
    title: "One-click cover letters",
    description:
      "Get a 300-word cover letter that opens with your strongest achievement and directly addresses what the employer needs.",
  },
  {
    icon: <Mail className="w-5 h-5" />,
    title: "Cold outreach emails",
    description:
      "A punchy, under-200-word cold email with a clear hook, matched metrics, and a strong call to action — ready to send.",
  },
  {
    icon: <Linkedin className="w-5 h-5" />,
    title: "LinkedIn headline & About",
    description:
      "Rewrite your LinkedIn profile with keyword-rich headline and a compelling About section that gets you found by recruiters.",
  },
  {
    icon: <Bot className="w-5 h-5" />,
    title: "AI refinement chat",
    description:
      "Not quite right? Chat with RezAI to fine-tune any section. Ask it to change tone, add keywords, or shorten bullets.",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Multi-role in one go",
    description:
      "Apply to up to 3 different roles simultaneously. Each output is independently tailored — no generic copy-paste.",
  },
];

function Features() {
  return (
    <section id="features" className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <AnimateIn className="text-center mb-16">
          <FadeItem>
            <p className="text-[var(--rz-accent)] font-semibold text-sm uppercase tracking-widest mb-3">
              Features
            </p>
          </FadeItem>
          <FadeItem>
            <h2 className="text-4xl md:text-5xl font-bold text-[var(--rz-text)] font-display tracking-tight">
              Everything you need to{" "}
              <span className="text-gradient-gold">land the role</span>
            </h2>
          </FadeItem>
          <FadeItem>
            <p className="text-[var(--rz-text)]/50 mt-4 text-lg max-w-xl mx-auto">
              One tool replaces five. Resume writer, ATS checker, cover letter generator, LinkedIn
              optimiser, and outreach coach — all in one.
            </p>
          </FadeItem>
        </AnimateIn>

        <AnimateIn className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <FadeItem key={f.title}>
              <div className="p-6 rounded-2xl border border-[var(--rz-card-border)] bg-[var(--rz-card-bg)] hover:border-[var(--rz-card-hover-border)] hover:bg-[var(--rz-surface)] transition-all duration-300 group h-full">
                <div className="w-10 h-10 rounded-lg bg-[var(--rz-accent)]/10 border border-[var(--rz-accent)]/20 flex items-center justify-center text-[var(--rz-accent)] mb-4 group-hover:bg-[var(--rz-accent)]/20 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-[var(--rz-text)] mb-2 font-display">
                  {f.title}
                </h3>
                <p className="text-[var(--rz-text)]/45 text-sm leading-relaxed">{f.description}</p>
              </div>
            </FadeItem>
          ))}
        </AnimateIn>
      </div>
    </section>
  );
}

// ── Testimonials ───────────────────────────────────────────────────────────
const testimonials = [
  {
    stars: 5,
    quote: "ATS score went from 42 to 87. Got shortlisted in 3 days.",
    name: "Priya S.",
    role: "Software Engineer",
    location: "Bangalore",
  },
  {
    stars: 5,
    quote: "Used to spend hours rewriting resume. Now takes 2 minutes.",
    name: "Rahul M.",
    role: "MBA Graduate",
    location: "Mumbai",
  },
  {
    stars: 5,
    quote: "The outreach email feature got me 4 recruiter replies in one week.",
    name: "Ananya K.",
    role: "Marketing Manager",
    location: "Hyderabad",
  },
];

function Testimonials() {
  return (
    <section id="testimonials" className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <AnimateIn className="text-center mb-16">
          <FadeItem>
            <p className="text-[var(--rz-accent)] font-semibold text-sm uppercase tracking-widest mb-3">
              Testimonials
            </p>
          </FadeItem>
          <FadeItem>
            <h2 className="text-4xl md:text-5xl font-bold text-[var(--rz-text)] font-display tracking-tight">
              Real results from{" "}
              <span className="text-gradient-gold">real job seekers</span>
            </h2>
          </FadeItem>
        </AnimateIn>

        <AnimateIn className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <FadeItem key={t.name}>
              <div className="p-7 rounded-2xl border border-[var(--rz-card-border)] bg-[var(--rz-card-bg)] hover:border-[var(--rz-card-hover-border)] transition-all duration-300 flex flex-col h-full">
                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[var(--rz-accent)] text-[var(--rz-accent)]" />
                  ))}
                </div>
                {/* Quote */}
                <p className="text-[var(--rz-text)]/65 text-sm leading-relaxed flex-1 mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--rz-accent)]/20 flex items-center justify-center text-[var(--rz-accent)] font-bold text-sm font-display">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[var(--rz-text)] font-semibold text-sm">{t.name}</p>
                    <p className="text-[var(--rz-text)]/40 text-xs">{t.role} · {t.location}</p>
                  </div>
                </div>
              </div>
            </FadeItem>
          ))}
        </AnimateIn>
      </div>
    </section>
  );
}

// ── CTA Banner ─────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <AnimateIn>
          <FadeItem>
            <div className="relative rounded-3xl border border-[var(--rz-accent)]/20 bg-[var(--rz-accent)]/5 p-12 text-center overflow-hidden">
              {/* Glow */}
              <div className="absolute inset-0 rounded-3xl bg-[var(--rz-accent)]/3 blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold text-[var(--rz-text)] font-display tracking-tight mb-4">
                  Ready to get{" "}
                  <span className="text-gradient-gold">more interviews?</span>
                </h2>
                <p className="text-[var(--rz-text)]/50 text-lg mb-8 max-w-xl mx-auto">
                  Stop sending generic applications. Let RezAI tailor every word to every role —
                  in under 2 minutes.
                </p>
                <Link
                  href="/app"
                  className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--rz-accent)] text-[var(--rz-accent-text)] font-bold text-base hover:bg-[var(--rz-accent)]/90 transition-all duration-200 hover:-translate-y-1"
                >
                  Start for free — no login needed
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <div className="mt-6 flex items-center justify-center gap-6 text-sm text-[var(--rz-text)]/35">
                  {[
                    { icon: <Clock className="w-3.5 h-3.5" />, label: "Ready in 60 seconds" },
                    { icon: <Check className="w-3.5 h-3.5 text-[var(--rz-accent)]" />, label: "PDF & Word export" },
                    { icon: <Zap className="w-3.5 h-3.5" />, label: "Powered by Claude AI" },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="text-[var(--rz-accent)]/60">{icon}</span>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeItem>
        </AnimateIn>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-[var(--rz-border)]/50 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--rz-accent)] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[var(--rz-accent-text)]" />
          </div>
          <span className="text-lg font-bold text-[var(--rz-text)] font-display">
            Rez<span className="text-[var(--rz-accent)]">AI</span>
          </span>
        </div>

        <p className="text-[var(--rz-text)]/30 text-sm text-center">
          &copy; {new Date().getFullYear()} RezAI. Built with Claude AI.
        </p>

        <div className="flex items-center gap-6 text-sm text-[var(--rz-text)]/40">
          <Link href="/app" className="hover:text-[var(--rz-accent)] transition-colors">
            Launch App
          </Link>
          <a
            href="#features"
            className="hover:text-[var(--rz-text)]/70 transition-colors"
          >
            Features
          </a>
        </div>
      </div>
    </footer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--rz-bg)] text-[var(--rz-text)]">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <Testimonials />
      <CTABanner />
      <Footer />
    </div>
  );
}
