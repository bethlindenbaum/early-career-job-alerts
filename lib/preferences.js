const fs = require('node:fs');

const CATEGORIES = ['companies', 'roles', 'locations'];
const COLUMN_MAP = { Companies: 'companies', Roles: 'roles', Locations: 'locations' };

function unique(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',').map(value => value.trim());
  const result = { companies: [], roles: [], locations: [] };
  for (const line of lines) {
    const columns = line.split(',').map(value => value.trim());
    headers.forEach((header, index) => {
      const category = COLUMN_MAP[header];
      if (category && columns[index]) result[category].push(columns[index]);
    });
  }
  for (const category of CATEGORIES) result[category] = unique(result[category]);
  return result;
}

function toCsv(preferences) {
  const length = Math.max(...CATEGORIES.map(category => preferences[category]?.length || 0));
  const rows = ['Companies,Roles,Locations'];
  for (let index = 0; index < length; index += 1) {
    rows.push(CATEGORIES.map(category => preferences[category]?.[index] || '').join(','));
  }
  return `${rows.join('\n')}\n`;
}

function fromFile(file) { return parseCsv(fs.readFileSync(file, 'utf8')); }
function entries(preferences) {
  return CATEGORIES.flatMap(category => (preferences[category] || []).map((value, index) => ({ id: `${category}-${index + 1}`, category, value, active: true })));
}

module.exports = { CATEGORIES, parseCsv, toCsv, fromFile, entries, unique };
