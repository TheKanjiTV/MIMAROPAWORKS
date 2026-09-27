import { createHash } from 'node:crypto';

export class SemanticUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SemanticUnavailableError';
    this.code = 'SEMANTIC_UNAVAILABLE';
  }
}

/**
 * Wrap an async (candidateText, jobText, endpoint) scorer. Rejections deliberately
 * remain rejections so callers can keep their existing local scoring fallback.
 * Cache keys contain only digests, never candidate text or endpoint credentials.
 */
export function createSemanticScorer(score, {
  maxConcurrent = 4,
  maxCacheEntries = 1000,
  cacheTtlMs = 5 * 60 * 1000,
  cooldownMs = 30 * 1000,
  now = Date.now,
} = {}) {
  if (typeof score !== 'function' || typeof now !== 'function') throw new TypeError('A scorer and clock function are required.');
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 4)
    throw new RangeError('Semantic concurrency must be between 1 and 4.');
  if (!Number.isInteger(maxCacheEntries) || maxCacheEntries < 1 || maxCacheEntries > 1000)
    throw new RangeError('Semantic cache capacity must be between 1 and 1000.');
  if (!Number.isFinite(cacheTtlMs) || cacheTtlMs <= 0 || !Number.isFinite(cooldownMs) || cooldownMs <= 0)
    throw new RangeError('Semantic cache and cooldown durations must be positive.');

  const cache = new Map();
  const inFlight = new Map();
  const cooldowns = new Map();
  const queue = [];
  let active = 0;

  const coolingDown = (endpoint) => {
    const until = cooldowns.get(endpoint);
    if (until === undefined) return false;
    if (until > now()) return true;
    cooldowns.delete(endpoint);
    return false;
  };
  const cooldownError = () => new SemanticUnavailableError('Semantic scoring is temporarily unavailable; use the local fallback.');
  const pump = () => {
    while (active < maxConcurrent && queue.length) {
      const task = queue.shift();
      if (coolingDown(task.endpoint)) {
        inFlight.delete(task.key);
        task.reject(cooldownError());
        continue;
      }
      active += 1;
      Promise.resolve()
        .then(() => score(task.candidateText, task.jobText, task.endpoint))
        .then((value) => {
          cache.delete(task.key);
          cache.set(task.key, { value, expiresAt: now() + cacheTtlMs });
          while (cache.size > maxCacheEntries) cache.delete(cache.keys().next().value);
          task.resolve(value);
        }, (error) => {
          cooldowns.set(task.endpoint, now() + cooldownMs);
          task.reject(error);
        })
        .finally(() => {
          active -= 1;
          inFlight.delete(task.key);
          pump();
        });
    }
  };

  return function scoreSemantic(candidateText, jobText, url) {
    const endpoint = typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '';
    if (!endpoint) return Promise.reject(new SemanticUnavailableError('Semantic scoring has no configured endpoint.'));
    const key = createHash('sha256').update(JSON.stringify([endpoint, candidateText, jobText])).digest('hex');
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) {
      // Refresh insertion order for LRU eviction without extending its lifetime.
      cache.delete(key);
      cache.set(key, cached);
      return Promise.resolve(cached.value);
    }
    if (cached) cache.delete(key);
    if (inFlight.has(key)) return inFlight.get(key);
    if (coolingDown(endpoint)) return Promise.reject(cooldownError());

    let resolve;
    let reject;
    const result = new Promise((resolveResult, rejectResult) => {
      resolve = resolveResult;
      reject = rejectResult;
    });
    inFlight.set(key, result);
    queue.push({ key, endpoint, candidateText, jobText, resolve, reject });
    pump();
    return result;
  };
}
