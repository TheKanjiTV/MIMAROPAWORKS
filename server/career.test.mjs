import test from 'node:test';
import assert from 'node:assert/strict';
import { skillsGap, trainingFor, careerSuggestions } from './career.mjs';

test('skills gaps aggregate real required/preferred skills and deduplicate jobs', () => {
  const job = {
    id: 'one',
    title: 'Marketing Assistant',
    match_percentage: 85,
    required_skills: ['Canva', 'Communication'],
    preferred_skills: ['Microsoft Excel', 'Canva', 'Microsoft Excel'],
    matched_skills: ['Canva'],
    missing_skills: ['Communication'],
  };
  const gap = skillsGap([job, { ...job, id: 'two', title: 'Sales Assistant' }], ['Canva']);
  assert.equal(gap.evaluated_jobs, 2);
  assert.deepEqual(
    gap.strong_skills.map((s) => s.skill),
    ['Canva'],
  );
  assert.equal(gap.missing_skills.length, 2);
  assert.equal(gap.missing_skills[0].priority, 'High Priority');
  assert.equal(gap.missing_skills.find((s) => s.skill === 'Microsoft Excel').priority, 'Optional');
  assert.equal(gap.missing_skills.find((s) => s.skill === 'Microsoft Excel').jobs.length, 2);
  assert.equal(
    gap.missing_skills.find((s) => s.skill === 'Microsoft Excel').jobs[0].importance,
    'preferred',
  );
  assert.equal(
    gap.missing_skills.find((s) => s.skill === 'Communication').jobs[0].importance,
    'required',
  );
  assert.deepEqual(
    trainingFor(gap)
      .map((t) => t.skill)
      .sort(),
    ['Communication', 'Microsoft Excel'],
  );
  assert.equal(skillsGap([job], ['Canva', 'Microsoft Excel']).missing_skills.length, 1);
});
test('empty vacancy pool produces no fabricated skill gaps or training', () => {
  const gap = skillsGap([], ['Canva']);
  assert.deepEqual(gap, { evaluated_jobs: 0, strong_skills: [], missing_skills: [] });
  assert.deepEqual(trainingFor(gap), []);
});
test('careers compare normalized profile text, rank returned similarity, and bound scores', async () => {
  const inputs = [];
  const careers = await careerSuggestions(
    {
      data: JSON.stringify({ skills: ['Canva'], full_name: 'Private Name' }),
      normalized_profile_text: 'Skills: Canva',
    },
    async (candidate, occupation) => {
      inputs.push([candidate, occupation]);
      return occupation.startsWith('Occupation: Marketing Assistant') ? 0.92 : 0.31;
    },
  );
  assert.equal(inputs.length, 10);
  assert.ok(inputs.every(([c]) => c === 'Skills: Canva'));
  assert.equal(careers[0].title, 'Marketing Assistant');
  assert.equal(careers[0].similarity_percentage, 92);
  assert.ok(careers.every((c) => c.semantic_engine === 'sentence_transformer'));
  assert.deepEqual(careers[0].relevant_skills, ['Canva']);
  const bounded = await careerSuggestions(
    { data: '{}', normalized_profile_text: 'Education' },
    async () => 2,
  );
  assert.ok(bounded.every((c) => c.similarity_percentage === 100));
});
test('career AI failure uses explicitly labelled deterministic skill fallback', async () => {
  const results = await careerSuggestions(
    { data: JSON.stringify({ skills: ['Canva'] }), normalized_profile_text: 'Skills: Canva' },
    async () => {
      throw new Error('offline');
    },
  );
  assert.ok(results.every((c) => c.semantic_engine === 'skills_overlap_fallback'));
  assert.equal(results.find((c) => c.title === 'Marketing Assistant').similarity_percentage, 25);
});
