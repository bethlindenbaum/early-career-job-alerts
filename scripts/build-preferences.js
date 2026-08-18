const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'data', 'preferences.csv');
const target = path.join(__dirname, '..', 'public', 'preferences.json');
const preferences = fs.readFileSync(source, 'utf8').trim().split(/\r?\n/).slice(1).map((line, index) => {
  const [company = '', role = '', location = ''] = line.split(',').map(value => value.trim());
  return { id: `pref-${index + 1}`, company, role, location, active: true };
}).filter(item => item.company);
fs.writeFileSync(target, `${JSON.stringify(preferences, null, 2)}\n`);
console.log(`Built ${preferences.length} browser preferences`);
