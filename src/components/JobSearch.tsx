import { ArrowUpRight, ChevronDown, MapPin, Search } from 'lucide-react';
import { PROVINCES } from '@/data/jobs';

type JobSearchProps = {
  keyword: string;
  location: string;
  onKeyword: (value: string) => void;
  onLocation: (value: string) => void;
  onSearch: () => void;
  onPopular: (value: string) => void;
};

export function JobSearch({
  keyword,
  location,
  onKeyword,
  onLocation,
  onSearch,
  onPopular,
}: JobSearchProps) {
  return (
    <section id="search" className="search-section" aria-label="Search sample opportunities">
      <div className="container">
        <form
          className="search-panel"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <label className="search-field">
            <Search size={22} />
            <span>
              <span className="search-label">What</span>
              <input
                name="keyword"
                value={keyword}
                onChange={(event) => onKeyword(event.target.value)}
                placeholder="Job title, keyword, or company"
                autoComplete="off"
              />
            </span>
          </label>
          <label className="search-field location-field">
            <MapPin size={22} />
            <span>
              <span className="search-label">Where</span>
              <input
                name="location"
                list="locations"
                value={location}
                onChange={(event) => onLocation(event.target.value)}
                placeholder="City or province"
                autoComplete="off"
              />
              <datalist id="locations">
                {PROVINCES.map((province) => (
                  <option value={province} key={province} />
                ))}
                {['Calapan City', 'Puerto Princesa City', 'Roxas', 'Boac', 'San Jose'].map(
                  (city) => (
                    <option value={city} key={city} />
                  ),
                )}
              </datalist>
            </span>
            <ChevronDown size={16} className="location-chevron" />
          </label>
          <button className="button button-primary search-button" type="submit">
            Search jobs <Search size={18} />
          </button>
        </form>
        <div className="popular-searches">
          <span>Popular searches:</span>
          {['Customer service', 'Marketing', 'IT support', 'Admin'].map((term) => (
            <button key={term} onClick={() => onPopular(term)}>
              {term} <ArrowUpRight size={12} />
            </button>
          ))}
        </div>
        <div className="region-strip">
          <span className="region-strip-title">
            <MapPin size={17} /> Explore our five provinces
          </span>
          <div>
            {PROVINCES.map((province) => (
              <span key={province}>{province}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
