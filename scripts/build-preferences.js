const fs = require('node:fs');
const path = require('node:path');
const { fromFile } = require('../lib/preferences');

const source = path.join(__dirname, '..', 'data', 'preferences.csv');
const target = path.join(__dirname, '..', 'public', 'preferences.json');
const preferences = fromFile(source);
fs.writeFileSync(target, `${JSON.stringify(preferences, null, 2)}\n`);
console.log(`Built ${preferences.companies.length} companies, ${preferences.roles.length} roles, and ${preferences.locations.length} locations`);
