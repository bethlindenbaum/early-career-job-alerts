const { event } = require('./store');

async function sendSms(profile, job) {
  if (!profile.phone || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) return false;
  const body = new URLSearchParams({ From: process.env.TWILIO_FROM_NUMBER, To: profile.phone,
    Body: `New match: ${job.company} — ${job.title}\n${job.location}${job.salary ? ` · ${job.salary}` : ''}\n${job.skills?.length ? `Skills: ${job.skills.join(', ')}\n` : ''}${job.url}` });
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw new Error(`Twilio returned ${response.status}`);
  return true;
}
async function sendDigest(state, jobs) {
  if (!state.profile.email || !process.env.RESEND_API_KEY || !jobs.length) return false;
  const rows = jobs.map(job => `<li><strong>${job.company} — ${job.title}</strong><br>${job.location}${job.salary ? ` · ${job.salary}` : ''}<br>${job.skills?.join(', ') || 'Skills not listed'} · <a href="${job.url}">Apply</a></li>`).join('');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [state.profile.email], subject: `${jobs.length} new early-career job match${jobs.length === 1 ? '' : 'es'}`, html: `<h1>Today's job matches</h1><ul>${rows}</ul>` }) });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
  state.lastDigestAt = new Date().toISOString(); event(state, 'email', `Daily digest sent with ${jobs.length} jobs`); return true;
}
module.exports = { sendSms, sendDigest };
