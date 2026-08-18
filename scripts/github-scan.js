const fs = require('node:fs');
const path = require('node:path');
const { scan } = require('../lib/scanner');
const { sendSms, sendDigest } = require('../lib/notify');
const { match } = require('../lib/matcher');

const root = path.join(__dirname, '..');
const outputPath = path.join(root, 'public', 'jobs.json');
const preferences = fs.readFileSync(path.join(root, 'public', 'preferences.json'), 'utf8');
const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const parsedPreferences = JSON.parse(preferences);
const state = {
  profile: { phone: process.env.ALERT_PHONE || '', email: process.env.ALERT_EMAIL || '', timezone: process.env.ALERT_TIMEZONE || 'America/New_York' },
  preferences: parsedPreferences, jobs: (existing.jobs || []).filter(job => match(job, parsedPreferences)), events: [], lastScanAt: existing.lastScanAt || null, lastDigestAt: existing.lastDigestAt || null
};

(async () => {
  const result = await scan(state);
  for (const job of result.added) {
    try { await sendSms(state.profile, job); } catch (error) { console.error(`SMS failed: ${error.message}`); }
  }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: state.profile.timezone, hour: 'numeric', hour12: false, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const localDate = `${values.year}-${values.month}-${values.day}`;
  if (Number(values.hour) === 18 && !state.lastDigestAt?.startsWith(localDate)) {
    const todaysJobs = state.jobs.filter(job => {
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
  console.log(`Scan finished with ${result.added.length} new matches and ${result.errors.length} source errors.${jobsChanged ? ' Published job data changed.' : ''}`);
  if (result.errors.length) console.error(result.errors.join('\n'));
})().catch(error => { console.error(error); process.exitCode = 1; });
