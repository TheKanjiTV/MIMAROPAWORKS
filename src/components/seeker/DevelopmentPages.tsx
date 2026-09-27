import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Compass,
  FileCheck2,
  GraduationCap,
  MessageCircle,
  Route,
  Target,
} from 'lucide-react';
import { api } from '@/auth/api';
import type { SeekerHomeResponse } from '@/types/career';
import {
  CareerLink,
  CareerToolPage,
  CareerTraining,
  type CareerToolsData,
  type ToolState,
} from './CareerTools';
import './career-tools.css';

const tools = [
  {
    id: 'readiness',
    title: 'Workplace Readiness',
    description: 'Reflect on your preparation and choose practical next steps.',
    icon: FileCheck2,
    group: 'Prepare for your next opportunity',
  },
  {
    id: 'resume-optimizer',
    title: 'Resume Optimizer',
    description: 'Shape an honest resume draft using your own skills and experience.',
    icon: Briefcase,
    group: 'Prepare for your next opportunity',
  },
  {
    id: 'interview',
    title: 'Interview Practice',
    description: 'Save your answers and review them with clear, guided feedback.',
    icon: MessageCircle,
    group: 'Prepare for your next opportunity',
  },
  {
    id: 'skills-gap',
    title: 'Skills Gap Analysis',
    description: 'Compare your profile with the skills listed in current vacancies.',
    icon: Target,
    group: 'Explore and keep growing',
  },
  {
    id: 'suggestions',
    title: 'Career Suggestions',
    description: 'Explore occupations, the skills you bring, and areas to develop.',
    icon: Compass,
    group: 'Explore and keep growing',
  },
  {
    id: 'training',
    title: 'Recommended Training',
    description: 'Complete practice activities and keep a record of what you learn.',
    icon: GraduationCap,
    group: 'Explore and keep growing',
  },
  {
    id: 'coach',
    title: 'Career Coach',
    description: 'Turn your goal into a guided action plan you can work through.',
    icon: Route,
    group: 'Explore and keep growing',
  },
];

