const fs = require('node:fs');
const path = require('node:path');
const { scan } = require('../lib/scanner');
const { sendSms, sendDigest } = require('../lib/notify');
const { match } = require('../lib/matcher');

const root = path.join(__dirname, '..');
const outputPath = path.join(root, 'public', 'jobs.json');
const healthPath = path.join(root, 'public', 'source-health.json');
const preferences = fs.readFileSync(path.join(root, 'public', 'preferences.json'), 'utf8');
const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const previousHealth = fs.existsSync(healthPath) ? JSON.parse(fs.readFileSync(healthPath, 'utf8')) : { sources: [] };
const previousSourceNames = new Set((previousHealth.sources || []).map(source => source.company));
const fallbackSources = JSON.parse(fs.readFileSync(path.join(root, 'data', 'sources.json'), 'utf8')).filter(source => source.coverage === 'all-target-companies');
const newFallbackNames = new Set(fallbackSources.filter(source => !previousSourceNames.has(source.name)).map(source => source.name));
const parsedPreferences = JSON.parse(preferences);
const state = {
  profile: { phone: process.env.ALERT_PHONE || '', email: process.env.ALERT_EMAIL || '', timezone: process.env.ALERT_TIMEZONE || 'America/New_York' },
  preferences: parsedPreferences, jobs: (existing.jobs || []).filter(job => match(job, parsedPreferences)), events: [], lastScanAt: existing.lastScanAt || null, lastDigestAt: existing.lastDigestAt || null
};

(async () => {
  const result = await scan(state);
  for (const job of result.added) {
    if (newFallbackNames.has(job.source)) { job.alertSuppressed = true; continue; }
    try { await sendSms(state.profile, job); } catch (error) { console.error(`SMS failed: ${error.message}`); }
  }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: state.profile.timezone, hour: 'numeric', hour12: false, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const localDate = `${values.year}-${values.month}-${values.day}`;
  if (Number(values.hour) === 18 && !state.lastDigestAt?.startsWith(localDate)) {
    const todaysJobs = state.jobs.filter(job => !job.alertSuppressed).filter(job => {
      const jobParts = new Intl.DateTimeFormat('en-US', { timeZone: state.profile.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(job.discoveredAt));
      const jobValues = Object.fromEntries(jobParts.map(part => [part.type, part.value]));
      return `${jobValues.year}-${jobValues.month}-${jobValues.day}` === localDate;
    });
    try { await sendDigest(state, todaysJobs); } catch (error) { console.error(`Digest failed: ${error.message}`); }
  }
  const previousIds = (existing.jobs || []).map(job => job.externalId).sort().join('|');
  const currentIds = state.jobs.map(job => job.externalId).sort().join('|');
  const jobsChanged = previousIds !== currentIds;
  const output = { jobs: state.jobs, lastScanAt: jobsChanged ? state.lastScanAt : existing.lastScanAt, lastDigestAt: state.lastDigestAt || null,
    delivery: { smsConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.ALERT_PHONE), emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL) } };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  const previousBySource = new Map((previousHealth.sources || []).map(item => [`${item.company}|${item.type}`, item]));
  const sources = result.health.map(({ durationMs, checkedAt, ...item }) => {
    const previous = previousBySource.get(`${item.company}|${item.type}`);
    const same = previous && JSON.stringify({ ...previous, checkedAt: undefined }) === JSON.stringify({ ...item, checkedAt: undefined });
    return { ...item, checkedAt: same ? previous.checkedAt : checkedAt };
  }).sort((a, b) => a.company.localeCompare(b.company));
  const healthCounts = { healthy: sources.filter(item => item.status === 'healthy').length, errors: sources.filter(item => item.status === 'error').length };
  const healthChanged = JSON.stringify((previousHealth.sources || []).map(item => ({ ...item, checkedAt: undefined }))) !== JSON.stringify(sources.map(item => ({ ...item, checkedAt: undefined })));
  const health = { checkedAt: healthChanged ? new Date().toISOString() : previousHealth.checkedAt, ...healthCounts, sources };
  fs.writeFileSync(healthPath, `${JSON.stringify(health, null, 2)}\n`);
  console.log(`Scan finished with ${result.added.length} new matches and ${result.errors.length} source errors.${jobsChanged ? ' Published job data changed.' : ''}`);
  if (result.errors.length) console.warn(result.errors.join('\n'));
})().catch(error => { console.error(error); process.exitCode = 1; });
