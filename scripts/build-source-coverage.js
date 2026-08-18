const fs = require('node:fs');
const path = require('node:path');
const { fromFile } = require('../lib/preferences');

const root = path.join(__dirname, '..');
const preferences = fromFile(path.join(root, 'data', 'preferences.csv'));
const sources = JSON.parse(fs.readFileSync(path.join(root, 'data', 'sources.json'), 'utf8'));
const direct = new Map(sources.filter(source => source.company).map(source => [source.company.toLowerCase(), source]));
const fallback = sources.find(source => source.coverage === 'all-target-companies');
const companies = preferences.companies.map(company => {
  const source = direct.get(company.toLowerCase());
  return { company, direct: Boolean(source), provider: source?.type || null, fallback: Boolean(fallback) };
});
const outputPath = path.join(root, 'public', 'source-coverage.json');
const previous = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : null;
const content = { targetCompanies: companies.length, directCompanies: companies.filter(item => item.direct).length,
  fallbackEnabled: Boolean(fallback), fallbackName: fallback?.name || null, companies };
const unchanged = previous && JSON.stringify({ ...previous, generatedAt: undefined }) === JSON.stringify({ ...content, generatedAt: undefined });
const report = { generatedAt: unchanged ? previous.generatedAt : new Date().toISOString(), ...content };
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Built source coverage: ${report.directCompanies} direct feeds; fallback ${report.fallbackEnabled ? 'enabled' : 'disabled'} for ${report.targetCompanies} targets`);
