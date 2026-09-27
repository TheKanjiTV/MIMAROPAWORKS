import { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Trash2,
  Download,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { api, upload } from '@/auth/api';
import { navigate } from '@/auth/navigation';

interface ResumeAnalysis {
  detected_skills?: string[];
  detected_education?: string;
  detected_course?: string;
  detected_job_titles?: string[];
  experience_snippets?: string[];
  resume_text_available?: boolean;
}

interface ResumeRecord {
  id: string;
  original_filename: string;
  file_size: number;
  parsing_status: string;
  analysis?: ResumeAnalysis;
  uploaded_at: number;
}

export function ResumePage() {
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  useEffect(() => {
    const loadResume = async () => {
      try {
        const res = await api<{ resume: ResumeRecord | null }>('/resume');
        setResume(res.resume);
        if (res.resume?.analysis?.detected_skills) {
          setSelectedSkills(res.resume.analysis.detected_skills);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load resume.');
      } finally {
        setLoading(false);
      }
    };
    void loadResume();
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 5 * 1024 * 1024) {
      setError('Please choose a PDF file up to 5 MB.');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');
    try {
      const res = await upload<{ resume: ResumeRecord; message?: string }>('/resume', file);
      setResume(res.resume);
      if (res.resume.analysis?.detected_skills) {
        setSelectedSkills(res.resume.analysis.detected_skills);
      }
      setFile(null);
      setMessage(res.message || 'Resume uploaded and analyzed successfully.');
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', { detail: { message: 'Resume uploaded and analyzed.' } }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleMergeToProfile = async () => {
    if (!resume) return;
    setMerging(true);
    setError('');
    try {
      const res = await api<{ message: string }>(`/resume/${resume.id}/merge`, {
        skills: selectedSkills,
        use_resume: true,
      });
      setMessage(res.message);
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', {
          detail: { message: 'Resume details merged into profile!' },
        }),
      );
      window.dispatchEvent(new Event('mimawork:updates'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile from resume.');
    } finally {
      setMerging(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!resume) return;
    if (!window.confirm('Are you sure you want to remove your uploaded resume?')) return;
    try {
      await api(`/resume/${resume.id}`, {}, 'DELETE');
      setResume(null);
      setSelectedSkills([]);
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', { detail: { message: 'Resume removed.' } }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove resume.');
    }
  };

  const handleDownload = () => {
    if (!resume) return;
    window.open(`/api/resume/${resume.id}/file`, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto py-6">
        <div className="sw-skeleton h-24 rounded-xl" />
        <div className="sw-skeleton h-48 rounded-xl" />
      </div>
    );
  }

  const analysis = resume?.analysis;
  const detectedSkills = analysis?.detected_skills || [];
  const detectedEducation = analysis?.detected_education;
  const detectedTitles = analysis?.detected_job_titles || [];

  // Descriptive analysis counts without fabricating numbers
  const sectionCount =
    (detectedSkills.length > 0 ? 1 : 0) +
    (detectedEducation ? 1 : 0) +
    (detectedTitles.length > 0 ? 1 : 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        <a
          href="/dashboard"
          onClick={(e) => {
            e.preventDefault();
            navigate('/dashboard');
          }}
          className="hover:underline text-slate-600"
        >
          Home
        </a>
        <ChevronRight size={13} className="text-slate-400" />
        <a
          href="/profile"
          onClick={(e) => {
            e.preventDefault();
            navigate('/profile');
          }}
          className="hover:underline text-slate-600"
        >
          Profile
        </a>
        <ChevronRight size={13} className="text-slate-400" />
        <span className="text-slate-900 font-medium">Resume</span>
      </nav>

      {/* Header Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <span className="text-xs font-bold text-[#176b61] uppercase tracking-wider block mb-1">
          Document Management
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Your Resume</h1>
        <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
          Upload a PDF resume to automatically detect key skills, education credentials, and work
          experience to power AI matching across MIMAROPA.
        </p>
      </section>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg font-medium flex items-center gap-2">
          <CheckCircle2 size={16} /> {message}
        </div>
      )}

      {/* Current Resume Card */}
      {resume ? (
        <section className="sw-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 text-[#176b61] flex items-center justify-center shrink-0">
                <FileText size={24} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                  {resume.original_filename}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>{(resume.file_size / 1024).toFixed(0)} KB</span>
                  <span>•</span>
                  <span>
                    Uploaded on{' '}
                    {new Date(Number(resume.uploaded_at)).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="sw-badge sw-badge-match text-xs">✓ Analyzed</span>
              <button
                type="button"
                onClick={handleDownload}
                className="sw-btn sw-btn-secondary sw-btn-sm"
                title="Download original PDF"
              >
                <Download size={14} /> Download
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteResume()}
                className="sw-btn sw-btn-secondary sw-btn-sm text-rose-600 hover:text-rose-700"
                title="Remove resume"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Genuine AI Resume Analysis (No fabricated percentages) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-[#176b61]" /> AI Resume Analysis
                </h3>
                <p className="text-xs text-slate-500">
                  {sectionCount} key {sectionCount === 1 ? 'section' : 'sections'} identified from
                  your document text.
                </p>
              </div>

              {detectedSkills.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMergeToProfile()}
                  disabled={merging}
                  className="sw-btn sw-btn-primary sw-btn-sm"
                >
                  {merging ? 'Saving…' : 'Add to Profile'}
                </button>
              )}
            </div>

            {/* Detected Skills */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">
                Detected Skills ({detectedSkills.length})
              </span>
              {detectedSkills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detectedSkills.map((skill) => {
                    const isChecked = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setSelectedSkills(selectedSkills.filter((s) => s !== skill));
                          } else {
                            setSelectedSkills([...selectedSkills, skill]);
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                          isChecked
                            ? 'bg-teal-50 border-[#176b61] text-[#176b61] font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isChecked && <CheckCircle2 size={12} />}
                        {skill}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No exact catalog skills detected.</p>
              )}
            </div>

            {/* Detected Education & Experience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="text-slate-500 block mb-1">Detected Education:</span>
                <span className="font-semibold text-slate-800">
                  {detectedEducation || 'Not specifically identified'}
                </span>
                {analysis?.detected_course && (
                  <p className="text-xs text-slate-600 mt-1">{analysis.detected_course}</p>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="text-slate-500 block mb-1">Detected Experience / Titles:</span>
                <span className="font-semibold text-slate-800">
                  {detectedTitles.length
                    ? detectedTitles.join(', ')
                    : 'Not specifically identified'}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Upload Area */
        <section className="sw-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-teal-50 text-[#176b61] flex items-center justify-center mx-auto">
            <UploadCloud size={30} />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Upload your PDF Resume</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Choose a PDF document up to 5 MB. Our AI analyzer extracts your skills and education
              to build your profile.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <label className="border-2 border-dashed border-slate-300 hover:border-[#176b61] rounded-xl p-6 flex flex-col items-center cursor-pointer transition bg-slate-50 hover:bg-white">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <span className="text-xs font-semibold text-slate-700">
                {file ? file.name : 'Click to select or drag and drop your PDF resume'}
              </span>
              <span className="text-xs text-slate-400 mt-1">PDF format • Maximum 5 MB</span>
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setFile(null)}
                className="sw-btn sw-btn-secondary sw-btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploading}
                className="sw-btn sw-btn-primary sw-btn-sm"
              >
                {uploading ? 'Analyzing Document…' : 'Upload & Analyze Resume'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Replace Resume Option if one already exists */}
      {resume && (
        <section className="sw-card p-5 bg-slate-50 border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Need to update your resume?
              </h3>
              <p className="text-xs text-slate-500">
                Uploading a new version replaces your current resume and runs fresh analysis.
              </p>
            </div>
            <label className="sw-btn sw-btn-secondary sw-btn-sm cursor-pointer shrink-0">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const newF = e.target.files?.[0];
                  if (newF) {
                    setFile(newF);
                    // trigger upload
                    const form = new FormData();
                    form.append('resume', newF);
                    setUploading(true);
                    upload<{ resume: ResumeRecord }>('/resume', newF)
                      .then((res) => {
                        setResume(res.resume);
                        if (res.resume.analysis?.detected_skills) {
                          setSelectedSkills(res.resume.analysis.detected_skills);
                        }
                        window.dispatchEvent(
                          new CustomEvent('mimawork:toast', {
                            detail: { message: 'Resume replaced and analyzed.' },
                          }),
                        );
                      })
                      .catch((err: Error) => setError(err.message))
                      .finally(() => setUploading(false));
                  }
                }}
              />
              Replace Resume PDF
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
