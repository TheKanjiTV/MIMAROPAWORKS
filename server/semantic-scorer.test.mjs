import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticScorer } from './semantic-scorer.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('semantic scorer limits 300 requests to four concurrent calls and deduplicates pending work', async () => {
  let active = 0;
  let peak = 0;
  let calls = 0;
  const pending = [];
  const score = createSemanticScorer(async () => {
    calls += 1;
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => pending.push(resolve));
    active -= 1;
    return 0.75;
  });
  const first = score('candidate', 'job-0', 'http://local-ai.test/');
  assert.equal(score('candidate', 'job-0', 'http://local-ai.test'), first);
  const results = [first, ...Array.from({ length: 299 }, (_, index) => score('candidate', `job-${index + 1}`, 'http://local-ai.test'))];
  await tick();
  assert.equal(calls, 4);
  assert.equal(active, 4);
  while (calls < 300 || active) {
    pending.splice(0).forEach((resolve) => resolve());
    await tick();
  }
  assert.deepEqual(await Promise.all(results), Array(300).fill(0.75));
  assert.equal(calls, 300);
  assert.equal(peak, 4);
});

test('semantic score success cache respects candidate/job/endpoint and expires after its TTL', async () => {
  let time = 1000;
  let calls = 0;
  const score = createSemanticScorer(async () => ++calls / 10, { now: () => time });
  assert.equal(await score('candidate-A', 'job-A', 'http://ai-a.test'), 0.1);
  assert.equal(await score('candidate-A', 'job-A', 'http://ai-a.test/'), 0.1);
  assert.equal(await score('candidate-B', 'job-A', 'http://ai-a.test'), 0.2);
  assert.equal(await score('candidate-A', 'job-B', 'http://ai-a.test'), 0.3);
  assert.equal(await score('candidate-A', 'job-A', 'http://ai-b.test'), 0.4);
  time += 299999;
  assert.equal(await score('candidate-A', 'job-A', 'http://ai-a.test'), 0.1);
  time += 1;
  assert.equal(await score('candidate-A', 'job-A', 'http://ai-a.test'), 0.5);
  assert.equal(calls, 5);
});

test('semantic score success cache is capped at 1000 entries with LRU eviction', async () => {
  let calls = 0;
  const score = createSemanticScorer(async () => { calls += 1; return 0.5; });
  for (let index = 0; index < 1000; index += 1) await score('candidate', `job-${index}`, 'http://ai.test');
  await score('candidate', 'job-0', 'http://ai.test'); // Keep the oldest entry in use.
  await score('candidate', 'job-1000', 'http://ai.test');
  assert.equal(calls, 1001);
  await score('candidate', 'job-0', 'http://ai.test');
  assert.equal(calls, 1001);
  await score('candidate', 'job-1', 'http://ai.test');
  assert.equal(calls, 1002);
});

test('endpoint failure skips queued work and retries only after the 30-second cooldown', async () => {
  let time = 1000;
  let calls = 0;
  let failing = true;
  const score = createSemanticScorer(async () => {
    calls += 1;
    if (failing) throw new Error('Unavailable');
    return 0.8;
  }, { now: () => time });
  const failed = await Promise.allSettled(Array.from({ length: 300 }, (_, index) => score('candidate', `job-${index}`, 'http://ai.test')));
  assert.equal(calls, 4);
  assert.ok(failed.every((result) => result.status === 'rejected'));
  assert.ok(failed.slice(4).every((result) => result.reason.code === 'SEMANTIC_UNAVAILABLE'));
  failing = false;
  time += 29999;
  await assert.rejects(score('candidate', 'new-job', 'http://ai.test'), { code: 'SEMANTIC_UNAVAILABLE' });
  assert.equal(calls, 4);
  // An independent endpoint remains available during the first endpoint's cooldown.
  assert.equal(await score('candidate', 'new-job', 'http://other-ai.test'), 0.8);
  time += 1;
  assert.equal(await score('candidate', 'job-0', 'http://ai.test'), 0.8);
  assert.equal(calls, 6);
  assert.equal(await score('candidate', 'job-0', 'http://ai.test'), 0.8);
  assert.equal(calls, 6);
});

test('blank endpoint immediately skips scoring and cached successes remain usable during cooldown', async () => {
  let calls = 0;
  const score = createSemanticScorer(async (_candidate, job) => {
    calls += 1;
    if (job === 'fail') throw new Error('Endpoint failed');
    return 0.7;
  });
  for (const url of ['', '   ', undefined])
    await assert.rejects(score('candidate', 'job', url), { code: 'SEMANTIC_UNAVAILABLE' });
  assert.equal(calls, 0);
  assert.equal(await score('candidate', 'cached', 'http://ai.test'), 0.7);
  await assert.rejects(score('candidate', 'fail', 'http://ai.test'));
  assert.equal(await score('candidate', 'cached', 'http://ai.test'), 0.7);
  assert.equal(calls, 2);
});

test('semantic scorer enforces hard concurrency and cache bounds', () => {
  assert.throws(() => createSemanticScorer(async () => 0.5, { maxConcurrent: 5 }), /between 1 and 4/);
  assert.throws(() => createSemanticScorer(async () => 0.5, { maxCacheEntries: 1001 }), /between 1 and 1000/);
  assert.throws(() => createSemanticScorer(async () => 0.5, { cooldownMs: 0 }), /positive/);
});
