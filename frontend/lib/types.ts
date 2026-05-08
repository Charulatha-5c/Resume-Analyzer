export type ParsedJob = {
  company?: string | null;
  title?: string | null;
  start?: string | null;
  end?: string | null;
  description?: string | null;
};

export type ParsedEducation = {
  college?: string | null;
  degree?: string | null;
  year?: string | null;
};

export type ParsedResume = {
  name?: string | null;
  email?: string | null;
  contact?: string | null;
  total_experience_years?: number | null;
  skills?: string[];
  previous_jobs?: ParsedJob[];
  education?: ParsedEducation[];
  certifications?: string[];
  summary?: string | null;
  error?: string;
  raw_excerpt?: string;
};

export type Candidate = {
  candidate_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  cover_letter: string | null;
  cv_drive_link: string | null;
  llm_score: number;
  reason: string;
  parsed_resume: ParsedResume;
  created_at: string | null;
  updated_at: string | null;
};
