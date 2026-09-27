// Controlled MVP exploration catalog, not labor-market statistics or live vacancies.
export const occupations = [
  {
    id: 'hospitality',
    title: 'Hospitality Staff',
    description:
      'Welcome guests, answer service questions, maintain guest areas and support food or accommodation services.',
    skills: ['Customer Service', 'Communication', 'Housekeeping', 'Food Service'],
    industry: 'Hospitality',
  },
  {
    id: 'retail',
    title: 'Retail Associate',
    description:
      'Help shoppers find products, maintain stock displays and support sales transactions and customer inquiries.',
    skills: ['Customer Service', 'Sales', 'Communication', 'Inventory Management'],
    industry: 'Retail',
  },
  {
    id: 'customer-service',
    title: 'Customer Service Associate',
    description:
      'Respond to customer inquiries, explain services, resolve concerns and maintain support records.',
    skills: ['Customer Service', 'Communication', 'Microsoft Office'],
    industry: 'Customer services',
  },
  {
    id: 'administration',
    title: 'Administrative Assistant',
    description:
      'Organize documents, schedules and office records, prepare spreadsheets and support daily office tasks.',
    skills: ['Microsoft Office', 'Microsoft Excel', 'Communication', 'Data Entry'],
    industry: 'Administration',
  },
  {
    id: 'marketing',
    title: 'Marketing Assistant',
    description:
      'Support marketing campaigns, create visual content and communicate with customers through social media.',
    skills: ['Canva', 'Social Media Management', 'Communication', 'Digital Marketing'],
    industry: 'Marketing',
  },
  {
    id: 'social-media',
    title: 'Social Media Associate',
    description:
      'Manage social media pages, design content, respond to community messages and review content performance.',
    skills: [
      'Social Media Management',
      'Canva',
      'Customer Service',
      'Photography',
      'Analytics',
      'Content Planning',
    ],
    industry: 'Digital services',
  },
  {
    id: 'sales',
    title: 'Sales Associate',
    description:
      'Assist customers with product choices, explain offers, record sales and maintain customer relationships.',
    skills: ['Sales', 'Customer Service', 'Communication', 'Microsoft Excel'],
    industry: 'Retail and sales',
  },
  {
    id: 'moderation',
    title: 'Content Moderator',
    description:
      'Review online posts against community guidelines, document decisions and communicate concerns clearly.',
    skills: ['Communication', 'Attention to Detail', 'Microsoft Office'],
    industry: 'Online services',
  },
  {
    id: 'bookkeeping',
    title: 'Bookkeeping Assistant',
    description:
      'Record business transactions, organize receipts and support spreadsheet-based financial record keeping.',
    skills: ['Bookkeeping', 'Microsoft Excel', 'Data Entry', 'Attention to Detail'],
    industry: 'Accounting support',
  },
  {
    id: 'it-support',
    title: 'IT Support',
    description:
      'Troubleshoot computer and software problems, document technical issues and help users resolve support requests.',
    skills: ['Technical Support', 'Communication', 'Microsoft Office', 'Networking'],
    industry: 'Information technology',
  },
];

const lessons = [
  [
    'excel',
    'Excel Fundamentals',
    'Microsoft Excel',
    'Office skills',
    'Organize a worksheet, use basic formulas and summarize a small dataset.',
    [
      'Create a monthly expense worksheet.',
      'Use SUM and AVERAGE; check totals manually.',
      'Sort records and create a simple chart.',
    ],
  ],
  [
    'communication',
    'Business Communication Basics',
    'Communication',
    'Communication',
    'Practice clear, respectful workplace messages.',
    [
      'Write a reply to a customer question.',
      'State the next action and expected timeline.',
      'Review the message for clarity and respectful language.',
    ],
  ],
  [
    'marketing',
    'Introduction to Digital Marketing',
    'Digital Marketing',
    'Marketing',
    'Plan an introductory campaign with a clear audience and purpose.',
    [
      'Choose a product and describe its audience.',
      'Draft a campaign objective and three content ideas.',
      'Identify how you would assess the campaign.',
    ],
  ],
  [
    'analytics',
    'Analytics Practice',
    'Google Analytics',
    'Marketing',
    'Explore the questions website analytics can help answer.',
    [
      'List three questions about a sample website audience.',
      'Explain visits, events and conversions in your own words.',
      'Sketch a report using clearly labelled practice data.',
    ],
  ],
  [
    'general-analytics',
    'Reading Performance Data',
    'Analytics',
    'Marketing',
    'Practice interpreting content performance without overstating results.',
    [
      'Build a small practice dataset.',
      'Compare reach and engagement.',
      'Describe limitations of your conclusions.',
    ],
  ],
  [
    'canva',
    'Visual Content Basics',
    'Canva',
    'Design',
    'Practice creating readable social content.',
    ['Design a sample announcement.', 'Check typography and contrast.', 'Review it at phone size.'],
  ],
  [
    'social',
    'Social Media Planning',
    'Social Media Management',
    'Marketing',
    'Practice page management and customer responses.',
    [
      'Draft a weekly content schedule.',
      'Write responses to three sample inquiries.',
      'Define a process for escalating sensitive concerns.',
    ],
  ],
  [
    'planning',
    'Content Planning Basics',
    'Content Planning',
    'Marketing',
    'Build a simple content plan.',
    ['Define an audience.', 'Write three content briefs.', 'Review consistency and accessibility.'],
  ],
  [
    'service',
    'Customer Service Practice',
    'Customer Service',
    'Customer services',
    'Practice responding clearly to customer concerns.',
    [
      'Read a sample complaint.',
      'Acknowledge the concern and propose a next step.',
      'Record a concise support note.',
    ],
  ],
  [
    'office',
    'Office Productivity Basics',
    'Microsoft Office',
    'Office skills',
    'Practice common document and spreadsheet tasks.',
    [
      'Create a one-page business letter.',
      'Build a simple record sheet.',
      'Check formatting and filenames.',
    ],
  ],
];
export const trainingCatalog = lessons.map(
  ([id, title, skill, category, description, activities]) => ({
    id,
    title,
    skill,
    category,
    description,
    activities,
    provider: 'MIMAROPA Works',
    delivery_mode: 'Self-guided practice',
    catalog_note: 'MVP practice guide; not an accredited course or certification.',
  }),
);
const key = (value) => String(value).trim().toLowerCase();

