const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '..', 'data');
const STATE = path.join(DATA, 'state.json');

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).slice(1);
  return rows.map((line, index) => {
    const [company = '', role = '', location = ''] = line.split(',').map(v => v.trim());
    return { id: `pref-${index + 1}`, company, role, location, active: true };
  }).filter(row => row.company);
}

function initialState() {
  return {
    profile: { name: '', phone: '', email: '', timezone: 'America/New_York', onboardingComplete: false },
    preferences: parseCsv(fs.readFileSync(path.join(DATA, 'preferences.csv'), 'utf8')),
    jobs: [],
    events: [],
    lastScanAt: null,
    lastDigestAt: null
  };
}

function read() {
  if (!fs.existsSync(STATE)) return initialState();
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); }
  catch { return initialState(); }
}

function write(state) {
  const temporary = `${STATE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
  fs.renameSync(temporary, STATE);
  return state;
}

function event(state, type, message) {
  state.events.unshift({ id: crypto.randomUUID(), type, message, at: new Date().toISOString() });
  state.events = state.events.slice(0, 50);
}

module.exports = { read, write, event };
