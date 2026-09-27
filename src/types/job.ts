export type Job = {
  id: string;
  title: string;
  company: string;
  companyInitials: string;
  companyColor: 'teal' | 'blue' | 'orange' | 'purple' | 'rose' | 'green';
  city: string;
  province: string;
  type: string;
  salary: string;
  match: number;
  category: string;
  skills: string[];
  description: string;
  responsibilities: string[];
  qualifications: string[];
  postedLabel: string;
  matchBreakdown: {
    skills: number;
    experience: number;
    education: number;
    location: number;
  };
};
