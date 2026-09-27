import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Save, Trash2 } from 'lucide-react';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import type { TrainingGuide } from '@/types/career';

interface ReadinessQuestion {
  id: string;
  title: string;
  action: string;
  href: string;
}
interface InterviewQuestion {
  id: string;
  title: string;
  tip: string;
}
interface ReadinessData {
  answers: Record<string, number>;
}
interface InterviewData {
  answers: Record<string, string>;
}
interface ResumeData {
  target_role: string;
  summary: string;
  bullets: string[];
}
interface CoachData {
  goal: string;
  weekly_hours: number;
  completed: string[];
}
interface TrainingData {
  completed: number[];
  notes: string;
}
interface ReadinessFeedback {
  answered: number;
  total: number;
  confident: number;
  next_steps: ReadinessQuestion[];
  note: string;
}
interface InterviewFeedback {
  word_count: number;
  checks: { label: string; passed: boolean; advice: string }[];
  note: string;
}
interface CoachPlan {
  title: string;
  time_note: string;
  steps: { id: string; title: string; detail: string; href: string }[];
  note: string;
}
export interface ToolState<T = unknown, F = unknown> {
  data: T;
  feedback: F;
  updated_at: number;
}
export interface CareerToolsData {
  profile: {
    preferred_job: string;
    about: string;
    education: string;
    skills: string[];
    experience_snippets: string[];
  };
  resume: {
    original_filename: string;
    parsing_status: string;
    experience_snippets: string[];
    detected_skills: string[];
  } | null;
  readiness_questions: ReadinessQuestion[];
  interview_questions: InterviewQuestion[];
  training: TrainingGuide[];
  states: Record<string, ToolState>;
}
export interface ToolProps {
  data: CareerToolsData;
  onSave: (tool: string, state: ToolState) => void;
}

export function CareerLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      onClick={(event) => {
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
          event.preventDefault();
          navigate(href);
        }
      }}
    >
      {children}
    </a>
  );
}

