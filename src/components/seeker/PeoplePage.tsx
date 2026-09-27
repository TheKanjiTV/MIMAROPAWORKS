import { useState, useEffect } from 'react';
import { Search, Building2, MapPin, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import { Modal } from '@/components/Modal';
import { ListPagination } from './ListPagination';
import type { SeekerCompany, SeekerJob } from '@/types/seeker';

const PROVINCES = [
  'All Provinces',
  'Oriental Mindoro',
  'Occidental Mindoro',
  'Marinduque',
  'Romblon',
  'Palawan',
];

export function PeoplePage({ path }: { path: string }) {
  const [companies, setCompanies] = useState<SeekerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedProvince, setSelectedProvince] = useState('All Provinces');
  const [filterType, setFilterType] = useState<'all' | 'contacts'>('all');

  // Detail modal / view for /people/:id
  const detailId = path.split('/')[2];
  const [detailResult, setDetailResult] = useState<{
    id: string;
    data: { company: SeekerCompany; jobs: SeekerJob[] } | null;
    error: string;
  } | null>(null);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const selectedCompany = detailResult && detailResult.id === detailId ? detailResult.data : null;
  const detailError = detailResult && detailResult.id === detailId ? detailResult.error : '';
  const loadingDetail = Boolean(detailId && detailResult?.id !== detailId);

  useEffect(() => {
    let active = true;
    api<{ companies: SeekerCompany[] }>('/discovery/companies')
      .then((res) => {
        if (active) setCompanies(res.companies);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [directoryAttempt]);

  // Load detail if detailId is present
  useEffect(() => {
    if (!detailId) return;
    let active = true;
    api<{ company: SeekerCompany; jobs: SeekerJob[] }>(
      `/discovery/companies/${encodeURIComponent(detailId)}`,
    )
      .then((res) => {
        if (active) setDetailResult({ id: detailId, data: res, error: '' });
      })
      .catch((err: Error) => {
        if (active)
          setDetailResult({
            id: detailId,
            data: null,
            error: err.message || 'Could not load company details.',
          });
      });
    return () => {
      active = false;
    };
  }, [detailId, detailAttempt]);

  const filtered = companies.filter((c) => {
    if (filterType === 'contacts' && !c.contact_person?.trim()) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const searchable = [
        c.company_name,
        c.industry,
        c.contact_person,
        c.contact_position,
        c.municipality,
        c.province,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    if (selectedProvince !== 'All Provinces' && c.province !== selectedProvince) {
      return false;
    }
    return true;
  });

  const pageSize = 20;
  const page = Math.min(pageNumber, Math.max(1, Math.ceil(filtered.length / pageSize)));
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {loadingDetail && (
        <p role="status" className="text-sm text-slate-600">
          Opening company details…
        </p>
      )}
      {detailError && (
        <div role="alert" className="sw-alert">
          <p>Company details could not load. {detailError}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="sw-btn sw-btn-primary"
              onClick={() => {
                setDetailResult(null);
                setDetailAttempt((attempt) => attempt + 1);
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="sw-btn sw-btn-secondary"
              onClick={() => navigate('/people')}
            >
              Back to directory
            </button>
          </div>
        </div>
      )}
      {/* Header Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Discover People & Organizations</h1>
        <p className="text-sm text-slate-600 max-w-2xl leading-relaxed mb-4">
          Connect with verified employers, recruiters, and hiring managers in MIMAROPA. Explore
          active company vacancies and verified organizational profiles.
        </p>

        {/* Directory Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1">
            <label
              htmlFor="directory-search"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Search organizations or hiring contacts
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <Search size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
              <input
                id="directory-search"
                type="search"
                placeholder="Search companies, recruiters, or industry..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPageNumber(1);
                }}
                className="w-full bg-transparent text-xs text-slate-900 focus:outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="sm:w-56">
            <label
              htmlFor="directory-province"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Province
            </label>
            <select
              id="directory-province"
              value={selectedProvince}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setPageNumber(1);
              }}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 focus:outline-none"
            >
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Directory Tabs */}
        <div
          className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100"
          role="group"
          aria-label="Directory view"
        >
          {[
            { id: 'all', label: 'All organizations' },
            { id: 'contacts', label: 'Hiring contacts' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={filterType === tab.id}
              onClick={() => {
                setFilterType(tab.id as typeof filterType);
                setPageNumber(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                filterType === tab.id
                  ? 'bg-[#176b61] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="sw-skeleton-card">
              <div className="sw-skeleton h-6 w-1/2" />
              <div className="sw-skeleton h-4 w-1/3" />
              <div className="sw-skeleton h-12 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="sw-empty" role="alert">
          <h2>The directory could not load</h2>
          <p>{error}</p>
          <button
            type="button"
            className="sw-btn sw-btn-primary"
            onClick={() => {
              setLoading(true);
              setError('');
              setDirectoryAttempt((attempt) => attempt + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sw-card text-center py-12 px-6">
          <Building2 size={40} className="mx-auto text-slate-400 mb-2" />
          <h2 className="text-base font-semibold text-slate-800 mb-1">
            {filterType === 'contacts' ? 'No hiring contacts found' : 'No organizations found'}
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try a different search or province. Switch to All organizations to explore every
            company.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.slice((page - 1) * pageSize, page * pageSize).map((comp) => {
            const hasRecruiter = Boolean(comp.contact_person?.trim());

            return (
              <article
                key={comp.id}
                className="sw-card sw-card-clickable relative p-5 flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 text-[#176b61] flex items-center justify-center font-bold text-base shrink-0">
                        {comp.company_name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        {hasRecruiter && (
                          <p className="text-xs font-bold text-slate-900">
                            {comp.contact_person}
                            {comp.contact_position && (
                              <span className="text-slate-500 font-normal ml-1">
                                • {comp.contact_position}
                              </span>
                            )}
                          </p>
                        )}
                        <h2 className="text-sm font-bold text-[#176b61] flex items-center gap-1">
                          <a
                            href={`/people/${encodeURIComponent(comp.id)}`}
                            onClick={(event) => {
                              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                                return;
                              event.preventDefault();
                              navigate(`/people/${encodeURIComponent(comp.id)}`);
                            }}
                          >
                            {comp.company_name}
                            <span className="absolute inset-0" aria-hidden="true" />
                          </a>
                          <ShieldCheck
                            size={14}
                            className="text-teal-600"
                            aria-label="Verified employer"
                          />
                        </h2>
                        <span className="text-xs text-slate-500">
                          {comp.industry} • {comp.province}
                        </span>
                      </div>
                    </div>

                    <span className="sw-badge sw-badge-blue text-xs shrink-0">
                      {comp.open_jobs} open {comp.open_jobs === 1 ? 'job' : 'jobs'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {comp.description ||
                      'Verified employer in MIMAROPA offering employment opportunities.'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-slate-400" />
                      {comp.municipality}, {comp.province}
                    </span>
                    {comp.company_size && <span>Size: {comp.company_size}</span>}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#176b61]">
                  <span>View Company & Vacancies</span>
                  <ArrowRight size={13} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && (
        <ListPagination
          page={page}
          total={filtered.length}
          pageSize={pageSize}
          onChange={(next) => {
            setPageNumber(next);
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {/* Company Detail Modal (when on /people/:id) */}
      {detailId && selectedCompany && (
        <Modal
          isOpen={Boolean(selectedCompany)}
          onClose={() => navigate('/people')}
          titleId="company-detail-title"
          descriptionId="company-detail-desc"
          className="company-detail-dialog space-y-6"
        >
          <div className="company-dialog-header">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-teal-50 border border-teal-100 text-[#176b61] flex items-center justify-center font-bold text-xl shrink-0">
                {selectedCompany.company.company_name?.charAt(0) || 'C'}
              </div>
              <div>
                <h2 id="company-detail-title" className="text-xl font-bold text-slate-900">
                  {selectedCompany.company.company_name}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedCompany.company.industry} • {selectedCompany.company.municipality},{' '}
                  {selectedCompany.company.province}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/people')}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close company details"
              data-modal-close
            >
              <X size={20} />
            </button>
          </div>

          <div id="company-detail-desc" className="text-xs text-slate-600 leading-relaxed">
            {selectedCompany.company.description ||
              'Verified employer registered with MIMAROPA Works.'}
          </div>

          {selectedCompany.company.contact_person && (
            <div className="p-3 bg-slate-50 rounded-lg text-xs flex justify-between items-center border border-slate-100">
              <div>
                <span className="text-slate-500 block">Recruitment Representative</span>
                <span className="font-semibold text-slate-800">
                  {selectedCompany.company.contact_person}
                </span>
                {selectedCompany.company.contact_position && (
                  <span className="text-slate-500 ml-1">
                    ({selectedCompany.company.contact_position})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Active Vacancies for this Company */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2.5">
              Open Positions ({selectedCompany.jobs.length})
            </h3>
            {selectedCompany.jobs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active job listings right now.</p>
            ) : (
              <div className="space-y-2">
                {selectedCompany.jobs.map((j) => (
                  <a
                    key={j.id}
                    href={`/jobs/${encodeURIComponent(j.id)}`}
                    className="p-3 rounded-lg border border-slate-200 hover:border-teal-500 flex items-center justify-between cursor-pointer transition"
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      navigate(`/jobs/${encodeURIComponent(j.id)}`);
                    }}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 hover:text-[#176b61]">
                        {j.title}
                      </h4>
                      <span className="text-xs text-slate-500">
                        {j.employment_type} • {j.work_setup}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#176b61]">View Job →</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
