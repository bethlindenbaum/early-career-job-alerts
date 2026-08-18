const fs = require('node:fs');
const path = require('node:path');
const { fromFile, toCsv, unique, CATEGORIES } = require('../lib/preferences');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.log('Supabase sync skipped: credentials are not configured.'); process.exit(0); }

const csvPath = path.join(__dirname, '..', 'data', 'preferences.csv');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

(async () => {
  const response = await fetch(`${url}/rest/v1/target_changes?select=id,action,category,value,created_at&order=created_at.asc`, { headers });
  if (!response.ok) throw new Error(`Could not load target changes: ${response.status} ${await response.text()}`);
  const changes = await response.json();
  if (!changes.length) { console.log('No website target changes to synchronize.'); return; }
  const preferences = fromFile(csvPath);
  for (const change of changes) {
    if (!CATEGORIES.includes(change.category)) continue;
    if (change.action === 'add') preferences[change.category] = unique([...preferences[change.category], change.value.trim()]);
    if (change.action === 'remove') preferences[change.category] = preferences[change.category].filter(value => value.toLowerCase() !== change.value.trim().toLowerCase());
  }
  fs.writeFileSync(csvPath, toCsv(preferences));
  fs.writeFileSync(path.join(__dirname, '..', '.target-change-ids.json'), JSON.stringify(changes.map(change => change.id)));
  console.log(`Applied ${changes.length} website target change${changes.length === 1 ? '' : 's'} to the CSV.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
