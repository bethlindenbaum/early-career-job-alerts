const fs = require('node:fs');
const path = require('node:path');
const { match, skillsFrom } = require('./matcher');
const { event } = require('./store');

function cleanHtml(value = '') { return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ').trim(); }
function greenhouseJob(company, raw) {
  const description = cleanHtml(raw.content);
  return { externalId: `gh-${company}-${raw.id}`, company, title: raw.title, location: raw.location?.name || 'Location not listed',
    url: raw.absolute_url, description, salary: description.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)/)?.[0] || '',
    skills: skillsFrom(description), postedAt: raw.updated_at || new Date().toISOString(), source: 'Greenhouse' };
}
function leverJob(company, raw) {
  const description = cleanHtml(`${raw.descriptionPlain || ''} ${raw.additionalPlain || ''}`);
  return { externalId: `lever-${company}-${raw.id}`, company, title: raw.text, location: raw.categories?.location || 'Location not listed',
    url: raw.hostedUrl, description, salary: description.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)/)?.[0] || '',
    skills: skillsFrom(description), postedAt: new Date(raw.createdAt || Date.now()).toISOString(), source: 'Lever' };
}
function ashbyJob(company, raw) {
  const description = cleanHtml(raw.descriptionPlain || raw.descriptionHtml || '');
  const salary = raw.compensation?.scrapeableCompensationSalarySummary || raw.compensation?.compensationTierSummary || '';
  return { externalId: `ashby-${company}-${raw.id || raw.jobUrl}`, company, title: raw.title, location: raw.location || 'Location not listed',
    url: raw.applyUrl || raw.jobUrl, description, salary, skills: skillsFrom(description), postedAt: raw.publishedAt || new Date().toISOString(), source: 'Ashby' };
}
function smartRecruitersJob(company, raw) {
  const location = raw.location?.fullLocation || [raw.location?.city, raw.location?.region, raw.location?.country].filter(Boolean).join(', ') || 'Location not listed';
  const titleSlug = raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { externalId: `smartrecruiters-${company}-${raw.id}`, company, title: raw.name, location,
    url: `https://jobs.smartrecruiters.com/${raw.company?.identifier || company}/${raw.id}-${titleSlug}`, description: '', salary: '', skills: [], postedAt: raw.releasedDate || new Date().toISOString(), source: 'SmartRecruiters' };
}
function applyGuyJob(raw) {
  return { externalId: `applyguy-${raw.id}`, company: raw.company, title: raw.title, location: raw.location || 'Location not listed',
    url: raw.listingUrl || raw.url, description: `${raw.eligibility || ''} ${raw.matchKind || ''}`, salary: '', skills: [], postedAt: raw.posted || new Date().toISOString(), source: 'ApplyGuy 2027 feed', earlyCareer: true };
}
async function fetchSource(source) {
  let url;
  if (source.type === 'greenhouse') url = `https://boards-api.greenhouse.io/v1/boards/${source.token}/jobs?content=true`;
  else if (source.type === 'lever') url = `https://api.lever.co/v0/postings/${source.token}?mode=json`;
  else if (source.type === 'ashby') url = `https://api.ashbyhq.com/posting-api/job-board/${source.token}?includeCompensation=true`;
  else if (source.type === 'smartrecruiters') url = `https://api.smartrecruiters.com/v1/companies/${source.token}/postings?limit=100`;
  else if (source.type === 'applyguy') url = source.url;
  else throw new Error(`${source.company || source.type}: unsupported source type`);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${source.company || source.type}: ${response.status}`);
  const payload = await response.json();
  if (source.type === 'greenhouse') return payload.jobs.map(row => greenhouseJob(source.company, row));
  if (source.type === 'lever') return payload.map(row => leverJob(source.company, row));
  if (source.type === 'ashby') return payload.jobs.filter(row => row.isListed !== false).map(row => ashbyJob(source.company, row));
  if (source.type === 'smartrecruiters') return payload.content.map(row => smartRecruitersJob(source.company, row));
  return payload.jobs.map(applyGuyJob);
}
async function scan(state) {
  const sources = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sources.json'), 'utf8'));
  const settled = await Promise.allSettled(sources.map(fetchSource));
  const candidates = settled.filter(x => x.status === 'fulfilled').flatMap(x => x.value);
  const known = new Set(state.jobs.map(job => job.externalId));
  const knownSignatures = new Set(state.jobs.map(job => `${job.company}|${job.title}|${job.location}`.toLowerCase()));
  const added = [];
  for (const job of candidates) {
    const preference = match(job, state.preferences);
    const signature = `${job.company}|${job.title}|${job.location}`.toLowerCase();
    if (!preference || known.has(job.externalId) || knownSignatures.has(signature)) continue;
    const result = { ...job, id: crypto.randomUUID(), preferenceId: preference.id, status: 'review', discoveredAt: new Date().toISOString() };
    state.jobs.unshift(result); added.push(result); known.add(job.externalId); knownSignatures.add(signature);
  }
  state.lastScanAt = new Date().toISOString();
  event(state, 'scan', `Scan complete: ${added.length} new match${added.length === 1 ? '' : 'es'}`);
  return { added, errors: settled.filter(x => x.status === 'rejected').map(x => x.reason.message) };
}
module.exports = { scan };
