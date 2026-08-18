const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { read, write, event } = require('./lib/store');
const { scan } = require('./lib/scanner');
const { sendSms, sendDigest } = require('./lib/notify');

const PORT = Number(process.env.PORT || 4173);
const PUBLIC = path.join(__dirname, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); }
async function body(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
function publicState(state) {
  return { ...state, delivery: { smsConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER), emailConfigured: Boolean(process.env.RESEND_API_KEY) } };
}
async function runScan(state) {
  const result = await scan(state);
  for (const job of result.added) {
    try { if (await sendSms(state.profile, job)) event(state, 'sms', `Text sent: ${job.company} — ${job.title}`); }
    catch (error) { event(state, 'error', error.message); }
  }
  write(state); return result;
}
async function api(req, res, url) {
  let state = read();
  if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, publicState(state));
  if (req.method === 'PUT' && url.pathname === '/api/profile') {
    state.profile = { ...state.profile, ...(await body(req)) }; write(state); return json(res, 200, publicState(state));
  }
  if (req.method === 'POST' && url.pathname === '/api/preferences') {
    const row = await body(req); state.preferences.unshift({ id: crypto.randomUUID(), company: row.company.trim(), role: row.role?.trim() || '', location: row.location?.trim() || '', active: true }); write(state); return json(res, 201, publicState(state));
  }
  if (req.method === 'PATCH' && url.pathname.startsWith('/api/preferences/')) {
    const id = url.pathname.split('/').pop(); const update = await body(req); state.preferences = state.preferences.map(item => item.id === id ? { ...item, ...update } : item); write(state); return json(res, 200, publicState(state));
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/preferences/')) {
    const id = url.pathname.split('/').pop(); state.preferences = state.preferences.filter(item => item.id !== id); write(state); return json(res, 200, publicState(state));
  }
  if (req.method === 'PATCH' && url.pathname.startsWith('/api/jobs/')) {
    const id = url.pathname.split('/').pop(); const update = await body(req); state.jobs = state.jobs.map(job => job.id === id ? { ...job, ...update, statusUpdatedAt: new Date().toISOString() } : job); write(state); return json(res, 200, publicState(state));
  }
  if (req.method === 'POST' && url.pathname === '/api/scan') {
    const result = await runScan(state); return json(res, 200, { ...result, state: publicState(read()) });
  }
  if (req.method === 'POST' && url.pathname === '/api/digest') {
    const today = new Date().toISOString().slice(0, 10); const jobs = state.jobs.filter(job => job.discoveredAt?.startsWith(today));
    const sent = await sendDigest(state, jobs); write(state); return json(res, 200, { sent, count: jobs.length, state: publicState(state) });
  }
  return json(res, 404, { error: 'Not found' });
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.normalize(path.join(PUBLIC, requested));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  } catch (error) { json(res, 500, { error: error.message }); }
});
server.listen(PORT, () => console.log(`First Look Jobs is running at http://localhost:${PORT}`));

const minutes = Number(process.env.SCAN_INTERVAL_MINUTES || 15);
if (minutes > 0) setInterval(() => runScan(read()).catch(error => console.error('Background scan failed:', error.message)), minutes * 60_000).unref();
setInterval(async () => {
  const state = read(); const localHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: state.profile.timezone, hour: 'numeric', hour12: false }).format(new Date()));
  const today = new Date().toISOString().slice(0, 10);
  if (localHour === 18 && !state.lastDigestAt?.startsWith(today)) { const jobs = state.jobs.filter(job => job.discoveredAt?.startsWith(today)); await sendDigest(state, jobs); write(state); }
}, 15 * 60_000).unref();
