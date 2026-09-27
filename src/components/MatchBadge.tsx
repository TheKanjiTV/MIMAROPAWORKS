import { Sparkles } from 'lucide-react';

export function MatchBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <span
      className={`match-badge ${compact ? 'match-badge-compact' : ''}`}
      aria-label={`${score}% illustrative AI match`}
    >
      <Sparkles size={14} aria-hidden="true" />
      <strong>{score}%</strong> Match
    </span>
  );
}
