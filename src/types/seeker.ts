export interface SeekerCompany {
  id: string;
  company_name: string;
  industry: string;
  description: string;
  province: string;
  municipality: string;
  website: string | null;
  open_jobs: number;
  contact_person?: string;
  contact_position?: string;
  company_size?: string;
}

export interface SeekerJob {
  id: string;
  employer_id: string;
  company_id: string;
  title: string;
  company_name: string;
  description: string;
  industry: string;
  province: string;
  municipality: string;
  employment_type: string;
  work_setup: string;
  salary_min: number | null;
  salary_max: number | null;
  required_skills: string[];
  preferred_skills: string[];
  education_required: string | null;
  experience_required: number;
  status: string;
  created_at: number;
  updated_at?: number;
  vacancies: number;
  application_deadline: number | null;
  verification_status: string;
  company: SeekerCompany;
  match_percentage?: number;
  matched_skills?: string[];
  missing_skills?: string[];
}

export interface SeekerNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  href: string | null;
  type: string | null;
  created_at: number;
  read_at: number | null;
}

export interface SeekerConversation {
  id: string;
  application_id: string;
  job_title: string;
  other_name: string;
  last_message: string | null;
  updated_at: number;
  unread_count: number;
}

export interface SeekerMessage {
  id: string;
  body: string;
  sender_id: string;
  sender_name: string;
  created_at: number;
  is_own: boolean;
}

export interface ProfessionalProfile {
  about: string;
  course: string;
  recent_job_title: string;
  experience_snippets: string[];
  experience_years: number;
  career_interests: string[];
  province: string;
  municipality: string;
  education: string;
  preferred_job: string;
  work_setup: string;
  skills: string[];
  willing_to_relocate?: boolean;
  resume: {
    id: string;
    original_filename: string;
    file_size: number;
    parsing_status: string;
    uploaded_at: number;
    parsed_at?: number;
  } | null;
}
