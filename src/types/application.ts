export type ApplicationStatus =
  'submitted' | 'under_review' | 'shortlisted' | 'rejected' | 'withdrawn';
export const statusLabels: Record<ApplicationStatus, string> = {
  submitted: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  rejected: 'Not Selected',
  withdrawn: 'Withdrawn',
};
export interface ApplicationSnapshot {
  match_score: number;
  // MySQL DECIMAL values arrive as strings; SQLite returns numbers.
  semantic_score: number | string;
  skills_score: number | string;
  location_score: number | string;
  education_score: number | string;
  experience_score: number | string;
  matched_skills: string[];
  missing_skills: string[];
}
export interface ResumeResponse {
  available: boolean;
  original_filename?: string;
}
export interface Applicant extends ApplicationSnapshot {
  id: string;
  job_id: string;
  full_name: string;
  title: string;
  company_name: string;
  status: ApplicationStatus;
  applied_at: number;
  updated_at: number;
  resume: ResumeResponse;
  profile: {
    province?: string;
    municipality?: string;
    education?: string;
    course?: string;
    skills?: string[];
    recent_job_title?: string;
    experience_snippets?: string[];
  };
}
export type ApplicantDetail = Applicant;
export interface Application extends ApplicationSnapshot {
  id: string;
  title: string;
  company_name: string;
  municipality: string;
  province: string;
  status: ApplicationStatus;
  applied_at: number;
}
export interface JobDetailResponse {
  job: {
    title: string;
    company_name: string;
    municipality: string;
    province: string;
    description: string;
  };
  match: { match_percentage: number } | null;
  applied: boolean;
}