export function skillsGap(recommendations, candidateSkills) {
  const owned = new Set(candidateSkills.map(key)),
    strong = new Map(),
    gaps = new Map();
  for (const job of recommendations) {
    for (const skill of job.matched_skills) {
      const k = key(skill);
      if (!strong.has(k)) strong.set(k, { skill, jobs: [] });
      strong.get(k).jobs.push({ id: job.id, title: job.title });
    }
    const required = new Set(job.required_skills.map(key));
    const missing = [
      ...job.missing_skills.map((skill) => ({ skill, importance: 'required' })),
      ...job.preferred_skills
        .filter((skill) => !owned.has(key(skill)) && !required.has(key(skill)))
        .map((skill) => ({ skill, importance: 'preferred' })),
    ];
    for (const { skill, importance } of missing) {
      const k = key(skill);
      if (!gaps.has(k)) gaps.set(k, { skill, jobs: [] });
      const entry = gaps.get(k);
      if (entry.jobs.some((j) => j.id === job.id)) continue;
      entry.jobs.push({
        id: job.id,
        title: job.title,
        importance,
        match_percentage: job.match_percentage,
        why: `${job.title} lists ${skill} as a ${importance} skill. Developing it can help you address this stated job requirement.`,
      });
    }
  }
  return {
    evaluated_jobs: recommendations.length,
    strong_skills: [...strong.values()].sort((a, b) => b.jobs.length - a.jobs.length),
    missing_skills: [...gaps.values()]
      .map((entry) => {
        const required = entry.jobs.filter((job) => job.importance === 'required');
        const priority =
          required.length &&
          (required.length >= 2 || required.some((job) => job.match_percentage >= 80))
            ? 'High Priority'
            : required.length
              ? 'Useful to Develop'
              : 'Optional';
        const priority_score = entry.jobs.reduce(
          (sum, job) =>
            sum + ((job.importance === 'required' ? 2 : 1) * job.match_percentage) / 100,
          0,
        );
        return { ...entry, priority, priority_score };
      })
      .sort((a, b) => b.priority_score - a.priority_score || a.skill.localeCompare(b.skill)),
  };
}
export function trainingFor(gap) {
  const missing = new Set(gap.missing_skills.map((x) => key(x.skill)));
  return trainingCatalog.filter((t) => missing.has(key(t.skill)));
}
export async function careerSuggestions(profile, compare) {
  const skills = new Set((JSON.parse(profile.data).skills || []).map(key));
  const results = [];
  // Keep local CPU inference bounded instead of issuing eight simultaneous requests.
  for (const occupation of occupations) {
    const relevant_skills = occupation.skills.filter((s) => skills.has(key(s))),
      skills_to_develop = occupation.skills.filter((s) => !skills.has(key(s)));
    let score,
      semantic_engine = 'sentence_transformer';
    try {
      score = await compare(
        profile.normalized_profile_text,
        `Occupation: ${occupation.title}\nIndustry: ${occupation.industry}\n${occupation.description}\nTypical skills: ${occupation.skills.join(', ')}`,
      );
      if (!Number.isFinite(score)) throw new Error('Invalid similarity');
    } catch {
      score = relevant_skills.length / occupation.skills.length;
      semantic_engine = 'skills_overlap_fallback';
    }
    results.push({
      ...occupation,
      relevant_skills,
      skills_to_develop,
      similarity_percentage: Math.round(Math.max(0, Math.min(1, score)) * 100),
      semantic_engine,
    });
  }
  return results.sort(
    (a, b) => b.similarity_percentage - a.similarity_percentage || a.title.localeCompare(b.title),
  );
}