function CareerHub({ data }: { data: CareerToolsData | null }) {
  const recent = Object.entries(data?.states || {}).sort(
    (a, b) => b[1].updated_at - a[1].updated_at,
  )[0];
  const recentHref = recent
    ? recent[0].startsWith('training:')
      ? `/career/training/${recent[0].slice(9)}`
      : `/career/${recent[0] === 'resume' ? 'resume-optimizer' : recent[0]}`
    : '/career/readiness';
  const recentTitle = recent
    ? recent[0].startsWith('training:')
      ? data?.training.find((guide) => guide.id === recent[0].slice(9))?.title
      : tools.find(
          (tool) =>
            tool.id === recent[0] || (tool.id === 'resume-optimizer' && recent[0] === 'resume'),
        )?.title
    : null;
  return (
    <>
      <section className="ct-start">
        <div>
          <h2>{recentTitle ? `Continue with ${recentTitle}` : 'A useful next step starts here'}</h2>
          <p>
            {recentTitle
              ? 'Your saved work is ready when you are. Keep building at your own pace.'
              : 'Check in on your preparation, practice one skill, or make a plan for the week.'}
          </p>
          <CareerLink className="sw-btn sw-btn-primary" href={recentHref}>
            {recentTitle ? 'Continue your progress' : 'Start a readiness check-in'}
            <ArrowRight size={16} />
          </CareerLink>
        </div>
        <div className="ct-start-note">
          <CheckCircle2 size={22} />
          <p>
            Your answers, drafts, notes, and learning progress are saved privately to your account
            when you select Save.
          </p>
        </div>
      </section>
      <div className="ct-hub-columns">
        {['Prepare for your next opportunity', 'Explore and keep growing'].map((group) => (
          <section className="ct-hub-group" key={group}>
            <h2>{group}</h2>
            <div>
              {tools
                .filter((tool) => tool.group === group)
                .map((tool) => {
                  const Icon = tool.icon;
                  const state = data?.states[tool.id === 'resume-optimizer' ? 'resume' : tool.id];
                  return (
                    <CareerLink key={tool.id} href={`/career/${tool.id}`} className="ct-tool-row">
                      <span className="ct-tool-icon">
                        <Icon size={21} />
                      </span>
                      <span>
                        <strong>{tool.title}</strong>
                        <span>{tool.description}</span>
                        {state && <small>Saved progress</small>}
                      </span>
                      <ArrowRight size={16} />
                    </CareerLink>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
      <p className="ct-note">
        Readiness, resume, interview, and coaching tools use guided exercises. Job and career
        comparisons explain when a skills-based fallback is used.
      </p>
    </>
  );
}

function CareerAnalysis({ kind }: { kind: 'skills-gap' | 'suggestions' }) {
  const [data, setData] = useState<SeekerHomeResponse | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api<SeekerHomeResponse>('/job-seeker/home')
      .then((next) => {
        if (active) setData(next);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  if (error)
    return (
      <div className="ct-panel ct-empty">
        <p role="alert">{error}</p>
        <div className="ct-inline-actions">
          <button
            className="sw-btn sw-btn-primary"
            type="button"
            onClick={() => {
              setError('');
              setRetry((n) => n + 1);
            }}
          >
            Try again
          </button>
          <CareerLink className="sw-btn sw-btn-secondary" href="/profile">
            Review profile
          </CareerLink>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="ct-panel" role="status">
        Comparing your profile with current opportunities…
      </div>
    );
  if (kind === 'suggestions')
    return (
      <>
        <p className="ct-note">
          These are occupation ideas, not advertised openings or predictions of job performance.
          Similarity compares your saved profile with a career description.
        </p>
        <div className="ct-career-list">
          {data.careers.map((career) => (
            <article className="ct-panel" key={career.id}>
              <div className="ct-between">
                <span className="ct-muted">{career.industry}</span>
                <span className="sw-badge sw-badge-match">
                  {career.similarity_percentage}% similarity
                </span>
              </div>
              <h2>{career.title}</h2>
              <p>{career.description}</p>
              <dl className="ct-career-skills">
                <div>
                  <dt>Skills you bring</dt>
                  <dd>
                    {career.relevant_skills.length
                      ? career.relevant_skills.join(' · ')
                      : 'No listed skills overlap yet. Review the role requirements.'}
                  </dd>
                </div>
                <div>
                  <dt>Skills to explore</dt>
                  <dd>
                    {career.skills_to_develop.length
                      ? career.skills_to_develop.join(' · ')
                      : 'Your listed skills cover this catalog entry.'}
                  </dd>
                </div>
              </dl>
              <p className="ct-note">
                {career.semantic_engine === 'skills_overlap_fallback'
                  ? 'Compared using listed skill overlap.'
                  : 'Compared using profile text similarity.'}
              </p>
              <CareerLink href={`/jobs?q=${encodeURIComponent(career.title)}`}>
                Find related vacancies
                <ArrowRight size={15} />
              </CareerLink>
            </article>
          ))}
        </div>
        {!data.careers.length && (
          <div className="ct-panel">
            <p>No career suggestions are available yet.</p>
            <CareerLink href="/profile">Add your background and skills</CareerLink>
          </div>
        )}
      </>
    );
  const gap = data.skills_gap;
  return (
    <>
      <div className="ct-note">
        Compared with <strong>{gap.evaluated_jobs}</strong> active vacancies in your current
        recommendations. These are employer-listed requirements, not a test of your ability.
      </div>
      <section className="ct-panel">
        <div className="ct-section-heading">
          <h2>Skills you already bring</h2>
          <p>These skills are listed in both your profile and evaluated vacancies.</p>
        </div>
        <div className="ct-chips">
          {gap.strong_skills.length ? (
            gap.strong_skills.map((skill) => (
              <span key={skill.skill} className="sw-chip sw-chip-matched">
                <CheckCircle2 size={14} />
                {skill.skill} · {skill.jobs.length} {skill.jobs.length === 1 ? 'job' : 'jobs'}
              </span>
            ))
          ) : (
            <p>
              No skill overlaps to show yet.{' '}
              <CareerLink href="/profile">Review your profile skills</CareerLink>.
            </p>
          )}
        </div>
      </section>
      <section className="ct-panel">
        <div className="ct-section-heading">
          <h2>Choose a skill to develop</h2>
          <p>Start with a skill that appears in a role you actually want.</p>
        </div>
        <div className="ct-gap-list">
          {gap.missing_skills.map((skill) => {
            const guide = data.training.find(
              (item) => item.skill.toLowerCase() === skill.skill.toLowerCase(),
            );
            return (
              <article key={skill.skill}>
                <div className="ct-between">
                  <h3>{skill.skill}</h3>
                  <span className="sw-chip">{skill.priority}</span>
                </div>
                <p>
                  Mentioned in {skill.jobs.length} evaluated{' '}
                  {skill.jobs.length === 1 ? 'vacancy' : 'vacancies'}.
                </p>
                <ul>
                  {skill.jobs.slice(0, 3).map((job) => (
                    <li key={job.id}>
                      <CareerLink href={`/jobs/${job.id}`}>{job.title}</CareerLink>
                      <span className="ct-muted"> · {job.importance}</span>
                    </li>
                  ))}
                </ul>
                {skill.jobs.length > 3 && (
                  <details>
                    <summary>Show {skill.jobs.length - 3} more vacancies</summary>
                    <ul>
                      {skill.jobs.slice(3).map((job) => (
                        <li key={job.id}>
                          <CareerLink href={`/jobs/${job.id}`}>{job.title}</CareerLink>
                          <span className="ct-muted"> · {job.importance}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <CareerLink href={guide ? `/career/training/${guide.id}` : '/career/coach'}>
                  {guide ? 'Open a practice guide' : 'Plan your next learning step'}
                  <ArrowRight size={14} />
                </CareerLink>
              </article>
            );
          })}
        </div>
        {!gap.missing_skills.length && (
          <div className="ct-empty">
            <p>
              {gap.evaluated_jobs
                ? 'No missing skills were found in these evaluated vacancies. You can still explore new skills in the practice library.'
                : 'There are no evaluated vacancies yet. Update your profile and browse jobs to establish a useful comparison.'}
            </p>
            <CareerLink
              className="sw-btn sw-btn-secondary"
              href={gap.evaluated_jobs ? '/career/training' : '/jobs'}
            >
              {gap.evaluated_jobs ? 'Browse practice guides' : 'Browse jobs'}
              <ArrowRight size={15} />
            </CareerLink>
          </div>
        )}
      </section>
    </>
  );
}

export function DevelopmentPages({ path }: { path: string }) {
  const [data, setData] = useState<CareerToolsData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api<CareerToolsData>('/career/tools')
      .then((next) => {
        if (active) setData(next);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const id = path.split('/')[2] || '',
    guideId = path.split('/')[3];
  const tool = tools.find(
    (item) => item.id === id || (id === 'resume' && item.id === 'resume-optimizer'),
  );
  const title = !id
    ? 'Career Development'
    : data?.training.find((item) => item.id === guideId)?.title ||
      tool?.title ||
      'Career Development';
  const onSave = (toolId: string, state: ToolState) =>
    setData((previous) =>
      previous ? { ...previous, states: { ...previous.states, [toolId]: state } } : previous,
    );
  return (
    <div className="ct-root">
      {id && (
        <CareerLink href="/career" className="ct-back">
          <ArrowLeft size={16} />
          Career Development
        </CareerLink>
      )}
      <header className="ct-page-heading">
        <h1>{title}</h1>
        <p>
          {tool?.description ||
            'Build your skills, prepare your applications, and make steady progress toward work that fits you.'}
        </p>
      </header>
      {error && (
        <div className="ct-error" role="alert">
          <p>Your saved career workspace could not load. {error}</p>
          <button
            type="button"
            className="sw-btn sw-btn-secondary"
            onClick={() => {
              setError('');
              setRetry((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {!id ? (
        <CareerHub data={data} />
      ) : id === 'skills-gap' || id === 'suggestions' ? (
        <CareerAnalysis key={id} kind={id} />
      ) : !data ? (
        !error && (
          <div className="ct-panel" role="status">
            Loading your saved career workspace…
          </div>
        )
      ) : id === 'training' ? (
        <CareerTraining key={path} guideId={guideId} data={data} onSave={onSave} />
      ) : (
        <CareerToolPage key={path} tool={id} data={data} onSave={onSave} />
      )}
    </div>
  );
}