function useToolSave<T, F>(tool: string, props: ToolProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const state = props.data.states[tool] as ToolState<T, F> | undefined;
  async function save(data: T) {
    if (saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const next = await api<ToolState<T, F>>(
        `/career/tools/${encodeURIComponent(tool)}`,
        data,
        'PUT',
      );
      props.onSave(tool, next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your work could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  }
  return { save, state, saving, error, saved };
}

function SaveBar({
  saving,
  error,
  saved,
  dirty,
  label = 'Save progress',
  updatedAt,
}: {
  saving: boolean;
  error: string;
  saved: boolean;
  dirty: boolean;
  label?: string;
  updatedAt?: number;
}) {
  return (
    <div className="ct-save-area">
      {error && (
        <p className="ct-error" role="alert">
          {error} Your changes are still here.
        </p>
      )}
      <div className="ct-save-bar">
        <button type="submit" className="sw-btn sw-btn-primary" disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving…' : label}
        </button>
        <p role="status" className="ct-muted">
          {dirty
            ? 'Unsaved changes'
            : saved
              ? 'Saved to your account.'
              : updatedAt
                ? `Last saved ${new Date(updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Your progress is saved when you select Save.'}
        </p>
      </div>
    </div>
  );
}

function Readiness(props: ToolProps) {
  const task = useToolSave<ReadinessData, ReadinessFeedback>('readiness', props);
  const [answers, setAnswers] = useState(task.state?.data.answers || {});
  const draft = { answers },
    dirty = JSON.stringify(draft) !== JSON.stringify(task.state?.data);
  const feedback = task.state?.feedback;
  return (
    <div className="ct-workspace">
      <form
        className="ct-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void task.save(draft);
        }}
      >
        <div className="ct-section-heading">
          <h2>Your preparation check-in</h2>
          <p>
            Choose the response that describes you today. You can save partway through and return
            later.
          </p>
        </div>
        <div className="ct-question-list">
          {props.data.readiness_questions.map((question, index) => (
            <fieldset className="ct-question" key={question.id}>
              <legend>
                <span>{index + 1}.</span> {question.title}
              </legend>
              <div className="ct-radio-row">
                {['Not yet', 'Working on it', 'Confident'].map((label, value) => (
                  <label
                    className={
                      answers[question.id] === value ? 'ct-choice is-selected' : 'ct-choice'
                    }
                    key={label}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={value}
                      checked={answers[question.id] === value}
                      onChange={() =>
                        setAnswers((current) => ({ ...current, [question.id]: value }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <SaveBar
          {...task}
          dirty={dirty}
          label="Save reflection"
          updatedAt={task.state?.updated_at}
        />
      </form>
      <aside className="ct-aside">
        <h2>Your next steps</h2>
        {feedback ? (
          <>
            <p>
              <strong>
                {feedback.answered} of {feedback.total}
              </strong>{' '}
              questions answered. You marked <strong>{feedback.confident}</strong> areas as
              confident.
            </p>
            {dirty && (
              <p className="ct-note">
                This reflects your last saved answers. Save your changes to update it.
              </p>
            )}
            <ul className="ct-action-list">
              {feedback.next_steps.map((question) => (
                <li key={question.id}>
                  <p>{question.action}</p>
                  <CareerLink href={question.href}>
                    Work on this <ArrowRight size={14} />
                  </CareerLink>
                </li>
              ))}
            </ul>
            {!feedback.next_steps.length && (
              <p className="ct-success">
                You feel prepared across all six areas. Choose a vacancy and practice explaining
                your relevant experience.
              </p>
            )}
            <p className="ct-note">{feedback.note}</p>
          </>
        ) : (
          <>
            <p>
              Save your answers to get practical next steps based on the areas you want to work on.
            </p>
            <p className="ct-note">
              This is a personal reflection, not a hiring score or a test of ability. Employers do
              not receive your answers.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

function Interview(props: ToolProps) {
  const task = useToolSave<InterviewData, Record<string, InterviewFeedback>>('interview', props);
  const [answers, setAnswers] = useState(task.state?.data.answers || {});
  const [current, setCurrent] = useState(0);
  const questions = props.data.interview_questions,
    question = questions[current];
  const answer = answers[question.id] || '',
    draft = { answers };
  const dirty = JSON.stringify(draft) !== JSON.stringify(task.state?.data);
  const feedback =
    task.state?.data.answers[question.id] === answer
      ? task.state?.feedback[question.id]
      : undefined;
  return (
    <div className="ct-workspace">
      <form
        className="ct-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void task.save(draft);
        }}
      >
        <div className="ct-section-heading">
          <h2>Practice one answer at a time</h2>
          <p>Real examples from work, school, volunteering, or personal projects all count.</p>
        </div>
        <nav className="ct-question-nav" aria-label="Interview questions">
          {questions.map((item, index) => (
            <button
              type="button"
              key={item.id}
              aria-current={index === current ? 'step' : undefined}
              aria-label={`Question ${index + 1}: ${item.title}`}
              className={index === current ? 'is-current' : ''}
              onClick={() => setCurrent(index)}
            >
              {index + 1}
              {answers[item.id]?.trim() && <CheckCircle2 size={13} />}
            </button>
          ))}
        </nav>
        <label className="ct-field">
          <span className="ct-prompt">{question.title}</span>
          <span className="ct-muted">{question.tip}</span>
          <textarea
            rows={9}
            maxLength={5000}
            value={answer}
            placeholder="Describe your example in your own words…"
            onChange={(event) =>
              setAnswers((previous) => ({ ...previous, [question.id]: event.target.value }))
            }
          />
        </label>
        <div className="ct-between">
          <span className="ct-muted">
            {answer.trim() ? answer.trim().split(/\s+/).length : 0} words · up to 5,000 characters
          </span>
          <span className="ct-muted">
            Question {current + 1} of {questions.length}
          </span>
        </div>
        <div className="ct-between ct-paging">
          <button
            type="button"
            className="sw-btn sw-btn-secondary"
            disabled={!current}
            onClick={() => setCurrent(current - 1)}
          >
            <ArrowLeft size={15} />
            Previous
          </button>
          <button
            type="button"
            className="sw-btn sw-btn-secondary"
            disabled={current === questions.length - 1}
            onClick={() => setCurrent(current + 1)}
          >
            Next question
            <ArrowRight size={15} />
          </button>
        </div>
        <SaveBar
          {...task}
          dirty={dirty}
          label="Save answers & review"
          updatedAt={task.state?.updated_at}
        />
      </form>
      <aside className="ct-aside">
        <h2>Guided feedback</h2>
        {feedback && answer.trim() ? (
          <>
            <ul className="ct-feedback-list">
              {feedback.checks.map((check) => (
                <li key={check.label}>
                  <span className={check.passed ? 'ct-success' : ''}>
                    {check.passed ? 'Detected' : 'Consider'}: <strong>{check.label}</strong>
                  </span>
                  {!check.passed && <p>{check.advice}</p>}
                </li>
              ))}
            </ul>
            <p className="ct-note">{feedback.note}</p>
          </>
        ) : (
          <>
            <p>
              Write an answer and save it to see simple checks for context, actions, and outcomes.
            </p>
            <ol className="ct-plain-list">
              <li>
                <strong>Situation:</strong> What was happening?
              </li>
              <li>
                <strong>Task:</strong> What was your responsibility?
              </li>
              <li>
                <strong>Action:</strong> What did you do?
              </li>
              <li>
                <strong>Result:</strong> What changed or what did you learn?
              </li>
            </ol>
            <p className="ct-note">
              Guided practice uses wording rules, not AI evaluation. You decide whether the advice
              fits your answer.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Resume(props: ToolProps) {
  const task = useToolSave<ResumeData, null>('resume', props);
  const evidence = [
    ...new Set([
      ...props.data.profile.experience_snippets,
      ...(props.data.resume?.experience_snippets || []),
    ]),
  ];
  const [draft, setDraft] = useState<ResumeData>(
    task.state?.data || {
      target_role: props.data.profile.preferred_job,
      summary: props.data.profile.about,
      bullets: evidence.length ? evidence : [''],
    },
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(task.state?.data);
  const filled = draft.bullets.filter((bullet) => bullet.trim());
  return (
    <div className="ct-workspace">
      <form
        className="ct-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void task.save(draft);
        }}
      >
        <div className="ct-section-heading">
          <h2>Build a focused resume draft</h2>
          <p>
            Start with your saved profile and edit your own evidence. Download your draft when you
            are ready.
          </p>
        </div>
        <label className="ct-field">
          <span>Target role</span>
          <input
            maxLength={150}
            value={draft.target_role}
            onChange={(event) => setDraft({ ...draft, target_role: event.target.value })}
            placeholder="e.g. Administrative Assistant"
          />
        </label>
        <label className="ct-field">
          <span>Professional summary</span>
          <textarea
            maxLength={3000}
            rows={4}
            value={draft.summary}
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
            placeholder="State your relevant background, skills, and the work you want to do."
          />
        </label>
        <div className="ct-section-heading">
          <h3>Experience and project examples</h3>
          <p>
            Use the task, your action, and an outcome you can explain. School or volunteer projects
            are welcome.
          </p>
        </div>
        <div className="ct-bullets">
          {draft.bullets.map((bullet, index) => (
            <div className="ct-bullet" key={index}>
              <label className="ct-field">
                <span>Example {index + 1}</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={bullet}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      bullets: draft.bullets.map((item, i) =>
                        i === index ? event.target.value : item,
                      ),
                    })
                  }
                  placeholder="What did you do, how did you do it, and what happened?"
                />
              </label>
              <button
                className="sw-btn sw-btn-icon"
                type="button"
                aria-label={`Remove example ${index + 1}`}
                onClick={() =>
                  setDraft({ ...draft, bullets: draft.bullets.filter((_, i) => i !== index) })
                }
              >
                <Trash2 size={16} />
              </button>
              {bullet.trim() && (
                <p className="ct-note">
                  {bullet.trim().split(/\s+/).length < 8
                    ? 'Add context: describe the task and your own contribution.'
                    : /\d/.test(bullet)
                      ? 'You included a number. Check that you can explain where it came from.'
                      : 'If you know the outcome, describe it. A truthful qualitative result is useful too.'}
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="sw-btn sw-btn-secondary"
          disabled={draft.bullets.length >= 20}
          onClick={() => setDraft({ ...draft, bullets: [...draft.bullets, ''] })}
        >
          Add experience example
        </button>
        <SaveBar
          {...task}
          dirty={dirty}
          label="Save resume draft"
          updatedAt={task.state?.updated_at}
        />
        <button
          type="button"
          className="sw-btn sw-btn-secondary ct-download"
          disabled={!draft.summary.trim() && !filled.length}
          onClick={() =>
            downloadText(
              'mimaropa-resume-draft.txt',
              [
                draft.target_role,
                draft.summary,
                'Skills from my profile',
                props.data.profile.skills.join(', '),
                'Experience and projects',
                ...filled.map((bullet) => `• ${bullet}`),
              ]
                .filter(Boolean)
                .join('\n\n'),
            )
          }
        >
          <Download size={16} />
          Download text draft
        </button>
      </form>
      <aside className="ct-aside">
        <h2>Your source material</h2>
        <p>
          {props.data.resume
            ? `Resume: ${props.data.resume.original_filename}`
            : 'No uploaded resume yet. You can still work from your profile and add your own examples.'}
        </p>
        {props.data.resume && props.data.resume.parsing_status !== 'completed' && (
          <p className="ct-note">
            Your resume text is not available yet. This draft uses your saved profile.
          </p>
        )}
        <h3>Skills in your profile</h3>
        <div className="ct-chips">
          {props.data.profile.skills.length ? (
            props.data.profile.skills.map((skill) => (
              <span className="sw-chip sw-chip-matched" key={skill}>
                {skill}
              </span>
            ))
          ) : (
            <p>Add your skills to your profile to use them here.</p>
          )}
        </div>
        <h3>Original experience</h3>
        {evidence.length ? (
          <ul className="ct-plain-list">
            {evidence.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>
            No experience examples saved yet. Start with a project or task you actually completed.
          </p>
        )}
        <div className="ct-link-stack">
          <CareerLink href="/profile">
            Review your profile
            <ArrowRight size={14} />
          </CareerLink>
          <CareerLink href="/profile/resume">
            Manage uploaded resume
            <ArrowRight size={14} />
          </CareerLink>
          <CareerLink href={`/jobs?q=${encodeURIComponent(draft.target_role)}`}>
            Compare target vacancies
            <ArrowRight size={14} />
          </CareerLink>
        </div>
        <p className="ct-note">
          Guided editing does not generate experience or an ATS score. Saving this draft does not
          replace your uploaded resume or change your profile.
        </p>
      </aside>
    </div>
  );
}

function Coach(props: ToolProps) {
  const task = useToolSave<CoachData, CoachPlan>('coach', props);
  const [draft, setDraft] = useState<CoachData>(
    task.state?.data || { goal: 'first-job', weekly_hours: 3, completed: [] },
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(task.state?.data);
  const plan = task.state?.feedback;
  const planMatches =
    task.state?.data.goal === draft.goal && task.state?.data.weekly_hours === draft.weekly_hours;
  return (
    <form
      className="ct-panel"
      onSubmit={(event) => {
        event.preventDefault();
        void task.save(draft);
      }}
    >
      <div className="ct-section-heading">
        <h2>Make room for your next step</h2>
        <p>
          Choose a goal and a realistic time commitment. Save your plan to track it across visits.
        </p>
      </div>
      <div className="ct-form-grid">
        <label className="ct-field">
          <span>Your current goal</span>
          <select
            value={draft.goal}
            onChange={(event) => setDraft({ ...draft, goal: event.target.value, completed: [] })}
          >
            <option value="first-job">Find my first job</option>
            <option value="change-role">Move to a different role</option>
            <option value="build-skills">Develop my skills</option>
            <option value="interview">Prepare for interviews</option>
          </select>
        </label>
        <label className="ct-field">
          <span>Hours available each week</span>
          <input
            type="number"
            min={1}
            max={20}
            required
            value={draft.weekly_hours || ''}
            onChange={(event) => setDraft({ ...draft, weekly_hours: Number(event.target.value) })}
          />
        </label>
      </div>
      {plan && planMatches ? (
        <section className="ct-plan">
          <h2>{plan.title}</h2>
          <p>{plan.time_note}</p>
          <div className="ct-plan-steps">
            {plan.steps.map((step, index) => (
              <div className="ct-plan-step" key={step.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.completed.includes(step.id)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        completed: event.target.checked
                          ? [...draft.completed, step.id]
                          : draft.completed.filter((id) => id !== step.id),
                      })
                    }
                  />
                  <span>
                    <strong>
                      {index + 1}. {step.title}
                    </strong>
                    <span>{step.detail}</span>
                  </span>
                </label>
                <CareerLink className="sw-btn sw-btn-secondary" href={step.href}>
                  Open activity
                  <ArrowRight size={14} />
                </CareerLink>
              </div>
            ))}
          </div>
          <p className="ct-note">{plan.note}</p>
          <p className="ct-success">
            {draft.completed.length} of {plan.steps.length} steps checked off
          </p>
        </section>
      ) : (
        <div className="ct-note">
          {plan
            ? 'Save your new goal to refresh your plan.'
            : 'Your plan will connect profile preparation, skill practice, resume evidence, and real vacancies.'}{' '}
          Guidance uses a structured plan based on your choices, not generative AI.
        </div>
      )}
      <SaveBar
        {...task}
        dirty={dirty}
        label={plan && planMatches ? 'Save plan progress' : 'Create my plan'}
        updatedAt={task.state?.updated_at}
      />
    </form>
  );
}

function TrainingDetail({ guide, ...props }: ToolProps & { guide: TrainingGuide }) {
  const task = useToolSave<TrainingData, null>(`training:${guide.id}`, props);
  const [draft, setDraft] = useState<TrainingData>(
    task.state?.data || { completed: [], notes: '' },
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(task.state?.data);
  return (
    <div className="ct-workspace">
      <form
        className="ct-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void task.save(draft);
        }}
      >
        <CareerLink className="ct-back" href="/career/training">
          <ArrowLeft size={15} />
          All practice guides
        </CareerLink>
        <div className="ct-section-heading">
          <h2>{guide.title}</h2>
          <p>{guide.description}</p>
        </div>
        <div className="ct-between">
          <span className="sw-chip sw-chip-matched">{guide.skill}</span>
          <span className="ct-muted">
            {draft.completed.length} of {guide.activities.length} activities complete
          </span>
        </div>
        <progress
          className="ct-progress"
          max={guide.activities.length}
          value={draft.completed.length}
          aria-label="Practice activities completed"
        />
        <div className="ct-training-activities">
          {guide.activities.map((activity, index) => (
            <label key={activity}>
              <input
                type="checkbox"
                checked={draft.completed.includes(index)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    completed: event.target.checked
                      ? [...draft.completed, index]
                      : draft.completed.filter((id) => id !== index),
                  })
                }
              />
              <span>
                <strong>Activity {index + 1}</strong>
                {activity}
              </span>
            </label>
          ))}
        </div>
        <label className="ct-field">
          <span>Practice notes and evidence</span>
          <span className="ct-muted">
            Record what you made, what you learned, and what you want to try next.
          </span>
          <textarea
            maxLength={5000}
            rows={6}
            value={draft.notes}
            placeholder="My practice notes…"
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
        </label>
        <SaveBar {...task} dirty={dirty} updatedAt={task.state?.updated_at} />
      </form>
      <aside className="ct-aside">
        <h2>Make the practice count</h2>
        <ol className="ct-plain-list">
          <li>Choose a small example you can complete with the tools available to you.</li>
          <li>Keep your work in a file or notebook and review it against each activity.</li>
          <li>
            Write what you learned in your own words. Check activities off when you finish them.
          </li>
        </ol>
        <p className="ct-note">
          {guide.provider} · {guide.delivery_mode}. {guide.catalog_note} Checking off an activity
          records your own progress; it does not certify a skill.
        </p>
        <CareerLink href="/career/resume-optimizer">
          Add a truthful project example
          <ArrowRight size={14} />
        </CareerLink>
      </aside>
    </div>
  );
}

export function CareerTraining({ guideId, ...props }: ToolProps & { guideId?: string }) {
  const [query, setQuery] = useState('');
  const guide = props.data.training.find((item) => item.id === guideId);
  if (guideId)
    return guide ? (
      <TrainingDetail key={guide.id} guide={guide} {...props} />
    ) : (
      <div className="ct-panel">
        <h2>Practice guide not found</h2>
        <p>Choose a guide from the current learning library.</p>
        <CareerLink href="/career/training">
          View all practice guides
          <ArrowRight size={15} />
        </CareerLink>
      </div>
    );
  const guides = props.data.training.filter((item) =>
    `${item.title} ${item.skill} ${item.category}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <div className="ct-panel">
      <div className="ct-section-heading">
        <h2>Choose a skill to practice</h2>
        <p>
          Work through a short activity plan, keep notes, and save your progress. All guides remain
          available even when your job matches change.
        </p>
      </div>
      <label className="ct-field ct-search">
        <span>Find a practice guide</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or skill"
        />
      </label>
      <div className="ct-guide-list">
        {guides.map((item) => {
          const progress = props.data.states[`training:${item.id}`]?.data as
            TrainingData | undefined;
          const count = progress?.completed.length || 0;
          return (
            <CareerLink className="ct-guide-row" key={item.id} href={`/career/training/${item.id}`}>
              <div>
                <span className="ct-muted">{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className={count === item.activities.length ? 'ct-success' : 'ct-muted'}>
                  {count
                    ? `${count} of ${item.activities.length} activities completed`
                    : `${item.activities.length} activities · self-guided`}
                </span>
              </div>
              <ArrowRight size={19} />
            </CareerLink>
          );
        })}
      </div>
      {!guides.length && (
        <div className="ct-empty">
          <p>No guides match “{query}”. Try another skill or clear your search.</p>
          <button type="button" className="sw-btn sw-btn-secondary" onClick={() => setQuery('')}>
            Clear search
          </button>
        </div>
      )}
      <p className="ct-note">
        These practice guides do not provide accredited courses or certifications.
      </p>
    </div>
  );
}

export function CareerToolPage({ tool, ...props }: ToolProps & { tool: string }) {
  if (tool === 'readiness') return <Readiness {...props} />;
  if (tool === 'interview') return <Interview {...props} />;
  if (tool === 'resume' || tool === 'resume-optimizer') return <Resume {...props} />;
  if (tool === 'coach') return <Coach {...props} />;
  return (
    <div className="ct-panel">
      <h2>Career tool not found</h2>
      <CareerLink href="/career">Return to Career Development</CareerLink>
    </div>
  );
}
