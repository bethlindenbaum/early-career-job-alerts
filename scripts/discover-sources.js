const fs = require('node:fs');
const path = require('node:path');
const { fromFile } = require('../lib/preferences');
const { fetchSource } = require('../lib/source-connectors');

const root = path.join(__dirname, '..');
const file = path.join(root, 'data', 'sources.json');
const sources = JSON.parse(fs.readFileSync(file, 'utf8'));
const companies = fromFile(path.join(root, 'data', 'preferences.csv')).companies;
const known = new Set(sources.filter(source => source.company).map(source => source.company.toLowerCase()));
const types = ['greenhouse', 'lever', 'ashby', 'smartrecruiters'];

function tokenFor(company) {
  const base = company.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
  return base.replace(/ /g, '');
}
async function discover(company) {
  const candidates = types.map(type => ({ company, type, token: tokenFor(company), discovery: 'automatic' }));
  for (const candidate of candidates) {
    try {
      const result = await fetchSource({ ...candidate, timeoutMs: 6000 });
      if (result.jobs.length) return candidate;
    } catch {}
  }
  return null;
}
async function mapLimit(values, limit, task) {
  const output = new Array(values.length); let next = 0;
  async function worker() { while (next < values.length) { const index = next++; output[index] = await task(values[index]); } }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker)); return output;
}
function inferFromUrl(company, value) {
  try {
    const url = new URL(value); const parts = url.pathname.split('/').filter(Boolean); let type; let token;
    if (/greenhouse\.io$/i.test(url.hostname)) { type = 'greenhouse'; token = parts[0]; }
    else if (url.hostname === 'jobs.lever.co') { type = 'lever'; token = parts[0]; }
    else if (url.hostname === 'jobs.ashbyhq.com') { type = 'ashby'; token = parts[0]; }
    else if (url.hostname === 'jobs.smartrecruiters.com') { type = 'smartrecruiters'; token = parts[0]; }
    else if (/\.myworkdayjobs\.com$/i.test(url.hostname) && parts.length) {
      return { company, type: 'workday', host: url.hostname, tenant: url.hostname.split('.')[0], site: parts[0], discovery: 'fallback-listing' };
    }
    return type && token ? { company, type, token, discovery: 'fallback-listing' } : null;
  } catch { return null; }
}
async function inferFromFallback(missing) {
  const fallback = sources.find(source => source.type === 'applyguy');
  if (!fallback) return [];
  try {
    const response = await fetch(fallback.url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return [];
    const payload = await response.json(); const target = new Map(missing.map(company => [company.toLowerCase(), company])); const candidates = new Map();
    for (const job of payload.jobs || []) {
      const company = target.get(String(job.company || '').toLowerCase()); if (!company) continue;
      const source = inferFromUrl(company, job.listingUrl || job.url); if (source) candidates.set(company.toLowerCase(), source);
    }
    const tested = await mapLimit([...candidates.values()], 6, async source => { try { return (await fetchSource({ ...source, timeoutMs: 6000 })).jobs.length ? source : null; } catch { return null; } });
    return tested.filter(Boolean);
  } catch { return []; }
}

(async () => {
  const missing = companies.filter(company => !known.has(company.toLowerCase()));
  console.log(`Probing common ATS endpoints for ${missing.length} companies...`);
  const inferred = await inferFromFallback(missing);
  const inferredCompanies = new Set(inferred.map(source => source.company.toLowerCase()));
  const probed = (await mapLimit(missing.filter(company => !inferredCompanies.has(company.toLowerCase())), 6, discover)).filter(Boolean);
  const discovered = [...inferred, ...probed];
  if (!discovered.length) return console.log('No additional structured feeds discovered.');
  const fallback = sources.filter(source => !source.company);
  const direct = [...sources.filter(source => source.company), ...discovered].sort((a, b) => a.company.localeCompare(b.company));
  fs.writeFileSync(file, `${JSON.stringify([...direct, ...fallback], null, 2)}\n`);
  console.log(`Added ${discovered.length} feeds: ${discovered.map(source => `${source.company} (${source.type})`).join(', ')}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
