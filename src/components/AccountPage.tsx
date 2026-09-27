import { SeekerNav } from './SeekerNav';
import './seeker-home.css';
import { statusLabels, type Application, type JobDetailResponse } from '@/types/application';
import { useEffect, useId, useState } from 'react';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { Brand } from '@/components/Brand';
import { AuthForm } from '@/components/LoginModal';
import { useAuth } from '@/auth/useAuth';
import { api, ApiError, upload, uploadFiles } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import { PROVINCES } from '@/data/jobs';
import type { AuthResult, AuthUser } from '@/types/auth';
import './account-page.css';

type Profile = {
  province: string;
  municipality: string;
  education: string;
  skills: string;
  preferred_job: string;
  work_setup: string;
  step: number;
};
const EMPTY_PROFILE: Profile = {
  province: '',
  municipality: '',
  education: '',
  skills: '',
  preferred_job: '',
  work_setup: '',
  step: 0,
};
const STEPS = ['Location', 'Education & skills', 'Work preferences'];

function ProfileSetup() {
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ profile: Profile | null }>('/profile')
      .then((result) => {
        if (active) setProfile(result.profile ?? EMPTY_PROFILE);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const save = async (step: number, complete = false, leave = false) => {
    if (!profile || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api<AuthResult>('/profile', { ...profile, step, complete }, 'PUT');
      await refresh();
      setProfile((p) => (p ? { ...p, step } : p));
      setMessage('Your progress is saved.');
      if (complete) navigate('/onboarding/job-seeker/resume');
      else if (leave) navigate('/');
      else requestAnimationFrame(() => document.getElementById('profile-heading')?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your profile.');
    } finally {
      setBusy(false);
    }
  };
  const field = (name: keyof Omit<Profile, 'step'>, label: string, options?: readonly string[]) => (
    <label className="account-field">
      <span id={`profile-${name}-label`}>{label}</span>
      {options ? (
        <select
          aria-labelledby={`profile-${name}-label`}
          value={profile?.[name] ?? ''}
          required
          onChange={(event) => setProfile((p) => (p ? { ...p, [name]: event.target.value } : p))}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : name === 'skills' ? (
        <textarea
          aria-labelledby={`profile-${name}-label`}
          value={profile?.skills ?? ''}
          rows={3}
          maxLength={1000}
          required
          onChange={(event) => setProfile((p) => (p ? { ...p, skills: event.target.value } : p))}
        />
      ) : (
        <input
          aria-labelledby={`profile-${name}-label`}
          value={profile?.[name] ?? ''}
          maxLength={150}
          required
          autoComplete={name === 'municipality' ? 'address-level2' : 'off'}
          onChange={(event) => setProfile((p) => (p ? { ...p, [name]: event.target.value } : p))}
        />
      )}
      {name === 'skills' && (
        <small>
          Separate skills with commas, for example: customer service, Excel, bookkeeping.
        </small>
      )}
    </label>
  );
  return (
    <>
      <p className="account-eyebrow">YOUR NEXT STEP</p>
      <h1>Let’s build your profile, {user?.name.split(' ')[0]}.</h1>
      <p className="account-intro">
        Your account is ready. Add a few details at a time so we can prepare for better job
        recommendations.
      </p>
      {!user?.emailVerified && (
        <div className="account-notice">
          <ShieldCheck size={23} aria-hidden="true" />
          <div>
            <strong>Verify your email</strong>
            <p>
              Check your inbox for a verification link. You can save your progress now and finish
              after verification.
            </p>
            <button
              type="button"
              className="auth-text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const result = await api<{ message: string }>('/auth/resend-verification', {});
                  setMessage(result.message);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send another verification email
            </button>
            <button
              type="button"
              className="auth-text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const currentUser = await refresh();
                  setMessage(
                    currentUser?.emailVerified
                      ? 'Your email is verified. You can continue your profile setup.'
                      : 'Your email is not verified yet. Open the latest verification link, then try again.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              I’ve verified my email
            </button>
          </div>
        </div>
      )}
      <p className="auth-form-error" role="alert">
        {error}
      </p>
      <p className="auth-success" role="status">
        {message}
      </p>
      {!profile ? (
        <p role="status">
          {error ? 'Reload the page to try again.' : 'Loading your saved progress…'}
        </p>
      ) : (
        <div className="account-card">
          <ol className="onboarding-steps" aria-label="Profile setup progress">
            {STEPS.map((step, index) => (
              <li key={step} aria-current={profile.step === index ? 'step' : undefined}>
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <h2 id="profile-heading" tabIndex={-1}>
            {STEPS[profile.step]}
          </h2>
          <p className="account-step-note">
            Step {profile.step + 1} of 3 · Your details stay saved between visits.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save(Math.min(2, profile.step + 1), profile.step === 2);
            }}
          >
            <fieldset disabled={busy}>
              {profile.step === 0 && (
                <>
                  {field('province', 'Province', PROVINCES)}
                  {field('municipality', 'Municipality or city')}
                </>
              )}
              {profile.step === 1 && (
                <>
                  {field('education', 'Educational attainment', [
                    'Elementary',
                    'Junior high school',
                    'Senior high school',
                    'Vocational / TESDA',
                    'College undergraduate',
                    'Associate Degree',
                    'College graduate',
                    'Postgraduate',
                    'Prefer to describe later',
                  ])}
                  {field('skills', 'Skills')}
                </>
              )}
              {profile.step === 2 && (
                <>
                  {field('preferred_job', 'Preferred job')}
                  {field('work_setup', 'Work setup', [
                    'On-site',
                    'Remote',
                    'Hybrid',
                    'Open to any setup',
                  ])}
                  <p className="account-step-note">
                    Résumé, supporting documents, and AI matching will follow in the next module.
                  </p>
                </>
              )}
              <div className="account-form-actions">
                {profile.step > 0 && (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => void save(profile.step - 1)}
                  >
                    <ArrowLeft size={17} /> Back
                  </button>
                )}
                <button type="submit" className="button button-primary">
                  {busy
                    ? 'Saving…'
                    : profile.step === 2
                      ? 'Finish basic profile'
                      : 'Save and continue'}
                  <ArrowRight size={17} />
                </button>
              </div>
              <button
                type="button"
                className="auth-text-button"
                onClick={() => void save(profile.step, false, true)}
              >
                Save and finish later
              </button>
            </fieldset>
          </form>
        </div>
      )}
    </>
  );
}

function Dashboard({ admin }: { admin: boolean }) {
  const { user, completeGoogleSignIn, googleAvailable } = useAuth();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [linkingPassword, setLinkingPassword] = useState('');
  useEffect(() => {
    let active = true;
    api<{ user: AuthUser; message?: string }>(admin ? '/admin' : '/dashboard')
      .then((result) => {
        if (active) {
          setMessage(
            result.message ??
              'Your administrator session is active. Management tools will be added separately.',
          );
          setReady(true);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 403 && !admin) navigate('/onboarding');
        else setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [admin]);
  return (
    <>
      <p className="account-eyebrow">{admin ? 'ADMINISTRATION' : 'MY ACCOUNT'}</p>
      <h1>Welcome, {user?.name.split(' ')[0]}.</h1>
      <p role="alert" className="auth-form-error">
        {error}
      </p>
      {!ready ? (
        <p role="status">{error ? 'Access could not be confirmed.' : 'Loading your account…'}</p>
      ) : (
        <div className="account-card">
          <CheckCircle2 size={32} color="#176b61" aria-hidden="true" />
          <h2>{admin ? 'Administrator access' : 'Your basic profile is complete'}</h2>
          <p className="account-intro">{message}</p>
          {!admin && (
            <>
              <button className="button button-secondary" onClick={() => navigate('/onboarding')}>
                Edit profile
              </button>
              <button className="auth-text-button" onClick={() => navigate('/profile/resume')}>
                Manage resume
              </button>
              <button className="auth-text-button" onClick={() => navigate('/#jobs')}>
                Browse sample jobs
              </button>
              {user?.provider === 'password' && googleAvailable && (
                <div className="account-google">
                  <h3>Connect Google</h3>
                  <p>
                    Use the Google account with the same email. Your existing account and profile
                    will be kept.
                  </p>
                  <label className="account-field">
                    <span>Confirm your current password</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      maxLength={128}
                      value={linkingPassword}
                      onChange={(event) => setLinkingPassword(event.target.value)}
                    />
                  </label>
                  <GoogleLogin
                    onSuccess={async (response) => {
                      try {
                        await completeGoogleSignIn(response, false, false, linkingPassword);
                        setLinkingPassword('');
                        setMessage('Google is connected to your account.');
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                    onError={() => setError('Google could not connect. Please try again.')}
                    text="continue_with"
                    useOneTap={false}
                    auto_select={false}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function SelectRole() {
  const { refresh } = useAuth();
  const [chosen, setChosen] = useState<'job_seeker' | 'employer' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const roles = [{ id: 'job_seeker' as const, icon: BriefcaseBusiness, title: "I'm looking for a job", copy: 'Create your profile, upload your resume, and receive job recommendations based on your skills, experience, and location.', button: 'Continue as Job Seeker' }, { id: 'employer' as const, icon: Building2, title: "I'm hiring", copy: 'Create your company profile, complete verification, and post employment opportunities for job seekers in MIMAROPA.', button: 'Continue as Employer' }];
  return <><p className="account-eyebrow">GET STARTED</p><h1>How would you like to use MIMAWork?</h1><p className="account-intro">Choose the option that best describes you. You can complete your profile after selecting your role.</p><p className="auth-form-error" role="alert">{error}</p><div className="role-grid">{roles.map((role) => { const Icon=role.icon; return <button key={role.id} className={`role-card ${chosen===role.id?'is-selected':''}`} onClick={() => { setChosen(role.id); setConfirm(true); }}><Icon size={32}/><h2>{role.title}</h2><p>{role.copy}</p><span className="button button-primary">{role.button}</span></button>; })}</div>{confirm && chosen && <div className="account-card role-confirm" role="dialog" aria-modal="true" aria-labelledby="role-confirm-title"><h2 id="role-confirm-title">Continue as {chosen === 'job_seeker' ? 'Job Seeker' : 'Employer'}?</h2><p>Your dashboard and onboarding process will be customized based on this role.</p><div className="account-form-actions"><button className="button button-secondary" onClick={() => setConfirm(false)}>Cancel</button><button className="button button-primary" disabled={busy} onClick={async () => { setBusy(true); try { const result=await api<AuthResult>('/role',{role:chosen}); await refresh(); navigate(result.redirect); } catch (e) { setError((e as Error).message); setConfirm(false); } finally { setBusy(false); } }}>{busy?'Saving…':'Confirm'}</button></div></div>}</>;
}

type Recommendation = { id:string; title:string; company_name:string; municipality:string; province:string; employment_type:string; work_setup:string; salary_min?:number; salary_max?:number; required_skills:string[]; match_percentage:number; matched_skills:string[]; missing_skills:string[]; skills_score:number; location_score:number; education_score:number; experience_score:number };
function RecommendedJobs() {
  const [items, setItems] = useState<Recommendation[] | null>(null); const [error, setError] = useState('');
  useEffect(() => { api<{recommendations:Recommendation[]}>('/jobs/recommended').then((r)=>setItems(r.recommendations)).catch((e: Error) => { if (e instanceof ApiError && e.status === 403) navigate('/onboarding/job-seeker'); else setError(e.message); }); }, []);
  const label=(score:number)=>score>=90?'Excellent Match':score>=80?'Strong Match':score>=70?'Good Match':score>=60?'Possible Match':'Low Match';
  return <><p className="account-eyebrow">AI-POWERED RECOMMENDATIONS</p><h1>Recommended for You</h1><p className="account-intro">Jobs selected based on your skills, experience, preferences, and location.</p>{error?<p role="alert">{error}</p>:!items?<p role="status">Finding jobs that match your profile…</p>:<div className="recommended-list">{items.map((job)=><article className="recommendation-card" key={job.id}><div><h2>{job.title}</h2><p>{job.company_name} · {job.municipality}, {job.province}</p><p>{job.required_skills.join(' · ')}</p></div><div><strong>{job.match_percentage}% Match</strong><p>{label(job.match_percentage)}</p><button className="button button-primary" onClick={()=>navigate(`/jobs/${job.id}`)}>View Job</button></div></article>)}</div>}</>;
}
function JobDetails({id}:{id:string}){const [data,setData]=useState<JobDetailResponse>();const [confirm,setConfirm]=useState(false);const [message,setMessage]=useState('');useEffect(()=>{api<JobDetailResponse>(`/jobs/${id}`).then(setData).catch((e:Error)=>setMessage(e.message));},[id]);if(!data)return <p>{message||'Loading job…'}</p>;const {job,match}=data;return <><button className="auth-text-button" onClick={()=>navigate('/jobs/recommended')}>← Recommended Jobs</button><div className="account-card"><h1>{job.title}</h1><p>{job.company_name} · {job.municipality}, {job.province}</p>{match&&<p>{match.match_percentage}% Match</p>}<p>{job.description}</p>{data.applied?<button className="button button-secondary" disabled>Applied</button>:<button className="button button-primary" onClick={()=>setConfirm(true)}>Apply Now</button>}</div>{confirm&&<div className="account-card role-confirm" role="dialog"><h2>Apply for {job.title}?</h2><button className="button button-secondary" onClick={()=>setConfirm(false)}>Cancel</button><button className="button button-primary" onClick={async()=>{await api(`/jobs/${id}/apply`,{});setMessage('Application submitted.');setConfirm(false);setData({...data,applied:true})}}>Submit Application</button></div>}{message&&<p className="account-notice">{message} <button className="auth-text-button" onClick={()=>navigate('/applications')}>View My Applications</button></p>}</>}
function MyApplications() {
  const [items,setItems]=useState<Application[]>([]);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    const load=()=>api<{applications:Application[]}>('/applications').then(r=>{if(active){setItems(r.applications);setError('');}}).catch((e:Error)=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    void load();window.addEventListener('focus',load);
    return ()=>{active=false;window.removeEventListener('focus',load);};
  },[]);
  return <><h1>My Applications</h1><p role="alert">{error}</p>{loading?<p role="status">Loading applications…</p>:items.length===0?<p>No applications yet.</p>:items.map(a=><article className="recommendation-card" key={a.id}><div><h2>{a.title}</h2><p>{a.company_name} · {a.municipality}, {a.province}</p><p>Applied {new Date(Number(a.applied_at)).toLocaleDateString()}</p></div><p>{a.match_score}% Match · {statusLabels[a.status]}</p></article>)}</>;
}

type ResumeRecord = { id:string; original_filename:string; file_size:number; parsing_status:string; analysis?: { detected_skills?:string[]; detected_education?:string } };
function ResumeSetup() {
  const [resume, setResume] = useState<ResumeRecord | null>(null), [file, setFile] = useState<File | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [skills, setSkills] = useState<string[]>([]), [useResume, setUseResume] = useState(false), [message, setMessage] = useState('');
  const load = () => api<{resume:ResumeRecord | null}>('/resume').then((r) => { setResume(r.resume); setSkills(r.resume?.analysis?.detected_skills ?? []); }).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, []);
  const submit = async () => { if (!file) return; if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf' || file.size > 5*1024*1024) { setError('Choose a PDF file up to 5 MB.'); return; } setBusy(true); setError(''); try { const result=await upload<{resume:ResumeRecord; message?:string}>('/resume', file); setResume(result.resume); setSkills(result.resume.analysis?.detected_skills ?? []); if (result.resume.parsing_status === 'failed') setError(result.message ?? 'We could not automatically read this resume.'); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  const merge = async () => { if (!resume) return; setBusy(true); try { const r=await api<{message:string}>(`/resume/${resume.id}/merge`, {skills, use_resume:useResume}); setMessage(r.message); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <><p className="account-eyebrow">STEP 4 OF 4</p><h1>Upload your resume</h1><p className="account-intro">Upload a PDF resume and we’ll help identify skills, education, and experience that may improve your job recommendations.</p><p className="auth-form-error" role="alert">{error}</p>{message && <p className="auth-success" role="status">{message}</p>}<div className="account-card resume-card">{!resume ? <><label className="resume-drop"><input type="file" accept="application/pdf,.pdf" onChange={(e)=>setFile(e.target.files?.[0] ?? null)}/><strong>Drag and drop your resume here</strong><span>or choose a PDF · Maximum 5 MB</span></label>{file&&<p>{file.name} · {(file.size/1024).toFixed(0)} KB</p>}<div className="account-form-actions"><button className="button button-secondary" onClick={()=>navigate('/jobs/recommended')}>Skip for Now</button><button className="button button-primary" disabled={!file||busy} onClick={()=>void submit()}>{busy?'Analyzing your resume…':'Upload Resume'}</button></div></> : resume.parsing_status !== 'completed' ? <><h2>We couldn’t automatically read this resume.</h2><p>Your existing profile is safe and you can continue using it.</p><button className="button button-primary" onClick={()=>navigate('/jobs/recommended')}>Continue Without Resume</button></> : <><h2>We found these details in your resume</h2><p>{resume.original_filename} · {(resume.file_size/1024).toFixed(0)} KB · Analyzed</p><h3>Skills</h3>{skills.map((skill)=><label className="resume-skill" key={skill}><input type="checkbox" checked onChange={()=>setSkills(skills.filter((s)=>s!==skill))}/>{skill}<button type="button" onClick={()=>setSkills(skills.filter((s)=>s!==skill))}>Remove</button></label>)}<label className="account-field"><span>Add another skill</span><input onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault(); const value=(e.target as HTMLInputElement).value.trim(); if(value&&!skills.includes(value))setSkills([...skills,value]); (e.target as HTMLInputElement).value='';}}}/></label><h3>Education</h3><p>Detected: {resume.analysis?.detected_education ?? 'No education detected'}</p><label><input type="checkbox" checked={useResume} onChange={(e)=>setUseResume(e.target.checked)}/> Use detected education, course, and experience instead of current values</label><div className="account-form-actions"><button className="button button-secondary" onClick={()=>navigate('/jobs/recommended')}>Ignore</button><button className="button button-primary" disabled={busy} onClick={()=>void merge()}>{busy?'Saving…':'Add to Profile'}</button></div><button className="auth-text-button" onClick={async()=>{await api(`/resume/${resume.id}`,{},'DELETE');setResume(null);}}>Remove Resume</button></>}</div>{message&&<button className="button button-primary" onClick={()=>navigate('/jobs/recommended')}>View Updated Recommendations</button>}</>;
}

type EmployerProfile = Record<string,string> & { verification_status?: string; verification_reason?: string };
const EMPTY_EMPLOYER: EmployerProfile = { company_name:'',industry:'',description:'',address:'',province:'',municipality:'',company_size:'',contact_person:'',contact_position:'',business_email:'',contact_number:'',website:'' };
function EmployerOnboarding() {
  const [step,setStep]=useState(0),[profile,setProfile]=useState<EmployerProfile>(EMPTY_EMPLOYER),[files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{api<{profile:EmployerProfile|null}>('/employer/profile').then(r=>r.profile&&setProfile(r.profile)).catch(e=>setError(e.message));},[]);
  const input=(key:string,label:string, options?:string[]) => <label className="account-field"><span>{label}</span>{options?<select value={profile[key]||''} onChange={e=>setProfile({...profile,[key]:e.target.value})}><option value="">Select {label}</option>{options.map(v=><option key={v}>{v}</option>)}</select>:<input value={profile[key]||''} onChange={e=>setProfile({...profile,[key]:e.target.value})} type={key==='business_email'?'email':'text'}/>}</label>;
  const save=async()=>{setBusy(true);try{await api('/employer/profile',profile,'PUT');setStep(2);}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
  const submit=async()=>{setBusy(true);try{await uploadFiles('/employer/verification',files);navigate('/employer/verification-status')}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
  return <><p className="account-eyebrow">EMPLOYER ONBOARDING</p><h1>Set up your company profile</h1><ol className="onboarding-steps">{['Company Information','Contact Information','Verification Documents','Review & Submit'].map((x,i)=><li key={x} aria-current={step===i?'step':undefined}><span>{i+1}</span>{x}</li>)}</ol><p role="alert" className="auth-form-error">{error}</p><div className="account-card">{step===0&&<>{input('company_name','Company Name')}{input('industry','Industry')}{input('description','Company Description')}{input('province','Province',PROVINCES)}{input('municipality','Municipality / City')}{input('address','Complete Business Address')}{input('company_size','Company Size',['1–9','10–49','50–249','250+'])}<button className="button button-primary" onClick={()=>setStep(1)}>Continue</button></>}{step===1&&<>{input('contact_person','Contact Person')}{input('contact_position','Position / Role')}{input('business_email','Business Email')}{input('contact_number','Contact Number')}{input('website','Company Website') }<div className="account-form-actions"><button className="button button-secondary" onClick={()=>setStep(0)}>Back</button><button className="button button-primary" disabled={busy} onClick={()=>void save()}>Save and continue</button></div></>}{step===2&&<><h2>Verify your company</h2><p>Verification helps protect job seekers from fake or unauthorized job postings.</p><label className="resume-drop"><input multiple type="file" accept="application/pdf,image/png,image/jpeg" onChange={e=>setFiles(Array.from(e.target.files||[]))}/><strong>Choose Business Registration, Business Permit, or Representative ID</strong><span>PDF, PNG, JPG · Maximum 8 MB each</span></label>{files.map(f=><p key={f.name}>{f.name} · {(f.size/1024).toFixed(0)} KB</p>)}<div className="account-form-actions"><button className="button button-secondary" onClick={()=>setStep(1)}>Back</button><button className="button button-primary" disabled={!files.length} onClick={()=>setStep(3)}>Continue</button></div></>}{step===3&&<><h2>Review & submit</h2><p><strong>{profile.company_name}</strong> · {profile.industry}</p><p>{profile.contact_person} · {profile.business_email}</p><p>{profile.municipality}, {profile.province}</p><p>{files.length} verification document(s) selected</p><div className="account-form-actions"><button className="button button-secondary" onClick={()=>setStep(2)}>Replace documents</button><button className="button button-primary" disabled={busy} onClick={()=>void submit()}>{busy?'Submitting…':'Submit for Verification'}</button></div></>}</div></>;
}
function VerificationStatus(){const [p,setP]=useState<EmployerProfile|null>(null);useEffect(()=>{api<{profile:EmployerProfile|null}>('/employer/profile').then(r=>setP(r.profile));},[]);if(!p)return <p>Loading company status…</p>;return <div className="account-card"><p className="account-eyebrow">VERIFICATION STATUS</p><h1>{p.verification_status==='verified'?'Company verified':p.verification_status==='rejected'?'Verification rejected':'Your company is under review'}</h1><p>{p.verification_status==='verified'?'You can now publish job opportunities.':p.verification_status==='rejected'?`Reason: ${p.verification_reason}`:'You can save job drafts, but you cannot publish jobs yet.'}</p><button className="button button-primary" onClick={()=>navigate(p.verification_status==='verified'?'/employer/dashboard':'/onboarding/employer')}>{p.verification_status==='verified'?'Open dashboard':'Update verification documents'}</button></div>}

export function AccountPage({ path }: { path: string }) {
  const { user, loading, sessionError, signOut, refresh } = useAuth();
  const titleId = useId();
  const descriptionId = useId();
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '',
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const protectedRoute = ['/onboarding', '/onboarding/select-role', '/onboarding/job-seeker', '/onboarding/job-seeker/resume', '/profile/resume', '/onboarding/employer', '/employer/verification-status', '/employer/dashboard', '/dashboard', '/admin', '/jobs/recommended', '/applications'].includes(path) || path.startsWith('/jobs/');
  const publicAuth = ['/login', '/register', '/admin/login', '/reset-password'].includes(path);
  useEffect(() => {
    if (token) window.history.replaceState({}, '', path);
    document.title = `${path.includes('admin') ? 'Administrator' : path === '/onboarding' ? 'Profile setup' : path === '/dashboard' ? 'My account' : 'Account access'} | MIMAROPA Works`;
    return () => {
      document.title = 'MIMAROPA Works';
    };
  }, [path, token]);
  useEffect(() => {
    if (!loading && !sessionError && protectedRoute && !user)
      navigate(path === '/admin' ? '/admin/login' : '/login');
    if (!loading && user && user.role !== 'admin' && protectedRoute && !user.roleSelected && path !== '/onboarding/select-role') navigate('/onboarding/select-role');
    if (!loading && user && user.roleSelected && ['/', '/dashboard'].includes(path) && user.profileCompletion < 100) navigate('/onboarding/job-seeker');
  }, [loading, sessionError, protectedRoute, user, path]);
  const success = (result: AuthResult) => navigate(result.redirect);
  return (
    <div className="account-page">
      <header className="account-header">
        <Brand href="/" />
        {user && (
          <button
            className="auth-text-button"
            onClick={async () => {
              try {
                await signOut();
                navigate('/');
              } catch (err) {
                setMessage((err as Error).message);
              }
            }}
          >
            Sign out
          </button>
        )}
      </header>
      <main className={publicAuth ? 'account-auth-shell' : 'account-shell'}>
        {!publicAuth && user?.role === 'job_seeker' && user.roleSelected && <SeekerNav path={path} />}
        <button className="auth-text-button account-back" onClick={() => navigate('/')}>
          <ArrowLeft size={17} /> Back to home
        </button>
        {message && (
          <p className="account-notice" role="status">
            {message}
          </p>
        )}
        {path === '/verify-email' ? (
          <div className="account-card">
            <h1>Verify your email</h1>
            <p className="account-intro">Confirm your email to finish setting up your account.</p>
            <button
              className="button button-primary"
              disabled={busy || !token}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api<{ message: string }>('/auth/verify-email', { token });
                  setMessage(result.message);
                  await refresh();
                } catch (err) {
                  setMessage((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Verifying…' : 'Verify email'}
            </button>
            {!token && <p role="alert">Open the complete link from your verification email.</p>}
            {user && !user.emailVerified && (
              <button
                className="auth-text-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await api<{ message: string }>('/auth/resend-verification', {});
                    setMessage(result.message);
                  } catch (err) {
                    setMessage((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send another verification email
              </button>
            )}
            <button
              className="auth-text-button"
              onClick={() => navigate(user ? '/onboarding' : '/login')}
            >
              Continue to your account
            </button>
          </div>
        ) : publicAuth ? (
          <div className="account-auth-card">
            <AuthForm
              initialMode={
                path === '/register' ? 'register' : path === '/reset-password' ? 'reset' : 'login'
              }
              admin={path === '/admin/login'}
              token={token}
              titleId={titleId}
              descriptionId={descriptionId}
              onSuccess={success}
            />
          </div>
        ) : loading ? (
          <p role="status">Loading your account…</p>
        ) : sessionError ? (
          <div role="alert">
            <p>{sessionError}</p>
            <button className="button button-primary" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        ) : protectedRoute && user ? (
          path === '/onboarding/select-role' ? <SelectRole /> :
          path === '/onboarding' || path === '/onboarding/job-seeker' ? <ProfileSetup /> :
          path === '/onboarding/employer' ? <EmployerOnboarding /> : path === '/employer/verification-status' ? <VerificationStatus /> : path === '/onboarding/job-seeker/resume' || path === '/profile/resume' ? <ResumeSetup /> : path === '/jobs/recommended' ? <RecommendedJobs /> : path === '/applications' ? <MyApplications /> : path.startsWith('/jobs/') ? <JobDetails id={path.split('/')[2]} /> : <Dashboard admin={path === '/admin'} />
        ) : protectedRoute ? (
          <p role="status">Opening login…</p>
        ) : (
          <div className="account-card">
            <h1>Page not found</h1>
            <p>Return home to find jobs or access your account.</p>
          </div>
        )}
      </main>
    </div>
  );
}

