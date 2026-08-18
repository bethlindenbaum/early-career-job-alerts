const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', '.target-change-ids.json');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key || !fs.existsSync(file)) process.exit(0);
const ids = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!ids.length) process.exit(0);

(async () => {
  const response = await fetch(`${url}/rest/v1/target_changes?id=in.(${ids.join(',')})`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Could not clear synchronized target changes: ${response.status}`);
  console.log(`Cleared ${ids.length} synchronized website change${ids.length === 1 ? '' : 's'}.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
