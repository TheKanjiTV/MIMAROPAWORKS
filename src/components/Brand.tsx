export function Brand({ light = false, href = '#home' }: { light?: boolean; href?: string }) {
  return (
    <a
      className={`brand ${light ? 'brand-light' : ''}`}
      href={href}
      aria-label="MIMAROPA Works home"
    >
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path
            d="M9 28V14l11 9 11-9v14"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <path
            d="m29 5 2.2 4.8L36 12l-4.8 2.2L29 19l-2.2-4.8L22 12l4.8-2.2L29 5Z"
            fill="#a7e5cf"
          />
        </svg>
      </span>
      <span className="brand-name">
        MIMAROPA
        <span>
          works<span className="brand-dot">.</span>
        </span>
      </span>
    </a>
  );
}
