const test = require('node:test');
const assert = require('node:assert/strict');
const { match, skillsFrom } = require('../lib/matcher');

const preferences = [{ id: '1', company: 'Amazon', role: 'SWE', location: 'United States', active: true }];
test('matches early-career role synonyms', () => {
  const result = match({ company: 'Amazon', title: 'Software Development Engineer — 2027 New Grad', location: 'Seattle, WA', description: '' }, preferences);
  assert.equal(result.id, '1');
});
test('rejects senior roles', () => {
  assert.equal(match({ company: 'Amazon', title: 'Senior Software Engineer — University Team', location: 'Seattle', description: '' }, preferences), null);
});
test('does not match experienced titles just because the description mentions early career', () => {
  assert.equal(match({ company: 'Amazon', title: 'Head of Engineering', location: 'Seattle', description: 'Mentor early-career engineers.' }, preferences), null);
});
test('excludes internships from a new-grad search', () => {
  assert.equal(match({ company: 'Amazon', title: 'Software Engineer Internship — University', location: 'Seattle', description: '' }, preferences), null);
});
test('extracts a short skill summary', () => {
  assert.deepEqual(skillsFrom('Build in Python, React, SQL, and AWS.'), ['Python', 'React', 'SQL', 'AWS']);
});
