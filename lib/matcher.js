const EARLY = /(2027|new grad|new graduate|entry.level|early career|university|campus|graduate|engineer i\b|associate)/i;
const EXCLUDE = /(senior|staff|principal|manager|director|lead\b|[5-9]\+? years)/i;
const ROLE_SYNONYMS = {
  'swe': ['software engineer', 'software developer', 'software development engineer'],
  'software engineer': ['software engineer', 'software developer', 'software development engineer', 'swe'],
  'ai engineer': ['ai engineer', 'artificial intelligence', 'machine learning engineer'],
  'fpga engineer': ['fpga', 'rtl engineer'],
  'firmware engineer': ['firmware', 'embedded software'],
  'embedded software engineer': ['embedded software', 'firmware'],
  'hardware engineer': ['hardware engineer', 'electrical engineer'],
  'quantitative developer': ['quantitative developer', 'quant developer']
};

function words(value) { return String(value || '').toLowerCase().trim(); }
function roleMatches(target, job) {
  if (!target) return true;
  const values = ROLE_SYNONYMS[words(target)] || [words(target)];
  return values.some(value => words(`${job.title} ${job.description}`).includes(value));
}
function locationMatches(target, job) {
  if (!target || /united states|usa|us/i.test(target)) return true;
  return words(job.location).includes(words(target)) || /remote/i.test(job.location);
}
function match(job, preferences) {
  if (!EARLY.test(`${job.title} ${job.description}`) || EXCLUDE.test(job.title)) return null;
  return preferences.find(pref => pref.active && words(pref.company) === words(job.company)
    && roleMatches(pref.role, job) && locationMatches(pref.location, job)) || null;
}
function skillsFrom(text) {
  const skills = ['Python', 'Java', 'C++', 'JavaScript', 'TypeScript', 'React', 'SQL', 'AWS', 'Linux', 'Git', 'FPGA', 'Machine Learning'];
  return skills.filter(skill => new RegExp(`\\b${skill.replace('+', '\\+')}\\b`, 'i').test(text || '')).slice(0, 5);
}
module.exports = { match, skillsFrom };
