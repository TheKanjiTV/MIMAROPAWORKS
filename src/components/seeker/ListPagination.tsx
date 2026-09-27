import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ListPagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  return (
    <nav className="sw-pagination" aria-label="Results pages">
      <p aria-live="polite">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div>
        <button
          className="sw-btn sw-btn-secondary"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} aria-hidden="true" /> Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          className="sw-btn sw-btn-secondary"
          disabled={page === pages}
          onClick={() => onChange(page + 1)}
        >
          Next <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
