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

export interface JobResult {
  jdIndex: number;
  company: string;
  jobTitle: string;
  latex: string;
  atsOriginal: AtsScore;
  atsTailored: AtsScore;
  email: string;
  coverLetter: string;
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
