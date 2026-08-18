const EARLY = /(2027|new grad|new graduate|entry.level|early career|university|campus|graduate|engineer i\b|associate)/i;
const EXCLUDE = /(senior|\bsr\.?\b|staff|principal|manager|director|head of|lead\b|intern(ship)?|[5-9]\+? years)/i;
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
  if (!target) return true;
  if (/^(united states|usa|us)$/i.test(target)) return /(United States|USA|Remote.*US|,\s*(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEHINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])\b)/i.test(job.location);
  return words(job.location).includes(words(target)) || /remote/i.test(job.location);
}
function match(job, preferences) {
  if (!EARLY.test(job.title) || EXCLUDE.test(job.title)) return null;
  if (Array.isArray(preferences)) {
    return preferences.find(pref => pref.active && words(pref.company) === words(job.company)
      && roleMatches(pref.role, job) && locationMatches(pref.location, job)) || null;
  }
  const companies = preferences.companies || [];
  const roles = preferences.roles || [];
  const locations = preferences.locations || [];
  if (!companies.some(company => words(company) === words(job.company))) return null;
  if (roles.length && !roles.some(role => roleMatches(role, job))) return null;
  if (locations.length && !locations.some(location => locationMatches(location, job))) return null;
  return { company: job.company };
}
function skillsFrom(text) {
  const skills = ['Python', 'Java', 'C++', 'JavaScript', 'TypeScript', 'React', 'SQL', 'AWS', 'Linux', 'Git', 'FPGA', 'Machine Learning'];
  return skills.filter(skill => new RegExp(`\\b${skill.replace('+', '\\+')}\\b`, 'i').test(text || '')).slice(0, 5);
}
module.exports = { match, skillsFrom };
