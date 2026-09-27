export type PreviewKind =
  'login' | 'job-seeker' | 'employer' | 'get-started' | 'contact' | 'privacy' | 'terms' | 'social';
export type PreviewState = { kind: PreviewKind } | null;
export type PreviewAction = (kind: PreviewKind) => void;
