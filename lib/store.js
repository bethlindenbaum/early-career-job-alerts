const fs = require('node:fs');
const path = require('node:path');
const { fromFile } = require('./preferences');

const DATA = path.join(__dirname, '..', 'data');
const STATE = path.join(DATA, 'state.json');

function initialState() {
  return {
    profile: { name: '', phone: '', email: '', timezone: 'America/New_York', onboardingComplete: false },
    preferences: fromFile(path.join(DATA, 'preferences.csv')),
    jobs: [],
    events: [],
    lastScanAt: null,
    lastDigestAt: null
  };
}

function read() {
  if (!fs.existsSync(STATE)) return initialState();
  try {
    const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    if (Array.isArray(state.preferences)) state.preferences = {
      companies: [...new Set(state.preferences.map(item => item.company).filter(Boolean))],
      roles: [...new Set(state.preferences.map(item => item.role).filter(Boolean))],
      locations: [...new Set(state.preferences.map(item => item.location).filter(Boolean))]
    };
    return state;
  }
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
