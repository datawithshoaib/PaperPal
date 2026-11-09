export type ExplanationLevel = "beginner" | "undergraduate" | "graduate" | "expert";
export type PaperStatus = "queued" | "processing" | "ready" | "failed";

export interface PaperAnalysis {
  tldr: string;
  summary: string;
  problem_statement: string;
  contributions: string[];
  methodology: string;
  experiments: string;
  key_findings: string[];
  limitations: string[];
  keywords: string[];
  source?: "llm" | "extractive";
  model?: string;
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  arxiv_id: string | null;
  source_url: string | null;
  page_count: number;
  status: PaperStatus;
  error_code: string | null;
  analysis: Partial<PaperAnalysis>;
  created_at: string;
  job_id: string | null;
}

export interface Job {
  id: string;
  paper_id: string;
  status: PaperStatus | "completed";
  stage: string;
  attempts: number;
  error_code: string | null;
}

export interface Section {
  title: string;
  section_type: string;
  page_start: number;
  page_end: number;
  chunk_count: number;
}

export interface Citation {
  ref: string;
  chunk_id: string;
  section: string;
  page_start: number;
  page_end: number;
  quote: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  task?: string | null;
  insufficient_evidence?: boolean;
  streaming?: boolean;
  stage?: string;
  error?: boolean;
  rated?: "helpful" | "unhelpful";
}

export interface ConversationSummary {
  id: string;
  paper_id: string;
  title: string;
  updated_at: string;
}

export interface Conversation extends ConversationSummary {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: Citation[];
    task: string | null;
    insufficient_evidence: boolean;
  }>;
}

export interface RelatedPaper {
  key: string;
  title: string;
  url: string | null;
  abstract: string;
  authors: string[];
  year: number | null;
  relation: "cites" | "cited_by" | "similar_to";
  verified_citation: boolean;
  source: string;
}

export interface GraphData {
  nodes: Array<{
    id: string;
    title: string;
    url: string | null;
    year: number | null;
    kind: "root" | "paper";
    relation: RelatedPaper["relation"] | null;
  }>;
  edges: Array<{ source: string; target: string; relation: RelatedPaper["relation"]; verified: boolean }>;
  notice: string;
}

export interface AuthConfig {
  demo_enabled: boolean;
  demo_email: string | null;
  supabase_enabled: boolean;
  llm_enabled: boolean;
  llm_model: string | null;
}

export interface AppUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl?: string | null;
  isDemo: boolean;
}
