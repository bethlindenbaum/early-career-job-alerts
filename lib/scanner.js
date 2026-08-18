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
async function fetchSource(source) {
  const url = source.type === 'greenhouse'
    ? `https://boards-api.greenhouse.io/v1/boards/${source.token}/jobs?content=true`
    : `https://api.lever.co/v0/postings/${source.token}?mode=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${source.company}: ${response.status}`);
  const payload = await response.json();
  const rows = source.type === 'greenhouse' ? payload.jobs : payload;
  return rows.map(row => source.type === 'greenhouse' ? greenhouseJob(source.company, row) : leverJob(source.company, row));
}
async function scan(state) {
  const sources = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sources.json'), 'utf8'));
  const settled = await Promise.allSettled(sources.map(fetchSource));
  const candidates = settled.filter(x => x.status === 'fulfilled').flatMap(x => x.value);
  const known = new Set(state.jobs.map(job => job.externalId));
  const added = [];
  for (const job of candidates) {
    const preference = match(job, state.preferences);
    if (!preference || known.has(job.externalId)) continue;
    const result = { ...job, id: crypto.randomUUID(), preferenceId: preference.id, status: 'review', discoveredAt: new Date().toISOString() };
    state.jobs.unshift(result); added.push(result); known.add(job.externalId);
  }
  state.lastScanAt = new Date().toISOString();
  event(state, 'scan', `Scan complete: ${added.length} new match${added.length === 1 ? '' : 'es'}`);
  return { added, errors: settled.filter(x => x.status === 'rejected').map(x => x.reason.message) };
}
module.exports = { scan };
