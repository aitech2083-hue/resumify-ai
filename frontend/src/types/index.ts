export type Mode = "upload" | "linkedin" | "scratch";
export type Tone = "formal" | "warm" | "concise";

export interface JD {
  id: string;
  title: string;
  company: string;
  text: string;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  duration: string;
  resp: string;
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  month: string;
  year: string;
}

export interface ScratchData {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  skills: string;
  experiences: Experience[];
  education: Education[];
  certifications: string;
}

export interface AtsScore {
  score: number;
  breakdown: string;
}

export interface HealthCheck {
  name: string;
  passed: boolean;
  score: number;
  tip: string;
}

export interface HealthScore {
  overall: number;
  checks: HealthCheck[];
}

export interface JobFitDimension {
  name: string;
  score: number;
  label: string;
}

export interface JobFitGap {
  skill: string;
  severity: string;
  fix: string;
}

export interface JobFit {
  grade: string;
  score: number;
  verdict: string;
  shouldApply: boolean;
  dimensions: JobFitDimension[];
  gaps: JobFitGap[];
}

export interface AtsBreakdown {
  skills_match: number;
  experience_match: number;
  title_match: number;
  top_keywords: string[];
  missing_keywords: string[];
  verdict: string;
}

export interface QuickWins {
  rewritten_headline: string;
  rewritten_summary: string;
  top_3_changes: string[];
}

export interface ReferralPerson {
  id: number;
  name: string;
  title: string;
  company: string;
  duration: string | null;
  city: string;
  country: string;
  photo: string | null;
  linkedinUrl: string;
  skills: string[];
  email: null;
}

export interface ReferralTabState {
  people: ReferralPerson[];
  loading: boolean;
  error: string | null;
  searched: boolean;
}

export interface ResumePersonalInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
}

export interface ResumeExperience {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
  pageBreakBefore: boolean;
}

export interface ResumeEducation {
  id: string;
  degree: string;
  institution: string;
  year: string;
}

export interface ResumeData {
  personalInfo: ResumePersonalInfo;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
  certifications: string[];
}

export interface JobResult {
  jdIndex: number;
  company: string;
  jobTitle: string;
  latex: string;
  atsOriginal: AtsScore;
  atsTailored: AtsScore;
  matched_keywords: string[];
  missing_keywords: string[];
  email: string;
  coverLetter: string;
  healthScore: HealthScore | null;
  jobFit: JobFit | null;
  resumeData: ResumeData | null;
  atsBreakdown?: AtsBreakdown | null;
  quickWins?: QuickWins | null;
}

export interface LinkedInContent {
  headline: string;
  about: string;
}

export interface GenerateResponse {
  results: JobResult[];
  linkedin: LinkedInContent;
}

export interface HistoryItem {
  id: string;
  date: string;
  jds: JD[];
  response: GenerateResponse;
}
