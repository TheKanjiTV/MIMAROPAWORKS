import type { ApplicationStatus } from './application';
export interface RecommendedVacancy {
  id: string;
  title: string;
  company_name: string;
  industry: string;
  created_at: number;
  municipality: string;
  province: string;
  work_setup: string;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  match_percentage: number;
  semantic_engine: string;
  matched_skills: string[];
  missing_skills: string[];
  required_skills: string[];
  preferred_skills: string[];
}
export interface SkillGap {
  skill: string;
  priority: 'High Priority' | 'Useful to Develop' | 'Optional';
  priority_score: number;
  jobs: {
    id: string;
    title: string;
    importance: 'required' | 'preferred';
    match_percentage: number;
    why: string;
  }[];
}
export interface CareerSuggestion {
  id: string;
  title: string;
  description: string;
  industry: string;
  relevant_skills: string[];
  skills_to_develop: string[];
  similarity_percentage: number;
  semantic_engine: string;
}
export interface TrainingGuide {
  id: string;
  title: string;
  skill: string;
  category: string;
  description: string;
  provider: string;
  delivery_mode: string;
  catalog_note: string;
  activities: string[];
}
export interface SeekerHomeResponse {
  recommendations: RecommendedVacancy[];
  skills_gap: {
    evaluated_jobs: number;
    strong_skills: { skill: string; jobs: { id: string; title: string }[] }[];
    missing_skills: SkillGap[];
  };
  careers: CareerSuggestion[];
  training: TrainingGuide[];
  applications: { status: ApplicationStatus; count: number }[];
}
