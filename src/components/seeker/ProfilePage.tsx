import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  FileText,
  Edit3,
  Plus,
  X,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import { Modal } from '@/components/Modal';
import type { ProfessionalProfile } from '@/types/seeker';

const PROVINCES = ['Oriental Mindoro', 'Occidental Mindoro', 'Marinduque', 'Romblon', 'Palawan'];

const WORK_SETUPS = ['On-site', 'Hybrid', 'Remote', 'Open to any setup'];
const EDUCATION_LEVELS = [
  'Elementary',
  'Junior High School',
  'Senior High School',
  'Vocational / TESDA',
  'College Undergraduate',
  'Associate Degree',
  "Bachelor's Degree",
  'Postgraduate',
];

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing state
  const urlParams = new URLSearchParams(window.location.search);
  const initialEdit = urlParams.get('edit') === '1';
  const [editSection, setEditSection] = useState<string | null>(initialEdit ? 'all' : null);
  const [formData, setFormData] = useState<Partial<Omit<ProfessionalProfile, 'resume'>>>({});
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api<{ profile: ProfessionalProfile }>('/job-seeker/professional-profile');
        setProfile(res.profile);
        setFormData(res.profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load profile.');
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, []);

  const openEdit = (section: string) => {
    if (profile) setFormData({ ...profile });
    setEditSection(section);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditSection(null);
    if (initialEdit) navigate('/profile', { replace: true });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api<{ profile: ProfessionalProfile }>(
        '/job-seeker/professional-profile',
        {
          preferred_job: formData.preferred_job ?? '',
          about: formData.about ?? '',
          education: formData.education ?? '',
          course: formData.course ?? '',
          province: formData.province ?? '',
          municipality: formData.municipality ?? '',
          work_setup: formData.work_setup ?? '',
          skills: formData.skills ?? [],
          recent_job_title: formData.recent_job_title ?? '',
          experience_years: formData.experience_years ?? 0,
          experience_snippets: formData.experience_snippets ?? [],
          career_interests: formData.career_interests ?? [],
          ...(typeof formData.willing_to_relocate === 'boolean'
            ? { willing_to_relocate: formData.willing_to_relocate }
            : {}),
        },
        'PUT',
      );
      setProfile(res.profile);
      setEditSection(null);
      if (initialEdit) navigate('/profile', { replace: true });
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', { detail: { message: 'Profile updated successfully.' } }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && formData.skills && !formData.skills.includes(newSkill.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, newSkill.trim()],
      });
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    if (formData.skills) {
      setFormData({
        ...formData,
        skills: formData.skills.filter((s) => s !== skill),
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto py-6">
        <div className="sw-skeleton h-28 rounded-xl" />
        <div className="sw-skeleton h-48 rounded-xl" />
      </div>
    );
  }

  const completion = user?.profileCompletion ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Profile Header Banner */}
      <section className="sw-card p-6 md:p-8 bg-white border border-slate-200 shadow-sm relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#176b61] to-[#203f78] text-white text-2xl font-bold flex items-center justify-center shrink-0 shadow-md">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                user?.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">{user?.name}</h1>
              <p className="text-sm font-semibold text-[#176b61] mt-0.5">
                {profile?.preferred_job || 'Aspiring Professional'}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-slate-400" />
                  {profile?.municipality || 'Calapan'}, {profile?.province || 'Oriental Mindoro'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Mail size={13} className="text-slate-400" />
                  {user?.email}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openEdit('all')}
            className="sw-btn sw-btn-primary sw-btn-sm shrink-0"
          >
            <Edit3 size={14} /> Edit Profile
          </button>
        </div>

        {/* Profile Completeness Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-50 text-[#176b61] flex items-center justify-center shrink-0 font-bold text-xs">
              <TrendingUp size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800">Profile Strength</span>
              <p className="text-xs text-slate-500">
                A complete profile boosts visibility and matching accuracy.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-48">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#176b61] rounded-full transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <span className="text-xs font-bold text-[#176b61]">{completion}%</span>
          </div>
        </div>
      </section>

      {/* Profile Sections Grid */}
      <div className="space-y-4">
        {/* About Section */}
        <section className="sw-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User size={16} className="text-[#176b61]" /> About Me
            </h2>
            <button
              type="button"
              onClick={() => openEdit('about')}
              className="text-xs text-[#176b61] hover:underline font-semibold flex items-center gap-1"
            >
              <Edit3 size={12} /> Edit
            </button>
          </div>
          <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
            {profile?.about ||
              'No summary provided yet. Share a brief introduction highlighting your career objectives, work ethic, and background.'}
          </p>
        </section>

        {/* Experience Section */}
        <section className="sw-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Briefcase size={16} className="text-[#176b61]" /> Professional Experience
            </h2>
            <button
              type="button"
              onClick={() => openEdit('experience')}
              className="text-xs text-[#176b61] hover:underline font-semibold flex items-center gap-1"
            >
              <Edit3 size={12} /> Edit
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Total Experience:</span>
              <span className="font-semibold text-slate-800">
                {profile?.experience_years
                  ? `${profile.experience_years} years`
                  : '0 years (Entry Level)'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Recent / Target Role:</span>
              <span className="font-semibold text-slate-800">
                {profile?.recent_job_title || profile?.preferred_job || 'Not specified'}
              </span>
            </div>
            {profile?.experience_snippets && profile.experience_snippets.length > 0 && (
              <div className="pt-2">
                <span className="text-slate-500 block mb-1">Highlights:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  {profile.experience_snippets.map((snip, i) => (
                    <li key={i}>{snip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Education Section */}
        <section className="sw-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap size={16} className="text-[#176b61]" /> Education
            </h2>
            <button
              type="button"
              onClick={() => openEdit('education')}
              className="text-xs text-[#176b61] hover:underline font-semibold flex items-center gap-1"
            >
              <Edit3 size={12} /> Edit
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Highest Attainment:</span>
              <span className="font-semibold text-slate-800">
                {profile?.education || 'Not specified'}
              </span>
            </div>
            {profile?.course && (
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Course / Major:</span>
                <span className="font-semibold text-slate-800">{profile.course}</span>
              </div>
            )}
          </div>
        </section>

        {/* Skills Section */}
        <section className="sw-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={16} className="text-[#176b61]" /> Skills & Competencies
            </h2>
            <button
              type="button"
              onClick={() => openEdit('skills')}
              className="text-xs text-[#176b61] hover:underline font-semibold flex items-center gap-1"
            >
              <Edit3 size={12} /> Edit
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(profile?.skills || []).length > 0 ? (
              profile!.skills.map((skill) => (
                <span key={skill} className="sw-chip py-1 px-2.5 text-xs">
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-xs text-slate-400">No skills listed yet.</p>
            )}
          </div>
        </section>

        {/* Job & Location Preferences */}
        <section className="sw-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin size={16} className="text-[#176b61]" /> Job & Location Preferences
            </h2>
            <button
              type="button"
              onClick={() => openEdit('preferences')}
              className="text-xs text-[#176b61] hover:underline font-semibold flex items-center gap-1"
            >
              <Edit3 size={12} /> Edit
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-500 block mb-1">Preferred Work Setup:</span>
              <span className="font-semibold text-slate-800">{profile?.work_setup || 'Any'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-500 block mb-1">Preferred Location:</span>
              <span className="font-semibold text-slate-800">
                {profile?.municipality}, {profile?.province}
              </span>
            </div>
          </div>
        </section>

        {/* Documents / Resume Card */}
        <section className="sw-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-[#176b61]" /> Uploaded Resume
            </h2>
            <button
              type="button"
              onClick={() => navigate('/profile/resume')}
              className="text-xs text-[#176b61] hover:underline font-semibold flex items-center gap-1"
            >
              Manage Resume <ChevronRight size={13} />
            </button>
          </div>

          {profile?.resume ? (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#176b61] flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block truncate max-w-xs">
                    {profile.resume.original_filename}
                  </span>
                  <span className="text-xs text-slate-500">
                    {(profile.resume.file_size / 1024).toFixed(0)} KB • Analyzed
                  </span>
                </div>
              </div>
              <span className="sw-badge sw-badge-match text-xs">Active Resume</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>No resume uploaded yet.</span>
              <button
                type="button"
                onClick={() => navigate('/profile/resume')}
                className="sw-btn sw-btn-primary sw-btn-sm"
              >
                Upload Resume
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Edit Profile Modal */}
      {editSection && (
        <Modal
          isOpen={Boolean(editSection)}
          onClose={closeEdit}
          titleId="edit-title"
          descriptionId="edit-desc"
          className="profile-edit-dialog space-y-5"
        >
          <div className="flex justify-between items-start">
            <div>
              <h2 id="edit-title" className="text-lg font-bold text-slate-900">
                Edit Professional Profile
              </h2>
              <p id="edit-desc" className="text-xs text-slate-500">
                Update your professional details to keep employers informed.
              </p>
            </div>
            <button
              type="button"
              onClick={closeEdit}
              aria-label="Close profile editor"
              disabled={saving}
              className="text-slate-400 hover:text-slate-600"
              data-modal-close
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="space-y-4 text-xs"
          >
            {/* Preferred Role */}
            <div>
              <label htmlFor="profile-job-role" className="font-semibold text-slate-700 block mb-1">
                Preferred Job Role
              </label>
              <input
                id="profile-job-role"
                type="text"
                value={formData.preferred_job || ''}
                onChange={(e) => setFormData({ ...formData, preferred_job: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
              />
            </div>

            {/* About */}
            <div>
              <label htmlFor="profile-about" className="font-semibold text-slate-700 block mb-1">
                About Me
              </label>
              <textarea
                id="profile-about"
                rows={3}
                value={formData.about || ''}
                onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                placeholder="Brief professional introduction..."
              />
            </div>

            {/* Education */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-education"
                  className="font-semibold text-slate-700 block mb-1"
                >
                  Education Level
                </label>
                <select
                  id="profile-education"
                  value={formData.education || ''}
                  onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 bg-white"
                >
                  <option value="">Select education level</option>
                  {formData.education && !EDUCATION_LEVELS.includes(formData.education) && (
                    <option value={formData.education}>{formData.education}</option>
                  )}
                  {EDUCATION_LEVELS.map((ed) => (
                    <option key={ed} value={ed}>
                      {ed}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="profile-course" className="font-semibold text-slate-700 block mb-1">
                  Course / Major
                </label>
                <input
                  id="profile-course"
                  type="text"
                  value={formData.course || ''}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                  placeholder="e.g. BS Information Tech"
                />
              </div>
            </div>

            {/* Province & Municipality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-province"
                  className="font-semibold text-slate-700 block mb-1"
                >
                  Province
                </label>
                <select
                  id="profile-province"
                  value={formData.province || ''}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 bg-white"
                >
                  <option value="">Select province</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="profile-city" className="font-semibold text-slate-700 block mb-1">
                  Municipality / City
                </label>
                <input
                  id="profile-city"
                  type="text"
                  value={formData.municipality || ''}
                  onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>
            </div>

            {/* Work Setup */}
            <div>
              <label htmlFor="profile-setup" className="font-semibold text-slate-700 block mb-1">
                Preferred Setup
              </label>
              <select
                id="profile-setup"
                value={formData.work_setup || ''}
                onChange={(e) => setFormData({ ...formData, work_setup: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 bg-white"
              >
                <option value="">Select work setup</option>
                {WORK_SETUPS.map((ws) => (
                  <option key={ws} value={ws}>
                    {ws}
                  </option>
                ))}
              </select>
            </div>

            {/* Skills */}
            <div>
              <label
                htmlFor="profile-add-skill"
                className="font-semibold text-slate-700 block mb-1"
              >
                Skills
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  id="profile-add-skill"
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Type a skill and press Add"
                  className="flex-1 border border-slate-300 rounded-lg p-2 text-slate-900"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="sw-btn sw-btn-secondary sw-btn-sm shrink-0"
                >
                  <Plus size={14} /> Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                {(formData.skills || []).map((s) => (
                  <span
                    key={s}
                    className="sw-chip bg-white border border-slate-200 py-1 px-2 text-xs flex items-center gap-1"
                  >
                    {s}
                    <button
                      type="button"
                      aria-label={`Remove ${s}`}
                      onClick={() => removeSkill(s)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <details className="profile-experience-fields" open={editSection === 'experience'}>
              <summary className="font-semibold text-slate-800 cursor-pointer py-3">
                Experience and career interests
              </summary>
              <div className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-recent-role"
                      className="font-semibold text-slate-700 block"
                    >
                      Most recent role
                    </label>
                    <input
                      id="profile-recent-role"
                      maxLength={150}
                      value={formData.recent_job_title || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, recent_job_title: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-years" className="font-semibold text-slate-700 block">
                      Years of experience
                    </label>
                    <input
                      id="profile-years"
                      type="number"
                      min={0}
                      max={80}
                      step={0.5}
                      value={formData.experience_years ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, experience_years: Number(e.target.value) })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2.5"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="profile-highlights"
                    className="font-semibold text-slate-700 block"
                  >
                    Experience highlights
                  </label>
                  <p id="profile-highlights-help" className="text-slate-600 mb-2">
                    Write one work, school, or volunteer example per line. Add up to 20 examples.
                  </p>
                  <textarea
                    id="profile-highlights"
                    aria-describedby="profile-highlights-help"
                    rows={4}
                    value={(formData.experience_snippets || []).join('\n')}
                    onChange={(e) =>
                      setFormData({ ...formData, experience_snippets: e.target.value.split('\n') })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label htmlFor="profile-interests" className="font-semibold text-slate-700 block">
                    Career interests
                  </label>
                  <p id="profile-interests-help" className="text-slate-600 mb-2">
                    Write one role or field of interest per line.
                  </p>
                  <textarea
                    id="profile-interests"
                    aria-describedby="profile-interests-help"
                    rows={3}
                    value={(formData.career_interests || []).join('\n')}
                    onChange={(e) =>
                      setFormData({ ...formData, career_interests: e.target.value.split('\n') })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
              </div>
            </details>

            <div className="profile-form-actions border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="sw-btn sw-btn-secondary sw-btn-sm"
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="sw-btn sw-btn-primary sw-btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
